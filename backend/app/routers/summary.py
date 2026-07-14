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
def summary_monthly(year_ref: int = 2026, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Returns monthly depreciation totals grouped by job category."""
    assets = db.query(FixedAsset).filter(FixedAsset.year_ref == year_ref).all()
    asset_ids = [a.id for a in assets]
    job_map = {a.id: a.job for a in assets}

    rows = (
        db.query(DepreciationMonthly)
        .filter(
            DepreciationMonthly.asset_id.in_(asset_ids),
            DepreciationMonthly.year == year_ref,
        )
        .all()
    )

    result: Dict[str, Dict] = {}
    for row in rows:
        job = job_map.get(row.asset_id, "UNKNOWN")
        if job not in result:
            result[job] = {m: 0 for m in MONTHS}
            result[job]["total"] = 0
        month_key = MONTHS[row.month - 1]
        amount = float(row.amount or 0)
        result[job][month_key] += amount
        result[job]["total"] += amount

    return result


@router.get("/by-group")
def summary_by_group(year_ref: int = 2026, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Returns yearly depreciation subtotals per group_name."""
    rows = (
        db.query(
            FixedAsset.group_name,
            func.sum(FixedAsset.dep_expense_current).label("yearly_total"),
            func.sum(FixedAsset.purchase_price).label("purchase_total"),
            func.sum(FixedAsset.acc_depreciation_curr).label("acc_total"),
            func.sum(FixedAsset.net_book_value_curr).label("nbv_total"),
            func.count(FixedAsset.id).label("count"),
        )
        .filter(FixedAsset.year_ref == year_ref)
        .group_by(FixedAsset.group_name)
        .all()
    )
    return {
        r.group_name or "Unknown": {
            "yearly_depreciation": float(r.yearly_total or 0),
            "purchase_price": float(r.purchase_total or 0),
            "acc_depreciation": float(r.acc_total or 0),
            "net_book_value": float(r.nbv_total or 0),
            "count": r.count,
        }
        for r in rows
    }


@router.get("/by-category")
def summary_by_category(year_ref: int = 2026, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Returns yearly depreciation subtotals per category (WH1, WH2, TRP, etc.)."""
    rows = (
        db.query(
            FixedAsset.category,
            FixedAsset.job,
            func.sum(FixedAsset.dep_expense_current).label("yearly_total"),
            func.sum(FixedAsset.purchase_price).label("purchase_total"),
            func.sum(FixedAsset.acc_depreciation_curr).label("acc_total"),
            func.sum(FixedAsset.net_book_value_curr).label("nbv_total"),
            func.count(FixedAsset.id).label("count"),
        )
        .filter(FixedAsset.year_ref == year_ref)
        .group_by(FixedAsset.category, FixedAsset.job)
        .order_by(FixedAsset.job, FixedAsset.category)
        .all()
    )
    result: Dict[str, Any] = {}
    for r in rows:
        job = r.job or "UNKNOWN"
        cat = r.category or "UNKNOWN"
        if job not in result:
            result[job] = {}
        result[job][cat] = {
            "yearly_depreciation": float(r.yearly_total or 0),
            "purchase_price": float(r.purchase_total or 0),
            "acc_depreciation": float(r.acc_total or 0),
            "net_book_value": float(r.nbv_total or 0),
            "count": r.count,
        }
    return result


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
