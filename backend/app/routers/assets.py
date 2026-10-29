from typing import Optional, List, Union
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from app.database import get_db
from app.models.fixed_asset import FixedAsset
from app.models.depreciation_monthly import DepreciationMonthly
from app.schemas.fixed_asset import (
    FixedAssetCreate,
    FixedAssetUpdate,
    FixedAssetResponse,
    FixedAssetListResponse,
)
from app.schemas.depreciation_monthly import DepreciationMonthlyResponse
from app.services.depreciation import recalculate_asset

router = APIRouter(prefix="/assets", tags=["assets"])


def split_values(raw: str) -> List[str]:
    """Accepts a single value or a comma-separated list (used by the header filters)."""
    return [part.strip() for part in raw.split(",") if part.strip()]


def apply_text_filter(query, column, raw: str):
    """Filters a text column, treating the UNKNOWN sentinel as "no value".

    The summary endpoints bucket assets without a value under "UNKNOWN", so a
    drill-down on that bucket has to look for NULL rather than the literal text.
    """
    values = split_values(raw)
    unknown = [value for value in values if value.upper() == "UNKNOWN"]
    known = [value for value in values if value.upper() != "UNKNOWN"]

    conditions = []
    if known:
        conditions.append(column.in_(known))
    if unknown:
        conditions.append(column.is_(None))
    if not conditions:
        return query
    return query.filter(or_(*conditions))


def get_asset_by_key(key: str, db: Session) -> FixedAsset:
    """Lookup asset by fixed_asset_number_ax (e.g. BLD000048).
    Falls back to integer id for assets without an AX number."""
    # Try fixed_asset_number_ax first
    asset = (
        db.query(FixedAsset)
        .options(joinedload(FixedAsset.depreciation_monthly))
        .filter(FixedAsset.fixed_asset_number_ax == key)
        .first()
    )
    if asset:
        return asset
    # Fallback: try integer id
    if key.isdigit():
        asset = (
            db.query(FixedAsset)
            .options(joinedload(FixedAsset.depreciation_monthly))
            .filter(FixedAsset.id == int(key))
            .first()
        )
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset '{key}' not found")
    return asset


@router.get("/meta")
def asset_meta(
    year_ref: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Distinct values that populate the asset form controls.

    Hard-coded option lists drift away from the data (a group spelled
    "Tools, Furniture & Fixtures" simply could not be matched by a list holding
    "Tools Furniture Fixtures"), so the form asks the database instead.
    """

    def distinct(column) -> List[str]:
        query = db.query(column).filter(column.isnot(None), column != "")
        if year_ref:
            query = query.filter(FixedAsset.year_ref == year_ref)
        rows = query.distinct().all()
        return sorted({str(row[0]) for row in rows}, key=str.casefold)

    return {
        "groups": distinct(FixedAsset.group_name),
        "categories": distinct(FixedAsset.category),
        "sites": distinct(FixedAsset.site_location),
        "jobs": distinct(FixedAsset.job),
        "years": [row[0] for row in db.query(FixedAsset.year_ref).distinct().order_by(FixedAsset.year_ref.desc()).all() if row[0]],
    }


@router.get("/{asset_key}/neighbors")
def asset_neighbors(asset_key: str, db: Session = Depends(get_db)):
    """Previous and next asset in the same fiscal year, ordered by sheet row.

    Powers the detail page's prev/next navigation without pulling the whole
    register down to the browser.
    """
    asset = get_asset_by_key(asset_key, db)
    base = db.query(FixedAsset.id, FixedAsset.fixed_asset_number_ax).filter(
        FixedAsset.year_ref == asset.year_ref
    )

    def key_of(row):
        if row is None:
            return None
        return row.fixed_asset_number_ax or str(row.id)

    previous = (
        base.filter(FixedAsset.no < asset.no).order_by(FixedAsset.no.desc()).first()
        if asset.no is not None
        else None
    )
    following = (
        base.filter(FixedAsset.no > asset.no).order_by(FixedAsset.no.asc()).first()
        if asset.no is not None
        else None
    )
    return {"previous": key_of(previous), "next": key_of(following)}


@router.get("", response_model=FixedAssetListResponse)
def list_assets(
    year_ref: Optional[int] = None,
    category: Optional[str] = None,
    group_name: Optional[str] = None,
    site_location: Optional[str] = None,
    job: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=350),
    db: Session = Depends(get_db),
):
    query = db.query(FixedAsset).options(joinedload(FixedAsset.depreciation_monthly))

    if year_ref:
        query = query.filter(FixedAsset.year_ref == year_ref)
    if category:
        query = apply_text_filter(query, FixedAsset.category, category)
    if group_name:
        query = apply_text_filter(query, FixedAsset.group_name, group_name)
    if site_location:
        query = apply_text_filter(query, FixedAsset.site_location, site_location)
    if job:
        query = apply_text_filter(query, FixedAsset.job, job)
    if search:
        query = query.filter(
            or_(
                FixedAsset.name.ilike(f"%{search}%"),
                FixedAsset.asset_no.ilike(f"%{search}%"),
                FixedAsset.fixed_asset_number_ax.ilike(f"%{search}%"),
            )
        )

    total = query.count()
    items = query.order_by(FixedAsset.no).offset((page - 1) * size).limit(size).all()

    return FixedAssetListResponse(items=items, total=total, page=page, size=size)


@router.post("", response_model=FixedAssetResponse, status_code=201)
def create_asset(payload: FixedAssetCreate, db: Session = Depends(get_db)):
    existing = db.query(FixedAsset).filter(
        FixedAsset.fixed_asset_number_ax == payload.fixed_asset_number_ax,
        FixedAsset.year_ref == (payload.year_ref or 2026),
    ).first() if payload.fixed_asset_number_ax else None
    if existing:
        raise HTTPException(status_code=400, detail=f"Asset no '{payload.asset_no}' already exists")

    asset = FixedAsset(**payload.model_dump())
    db.add(asset)
    db.flush()
    recalculate_asset(db, asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/{asset_key}", response_model=FixedAssetResponse)
def get_asset(asset_key: str, db: Session = Depends(get_db)):
    return get_asset_by_key(asset_key, db)


@router.put("/{asset_key}", response_model=FixedAssetResponse)
def update_asset(asset_key: str, payload: FixedAssetUpdate, db: Session = Depends(get_db)):
    asset = get_asset_by_key(asset_key, db)

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(asset, key, value)

    recalculate_asset(db, asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_key}", status_code=204)
def delete_asset(asset_key: str, db: Session = Depends(get_db)):
    asset = get_asset_by_key(asset_key, db)
    db.delete(asset)
    db.commit()


@router.get("/{asset_key}/depreciation", response_model=List[DepreciationMonthlyResponse])
def get_asset_depreciation(
    asset_key: str,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    asset = get_asset_by_key(asset_key, db)

    query = db.query(DepreciationMonthly).filter(DepreciationMonthly.asset_id == asset.id)
    if year:
        query = query.filter(DepreciationMonthly.year == year)
    return query.order_by(DepreciationMonthly.year, DepreciationMonthly.month).all()
