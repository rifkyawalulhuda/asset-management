from sqlalchemy import Column, Integer, String, Numeric, DateTime
from sqlalchemy.sql import func
from app.database import Base


class PlannedAsset(Base):
    __tablename__ = "planned_assets"

    id = Column(Integer, primary_key=True, index=True)
    forecast_year = Column(Integer, nullable=False, index=True)
    site_location = Column(String(50))
    job = Column(String(50))
    category = Column(String(50))
    group_name = Column(String(100))
    name = Column(String(500), nullable=False)
    purchase_price = Column(Numeric(20, 4))
    depreciation_period_total = Column(Integer)
    planned_purchase_month = Column(Integer, nullable=False)  # 1-12
    planned_purchase_year = Column(Integer, nullable=False)   # e.g. 2027
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
