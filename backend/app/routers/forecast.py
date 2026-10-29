from typing import Optional, Dict, Any, List
from decimal import Decimal
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.fixed_asset import FixedAsset
from app.models.planned_asset import PlannedAsset
from app.services.depreciation import build_schedule

router = APIRouter(prefix="/forecast", tags=["forecast"])

MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

# Assets in these groups never depreciate, so a missing period is expected
# rather than a data-entry problem.
NON_DEPRECIABLE_GROUPS = {"land", "construction in process"}
NON_DEPRECIABLE_AX_PREFIXES = ("LAD", "CIP")


def is_non_depreciable(asset: FixedAsset) -> bool:
    """Land and construction-in-process never depreciate.

    Their group is sometimes empty, so the AX prefix (LAD…, CIP…) is the
    reliable signal.
    """
    if (asset.group_name or "").strip().lower() in NON_DEPRECIABLE_GROUPS:
        return True
    ax = (asset.fixed_asset_number_ax or "").strip().upper()
    return ax.startswith(NON_DEPRECIABLE_AX_PREFIXES)


def calc_asset_forecast(asset: FixedAsset, forecast_year: int) -> Optional[Dict]:
    """Calculate forecasted depreciation for a single existing asset."""
    schedule = build_schedule(
        asset.purchase_price,
        asset.depreciation_period_total,
        asset.purchase_date,
        forecast_year,
    )
    if schedule is None:
        return None

    price = float(asset.purchase_price)
    period = int(asset.depreciation_period_total)
    month_amounts = [float(amount) for amount in schedule.months]
    total_year = float(schedule.dep_expense)

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
        "monthly_depreciation": float(schedule.monthly),
        "dep_period_acc_prev_year": schedule.acc_prev,
        "dep_period_yearly": schedule.yearly,
        "dep_period_until_year": schedule.acc_curr,
        "dep_period_remain": schedule.remain,
        "acc_depreciation_prev": float(schedule.acc_dep_prev),
        "nbv_prev": float(schedule.nbv_prev),
        "dep_expense_current": total_year,
        "acc_depreciation_curr": float(schedule.acc_dep_curr),
        "nbv_curr": float(schedule.nbv_curr),
        "months": {MONTHS[i]: month_amounts[i] for i in range(12)},
        "total_year": total_year,
        "is_planned": False,
    }


def calc_planned_forecast(asset: PlannedAsset, forecast_year: int) -> Optional[Dict]:
    """Calculate forecasted depreciation for a planned (future) asset."""
    if not asset.purchase_price or not asset.depreciation_period_total:
        return None

    # A planned purchase is known to the month, so the first of that month is
    # used as the start date.
    purchase_date = date(asset.planned_purchase_year, asset.planned_purchase_month, 1)
    schedule = build_schedule(
        asset.purchase_price,
        asset.depreciation_period_total,
        purchase_date,
        forecast_year,
    )
    if schedule is None:
        return None

    price = float(asset.purchase_price)
    period = int(asset.depreciation_period_total)
    month_amounts = [float(amount) for amount in schedule.months]
    total_year = float(schedule.dep_expense)

    return {
        "id": asset.id,
        "fixed_asset_number_ax": None,
        "asset_no": f"PLANNED-{asset.id}",
        "name": asset.name,
        "group_name": asset.group_name,
        "category": asset.category,
        "site_location": asset.site_location,
        "job": asset.job,
        "purchase_price": price,
        "purchase_date": str(purchase_date),
        "depreciation_period_total": period,
        "monthly_depreciation": float(schedule.monthly),
        "dep_period_acc_prev_year": schedule.acc_prev,
        "dep_period_yearly": schedule.yearly,
        "dep_period_until_year": schedule.acc_curr,
        "dep_period_remain": schedule.remain,
        "acc_depreciation_prev": float(schedule.acc_dep_prev),
        "nbv_prev": float(schedule.nbv_prev),
        "dep_expense_current": total_year,
        "acc_depreciation_curr": float(schedule.acc_dep_curr),
        "nbv_curr": float(schedule.nbv_curr),
        "months": {MONTHS[i]: month_amounts[i] for i in range(12)},
        "total_year": total_year,
        "is_planned": True,
        "planned_purchase_month": asset.planned_purchase_month,
        "planned_purchase_year": asset.planned_purchase_year,
    }


def get_assets(db: Session, site_location: Optional[str], year_ref: int = 2026) -> List[FixedAsset]:
    """Fetch all assets for the base year (2026 is source of truth)."""
    q = db.query(FixedAsset).filter(FixedAsset.year_ref == year_ref)
    if site_location:
        q = q.filter(FixedAsset.site_location == site_location)
    return q.all()


def get_planned_assets(db: Session, forecast_year: int, site_location: Optional[str]) -> List[PlannedAsset]:
    """
    Fetch planned assets whose depreciation period covers the given forecast_year.

    An asset is included if:
    1. Its purchase has started on or before the end of forecast_year
       (planned_purchase_year <= forecast_year)
    2. Its depreciation is not yet exhausted at the start of forecast_year
       i.e. months from purchase to Jan 1 of forecast_year < depreciation_period_total
       i.e. (forecast_year - planned_purchase_year) * 12 + (1 - planned_purchase_month) + 1
            <= depreciation_period_total
       simplified: (forecast_year - planned_purchase_year) * 12 - planned_purchase_month + 2
                   <= depreciation_period_total
    """
    from sqlalchemy import and_
    q = db.query(PlannedAsset).filter(
        # Must have started by end of forecast_year
        PlannedAsset.planned_purchase_year <= forecast_year,
        # Depreciation must not be fully exhausted before forecast_year starts
        # months_elapsed to Dec of (forecast_year-1) = (forecast_year-1 - purchase_year)*12 + (12 - purchase_month) + 1
        # = (forecast_year - purchase_year)*12 - purchase_month + 1
        # asset still active if this value < depreciation_period_total
        PlannedAsset.depreciation_period_total > (
            (forecast_year - PlannedAsset.planned_purchase_year) * 12
            - PlannedAsset.planned_purchase_month + 1
        )
    )
    if site_location:
        q = q.filter(PlannedAsset.site_location == site_location)
    return q.all()


def get_group_key(fc: Dict, group_by: str) -> str:
    if group_by == "category":
        return fc["category"] or "UNKNOWN"
    elif group_by == "group_name":
        return fc["group_name"] or "UNKNOWN"
    return fc["job"] or "UNKNOWN"


@router.get("/totals")
def forecast_totals(
    forecast_year: int = Query(2027, ge=2026),
    site_location: Optional[str] = None,
    include_planned: bool = False,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Returns overall totals for the forecasted year."""
    assets = get_assets(db, site_location)

    total_assets = len(assets)
    total_purchase = 0.0
    total_yearly_dep = 0.0
    total_acc_dep = 0.0
    total_nbv = 0.0
    excluded_assets = 0
    excluded_missing_data = 0
    excluded_non_depreciable = 0

    for asset in assets:
        fc = calc_asset_forecast(asset, forecast_year)
        if fc:
            total_purchase += fc["purchase_price"]
            total_yearly_dep += fc["dep_expense_current"]
            total_acc_dep += fc["acc_depreciation_curr"]
            total_nbv += fc["nbv_curr"]
        else:
            excluded_assets += 1
            if is_non_depreciable(asset):
                excluded_non_depreciable += 1
            else:
                excluded_missing_data += 1

    # Planned assets contribution
    planned_purchase = 0.0
    planned_yearly_dep = 0.0
    planned_acc_dep = 0.0
    planned_nbv = 0.0
    planned_count = 0

    if include_planned:
        planned = get_planned_assets(db, forecast_year, site_location)
        for asset in planned:
            fc = calc_planned_forecast(asset, forecast_year)
            if fc:
                planned_purchase += fc["purchase_price"]
                planned_yearly_dep += fc["dep_expense_current"]
                planned_acc_dep += fc["acc_depreciation_curr"]
                planned_nbv += fc["nbv_curr"]
                planned_count += 1

    return {
        "forecast_year": forecast_year,
        "total_assets": total_assets,
        "excluded_assets": excluded_assets,
        "excluded_missing_data": excluded_missing_data,
        "excluded_non_depreciable": excluded_non_depreciable,
        "forecasted_assets": total_assets - excluded_assets,
        "total_purchase_price": total_purchase,
        "total_yearly_depreciation": total_yearly_dep,
        "total_acc_depreciation": total_acc_dep,
        "total_net_book_value": total_nbv,
        "planned_count": planned_count,
        "planned_purchase_price": planned_purchase,
        "planned_yearly_depreciation": planned_yearly_dep,
        "planned_acc_depreciation": planned_acc_dep,
        "planned_net_book_value": planned_nbv,
        "combined_yearly_depreciation": total_yearly_dep + planned_yearly_dep,
        "combined_net_book_value": total_nbv + planned_nbv,
    }


@router.get("/monthly")
def forecast_monthly(
    forecast_year: int = Query(2027, ge=2026),
    site_location: Optional[str] = None,
    group_by: str = Query("job", pattern="^(job|category|group_name)$"),
    include_planned: bool = False,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Returns monthly depreciation totals grouped by job, category, or group_name."""
    assets = get_assets(db, site_location)

    result: Dict[str, Dict] = {}
    for asset in assets:
        fc = calc_asset_forecast(asset, forecast_year)
        if not fc:
            continue
        key = get_group_key(fc, group_by)
        if key not in result:
            result[key] = {m: 0.0 for m in MONTHS}
            result[key]["total"] = 0.0
            result[key]["planned"] = {m: 0.0 for m in MONTHS}
            result[key]["planned_total"] = 0.0
        for m in MONTHS:
            result[key][m] += fc["months"][m]
        result[key]["total"] += fc["total_year"]

    if include_planned:
        planned = get_planned_assets(db, forecast_year, site_location)
        for asset in planned:
            fc = calc_planned_forecast(asset, forecast_year)
            if not fc:
                continue
            key = get_group_key(fc, group_by)
            if key not in result:
                result[key] = {m: 0.0 for m in MONTHS}
                result[key]["total"] = 0.0
                result[key]["planned"] = {m: 0.0 for m in MONTHS}
                result[key]["planned_total"] = 0.0
            for m in MONTHS:
                result[key]["planned"][m] += fc["months"][m]
            result[key]["planned_total"] += fc["total_year"]

    return result


@router.get("/by-group")
def forecast_by_group(
    forecast_year: int = Query(2027, ge=2026),
    site_location: Optional[str] = None,
    include_planned: bool = False,
    group_by: str = Query("group_name", pattern="^(job|group_name|category)$"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Yearly depreciation subtotals per dimension (job, group_name or category)."""
    assets = get_assets(db, site_location)

    result: Dict[str, Dict] = {}
    for asset in assets:
        fc = calc_asset_forecast(asset, forecast_year)
        if not fc:
            continue
        key = get_group_key(fc, group_by)
        if key not in result:
            result[key] = {"yearly_depreciation": 0.0, "purchase_price": 0.0,
                           "acc_depreciation": 0.0, "net_book_value": 0.0, "count": 0,
                           "planned_yearly": 0.0, "planned_count": 0,
                           "planned_purchase_price": 0.0, "planned_acc_depreciation": 0.0,
                           "planned_net_book_value": 0.0}
        result[key]["yearly_depreciation"] += fc["dep_expense_current"]
        result[key]["purchase_price"] += fc["purchase_price"]
        result[key]["acc_depreciation"] += fc["acc_depreciation_curr"]
        result[key]["net_book_value"] += fc["nbv_curr"]
        result[key]["count"] += 1

    if include_planned:
        planned = get_planned_assets(db, forecast_year, site_location)
        for asset in planned:
            fc = calc_planned_forecast(asset, forecast_year)
            if not fc:
                continue
            key = get_group_key(fc, group_by)
            if key not in result:
                result[key] = {"yearly_depreciation": 0.0, "purchase_price": 0.0,
                               "acc_depreciation": 0.0, "net_book_value": 0.0, "count": 0,
                               "planned_yearly": 0.0, "planned_count": 0}
            result[key]["planned_yearly"] += fc["dep_expense_current"]
            result[key]["planned_count"] += 1
            result[key]["planned_purchase_price"] += fc["purchase_price"]
            result[key]["planned_acc_depreciation"] += fc["acc_depreciation_curr"]
            result[key]["planned_net_book_value"] += fc["nbv_curr"]

    return result


@router.get("/by-category")
def forecast_by_category(
    forecast_year: int = Query(2027, ge=2026),
    site_location: Optional[str] = None,
    include_planned: bool = False,
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
            result[key] = {"yearly_depreciation": 0.0, "purchase_price": 0.0,
                           "acc_depreciation": 0.0, "net_book_value": 0.0, "count": 0,
                           "planned_yearly": 0.0, "planned_count": 0,
                           "planned_purchase_price": 0.0, "planned_acc_depreciation": 0.0,
                           "planned_net_book_value": 0.0}
        result[key]["yearly_depreciation"] += fc["dep_expense_current"]
        result[key]["purchase_price"] += fc["purchase_price"]
        result[key]["acc_depreciation"] += fc["acc_depreciation_curr"]
        result[key]["net_book_value"] += fc["nbv_curr"]
        result[key]["count"] += 1

    if include_planned:
        planned = get_planned_assets(db, forecast_year, site_location)
        for asset in planned:
            fc = calc_planned_forecast(asset, forecast_year)
            if not fc:
                continue
            key = fc["category"] or "UNKNOWN"
            if key not in result:
                result[key] = {"yearly_depreciation": 0.0, "purchase_price": 0.0,
                               "acc_depreciation": 0.0, "net_book_value": 0.0, "count": 0,
                               "planned_yearly": 0.0, "planned_count": 0}
            result[key]["planned_yearly"] += fc["dep_expense_current"]
            result[key]["planned_count"] += 1
            result[key]["planned_purchase_price"] += fc["purchase_price"]
            result[key]["planned_acc_depreciation"] += fc["acc_depreciation_curr"]
            result[key]["planned_net_book_value"] += fc["nbv_curr"]

    return dict(sorted(result.items(), key=lambda x: x[1]["yearly_depreciation"], reverse=True))


def _excluded_row(asset: FixedAsset) -> Dict[str, Any]:
    """Row for an asset that cannot be forecast (missing price or period).

    It is returned only when `include_excluded=true`, so it can be surfaced in
    the asset grid instead of silently disappearing from the report.
    """
    return {
        "id": asset.id,
        "fixed_asset_number_ax": asset.fixed_asset_number_ax,
        "asset_no": asset.asset_no,
        "name": asset.name,
        "group_name": asset.group_name,
        "category": asset.category,
        "site_location": asset.site_location,
        "job": asset.job,
        "purchase_price": float(asset.purchase_price) if asset.purchase_price else 0.0,
        "purchase_date": str(asset.purchase_date) if asset.purchase_date else None,
        "depreciation_period_total": int(asset.depreciation_period_total) if asset.depreciation_period_total else 0,
        "monthly_depreciation": 0.0,
        "dep_period_remain": 0,
        "dep_expense_current": 0.0,
        "nbv_curr": 0.0,
        "total_year": 0.0,
        "months": {month: 0.0 for month in MONTHS},
        "is_planned": False,
        "excluded": True,
        "excluded_reason": (
            "non_depreciable" if is_non_depreciable(asset) else "missing_data"
        ),
    }


def _matches_filter(value: Optional[str], target: str) -> bool:
    """Match a dimension value; the UI's 'UNKNOWN' bucket means a null value."""
    if target.upper() == "UNKNOWN":
        return not value
    return value == target


@router.get("/assets")
def forecast_assets(
    forecast_year: int = Query(2027, ge=2026),
    site_location: Optional[str] = None,
    job: Optional[str] = None,
    group_name: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    include_planned: bool = False,
    include_excluded: bool = False,
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=350),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Returns per-asset forecast detail for the given year with pagination."""
    assets = get_assets(db, site_location)

    rows = []
    excluded_rows = []
    for asset in assets:
        if job and not _matches_filter(asset.job, job):
            continue
        if group_name and not _matches_filter(asset.group_name, group_name):
            continue
        if category and not _matches_filter(asset.category, category):
            continue
        if search:
            s = search.lower()
            if s not in (asset.name or "").lower() and s not in (asset.asset_no or "").lower() and s not in (asset.fixed_asset_number_ax or "").lower():
                continue
        fc = calc_asset_forecast(asset, forecast_year)
        if fc:
            rows.append(fc)
        elif include_excluded:
            excluded_rows.append(_excluded_row(asset))

    # Surfacing missing-data assets first makes the toggle immediately useful.
    rows = excluded_rows + rows

    if include_planned:
        planned = get_planned_assets(db, forecast_year, site_location)
        for asset in planned:
            if job and not _matches_filter(asset.job, job):
                continue
            if group_name and not _matches_filter(asset.group_name, group_name):
                continue
            if category and not _matches_filter(asset.category, category):
                continue
            if search:
                s = search.lower()
                if s not in (asset.name or "").lower():
                    continue
            fc = calc_planned_forecast(asset, forecast_year)
            if fc:
                rows.append(fc)

    total = len(rows)
    start = (page - 1) * size
    items = rows[start:start + size]

    return {
        "forecast_year": forecast_year,
        "total": total,
        "page": page,
        "size": size,
        "items": items,
    }
