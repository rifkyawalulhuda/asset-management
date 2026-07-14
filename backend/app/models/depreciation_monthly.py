from sqlalchemy import Column, Integer, Numeric, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base


class DepreciationMonthly(Base):
    __tablename__ = "depreciation_monthly"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("fixed_assets.id", ondelete="CASCADE"), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    amount = Column(Numeric(20, 4), default=0)

    __table_args__ = (UniqueConstraint("asset_id", "year", "month", name="uq_asset_year_month"),)

    asset = relationship("FixedAsset", back_populates="depreciation_monthly")
