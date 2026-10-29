from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app.database import get_db
from app.models.fixed_asset import FixedAsset
from app.models.depreciation_monthly import DepreciationMonthly

router = APIRouter(prefix="/summary", tags=["summary"])

MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]


@router.get("/monthly")
def summary_monthly(
    year_ref: int = 2026,
    site_location: Optional[str] = None,
    group_by: str = Query("job", pattern="^(job|category|group_name)$"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Returns monthly depreciation totals grouped by job, category, or group_name."""
    if group_by == "category":
        group_col = FixedAsset.category
    elif group_by == "group_name":
        group_col = FixedAsset.group_name
    else:
        group_col = FixedAsset.job

    query = (
        db.query(
            group_col.label("group_key"),
            DepreciationMonthly.month,
            func.sum(DepreciationMonthly.amount).label("total"),
        )
        .join(DepreciationMonthly, DepreciationMonthly.asset_id == FixedAsset.id)
        .filter(
            FixedAsset.year_ref == year_ref,
            DepreciationMonthly.year == year_ref,
        )
    )
    if site_location:
        query = query.filter(FixedAsset.site_location == site_location)

    rows = query.group_by(group_col, DepreciationMonthly.month).all()

    result: Dict[str, Dict] = {}
    for row in rows:
        key = row.group_key or "UNKNOWN"
        if key not in result:
            result[key] = {m: 0 for m in MONTHS}
            result[key]["total"] = 0
        month_key = MONTHS[row.month - 1]
        amount = float(row.total or 0)
        result[key][month_key] += amount
        result[key]["total"] += amount

    return result


def yearly_depreciation_subquery(db: Session, year_ref: int):
    """Yearly depreciation per asset, pre-aggregated.

    The monthly table holds one row per asset per month. Joining it directly and
    summing `purchase_price` / `net_book_value_curr` therefore multiplied those
    figures by the number of monthly rows (up to twelve). Aggregating first keeps
    the join at one row per asset.
    """
    return (
        db.query(
            DepreciationMonthly.asset_id.label("asset_id"),
            func.sum(DepreciationMonthly.amount).label("yearly_dep"),
        )
        .filter(DepreciationMonthly.year == year_ref)
        .group_by(DepreciationMonthly.asset_id)
        .subquery()
    )


def summarise_by(db: Session, group_col, year_ref: int, site_location: Optional[str], null_key: str = "UNKNOWN"):
    dep_sub = yearly_depreciation_subquery(db, year_ref)

    query = (
        db.query(
            group_col.label("group_key"),
            func.sum(dep_sub.c.yearly_dep).label("yearly_total"),
            func.sum(FixedAsset.purchase_price).label("purchase_total"),
            func.sum(FixedAsset.acc_depreciation_curr).label("acc_total"),
            func.sum(FixedAsset.net_book_value_curr).label("nbv_total"),
            func.count(FixedAsset.id).label("count"),
        )
        .join(dep_sub, dep_sub.c.asset_id == FixedAsset.id)
        .filter(FixedAsset.year_ref == year_ref)
    )
    if site_location:
        query = query.filter(FixedAsset.site_location == site_location)

    rows = (
        query
        .group_by(group_col)
        .order_by(func.sum(dep_sub.c.yearly_dep).desc())
        .all()
    )
    return {
        (r.group_key or null_key): {
            "yearly_depreciation": float(r.yearly_total or 0),
            "purchase_price": float(r.purchase_total or 0),
            "acc_depreciation": float(r.acc_total or 0),
            "net_book_value": float(r.nbv_total or 0),
            "count": r.count,
        }
        for r in rows
    }


@router.get("/by-group")
def summary_by_group(
    year_ref: int = 2026,
    site_location: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Returns yearly depreciation subtotals per group_name."""
    return summarise_by(db, FixedAsset.group_name, year_ref, site_location, null_key="Unknown")


@router.get("/by-category")
def summary_by_category(
    year_ref: int = 2026,
    site_location: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Returns yearly depreciation subtotals per category (WH1, WH2, TRP, etc.)."""
    return summarise_by(db, FixedAsset.category, year_ref, site_location)


@router.get("/by-dim")
def summary_by_dim(
    year_ref: int = 2026,
    site_location: Optional[str] = None,
    group_by: str = Query("group_name", pattern="^(job|category|group_name|site_location)$"),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Returns yearly subtotals per dimension.

    One generic endpoint backs the Dashboard's composition panel, its analysis
    table and its Sites tab, so a new dimension never needs a new route.
    """
    group_col = {
        "job": FixedAsset.job,
        "category": FixedAsset.category,
        "site_location": FixedAsset.site_location,
    }.get(group_by, FixedAsset.group_name)

    # Site is the dimension itself here, so a site filter would be redundant.
    effective_site = None if group_by == "site_location" else site_location
    return summarise_by(db, group_col, year_ref, effective_site)


@router.get("/years")
def summary_years(db: Session = Depends(get_db)):
    """Distinct year_ref values that actually contain assets, newest first."""
    rows = (
        db.query(FixedAsset.year_ref)
        .filter(FixedAsset.year_ref.isnot(None))
        .group_by(FixedAsset.year_ref)
        .order_by(FixedAsset.year_ref.desc())
        .all()
    )
    return [r.year_ref for r in rows]


@router.get("/totals")
def summary_totals(
    year_ref: int = 2026,
    site_location: Optional[str] = None,
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Returns overall totals for summary cards.
    total_yearly_depreciation is calculated from depreciation_monthly table for consistency."""
    # Subquery for yearly depreciation from monthly table
    dep_sub = (
        db.query(
            DepreciationMonthly.asset_id,
            func.sum(DepreciationMonthly.amount).label("yearly_dep"),
        )
        .filter(DepreciationMonthly.year == year_ref)
        .group_by(DepreciationMonthly.asset_id)
        .subquery()
    )

    query = (
        db.query(
            func.count(FixedAsset.id).label("total_assets"),
            func.sum(FixedAsset.purchase_price).label("total_purchase"),
            func.sum(FixedAsset.acc_depreciation_curr).label("total_acc_depr"),
            func.sum(FixedAsset.net_book_value_curr).label("total_nbv"),
            func.sum(dep_sub.c.yearly_dep).label("total_yearly_depr"),
        )
        .outerjoin(dep_sub, dep_sub.c.asset_id == FixedAsset.id)
        .filter(FixedAsset.year_ref == year_ref)
    )
    if site_location:
        query = query.filter(FixedAsset.site_location == site_location)
    r = query.first()
    return {
        "total_assets": r.total_assets or 0,
        "total_purchase_price": float(r.total_purchase or 0),
        "total_acc_depreciation": float(r.total_acc_depr or 0),
        "total_net_book_value": float(r.total_nbv or 0),
        "total_yearly_depreciation": float(r.total_yearly_depr or 0),
    }


@router.get("/site-locations")
def get_site_locations(year_ref: Optional[int] = None, db: Session = Depends(get_db)):
    """Returns distinct site_location values with asset count, sorted by count desc."""
    query = db.query(
        FixedAsset.site_location,
        func.count(FixedAsset.id).label("count"),
    ).filter(FixedAsset.site_location.isnot(None))
    if year_ref:
        query = query.filter(FixedAsset.year_ref == year_ref)
    rows = (
        query
        .group_by(FixedAsset.site_location)
        .order_by(func.count(FixedAsset.id).desc())
        .all()
    )
    return [{"site_location": r.site_location, "count": r.count} for r in rows]


@router.get("/jobs")
def get_jobs(
    year_ref: Optional[int] = None,
    site_location: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Returns distinct job values with asset count, optionally filtered by site_location."""
    query = db.query(
        FixedAsset.job,
        func.count(FixedAsset.id).label("count"),
    ).filter(FixedAsset.job.isnot(None))
    if year_ref:
        query = query.filter(FixedAsset.year_ref == year_ref)
    if site_location:
        query = query.filter(FixedAsset.site_location == site_location)
    rows = (
        query
        .group_by(FixedAsset.job)
        .order_by(func.count(FixedAsset.id).desc())
        .all()
    )
    return [{"job": r.job, "count": r.count} for r in rows]
