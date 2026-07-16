from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field


class PlannedAssetBase(BaseModel):
    forecast_year: int
    site_location: Optional[str] = None
    job: Optional[str] = None
    category: Optional[str] = None
    group_name: Optional[str] = None
    name: str
    purchase_price: Optional[Decimal] = None
    depreciation_period_total: Optional[int] = None
    planned_purchase_month: int = Field(..., ge=1, le=12)
    planned_purchase_year: int = Field(..., ge=2025)


class PlannedAssetCreate(PlannedAssetBase):
    pass


class PlannedAssetUpdate(BaseModel):
    site_location: Optional[str] = None
    job: Optional[str] = None
    category: Optional[str] = None
    group_name: Optional[str] = None
    name: Optional[str] = None
    purchase_price: Optional[Decimal] = None
    depreciation_period_total: Optional[int] = None
    planned_purchase_month: Optional[int] = Field(None, ge=1, le=12)
    planned_purchase_year: Optional[int] = Field(None, ge=2025)


class PlannedAssetResponse(PlannedAssetBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
