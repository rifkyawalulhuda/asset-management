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
        query = query.filter(FixedAsset.category == category)
    if group_name:
        query = query.filter(FixedAsset.group_name == group_name)
    if site_location:
        query = query.filter(FixedAsset.site_location == site_location)
    if job:
        query = query.filter(FixedAsset.job == job)
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
