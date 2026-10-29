"""Regression tests for the depreciation calculation.

Run with:
    python -m scripts.test_depreciation

Each test names the bug it locks down. The database tests run inside a
transaction that is rolled back, so the real data is never touched.
"""
from datetime import date
from decimal import Decimal

from app.database import SessionLocal
from app.models.depreciation_monthly import DepreciationMonthly
from app.models.fixed_asset import FixedAsset
from app.services.depreciation import (
    build_schedule,
    generate_monthly_rows,
    monthly_matches_price,
    recalculate_summary_fields,
)

FAILURES = []


def check(name, condition, detail=""):
    if condition:
        print(f"  ok   {name}")
    else:
        print(f"  FAIL {name} {detail}")
        FAILURES.append(name)


def eq(name, actual, expected):
    check(name, actual == expected, f"(expected {expected}, got {actual})")


# ── build_schedule: pure function ───────────────────────────────────────────

print("\nbuild_schedule")

s = build_schedule(120_000_000, 60, date(2024, 1, 15), 2024)
eq("first year: 12 months booked", s.yearly, 12)
eq("first year: nothing accrued before", s.acc_prev, 0)
eq("first year: 12 months accrued", s.acc_curr, 12)
eq("first year: 48 months remain", s.remain, 48)
eq("first year: monthly = price / period", s.monthly, Decimal("2000000"))
eq("first year: expense = 12 months", s.dep_expense, Decimal("24000000"))
eq("first year: NBV = price - 12 months", s.nbv_curr, Decimal("96000000"))

s = build_schedule(120_000_000, 60, date(2024, 1, 15), 2026)
eq("third year: still 12 months", s.yearly, 12)
eq("third year: 36 months accrued", s.acc_curr, 36)
eq("third year: 24 months remain", s.remain, 24)

s = build_schedule(120_000_000, 60, date(2024, 1, 15), 2028)
eq("final year: 12 months", s.yearly, 12)
eq("final year: fully depreciated", s.remain, 0)
eq("final year: NBV is zero", s.nbv_curr, Decimal("0"))

s = build_schedule(120_000_000, 60, date(2024, 1, 15), 2029)
eq("after the life: no months", s.yearly, 0)
eq("after the life: no expense", s.dep_expense, Decimal("0"))
eq("after the life: NBV stays zero", s.nbv_curr, Decimal("0"))

# purchase mid-year: only the remaining months of that year are booked
s = build_schedule(120_000_000, 60, date(2024, 9, 20), 2024)
eq("bought in September: 4 months", s.yearly, 4)
eq("bought in September: months 9..12 only", [i + 1 for i, v in enumerate(s.months) if v > 0], [9, 10, 11, 12])

# internal consistency: the 12 monthly amounts must add up to the yearly figure
for year in (2024, 2025, 2026, 2027, 2028, 2029, 2030):
    s = build_schedule(120_000_000, 60, date(2024, 1, 15), year)
    check(f"{year}: sum(months) == dep_expense", s.total == s.dep_expense, f"({s.total} vs {s.dep_expense})")

# bug 6: a price that does not divide evenly must never produce a negative NBV
s = build_schedule(1000, 3, date(2020, 1, 1), 2040)
check("rounding never yields a negative NBV", s.nbv_curr >= 0, f"(got {s.nbv_curr})")

# bug 3: no purchase date means no schedule at all (not twelve zeros)
eq("missing purchase date -> no schedule", build_schedule(120_000_000, 60, None, 2026), None)
eq("missing period -> no schedule", build_schedule(120_000_000, 0, date(2024, 1, 1), 2026), None)
eq("missing price -> no schedule", build_schedule(None, 60, date(2024, 1, 1), 2026), None)


# ── database behaviour (rolled back) ───────────────────────────────────────

print("\ndatabase behaviour (transaction rolled back)")

db = SessionLocal()
try:
    def new_asset(ax, price, period, purchase_date):
        asset = FixedAsset(
            fixed_asset_number_ax=ax,
            asset_no=ax,
            name=f"test {ax}",
            purchase_price=price,
            depreciation_period_total=period,
            purchase_date=purchase_date,
            year_ref=2026,
            no=999999,
        )
        db.add(asset)
        db.flush()
        return asset

    # bug 3: an asset without a purchase date must keep its existing schedule
    asset = new_asset("TEST0001", Decimal("12000000"), 12, None)
    for month in range(1, 5):
        db.add(DepreciationMonthly(asset_id=asset.id, year=2026, month=month, amount=Decimal("1000000")))
    db.flush()

    generate_monthly_rows(db, asset, 2026)
    rows = db.query(DepreciationMonthly).filter(DepreciationMonthly.asset_id == asset.id).all()
    eq("no purchase date: rows are kept, not wiped", len(rows), 4)
    eq("no purchase date: amounts unchanged", sum(Decimal(str(r.amount)) for r in rows), Decimal("4000000"))

    # and the summary columns must not be zeroed either
    asset.dep_expense_current = Decimal("4000000")
    asset.net_book_value_curr = Decimal("8000000")
    recalculate_summary_fields(asset, 2026)
    eq("no purchase date: expense preserved", asset.dep_expense_current, Decimal("4000000"))
    eq("no purchase date: NBV preserved", asset.net_book_value_curr, Decimal("8000000"))
    eq("no purchase date: monthly still derived", asset.monthly_depreciation, Decimal("1000000"))

    # with a purchase date the schedule is regenerated from scratch
    asset2 = new_asset("TEST0002", Decimal("12000000"), 12, date(2026, 1, 10))
    db.add(DepreciationMonthly(asset_id=asset2.id, year=2026, month=1, amount=Decimal("999")))
    db.flush()
    generate_monthly_rows(db, asset2, 2026)
    rows = db.query(DepreciationMonthly).filter(DepreciationMonthly.asset_id == asset2.id).all()
    eq("with purchase date: 12 rows written", len(rows), 12)
    eq("with purchase date: stale amount replaced", sum(Decimal(str(r.amount)) for r in rows), Decimal("12000000"))

    recalculate_summary_fields(asset2, 2026)
    eq("with purchase date: expense = full year", asset2.dep_expense_current, Decimal("12000000"))
    eq("with purchase date: fully depreciated after 12 months", asset2.dep_period_remain, Decimal("0"))

    # bug 4: the guard must flag a monthly amount that belongs to another asset
    asset3 = new_asset("TEST0003", Decimal("2161624500"), 240, date(2008, 7, 31))
    asset3.monthly_depreciation = Decimal("10132614.8438")
    check("detects a copied monthly amount", monthly_matches_price(asset3) is False)

    asset3.monthly_depreciation = Decimal("2161624500") / Decimal("240")
    check("accepts the correct monthly amount", monthly_matches_price(asset3) is True)
finally:
    db.rollback()
    db.close()
    print("\ntransaction rolled back")


print()
if FAILURES:
    print(f"{len(FAILURES)} FAILED: {FAILURES}")
    raise SystemExit(1)
print("all checks passed")
