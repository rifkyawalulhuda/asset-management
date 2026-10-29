from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, field_validator


def _clamp_non_negative(value: Optional[Decimal]) -> Optional[Decimal]:
    """Net book value can never be negative.

    Rounding the monthly amount to four decimals left a handful of assets a few
    cents below zero; the write path already floors at zero, so the read path
    does the same instead of showing a negative carrying value.
    """
    if value is None:
        return None
    return value if value >= 0 else Decimal("0")


class DepreciationMonthlyResponse(BaseModel):
    id: int
    asset_id: int
    year: int
    month: int
    amount: Optional[Decimal] = None

    model_config = {"from_attributes": True}


class FixedAssetBase(BaseModel):
    no: Optional[int] = None
    site_location: Optional[str] = None
    job: Optional[str] = None
    account_no: Optional[int] = None
    category: Optional[str] = None
    asset_no: str
    fixed_asset_number_ax: Optional[str] = None
    purchase_date: Optional[date] = None
    group_name: Optional[str] = None
    voucher_no: Optional[str] = None
    name: str
    maker_type_location: Optional[str] = None
    capacity_size_user: Optional[str] = None
    year: Optional[int] = None
    police_no: Optional[str] = None
    machine_no: Optional[str] = None
    chasis_no: Optional[str] = None
    quantity: Optional[int] = 1
    valas: Optional[str] = None
    purchase_price: Optional[Decimal] = None
    monthly_depreciation: Optional[Decimal] = None
    depreciation_period_total: Optional[int] = None
    dep_period_acc_prev_year: Optional[Decimal] = None
    dep_period_yearly: Optional[Decimal] = None
    dep_period_until_year: Optional[Decimal] = None
    dep_period_remain: Optional[Decimal] = None
    acc_depreciation_prev: Optional[Decimal] = None
    net_book_value_prev: Optional[Decimal] = None
    dep_expense_current: Optional[Decimal] = None
    acc_depreciation_curr: Optional[Decimal] = None
    net_book_value_curr: Optional[Decimal] = None
    status_additional: Optional[bool] = False
    status_disposals: Optional[bool] = False
    condition: Optional[str] = None
    photo_status: Optional[str] = None
    remark: Optional[str] = None
    year_ref: Optional[int] = 2026


class FixedAssetCreate(FixedAssetBase):
    pass


class FixedAssetUpdate(BaseModel):
    no: Optional[int] = None
    site_location: Optional[str] = None
    job: Optional[str] = None
    account_no: Optional[int] = None
    category: Optional[str] = None
    asset_no: Optional[str] = None
    fixed_asset_number_ax: Optional[str] = None
    purchase_date: Optional[date] = None
    group_name: Optional[str] = None
    voucher_no: Optional[str] = None
    name: Optional[str] = None
    maker_type_location: Optional[str] = None
    capacity_size_user: Optional[str] = None
    year: Optional[int] = None
    police_no: Optional[str] = None
    machine_no: Optional[str] = None
    chasis_no: Optional[str] = None
    quantity: Optional[int] = None
    valas: Optional[str] = None
    purchase_price: Optional[Decimal] = None
    monthly_depreciation: Optional[Decimal] = None
    depreciation_period_total: Optional[int] = None
    dep_period_acc_prev_year: Optional[Decimal] = None
    dep_period_yearly: Optional[Decimal] = None
    dep_period_until_year: Optional[Decimal] = None
    dep_period_remain: Optional[Decimal] = None
    acc_depreciation_prev: Optional[Decimal] = None
    net_book_value_prev: Optional[Decimal] = None
    dep_expense_current: Optional[Decimal] = None
    acc_depreciation_curr: Optional[Decimal] = None
    net_book_value_curr: Optional[Decimal] = None
    status_additional: Optional[bool] = None
    status_disposals: Optional[bool] = None
    condition: Optional[str] = None
    photo_status: Optional[str] = None
    remark: Optional[str] = None
    year_ref: Optional[int] = None


class FixedAssetResponse(FixedAssetBase):
    id: int
    is_active: Optional[bool] = True
    last_seen_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    depreciation_monthly: List[DepreciationMonthlyResponse] = []

    model_config = {"from_attributes": True}

    @field_validator("net_book_value_prev", "net_book_value_curr", mode="after")
    @classmethod
    def clamp_net_book_value(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        return _clamp_non_negative(value)


class FixedAssetListResponse(BaseModel):
    items: List[FixedAssetResponse]
    total: int
    page: int
    size: int
