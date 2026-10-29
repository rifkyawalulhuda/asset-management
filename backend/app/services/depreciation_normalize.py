"""Put the stored depreciation columns back on the full-year convention.

The workbook's summary columns are a snapshot taken when the file was closed
(2026 was closed at September), while its monthly columns run the whole year.
Writing both verbatim leaves two different yearly figures for the same assets.

This module rebuilds the summary columns from the monthly schedule, which is the
authoritative record, and trims a schedule that charges past the end of the
useful life. It runs after every import and is also available as a CLI:

    python -m scripts.normalize_depreciation --confirm
"""
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.depreciation_monthly import DepreciationMonthly
from app.models.fixed_asset import FixedAsset

CENT = Decimal("0.01")

NORMALISED_FIELDS = (
    "monthly_depreciation",
    "dep_period_yearly",
    "dep_period_until_year",
    "dep_period_remain",
    "dep_expense_current",
    "acc_depreciation_curr",
    "net_book_value_curr",
    "net_book_value_prev",
)


def load_schedules(db: Session) -> Dict[Tuple[int, int], Dict[int, Decimal]]:
    rows: Dict[Tuple[int, int], Dict[int, Decimal]] = {}
    for row in db.query(DepreciationMonthly).all():
        rows.setdefault((row.asset_id, row.year), {})[row.month] = Decimal(str(row.amount or 0))
    return rows


def allowed_months(asset: FixedAsset) -> Optional[int]:
    """How many months of the fiscal year the asset may still be depreciated."""
    if not asset.depreciation_period_total:
        return None
    period = int(asset.depreciation_period_total)

    acc_prev_months = asset.dep_period_acc_prev_year
    if acc_prev_months is None:
        if asset.purchase_date and asset.purchase_date.year >= (asset.year_ref or 2026):
            acc_prev_months = 0
        else:
            return None
    acc_prev_months = int(Decimal(str(acc_prev_months)))

    return max(0, min(12, period - acc_prev_months))


def cap_at_cost(asset: FixedAsset, amounts: Dict[int, Decimal]) -> Dict[int, Decimal]:
    """Remove the last cent of over-depreciation caused by 4-decimal rounding."""
    if not asset.purchase_price:
        return amounts
    price = Decimal(str(asset.purchase_price))

    acc_prev_value = asset.acc_depreciation_prev
    if acc_prev_value is None:
        if not asset.depreciation_period_total or asset.dep_period_acc_prev_year is None:
            return amounts
        monthly = price / Decimal(str(int(asset.depreciation_period_total)))
        acc_prev_value = monthly * Decimal(str(int(Decimal(str(asset.dep_period_acc_prev_year)))))
    acc_prev_value = Decimal(str(acc_prev_value))

    total = sum(amounts.values(), Decimal("0"))
    overage = (acc_prev_value + total) - price
    if overage <= Decimal("0"):
        return amounts

    adjusted = dict(amounts)
    charged = [month for month, amount in adjusted.items() if amount > 0]
    if not charged:
        return amounts
    last = max(charged)
    adjusted[last] = max(Decimal("0"), adjusted[last] - overage)
    return adjusted


def target_values(asset: FixedAsset, amounts: Dict[int, Decimal]) -> Optional[Dict[str, Decimal]]:
    """What the summary columns should say, given the monthly schedule."""
    if not asset.purchase_price or not asset.depreciation_period_total:
        return None
    price = Decimal(str(asset.purchase_price))
    period = int(asset.depreciation_period_total)
    if period <= 0:
        return None

    monthly = price / period
    yearly = sum(1 for amount in amounts.values() if amount > 0)
    expense = sum(amounts.values(), Decimal("0"))

    acc_prev_months = asset.dep_period_acc_prev_year
    if acc_prev_months is None:
        if asset.purchase_date and asset.purchase_date.year >= (asset.year_ref or 2026):
            acc_prev_months = 0
        else:
            return None
    acc_prev_months = int(Decimal(str(acc_prev_months)))

    acc_prev_value = asset.acc_depreciation_prev
    if acc_prev_value is None:
        acc_prev_value = monthly * acc_prev_months
    acc_prev_value = Decimal(str(acc_prev_value))

    until = min(period, acc_prev_months + yearly)
    remain = max(0, period - until)
    # Accumulated depreciation can never exceed cost, not even by a rounding cent.
    acc_curr = min(price, acc_prev_value + expense)
    nbv_curr = max(Decimal("0"), price - acc_curr)
    nbv_prev = max(Decimal("0"), price - acc_prev_value)

    return {
        "monthly_depreciation": monthly,
        "dep_period_yearly": Decimal(yearly),
        "dep_period_until_year": Decimal(until),
        "dep_period_remain": Decimal(remain),
        "dep_expense_current": expense,
        "acc_depreciation_curr": acc_curr,
        "net_book_value_curr": nbv_curr,
        "net_book_value_prev": nbv_prev,
    }


def differs(asset: FixedAsset, target: Dict[str, Decimal]) -> bool:
    for field, value in target.items():
        current = getattr(asset, field)
        if current is None:
            return True
        if abs(Decimal(str(current)) - Decimal(str(value))) > CENT:
            return True
    return False


def normalize_year(db: Session, year: int, assets: Optional[List[FixedAsset]] = None) -> Dict[str, int]:
    """Rewrite one fiscal year's summary columns and trim over-long schedules.

    Returns counts so an import can report what it adjusted.
    """
    schedules = load_schedules(db)
    if assets is None:
        assets = db.query(FixedAsset).filter(FixedAsset.year_ref == year).all()

    stats = {"updated": 0, "truncated": 0, "non_depreciable_fixed": 0}

    for asset in assets:
        if (asset.year_ref or 2026) != year:
            continue
        amounts = schedules.get((asset.id, year))
        if not amounts:
            continue

        # Nothing is depreciated when there is no useful life, so the carrying
        # value is the cost. Some workbook rows (construction in process) left the
        # NBV at zero while still reporting a price, which broke the balance.
        if not asset.depreciation_period_total and asset.purchase_price:
            price = Decimal(str(asset.purchase_price))
            current_nbv = asset.net_book_value_curr
            current_acc = asset.acc_depreciation_curr
            wrong = (current_nbv is None or abs(Decimal(str(current_nbv)) - price) > CENT) or current_acc is None
            if wrong:
                asset.acc_depreciation_curr = Decimal("0")
                asset.acc_depreciation_prev = Decimal("0")
                asset.net_book_value_curr = price
                asset.net_book_value_prev = price
                stats["non_depreciable_fixed"] += 1
            continue

        limit = allowed_months(asset)
        trimmed = amounts
        if limit is not None:
            trimmed = {month: (Decimal("0") if month > limit else amount) for month, amount in amounts.items()}
        trimmed = cap_at_cost(asset, trimmed)

        if any(trimmed[month] != amounts[month] for month in amounts):
            for month, amount in trimmed.items():
                db.query(DepreciationMonthly).filter(
                    DepreciationMonthly.asset_id == asset.id,
                    DepreciationMonthly.year == year,
                    DepreciationMonthly.month == month,
                ).update({DepreciationMonthly.amount: amount}, synchronize_session=False)
            stats["truncated"] += 1
            amounts = trimmed

        target = target_values(asset, amounts)
        if target is None:
            continue
        if differs(asset, target):
            for field, value in target.items():
                setattr(asset, field, value)
            stats["updated"] += 1

    return stats