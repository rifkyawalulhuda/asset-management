from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.planned_asset import PlannedAsset
from app.schemas.planned_asset import PlannedAssetCreate, PlannedAssetUpdate, PlannedAssetResponse

router = APIRouter(prefix="/planned-assets", tags=["planned-assets"])


@router.get("", response_model=List[PlannedAssetResponse])
def list_planned_assets(
    forecast_year: Optional[int] = None,
    site_location: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List all planned assets, optionally filtered by forecast_year and site_location."""
    q = db.query(PlannedAsset)
    if forecast_year:
        q = q.filter(PlannedAsset.forecast_year == forecast_year)
    if site_location:
        q = q.filter(PlannedAsset.site_location == site_location)
    return q.order_by(PlannedAsset.forecast_year, PlannedAsset.id).all()


@router.post("", response_model=PlannedAssetResponse, status_code=201)
def create_planned_asset(
    payload: PlannedAssetCreate,
    db: Session = Depends(get_db),
):
    """Create a new planned asset."""
    asset = PlannedAsset(**payload.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.put("/{asset_id}", response_model=PlannedAssetResponse)
def update_planned_asset(
    asset_id: int,
    payload: PlannedAssetUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing planned asset."""
    asset = db.query(PlannedAsset).filter(PlannedAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail=f"Planned asset {asset_id} not found")
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(asset, key, value)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=204)
def delete_planned_asset(
    asset_id: int,
    db: Session = Depends(get_db),
):
    """Delete a planned asset."""
    asset = db.query(PlannedAsset).filter(PlannedAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail=f"Planned asset {asset_id} not found")
    db.delete(asset)
    db.commit()
