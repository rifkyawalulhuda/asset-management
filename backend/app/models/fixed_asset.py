from sqlalchemy import Column, Integer, String, Date, Numeric, Boolean, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class FixedAsset(Base):
    __tablename__ = "fixed_assets"

    id = Column(Integer, primary_key=True, index=True)
    no = Column(Integer)
    site_location = Column(String(50))
    job = Column(String(50))
    account_no = Column(Integer)
    category = Column(String(50))
    asset_no = Column(String(50), unique=True, nullable=False, index=True)
    fixed_asset_number_ax = Column(String(50))
    purchase_date = Column(Date)
    group_name = Column(String(100))
    voucher_no = Column(String(50))
    name = Column(String(500), nullable=False)
    maker_type_location = Column(Text)
    capacity_size_user = Column(Text)
    year = Column(Integer)
    police_no = Column(String(50))
    machine_no = Column(String(50))
    chasis_no = Column(String(50))
    quantity = Column(Integer, default=1)
    valas = Column(String(20))
    purchase_price = Column(Numeric(20, 4))
    monthly_depreciation = Column(Numeric(20, 4))
    depreciation_period_total = Column(Integer)
    dep_period_acc_prev_year = Column(Numeric(10, 2))
    dep_period_yearly = Column(Numeric(10, 2))
    dep_period_until_year = Column(Numeric(10, 2))
    dep_period_remain = Column(Numeric(10, 2))
    acc_depreciation_prev = Column(Numeric(20, 4))
    net_book_value_prev = Column(Numeric(20, 4))
    dep_expense_current = Column(Numeric(20, 4))
    acc_depreciation_curr = Column(Numeric(20, 4))
    net_book_value_curr = Column(Numeric(20, 4))
    status_additional = Column(Boolean, default=False)
    status_disposals = Column(Boolean, default=False)
    condition = Column(String(100))
    photo_status = Column(String(20))
    remark = Column(Text)
    year_ref = Column(Integer, default=2026, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    depreciation_monthly = relationship(
        "DepreciationMonthly", back_populates="asset", cascade="all, delete-orphan"
    )
    acquisitions = relationship(
        "AcquisitionDisposal", back_populates="asset"
    )
