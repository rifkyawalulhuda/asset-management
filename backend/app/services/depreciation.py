from datetime import date
from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session
from app.models.fixed_asset import FixedAsset
from app.models.depreciation_monthly import DepreciationMonthly


def calculate_monthly_depreciation(purchase_price: Decimal, period_total: int) -> Decimal:
    """Calculate monthly depreciation using straight-line method."""
    if not period_total or period_total <= 0:
        return Decimal("0")
    return Decimal(str(purchase_price)) / Decimal(str(period_total))


def months_elapsed(purchase_date: date, target_year: int, target_month: int) -> int:
    """Calculate number of months from purchase_date up to and including target_month/year."""
    if not purchase_date:
        return 0
    start_year = purchase_date.year
    start_month = purchase_date.month
    elapsed = (target_year - start_year) * 12 + (target_month - start_month) + 1
    return max(0, elapsed)


def generate_monthly_rows(
    db: Session,
    asset: FixedAsset,
    year_ref: int,
):
    """Generate or regenerate depreciation_monthly rows for an asset for the given year."""
    if not asset.purchase_price or not asset.depreciation_period_total:
        return

    monthly_amount = calculate_monthly_depreciation(
        asset.purchase_price, asset.depreciation_period_total
    )

    # Delete existing rows for this asset + year
    db.query(DepreciationMonthly).filter(
        DepreciationMonthly.asset_id == asset.id,
        DepreciationMonthly.year == year_ref,
    ).delete()

    for month in range(1, 13):
        elapsed = months_elapsed(asset.purchase_date, year_ref, month)
        # Only depreciate if within depreciation period
        if 0 < elapsed <= asset.depreciation_period_total:
            amount = monthly_amount
        else:
            amount = Decimal("0")

        row = DepreciationMonthly(
            asset_id=asset.id,
            year=year_ref,
            month=month,
            amount=amount,
        )
        db.add(row)

    db.flush()


def recalculate_asset(db: Session, asset: FixedAsset):
    """Recalculate derived fields and regenerate monthly rows."""
    if asset.purchase_price and asset.depreciation_period_total:
        asset.monthly_depreciation = calculate_monthly_depreciation(
            asset.purchase_price, asset.depreciation_period_total
        )
    generate_monthly_rows(db, asset, asset.year_ref or 2026)
