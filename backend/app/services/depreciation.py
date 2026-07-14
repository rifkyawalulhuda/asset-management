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


def recalculate_summary_fields(asset: FixedAsset, year_ref: int) -> None:
    """
    Recalculate all depreciation summary fields in-place using straight-line method.
    Requires: purchase_price, depreciation_period_total, purchase_date, year_ref
    """
    if not asset.purchase_price or not asset.depreciation_period_total:
        return

    price = Decimal(str(asset.purchase_price))
    period_total = int(asset.depreciation_period_total)
    monthly = price / Decimal(str(period_total))
    asset.monthly_depreciation = monthly

    if not asset.purchase_date:
        # No purchase_date — only set monthly_depreciation, skip period fields
        return

    prev_year = year_ref - 1

    # Months elapsed from purchase_date up to end of prev_year (Dec prev_year)
    acc_prev = months_elapsed(asset.purchase_date, prev_year, 12)
    acc_prev = min(acc_prev, period_total)  # cap at total

    # Months active in current year_ref
    # = months elapsed up to Dec year_ref minus months up to Dec prev_year
    acc_curr_end = months_elapsed(asset.purchase_date, year_ref, 12)
    acc_curr_end = min(acc_curr_end, period_total)
    yearly = max(0, acc_curr_end - acc_prev)

    remain = max(0, period_total - acc_curr_end)

    asset.dep_period_acc_prev_year = Decimal(str(acc_prev))
    asset.dep_period_yearly        = Decimal(str(yearly))
    asset.dep_period_until_year    = Decimal(str(acc_curr_end))
    asset.dep_period_remain        = Decimal(str(remain))

    # Book values
    acc_dep_prev = monthly * Decimal(str(acc_prev))
    acc_dep_curr = monthly * Decimal(str(acc_curr_end))

    asset.acc_depreciation_prev = acc_dep_prev
    asset.net_book_value_prev   = max(Decimal("0"), price - acc_dep_prev)
    asset.dep_expense_current   = monthly * Decimal(str(yearly))
    asset.acc_depreciation_curr = acc_dep_curr
    asset.net_book_value_curr   = max(Decimal("0"), price - acc_dep_curr)


def recalculate_asset(db: Session, asset: FixedAsset):
    """Recalculate all derived fields and regenerate monthly rows."""
    year_ref = asset.year_ref or 2026
    recalculate_summary_fields(asset, year_ref)
    generate_monthly_rows(db, asset, year_ref)
