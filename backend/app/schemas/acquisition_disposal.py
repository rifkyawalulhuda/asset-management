from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class AcquisitionDisposalBase(BaseModel):
    asset_id: Optional[int] = None
    site: Optional[str] = None
    job: Optional[str] = None
    fixed_asset_no: Optional[str] = None
    application: Optional[str] = None
    transaction_date: Optional[date] = None
    bookslip_no: Optional[str] = None
    asset_name: Optional[str] = None
    price: Optional[Decimal] = None
    status: Optional[str] = None
    vendor_customer: Optional[str] = None
    year_ref: Optional[int] = None


class AcquisitionDisposalCreate(AcquisitionDisposalBase):
    pass


class AcquisitionDisposalUpdate(AcquisitionDisposalBase):
    pass


class AcquisitionDisposalResponse(AcquisitionDisposalBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
