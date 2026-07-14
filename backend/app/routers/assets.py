from typing import Optional, List
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


@router.get("", response_model=FixedAssetListResponse)
def list_assets(
    year_ref: Optional[int] = None,
    category: Optional[str] = None,
    group_name: Optional[str] = None,
    site_location: Optional[str] = None,
    job: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
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
        FixedAsset.asset_no == payload.asset_no,
        FixedAsset.year_ref == (payload.year_ref or 2026),
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Asset no '{payload.asset_no}' already exists")

    asset = FixedAsset(**payload.model_dump())
    db.add(asset)
    db.flush()
    recalculate_asset(db, asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/{asset_id}", response_model=FixedAssetResponse)
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = (
        db.query(FixedAsset)
        .options(joinedload(FixedAsset.depreciation_monthly))
        .filter(FixedAsset.id == asset_id)
        .first()
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.put("/{asset_id}", response_model=FixedAssetResponse)
def update_asset(asset_id: int, payload: FixedAssetUpdate, db: Session = Depends(get_db)):
    asset = db.query(FixedAsset).filter(FixedAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(asset, key, value)

    recalculate_asset(db, asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=204)
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.query(FixedAsset).filter(FixedAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    db.delete(asset)
    db.commit()


@router.get("/{asset_id}/depreciation", response_model=List[DepreciationMonthlyResponse])
def get_asset_depreciation(
    asset_id: int,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    asset = db.query(FixedAsset).filter(FixedAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    query = db.query(DepreciationMonthly).filter(DepreciationMonthly.asset_id == asset_id)
    if year:
        query = query.filter(DepreciationMonthly.year == year)
    return query.order_by(DepreciationMonthly.year, DepreciationMonthly.month).all()
