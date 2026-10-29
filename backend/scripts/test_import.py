"""End-to-end test of the import pipeline against a throwaway SQLite database.

Verifies the four rules the repeated-import workflow depends on:
  1. preview reports the same numbers the apply actually produces
  2. category is never overwritten by the workbook
  3. assets missing from the file are deactivated, not deleted
  4. a failure leaves nothing behind (single transaction)

Run:  python -m scripts.test_import
"""
import io
import os
import sys
import tempfile
from datetime import date
from decimal import Decimal

from openpyxl import Workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.depreciation_monthly import DepreciationMonthly
from app.models.fixed_asset import FixedAsset
from app.services import import_service
from app.services.import_service import ImportRejected, apply_plan, build_plan, diff_plan, fingerprint

# Rollback snapshots must not litter the real directory when the tests run.
import_service.SNAPSHOT_DIR = tempfile.mkdtemp(prefix="import-test-")

FAILURES = []


def check(name, condition, detail=""):
    if condition:
        print(f"  ok   {name}")
    else:
        print(f"  FAIL {name} {detail}")
        FAILURES.append(name)


def eq(name, actual, expected):
    check(name, actual == expected, f"(expected {expected}, got {actual})")


# ── synthetic workbook matching the FA_<year> layout ────────────────────────
# The real workbook uses a two-row header: a group label on top and the field
# name underneath. build_col_map() keys off exactly that shape.
HEADER = [
    "No.", "Site/\nLocation", "Job", "Account", "Asset",
    "Fixed Asset Number", "Purchase Date", "Group", "Voucher",
    "Name of Fixed Asset", "Maker/Type/Location", "Capacity/Size/User",
    "Year", "Police", "Machine", "Chasis", "Quantity",
    "Valas", "Purchase Price", "Monthly Depreciation",
    "Depreciation Period", "Depreciation Period", "Depreciation Period",
    "Depreciation Period", "Depreciation Period",
    "Accumulated Depreciation", "Net Book Value",
    "Depreciation Expense", "Accumulated Depreciation", "Net Book Value",
    "Depreciation 2026 (monthly)",
]
SUB = [
    "", "", "", "", "No.", "AX", "", "", "", "", "", "", "", "No.", "No.", "No.",
    "", "", "", "", "total", "acc. 2025", "yearly", "until", "remain",
    "", "", "", "", "", "jan",
] + ["feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

# Column indices, kept in one place so the layout above stays readable.
COL_PERIOD_TOTAL = 20
COL_PERIOD_ACC_PREV = 21
COL_PERIOD_YEARLY = 22
COL_PERIOD_UNTIL = 23
COL_PERIOD_REMAIN = 24
COL_ACC_PREV = 25
COL_NBV_PREV = 26
COL_DEP_EXPENSE = 27
COL_ACC_CURR = 28
COL_NBV_CURR = 29
COL_MONTHLY_JAN = 30

# The workbook closes its summary columns at September while its monthly columns
# still run to December. That is the shape that produced two different yearly
# figures for the same assets.
SUMMARY_MONTHS = 9


def make_workbook(rows, sheet="FA_2026"):
    """rows: list of dicts with ax, name, price, period(months), purchase_date."""
    workbook = Workbook()
    sheet_obj = workbook.active
    sheet_obj.title = sheet

    sheet_obj.append(HEADER)
    sheet_obj.append(SUB)
    # formula/legend row (the parser skips three rows after the header)
    sheet_obj.append([""] * len(HEADER))

    for index, row in enumerate(rows, start=1):
        period = row.get("period", 60)
        monthly = row["price"] / period
        values = [""] * (COL_MONTHLY_JAN + 12)
        values[0] = index
        values[1] = "JKT"
        values[2] = "AD_HO"
        values[3] = 100 + index
        values[4] = row["ax"]
        values[5] = row["ax"]
        values[6] = row.get("purchase_date", "2024-01-15")
        values[7] = "Vehicles"
        values[9] = row["name"]
        values[18] = row["price"]
        values[19] = monthly
        values[COL_PERIOD_TOTAL] = period
        values[COL_PERIOD_ACC_PREV] = 0
        values[COL_PERIOD_YEARLY] = SUMMARY_MONTHS
        values[COL_PERIOD_UNTIL] = SUMMARY_MONTHS
        values[COL_PERIOD_REMAIN] = period - SUMMARY_MONTHS
        values[COL_ACC_PREV] = 0
        values[COL_NBV_PREV] = row["price"]
        values[COL_DEP_EXPENSE] = monthly * SUMMARY_MONTHS
        values[COL_ACC_CURR] = monthly * SUMMARY_MONTHS
        values[COL_NBV_CURR] = row["price"] - monthly * SUMMARY_MONTHS
        for offset in range(12):
            values[COL_MONTHLY_JAN + offset] = monthly
        sheet_obj.append(values)

    buffer = io.BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return buffer


def fresh_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


# ── scenario ───────────────────────────────────────────────────────────────
db = fresh_db()

# seed: three assets already in the database, category set by hand in the app
seed = [
    ("AAA001", "Keep me", 120_000_000, 60, "WH1", 101),
    ("AAA002", "Will be updated", 240_000_000, 60, "TRP", 102),
    ("AAA003", "Will disappear", 60_000_000, 60, "SBY", 103),
]
for ax, name, price, period, category, account_no in seed:
    monthly = price / period
    # Seeded to match what the workbook reports, so AAA001 is genuinely unchanged
    # and only AAA002 (whose price moves) counts as an update.
    closed_months = SUMMARY_MONTHS
    asset = FixedAsset(
        fixed_asset_number_ax=ax, asset_no=ax, name=name, site_location="JKT",
        job="AD_HO", group_name="Vehicles", category=category, account_no=account_no,
        quantity=1,
        purchase_price=price, depreciation_period_total=period,
        purchase_date=date(2024, 1, 15), year_ref=2026,
        monthly_depreciation=Decimal(str(monthly)),
        dep_period_acc_prev_year=Decimal("0"),
        dep_period_yearly=Decimal(str(closed_months)),
        dep_period_until_year=Decimal(str(closed_months)),
        dep_period_remain=Decimal(str(period - closed_months)),
        acc_depreciation_prev=Decimal("0"),
        net_book_value_prev=Decimal(str(price)),
        dep_expense_current=Decimal(str(monthly * closed_months)),
        acc_depreciation_curr=Decimal(str(monthly * closed_months)),
        net_book_value_curr=Decimal(str(price - monthly * closed_months)),
    )
    db.add(asset)
db.flush()
for asset in db.query(FixedAsset).all():
    for month in range(1, 13):
        db.add(DepreciationMonthly(
            asset_id=asset.id, year=2026, month=month,
            amount=asset.monthly_depreciation,
        ))
db.commit()

before_active = db.query(FixedAsset).filter(FixedAsset.is_active.is_(True)).count()
print(f"\nseeded: {before_active} active assets\n")

# the new workbook: AAA001 unchanged, AAA002 new price, AAA003 gone, AAA004 new
contents = make_workbook([
    {"ax": "AAA001", "name": "Keep me", "price": 120_000_000},
    {"ax": "AAA002", "name": "Will be updated", "price": 300_000_000},
    {"ax": "AAA004", "name": "Brand new", "price": 90_000_000, "purchase_date": "2025-06-01"},
]).read()

import openpyxl
wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
plan = build_plan(wb, "synthetic.xlsx", fingerprint(contents))
preview = diff_plan(db, plan)

print("preview")
eq("2 unchanged/updated recognised as 1 each", (preview["assets"]["updated"], preview["assets"]["unchanged"]), (1, 1))
eq("1 new asset", preview["assets"]["created"], 1)
eq("1 asset to deactivate", preview["assets"]["deactivated"], 1)
check("preview names the disappearing asset", any(s["ax"] == "AAA003" for s in preview["deactivate_samples"]))
eq("reactivated is zero", preview["assets"]["reactivated"], 0)

# nothing may be written by the preview
eq("preview writes nothing", db.query(FixedAsset).filter(FixedAsset.is_active.is_(True)).count(), before_active)

run = apply_plan(db, plan, preview)
db.commit()

print("\napply")
eq("apply reports the same counts as the preview", (run.assets_created, run.assets_updated, run.assets_deactivated), (1, 1, 1))

assets = {a.fixed_asset_number_ax: a for a in db.query(FixedAsset).all()}
eq("deactivated asset is kept, not deleted", "AAA003" in assets, True)
eq("deactivated asset is marked inactive", assets["AAA003"].is_active, False)
eq("new asset exists", "AAA004" in assets, True)
eq("new asset is active", assets["AAA004"].is_active, True)

print("\ncategory ownership")
eq("category survives an update", assets["AAA001"].category, "WH1")
eq("category of the unchanged row survives", assets["AAA002"].category, "TRP")
eq("category of the removed row is untouched", assets["AAA003"].category, "SBY")
eq("new asset has no category", assets["AAA004"].category, None)

print("\npayload from the workbook")
eq("price updated from the file", float(assets["AAA002"].purchase_price), 300_000_000.0)
eq("group written from the file", assets["AAA002"].group_name, "Vehicles")
eq("new asset monthly derived from the file", float(assets["AAA004"].monthly_depreciation), 1_500_000.0)

print("\nmonthly schedule")
rows_004 = db.query(DepreciationMonthly).filter(DepreciationMonthly.asset_id == assets["AAA004"].id).all()
eq("12 monthly rows for the new asset", len(rows_004), 12)
rows_001 = db.query(DepreciationMonthly).filter(DepreciationMonthly.asset_id == assets["AAA001"].id).all()
eq("existing schedule replaced, not duplicated", len(rows_001), 12)

print("\nre-importing the same file is idempotent")
plan2 = build_plan(wb, "synthetic.xlsx", fingerprint(contents))
preview2 = diff_plan(db, plan2)
eq("second preview: nothing to create", preview2["assets"]["created"], 0)
eq("second preview: nothing to deactivate", preview2["assets"]["deactivated"], 0)
eq("second preview: all unchanged", preview2["assets"]["unchanged"], 3)

print("\nthe full-year convention survives an import")
for asset in db.query(FixedAsset).all():
    rows = db.query(DepreciationMonthly).filter(
        DepreciationMonthly.asset_id == asset.id,
        DepreciationMonthly.year == asset.year_ref,
    ).all()
    if not rows or asset.dep_expense_current is None:
        continue
    table = sum(Decimal(str(row.amount or 0)) for row in rows)
    check(
        f"{asset.fixed_asset_number_ax}: expense matches its schedule",
        abs(table - Decimal(str(asset.dep_expense_current))) < Decimal("0.01"),
        f"({table} vs {asset.dep_expense_current})",
    )
    if asset.purchase_price and asset.net_book_value_curr is not None:
        acc = Decimal(str(asset.acc_depreciation_curr or 0))
        check(
            f"{asset.fixed_asset_number_ax}: cost - acc equals NBV",
            abs((Decimal(str(asset.purchase_price)) - acc) - Decimal(str(asset.net_book_value_curr))) < Decimal("0.01"),
        )

print("\nreturning asset is reactivated")
contents3 = make_workbook([
    {"ax": "AAA001", "name": "Keep me", "price": 120_000_000},
    {"ax": "AAA002", "name": "Will be updated", "price": 300_000_000},
    {"ax": "AAA003", "name": "Will disappear", "price": 60_000_000},
    {"ax": "AAA004", "name": "Brand new", "price": 90_000_000, "purchase_date": "2025-06-01"},
]).read()
wb3 = openpyxl.load_workbook(io.BytesIO(contents3), data_only=True)
plan3 = build_plan(wb3, "synthetic2.xlsx", fingerprint(contents3))
preview3 = diff_plan(db, plan3)
eq("reactivation detected", preview3["assets"]["reactivated"], 1)
apply_plan(db, plan3, preview3)
db.commit()
assets = {a.fixed_asset_number_ax: a for a in db.query(FixedAsset).all()}
eq("AAA003 active again", assets["AAA003"].is_active, True)
eq("category still intact after reactivation", assets["AAA003"].category, "SBY")

print("\nrejecting a workbook with no importable sheet")
try:
    empty = Workbook()
    empty.active.title = "Sheet1"
    build_plan(empty, "wrong.xlsx", "0" * 64)
    check("rejects an unknown workbook", False)
except ImportRejected:
    check("rejects an unknown workbook", True)

print("\nrollback leaves nothing behind")
plan4 = build_plan(
    openpyxl.load_workbook(io.BytesIO(make_workbook([
        {"ax": "AAA001", "name": "Keep me", "price": 1},
    ]).read()), data_only=True),
    "fail.xlsx", "1" * 64,
)
count_before = db.query(FixedAsset).count()
try:
    apply_plan(db, plan4, diff_plan(db, plan4))
    raise RuntimeError("forced failure")
except RuntimeError:
    db.rollback()
eq("asset count unchanged after a rollback", db.query(FixedAsset).count(), count_before)

db.close()

print()
if FAILURES:
    print(f"{len(FAILURES)} FAILED: {FAILURES}")
    sys.exit(1)
print("all checks passed")