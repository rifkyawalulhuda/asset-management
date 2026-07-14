from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class DepreciationMonthlyResponse(BaseModel):
    id: int
    asset_id: int
    year: int
    month: int
    amount: Optional[Decimal] = None

    model_config = {"from_attributes": True}
