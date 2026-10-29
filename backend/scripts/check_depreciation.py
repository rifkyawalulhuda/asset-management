"""Depreciation integrity report, and a targeted repair.

Reports four classes of problem and repairs only the ones that are definitional
(no business decision required):

  monthly_mismatch  monthly_depreciation != purchase_price / period
                    (a monthly amount copied from a neighbouring spreadsheet row)
  negative_nbv      net book value below zero, caused by 4-decimal rounding
  fractional_months period fields holding a fraction of a month
  schedule_gap      dep_expense_current disagrees with the sum of the monthly rows

Usage:
    python -m scripts.check_depreciation                  # report only
    python -m scripts.check_depreciation --confirm        # repair what is safe
    python -m scripts.check_depreciation --year 2026      # single fiscal year
"""
import argparse
from decimal import Decimal

from app.database import SessionLocal
from app.models.depreciation_monthly import DepreciationMonthly
from app.models.fixed_asset import FixedAsset
from app.services.depreciation import calculate_monthly_depreciation

CENT = Decimal("0.01")


def load_monthly(db) -> dict:
    rows: dict = {}
    for row in db.query(DepreciationMonthly).all():
        rows.setdefault((row.asset_id, row.year), {})[row.month] = Decimal(str(row.amount or 0))
    return rows


def inspect(db, year: int | None):
    query = db.query(FixedAsset).order_by(FixedAsset.fixed_asset_number_ax)
    if year:
        query = query.filter(FixedAsset.year_ref == year)
    assets = query.all()
    monthly = load_monthly(db)

    findings = {"monthly_mismatch": [], "negative_nbv": [], "fractional_months": [], "schedule_gap": []}

    for asset in assets:
        price = asset.purchase_price
        period = asset.depreciation_period_total
        ref_year = asset.year_ref or 2026

        if price and period and asset.monthly_depreciation is not None:
            expected = calculate_monthly_depreciation(price, int(period))
            if abs(Decimal(str(asset.monthly_depreciation)) - expected) > CENT:
                findings["monthly_mismatch"].append((asset, expected))

        for field in ("net_book_value_prev", "net_book_value_curr"):
            value = getattr(asset, field)
            if value is not None and Decimal(str(value)) < 0:
                findings["negative_nbv"].append((asset, field, Decimal(str(value))))

        for field in ("dep_period_acc_prev_year", "dep_period_yearly", "dep_period_until_year", "dep_period_remain"):
            value = getattr(asset, field)
            if value is not None and Decimal(str(value)) != Decimal(str(value)).to_integral_value():
                findings["fractional_months"].append((asset, field, Decimal(str(value))))
                break

        rows = monthly.get((asset.id, ref_year))
        if rows and asset.dep_expense_current is not None:
            total = sum(rows.values(), Decimal("0"))
            stored = Decimal(str(asset.dep_expense_current))
            if abs(total - stored) > CENT:
                findings["schedule_gap"].append((asset, stored, total))

    return assets, findings


def report(findings) -> None:
    print("== monthly_depreciation != price / period ==")
    for asset, expected in findings["monthly_mismatch"]:
        print(
            f"  {asset.fixed_asset_number_ax:12} y{asset.year_ref} "
            f"stored={asset.monthly_depreciation} expected={expected:.4f} "
            f"price={asset.purchase_price} period={asset.depreciation_period_total}"
        )
    if not findings["monthly_mismatch"]:
        print("  none")

    print("\n== net book value below zero ==")
    for asset, field, value in findings["negative_nbv"]:
        print(f"  {asset.fixed_asset_number_ax:12} y{asset.year_ref} {field}={value}")
    if not findings["negative_nbv"]:
        print("  none")

    print("\n== fractional month counts ==")
    for asset, field, value in findings["fractional_months"]:
        print(f"  {asset.fixed_asset_number_ax:12} y{asset.year_ref} {field}={value}")
    if not findings["fractional_months"]:
        print("  none")

    print("\n== dep_expense_current != sum(monthly rows) ==")
    print(f"  {len(findings['schedule_gap'])} assets")
    for asset, stored, total in findings["schedule_gap"][:10]:
        print(f"  {asset.fixed_asset_number_ax:12} y{asset.year_ref} stored={stored:,.2f} rows={total:,.2f} gap={total - stored:,.2f}")


def repair_monthly(db, findings) -> int:
    """Recompute the monthly amount, and the money columns that depend on it.

    Only the arithmetic is corrected; the period convention already recorded on
    the row (which month the workbook was closed at) is preserved.
    """
    changed = 0
    for asset, expected in findings["monthly_mismatch"]:
        monthly = expected
        asset.monthly_depreciation = monthly

        acc_prev = asset.dep_period_acc_prev_year
        acc_curr = asset.dep_period_until_year
        yearly = asset.dep_period_yearly

        if acc_prev is not None:
            asset.acc_depreciation_prev = monthly * Decimal(str(acc_prev))
        if acc_curr is not None:
            asset.acc_depreciation_curr = monthly * Decimal(str(acc_curr))
        if yearly is not None:
            asset.dep_expense_current = monthly * Decimal(str(yearly))
        if asset.purchase_price is not None:
            price = Decimal(str(asset.purchase_price))
            if asset.acc_depreciation_prev is not None:
                asset.net_book_value_prev = max(Decimal("0"), price - asset.acc_depreciation_prev)
            if asset.acc_depreciation_curr is not None:
                asset.net_book_value_curr = max(Decimal("0"), price - asset.acc_depreciation_curr)

        print(
            f"  fixed {asset.fixed_asset_number_ax} y{asset.year_ref}: "
            f"monthly -> {monthly:.4f}, expense -> {asset.dep_expense_current:,.2f}, "
            f"acc_curr -> {asset.acc_depreciation_curr:,.2f}"
        )
        changed += 1
    return changed


def repair_negative_nbv(findings) -> int:
    changed = 0
    for asset, field, value in findings["negative_nbv"]:
        setattr(asset, field, Decimal("0"))
        print(f"  floored {asset.fixed_asset_number_ax} y{asset.year_ref} {field} {value} -> 0")
        changed += 1
    return changed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, default=None, help="limit to one fiscal year")
    parser.add_argument("--confirm", action="store_true", help="write the repairs")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        assets, findings = inspect(db, args.year)
        print(f"assets inspected: {len(assets)}\n")
        report(findings)

        repairable = len(findings["monthly_mismatch"]) + len(findings["negative_nbv"])
        print(f"\nrepairable findings: {repairable}")

        if not args.confirm:
            print("dry run — pass --confirm to write the repairs")
            return

        print("\n== applying ==")
        changed = repair_monthly(db, findings)
        changed += repair_negative_nbv(findings)
        db.commit()
        print(f"\nrows updated: {changed}")

        _, after = inspect(db, args.year)
        remaining = sum(len(value) for value in after.values())
        print(f"remaining findings after repair: {remaining}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
