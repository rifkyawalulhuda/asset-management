from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.models.depreciation_monthly import DepreciationMonthly
from app.models.fixed_asset import FixedAsset

MONTHS_IN_YEAR = 12

# Money fields are stored with four decimals; anything below this is rounding noise.
CENT = Decimal("0.01")


def calculate_monthly_depreciation(purchase_price: Decimal, period_total: int) -> Decimal:
    """Straight-line monthly amount. The single definition used everywhere."""
    if not period_total or period_total <= 0:
        return Decimal("0")
    return Decimal(str(purchase_price)) / Decimal(str(period_total))


def months_elapsed(purchase_date: date, target_year: int, target_month: int) -> int:
    """Months from the purchase month up to and including target_month/year."""
    if not purchase_date:
        return 0
    elapsed = (target_year - purchase_date.year) * 12 + (target_month - purchase_date.month) + 1
    return max(0, elapsed)


@dataclass(frozen=True)
class Schedule:
    """Result of the straight-line calculation for one asset and one fiscal year."""

    monthly: Decimal
    months: tuple
    acc_prev: int
    acc_curr: int
    yearly: int
    remain: int
    acc_dep_prev: Decimal
    acc_dep_curr: Decimal
    dep_expense: Decimal
    nbv_prev: Decimal
    nbv_curr: Decimal

    @property
    def total(self) -> Decimal:
        return sum(self.months, Decimal("0"))


def build_schedule(
    purchase_price,
    period_total,
    purchase_date: Optional[date],
    year: int,
) -> Optional[Schedule]:
    """One canonical straight-line schedule.

    Every consumer (write path, forecast, Excel export, integrity checks) goes
    through this function. Before it existed the same formula was copied into
    five places and the copies had already drifted apart, so the same asset
    reported different yearly depreciation on different pages.

    A missing purchase date yields no schedule rather than twelve zero rows:
    writing zeros used to erase a valid monthly table on save.
    """
    if not purchase_price or not period_total:
        return None
    period = int(period_total)
    if period <= 0:
        return None
    if not purchase_date:
        return None

    price = Decimal(str(purchase_price))
    monthly = calculate_monthly_depreciation(price, period)

    acc_prev = min(months_elapsed(purchase_date, year - 1, MONTHS_IN_YEAR), period)
    acc_curr = min(months_elapsed(purchase_date, year, MONTHS_IN_YEAR), period)
    yearly = max(0, acc_curr - acc_prev)
    remain = max(0, period - acc_curr)

    months = tuple(
        monthly if 0 < months_elapsed(purchase_date, year, month) <= period else Decimal("0")
        for month in range(1, MONTHS_IN_YEAR + 1)
    )

    acc_dep_prev = monthly * acc_prev
    acc_dep_curr = monthly * acc_curr

    return Schedule(
        monthly=monthly,
        months=months,
        acc_prev=acc_prev,
        acc_curr=acc_curr,
        yearly=yearly,
        remain=remain,
        acc_dep_prev=acc_dep_prev,
        acc_dep_curr=acc_dep_curr,
        dep_expense=monthly * yearly,
        nbv_prev=max(Decimal("0"), price - acc_dep_prev),
        nbv_curr=max(Decimal("0"), price - acc_dep_curr),
    )


def generate_monthly_rows(db: Session, asset: FixedAsset, year_ref: int) -> None:
    """Replace the asset's monthly rows for one year.

    Nothing is deleted unless a replacement can actually be computed, so an
    asset without a purchase date keeps the schedule it already had.
    """
    schedule = build_schedule(
        asset.purchase_price, asset.depreciation_period_total, asset.purchase_date, year_ref
    )
    if schedule is None:
        return

    db.query(DepreciationMonthly).filter(
        DepreciationMonthly.asset_id == asset.id,
        DepreciationMonthly.year == year_ref,
    ).delete()

    for month, amount in enumerate(schedule.months, start=1):
        db.add(
            DepreciationMonthly(
                asset_id=asset.id,
                year=year_ref,
                month=month,
                amount=amount,
            )
        )

    db.flush()


def recalculate_summary_fields(asset: FixedAsset, year_ref: int) -> None:
    """Refresh the derived columns in place from the canonical schedule."""
    schedule = build_schedule(
        asset.purchase_price, asset.depreciation_period_total, asset.purchase_date, year_ref
    )
    if schedule is None:
        # Without a purchase date only the monthly amount is knowable. The other
        # columns keep whatever the workbook said instead of being zeroed.
        if asset.purchase_price and asset.depreciation_period_total:
            asset.monthly_depreciation = calculate_monthly_depreciation(
                asset.purchase_price, int(asset.depreciation_period_total)
            )
        return

    asset.monthly_depreciation = schedule.monthly
    asset.dep_period_acc_prev_year = Decimal(str(schedule.acc_prev))
    asset.dep_period_yearly = Decimal(str(schedule.yearly))
    asset.dep_period_until_year = Decimal(str(schedule.acc_curr))
    asset.dep_period_remain = Decimal(str(schedule.remain))
    asset.acc_depreciation_prev = schedule.acc_dep_prev
    asset.net_book_value_prev = schedule.nbv_prev
    asset.dep_expense_current = schedule.dep_expense
    asset.acc_depreciation_curr = schedule.acc_dep_curr
    asset.net_book_value_curr = schedule.nbv_curr


def recalculate_asset(db: Session, asset: FixedAsset) -> None:
    """Recalculate all derived fields and regenerate monthly rows."""
    year_ref = asset.year_ref or 2026
    recalculate_summary_fields(asset, year_ref)
    generate_monthly_rows(db, asset, year_ref)


def monthly_matches_price(asset: FixedAsset) -> bool:
    """True when the stored monthly amount equals price ÷ period.

    Catches rows copied from a neighbouring spreadsheet row, where the monthly
    amount belongs to a different asset.
    """
    if not asset.purchase_price or not asset.depreciation_period_total:
        return True
    if asset.monthly_depreciation is None:
        return False
    expected = calculate_monthly_depreciation(asset.purchase_price, int(asset.depreciation_period_total))
    return abs(Decimal(str(asset.monthly_depreciation)) - expected) <= CENT
