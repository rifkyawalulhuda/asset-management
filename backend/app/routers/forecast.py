from typing import Optional, Dict, Any, List
from decimal import Decimal
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.fixed_asset import FixedAsset

router = APIRouter(prefix="/forecast", tags=["forecast"])

MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]


def months_elapsed(purchase_date: date, target_year: int, target_month: int) -> int:
    """Months elapsed from purchase_date up to end of target_month/year (inclusive)."""
    sy = purchase_date.year
    sm = purchase_date.month
    elapsed = (target_year - sy) * 12 + (target_month - sm) + 1
    return max(0, elapsed)


def calc_asset_forecast(asset: FixedAsset, forecast_year: int) -> Optional[Dict]:
    """
    Calculate forecasted depreciation for a single asset for the given year.
    Returns None if asset has no price/period data.
    """
    if not asset.purchase_price or not asset.depreciation_period_total:
        return None

    price = float(asset.purchase_price)
    period = int(asset.depreciation_period_total)
    if period <= 0:
        return None

    monthly = price / period
    prev_year = forecast_year - 1

    # Months elapsed up to end of prev_year
    if asset.purchase_date:
        acc_prev = min(months_elapsed(asset.purchase_date, prev_year, 12), period)
        acc_curr = min(months_elapsed(asset.purchase_date, forecast_year, 12), period)
    else:
        # No purchase date — cannot determine active months
        acc_prev = 0
        acc_curr = 0

    yearly = max(0, acc_curr - acc_prev)
    remain = max(0, period - acc_curr)

    # Per-month amounts
    month_amounts = []
    for m in range(1, 13):
        if asset.purchase_date:
            elapsed = months_elapsed(asset.purchase_date, forecast_year, m)
            active = 0 < elapsed <= period
        else:
            active = False
        month_amounts.append(monthly if active else 0.0)

    total_year = sum(month_amounts)

    # Book values (projected)
    acc_dep_prev = monthly * acc_prev
    acc_dep_curr = monthly * acc_curr
    nbv_curr = max(0.0, price - acc_dep_curr)

    return {
        "id": asset.id,
        "fixed_asset_number_ax": asset.fixed_asset_number_ax,
        "asset_no": asset.asset_no,
        "name": asset.name,
        "group_name": asset.group_name,
        "category": asset.category,
        "site_location": asset.site_location,
        "job": asset.job,
        "purchase_price": price,
        "purchase_date": str(asset.purchase_date) if asset.purchase_date else None,
        "depreciation_period_total": period,
        "monthly_depreciation": monthly,
        "dep_period_acc_prev_year": acc_prev,
        "dep_period_yearly": yearly,
        "dep_period_until_year": acc_curr,
        "dep_period_remain": remain,
        "acc_depreciation_prev": acc_dep_prev,
        "nbv_prev": max(0.0, price - acc_dep_prev),
        "dep_expense_current": total_year,
        "acc_depreciation_curr": acc_dep_curr,
        "nbv_curr": nbv_curr,
        "months": {MONTHS[i]: month_amounts[i] for i in range(12)},
        "total_year": total_year,
    }


def get_assets(db: Session, site_location: Optional[str], year_ref: int = 2026) -> List[FixedAsset]:
    """Fetch all assets for the base year (2026 is source of truth)."""
    q = db.query(FixedAsset).filter(FixedAsset.year_ref == year_ref)
    if site_location:
        q = q.filter(FixedAsset.site_location == site_location)
    return q.all()


@router.get("/totals")
def forecast_totals(
    forecast_year: int = Query(2027, ge=2026),
    site_location: Optional[str] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Returns overall totals for the forecasted year."""
    assets = get_assets(db, site_location)
    total_assets = len(assets)
    total_purchase = 0.0
    total_yearly_dep = 0.0
    total_acc_dep = 0.0
    total_nbv = 0.0

    for asset in assets:
        fc = calc_asset_forecast(asset, forecast_year)
        if fc:
            total_purchase += fc["purchase_price"]
            total_yearly_dep += fc["dep_expense_current"]
            total_acc_dep += fc["acc_depreciation_curr"]
            total_nbv += fc["nbv_curr"]

    return {
        "forecast_year": forecast_year,
        "total_assets": total_assets,
        "total_purchase_price": total_purchase,
        "total_yearly_depreciation": total_yearly_dep,
        "total_acc_depreciation": total_acc_dep,
        "total_net_book_value": total_nbv,
    }


@router.get("/monthly")
def forecast_monthly(
    forecast_year: int = Query(2027, ge=2026),
    site_location: Optional[str] = None,
    group_by: str = Query("job", pattern="^(job|category|group_name)$"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Returns monthly depreciation totals grouped by job, category, or group_name."""
    assets = get_assets(db, site_location)

    result: Dict[str, Dict] = {}
    for asset in assets:
        fc = calc_asset_forecast(asset, forecast_year)
        if not fc:
            continue

        if group_by == "category":
            key = fc["category"] or "UNKNOWN"
        elif group_by == "group_name":
            key = fc["group_name"] or "UNKNOWN"
        else:
            key = fc["job"] or "UNKNOWN"

        if key not in result:
            result[key] = {m: 0.0 for m in MONTHS}
            result[key]["total"] = 0.0

        for m in MONTHS:
            result[key][m] += fc["months"][m]
        result[key]["total"] += fc["total_year"]

    return result


@router.get("/by-group")
def forecast_by_group(
    forecast_year: int = Query(2027, ge=2026),
    site_location: Optional[str] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Returns yearly depreciation subtotals per group_name for the forecasted year."""
    assets = get_assets(db, site_location)

    result: Dict[str, Dict] = {}
    for asset in assets:
        fc = calc_asset_forecast(asset, forecast_year)
        if not fc:
            continue

        key = fc["group_name"] or "Unknown"
        if key not in result:
            result[key] = {
                "yearly_depreciation": 0.0,
                "purchase_price": 0.0,
                "acc_depreciation": 0.0,
                "net_book_value": 0.0,
                "count": 0,
            }
        result[key]["yearly_depreciation"] += fc["dep_expense_current"]
        result[key]["purchase_price"] += fc["purchase_price"]
        result[key]["acc_depreciation"] += fc["acc_depreciation_curr"]
        result[key]["net_book_value"] += fc["nbv_curr"]
        result[key]["count"] += 1

    return result


@router.get("/by-category")
def forecast_by_category(
    forecast_year: int = Query(2027, ge=2026),
    site_location: Optional[str] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Returns yearly depreciation subtotals per category for the forecasted year."""
    assets = get_assets(db, site_location)

    result: Dict[str, Dict] = {}
    for asset in assets:
        fc = calc_asset_forecast(asset, forecast_year)
        if not fc:
            continue

        key = fc["category"] or "UNKNOWN"
        if key not in result:
            result[key] = {
                "yearly_depreciation": 0.0,
                "purchase_price": 0.0,
                "acc_depreciation": 0.0,
                "net_book_value": 0.0,
                "count": 0,
            }
        result[key]["yearly_depreciation"] += fc["dep_expense_current"]
        result[key]["purchase_price"] += fc["purchase_price"]
        result[key]["acc_depreciation"] += fc["acc_depreciation_curr"]
        result[key]["net_book_value"] += fc["nbv_curr"]
        result[key]["count"] += 1

    # Sort by yearly_depreciation desc
    return dict(sorted(result.items(), key=lambda x: x[1]["yearly_depreciation"], reverse=True))


@router.get("/assets")
def forecast_assets(
    forecast_year: int = Query(2027, ge=2026),
    site_location: Optional[str] = None,
    group_name: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=350),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Returns per-asset forecast detail for the given year with pagination."""
    assets = get_assets(db, site_location)

    rows = []
    for asset in assets:
        # Apply filters
        if group_name and asset.group_name != group_name:
            continue
        if category and asset.category != category:
            continue
        if search:
            s = search.lower()
            if s not in (asset.name or "").lower() and s not in (asset.asset_no or "").lower() and s not in (asset.fixed_asset_number_ax or "").lower():
                continue

        fc = calc_asset_forecast(asset, forecast_year)
        if fc:
            rows.append(fc)

    total = len(rows)
    start = (page - 1) * size
    end = start + size
    items = rows[start:end]

    return {
        "forecast_year": forecast_year,
        "total": total,
        "page": page,
        "size": size,
        "items": items,
    }
