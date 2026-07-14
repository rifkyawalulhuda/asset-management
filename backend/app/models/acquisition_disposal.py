from sqlalchemy import Column, Integer, String, Date, Numeric, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class AcquisitionDisposal(Base):
    __tablename__ = "acquisition_disposals"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("fixed_assets.id"), nullable=True)
    site = Column(String(50))
    job = Column(String(50))
    fixed_asset_no = Column(String(50))
    application = Column(String(200))
    transaction_date = Column(Date)
    bookslip_no = Column(String(50))
    asset_name = Column(String(500))
    price = Column(Numeric(20, 4))
    status = Column(String(50))
    vendor_customer = Column(String(200))
    year_ref = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())

    asset = relationship("FixedAsset", back_populates="acquisitions")
