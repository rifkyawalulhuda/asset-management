"""
Excel Importer V2 - Auto-detect format, supports multiple file versions.

Supports:
- File lama: Est-Depreciation_Calculation_for_2026_.xlsx (header row 23-24, data row 26+)
- File baru: Fixed Asset_202606.xlsx (header row 7-8, data row 10+, no Category column)
- Future files: auto-detects header row by scanning for keyword markers

Category derivation (when Category column is absent):
  Derived from site_location + job using known mapping patterns.
"""
import argparse
import io
import os
import sys
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Optional

import openpyxl
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.database import SessionLocal, engine
from app.models import AcquisitionDisposal, DepreciationMonthly, FixedAsset
from app.database import Base

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def to_decimal(value) -> Optional[Decimal]:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def to_int(value) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(float(str(value)))
    except (ValueError, TypeError):
        return None


def to_date(value) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def _chunks(items: list, size: int = 1000):
    """Yield lists of at most `size` items (keeps SQL IN() clauses small)."""
    for start in range(0, len(items), size):
        yield items[start:start + size]


APPROVAL_TYPES = ("Acquisition", "Disposal", "Transfer", "Adjustment")

APPROVAL_TYPE_ALIASES = {
    "acquisition": "Acquisition",
    "acquisitions": "Acquisition",
    "disposal": "Disposal",
    "disposals": "Disposal",
    "transfer": "Transfer",
    "transfers": "Transfer",
    # Withdrawals are economically disposals: the asset leaves the register.
    "withdrawal": "Disposal",
    "withdrawals": "Disposal",
    "adjustment": "Adjustment",
    "adjustments": "Adjustment",
}

APPLICATION_TYPE_MARKERS = (
    ("FA-PURC", "Acquisition"),
    ("FA-DISP", "Disposal"),
    ("FA-TRF", "Transfer"),
)

EMPTY_CELL_VALUES = {"", "-", "#N/A", "N/A", "NONE"}


def clean_cell(value) -> Optional[str]:
    """to_str() that also drops spreadsheet error markers and placeholder dashes."""
    text = to_str(value)
    if text is None:
        return None
    return None if text.upper() in EMPTY_CELL_VALUES else text


def normalize_approval_type(status, application) -> str:
    """Map a raw status (or the application number prefix) to one of APPROVAL_TYPES.

    'List Approval' sheets leave the status column empty for transfers, so the
    application number ("004/ASC/FA-Trf/I/2025") is the second source of truth.
    """
    alias = APPROVAL_TYPE_ALIASES.get((status or "").strip().lower())
    if alias:
        return alias
    app = (application or "").upper()
    for marker, kind in APPLICATION_TYPE_MARKERS:
        if marker in app:
            return kind
    return "Adjustment"


def approval_key(year_ref, fixed_asset_no, asset_name, bookslip_no, application, status) -> tuple:
    """Identity of a movement row: one asset within one approval batch.

    The sheet's bookslip number is the batch; transfers have no bookslip, so the
    application number is used instead. Rows without an AX number fall back to
    the asset name so distinct unnamed-but-different assets never collide.
    """
    return (
        year_ref,
        fixed_asset_no or asset_name,
        bookslip_no or application,
        status,
    )


def to_str(value) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


# ---------------------------------------------------------------------------
# Category derivation
# ---------------------------------------------------------------------------

def derive_category(site_location: Optional[str], job: Optional[str]) -> Optional[str]:
    """
    Derive the Category field from site_location and/or job when the
    Category column is not present in the source file.

    Mapping is based on patterns observed in the file lama data.
    """
    site = (site_location or '').upper().strip()
    job_up = (job or '').upper().strip()

    # Site-based rules (most specific)
    if 'BALI' in site:
        return 'BALI'
    if site in ('MDN', 'MEDAN') or 'MDN' in site:
        return 'MDN'
    if site in ('PBG', 'PALEMBANG') or 'PBG' in site:
        return 'PBG'
    if site in ('MKS', 'MAKASSAR') or 'MKS' in site:
        return 'MKS'
    if site in ('SBY', 'SURABAYA') or 'SBY' in site:
        return 'SBY'

    # Job-based rules
    if 'CLCTRP' in job_up or 'TRP' in job_up:
        return 'TRP'
    if 'CLCWH' == job_up:
        return 'WH1'
    if 'WH2' in job_up:
        return 'WH2'
    if 'WH' in job_up:
        return 'WH1'
    if 'CLCOWH' in job_up:
        return 'OTHERS'

    # Fallback: use site_location directly if short code
    if site and len(site) <= 5:
        return site

    return 'OTHERS'


# ---------------------------------------------------------------------------
# Auto-detect file format
# ---------------------------------------------------------------------------

# Keywords that must ALL appear in the header row for it to be identified
HEADER_KEYWORDS = {'no.', 'name of fixed asset', 'purchase price', 'fixed asset number'}


def detect_header_row(ws) -> int:
    """
    Scan rows 1-40 and return the first row number that contains all
    HEADER_KEYWORDS (case-insensitive). Returns -1 if not found.
    """
    for i in range(1, 41):
        row = list(ws.iter_rows(min_row=i, max_row=i, values_only=True))[0]
        texts = {str(v).strip().lower() for v in row if v is not None}
        # Also check combined text (some headers span two rows)
        combined = ' '.join(texts)
        if all(kw in combined for kw in HEADER_KEYWORDS):
            return i
    return -1


def build_col_map(header_row: tuple, sub_row: tuple) -> dict:
    """
    Build a mapping of field-name → column-index by scanning the header
    and sub-header rows. Returns a dict with known field names as keys.
    """
    col_map = {}
    max_col = max(len(header_row), len(sub_row))

    def norm(v):
        return str(v).strip().lower().replace('\n', ' ').replace('  ', ' ') if v else ''

    for i in range(max_col):
        h1 = norm(header_row[i] if i < len(header_row) else None)
        h2 = norm(sub_row[i] if i < len(sub_row) else None)
        combined = f"{h1} {h2}".strip()

        if h1 == 'no.' and 'no.' not in col_map:
            col_map['no'] = i
        elif h1 in ('site/', 'site/\nlocation', 'site/ location', 'site/location'):
            col_map['site_location'] = i
        elif h1 == 'job':
            col_map['job'] = i
        elif h1 == 'account':
            col_map['account_no'] = i
        elif h1 == 'category':
            col_map['category'] = i
        elif h1 == 'asset' and h2 == 'no.' and 'asset_no' not in col_map:
            col_map['asset_no'] = i
        elif h1 == 'fixed asset number' and h2 == 'ax':
            col_map['fixed_asset_number_ax'] = i
        elif h1 == 'purchase date':
            col_map['purchase_date'] = i
        elif h1 == 'group':
            col_map['group_name'] = i
        elif h1 == 'voucher':
            col_map['voucher_no'] = i
        elif h1 == 'name of fixed asset':
            col_map['name'] = i
        elif h1 == 'maker/type/location':
            col_map['maker_type_location'] = i
        elif h1 == 'capacity/size/user':
            col_map['capacity_size_user'] = i
        elif h1 == 'year':
            col_map['year'] = i
        elif h1 == 'police' and h2 == 'no.':
            col_map['police_no'] = i
        elif h1 == 'machine' and h2 == 'no.':
            col_map['machine_no'] = i
        elif h1 == 'chasis' and h2 == 'no.':
            col_map['chasis_no'] = i
        elif h1 == 'quantity':
            col_map['quantity'] = i
        elif h1 == 'valas':
            col_map['valas'] = i
        elif h1 == 'purchase price':
            col_map['purchase_price'] = i
        elif h1 == 'monthly depreciation':
            col_map['monthly_depreciation'] = i
        elif 'depreciation period' in h1 and h2 == 'total':
            col_map['dep_period_total'] = i
        elif 'acc.' in h2 and ('2025' in h2 or '2024' in h2 or '2023' in h2):
            col_map['dep_period_acc_prev'] = i
        elif 'yearly' in h2:
            col_map['dep_period_yearly'] = i
        elif 'until' in h2:
            col_map['dep_period_until'] = i
        elif 'remain' in h2:
            col_map['dep_period_remain'] = i
        elif h1 == 'accumulated depreciation' and 'acc_depr_prev' not in col_map:
            col_map['acc_depr_prev'] = i
        elif h1 == 'net book value' and 'nbv_prev' not in col_map:
            col_map['nbv_prev'] = i
        elif 'depreciation expense' in h1:
            col_map['dep_expense'] = i
        elif h1 == 'depreciation' and h2 != '' and 'monthly' in combined:
            # DEPRECIATION 2026 (MONTHLY) — Jan starts here
            col_map['monthly_jan'] = i
        elif h2 == 'jan' and 'monthly_jan' not in col_map:
            col_map['monthly_jan'] = i
        elif h2 == 'feb' and 'monthly_jan' in col_map:
            pass  # consecutive from jan
        elif h1 == 'accumulated depreciation' and 'acc_depr_curr' not in col_map and 'acc_depr_prev' in col_map:
            col_map['acc_depr_curr'] = i
        elif h1 == 'net book value' and 'nbv_curr' not in col_map and 'nbv_prev' in col_map:
            col_map['nbv_curr'] = i
        elif h1 == 'status' and h2 == 'additional':
            col_map['status_additional'] = i
        elif h2 == 'disposals' and 'status_additional' in col_map:
            col_map['status_disposals'] = i
        elif h1 == 'acquisition' and h2 == 'condition':
            col_map['condition'] = i
        elif h1 == 'remark':
            col_map['remark'] = i
        elif 'photo' in h1 and 'status' in h1:
            col_map['photo_status'] = i

    return col_map


def resolve_monthly_cols(sub_row: tuple, jan_col: int) -> dict:
    """
    Given the sub-header row and the column index of 'Jan', map month numbers
    1-12 to column indices by scanning forward for month name matches.
    """
    month_names = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                   'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    month_map = {}
    # Scan from jan_col forward for up to 20 columns
    mi = 0
    for ci in range(jan_col, min(jan_col + 20, len(sub_row))):
        cell = str(sub_row[ci]).strip().lower() if sub_row[ci] else ''
        if mi < 12 and cell == month_names[mi]:
            month_map[mi + 1] = ci
            mi += 1
    return month_map


# ---------------------------------------------------------------------------
# Main importer
# ---------------------------------------------------------------------------

def import_fa_sheet(ws, year_ref: int, db: Session) -> int:
    """
    Auto-detect format and import assets from a FA sheet.
    Returns count of upserted rows.
    """
    # 1. Find header row
    header_row_idx = detect_header_row(ws)
    if header_row_idx == -1:
        print(f"  WARNING: Could not detect header row in sheet. Skipping.")
        return 0

    sub_row_idx = header_row_idx + 1
    data_start_row = header_row_idx + 3  # skip header, sub-header, formula row

    rows = list(ws.iter_rows(min_row=header_row_idx, max_row=header_row_idx, values_only=True))
    sub_rows = list(ws.iter_rows(min_row=sub_row_idx, max_row=sub_row_idx, values_only=True))
    header_tuple = rows[0] if rows else ()
    sub_tuple = sub_rows[0] if sub_rows else ()

    col_map = build_col_map(header_tuple, sub_tuple)
    has_category = 'category' in col_map

    # Find monthly columns
    jan_col = col_map.get('monthly_jan')
    if jan_col is None:
        # fallback: scan sub_row for 'jan'
        for ci, v in enumerate(sub_tuple):
            if v and str(v).strip().lower() == 'jan':
                jan_col = ci
                col_map['monthly_jan'] = ci
                break

    monthly_cols = resolve_monthly_cols(sub_tuple, jan_col) if jan_col is not None else {}

    # Resolve acc_depr_curr and nbv_curr from sub_row dates
    # They appear after the monthly columns
    if jan_col and monthly_cols:
        last_month_col = max(monthly_cols.values()) if monthly_cols else jan_col + 11
        for ci in range(last_month_col + 1, min(last_month_col + 5, len(sub_tuple))):
            v = sub_tuple[ci] if ci < len(sub_tuple) else None
            if v is not None and 'acc_depr_curr' not in col_map:
                col_map['acc_depr_curr'] = ci
            elif v is not None and 'nbv_curr' not in col_map and 'acc_depr_curr' in col_map:
                col_map['nbv_curr'] = ci
                break

    # Determine acc_depr_prev and nbv_prev from the columns before dep_expense
    # They appear right after dep_period_remain and before dep_expense
    if 'dep_period_remain' in col_map and 'acc_depr_prev' not in col_map:
        remain_col = col_map['dep_period_remain']
        col_map['acc_depr_prev'] = remain_col + 1
        col_map['nbv_prev'] = remain_col + 2
        col_map['dep_expense'] = remain_col + 3

    parsed: dict[str, tuple[dict, list]] = {}

    for row in ws.iter_rows(min_row=data_start_row, values_only=True):
        # Row must start with a numeric No.
        no_col = col_map.get('no', 0)
        if no_col >= len(row):
            continue
        if row[no_col] is None or not isinstance(row[no_col], (int, float)):
            continue

        def get(field, default=None):
            ci = col_map.get(field)
            if ci is None or ci >= len(row):
                return default
            return row[ci]

        asset_no = to_str(get('asset_no'))
        if not asset_no or asset_no == '-':
            asset_no = None

        ax_no = to_str(get('fixed_asset_number_ax'))
        if not ax_no or ax_no == '-':
            ax_no = None

        # Must have at least AX number to import
        if not ax_no:
            continue  # skip aset tanpa AX number

        # Use AX number as asset_no fallback if not provided
        if not asset_no:
            asset_no = ax_no

        name = to_str(get('name')) or asset_no

        # Category: from column only. If file has no Category column, leave None.
        # Never derive from site_location — user inputs category manually.
        if has_category:
            category = to_str(get('category'))
        else:
            category = None  # preserve existing DB value on upsert

        data = dict(
            no=to_int(get('no')),
            site_location=to_str(get('site_location')),
            job=to_str(get('job')),
            account_no=to_int(get('account_no')),
            category=category,
            asset_no=asset_no,
            fixed_asset_number_ax=ax_no,  # already validated above
            purchase_date=to_date(get('purchase_date')),
            group_name=to_str(get('group_name')),
            voucher_no=to_str(get('voucher_no')),
            name=name,
            maker_type_location=to_str(get('maker_type_location')),
            capacity_size_user=to_str(get('capacity_size_user')),
            year=to_int(get('year')),
            police_no=to_str(get('police_no')),
            machine_no=to_str(get('machine_no')),
            chasis_no=to_str(get('chasis_no')),
            quantity=to_int(get('quantity')) or 1,
            valas=to_str(get('valas')),
            purchase_price=to_decimal(get('purchase_price')),
            monthly_depreciation=to_decimal(get('monthly_depreciation')),
            depreciation_period_total=to_int(get('dep_period_total')),
            dep_period_acc_prev_year=to_decimal(get('dep_period_acc_prev')),
            dep_period_yearly=to_decimal(get('dep_period_yearly')),
            dep_period_until_year=to_decimal(get('dep_period_until')),
            dep_period_remain=to_decimal(get('dep_period_remain')),
            acc_depreciation_prev=to_decimal(get('acc_depr_prev')),
            net_book_value_prev=to_decimal(get('nbv_prev')),
            dep_expense_current=to_decimal(get('dep_expense')),
            acc_depreciation_curr=to_decimal(get('acc_depr_curr')),
            net_book_value_curr=to_decimal(get('nbv_curr')),
            status_additional=bool(get('status_additional')) if get('status_additional') else False,
            status_disposals=bool(get('status_disposals')) if get('status_disposals') else False,
            condition=to_str(get('condition')),
            photo_status=to_str(get('photo_status')),
            remark=to_str(get('remark')),
            year_ref=year_ref,
        )

        months = []
        for month, ci in monthly_cols.items():
            if ci < len(row):
                months.append((month, to_decimal(row[ci]) or Decimal("0")))

        # Same AX twice in one file: the last occurrence wins (never insert twice).
        parsed[ax_no] = (data, months)

    if not parsed:
        return 0

    # ---- Phase 2: load every existing asset in a handful of queries --------
    existing_by_ax: dict[str, FixedAsset] = {}
    for chunk in _chunks(list(parsed.keys()), 1000):
        rows_found = db.query(FixedAsset).filter(
            FixedAsset.year_ref == year_ref,
            FixedAsset.fixed_asset_number_ax.in_(chunk),
        )
        for asset in rows_found:
            existing_by_ax[asset.fixed_asset_number_ax] = asset

    # ---- Phase 3: upsert assets (single flush for the new ones) ------------
    touched: list[FixedAsset] = []
    created: list[FixedAsset] = []

    for ax_no, (data, _) in parsed.items():
        asset = existing_by_ax.get(ax_no)
        if asset is not None:
            for key, value in data.items():
                # Preserve existing category if new file has no Category column
                if key == 'category' and not has_category and asset.category:
                    continue
                setattr(asset, key, value)
        else:
            asset = FixedAsset(**data)
            db.add(asset)
            created.append(asset)
            existing_by_ax[ax_no] = asset
        touched.append(asset)

    if created:
        db.flush()  # assigns every primary key in one round-trip

    # ---- Phase 4: replace monthly rows in bulk -----------------------------
    for chunk in _chunks([asset.id for asset in touched], 1000):
        db.query(DepreciationMonthly).filter(
            DepreciationMonthly.asset_id.in_(chunk),
            DepreciationMonthly.year == year_ref,
        ).delete(synchronize_session=False)

    monthly_rows = [
        DepreciationMonthly(
            asset_id=existing_by_ax[ax_no].id,
            year=year_ref,
            month=month,
            amount=amount,
        )
        for ax_no, (_, months) in parsed.items()
        for month, amount in months
    ]
    if monthly_rows:
        db.bulk_save_objects(monthly_rows)

    return len(parsed)


def import_approval_sheet(ws, year_ref: int, db: Session) -> int:
    """Import acquisition/disposal/transfer rows from a 'List Approval' sheet.

    Column layout (0-indexed), identical in the 2025 and 2026 sheets:
      0:  No.
      1:  Site
      2:  Job
      3:  Fixed Asset Number AX
      4:  Asset No. (internal, e.g. CLC-A-002)
      5:  Application No (e.g. 001/CLC/FA-Disp/III/2026)
      6:  (empty / sub-number)
      7:  (empty / sub-number)
      8:  Remark date (2025 only — fallback for the transaction date)
      9:  Purchase / Disposed Date (primary)
      10: Bookslip No.
      11: Name of Fixed Asset
      12: Purchase / Disposal Price
      13: Status — Acquisition column
      14: Status — Disposals column
      15: Vendor / Customer

    Only sheets named 'List Approval *' must be passed here. The 'Disposal 20xx'
    sheet has a completely different layout (cost / acc. depreciation / NBV /
    proceeds) and parsing it with these indices is what used to fill the table
    with garbage rows.
    """
    data_start = 7  # safe default
    for r in range(1, 15):
        row = list(ws.iter_rows(min_row=r, max_row=r, values_only=True))[0]
        texts = [str(v).strip().lower() for v in row if v]
        if "site" in texts and "job" in texts:
            data_start = r + 2  # skip the two header rows
            break

    # ---- Phase 1: parse rows (no DB round-trips) ---------------------------
    parsed: list[dict] = []
    for row in ws.iter_rows(min_row=data_start, values_only=True):
        if not row or len(row) < 4:
            continue

        def cell(index: int):
            return row[index] if len(row) > index else None

        site = clean_cell(cell(1))
        job = clean_cell(cell(2))
        if not site and not job:
            continue

        fixed_asset_no = clean_cell(cell(3))
        asset_no = clean_cell(cell(4))
        application = clean_cell(cell(5))
        transaction_date = to_date(cell(9)) or to_date(cell(8))
        bookslip_no = clean_cell(cell(10))
        asset_name = clean_cell(cell(11))
        price = to_decimal(cell(12))
        vendor_customer = clean_cell(cell(15))

        # Sheets carry approval rows that were never filled in (#N/A name and
        # no AX number). They are placeholders, not movements.
        if not asset_name and not fixed_asset_no:
            continue

        status = normalize_approval_type(
            clean_cell(cell(13)) or clean_cell(cell(14)),
            application,
        )

        parsed.append({
            "site": site,
            "job": job,
            "fixed_asset_no": fixed_asset_no,
            "asset_no": asset_no,
            "application": application,
            "transaction_date": transaction_date,
            "bookslip_no": bookslip_no,
            "asset_name": asset_name,
            "price": price,
            "status": status,
            "vendor_customer": vendor_customer,
            "year_ref": year_ref,
        })

    if not parsed:
        return 0

    # ---- Phase 2: resolve asset links in bulk ------------------------------
    ax_values = sorted({
        value
        for item in parsed
        for value in (item["fixed_asset_no"], item["asset_no"])
        if value
    })
    asset_by_no: dict[str, int] = {}
    for chunk in _chunks(ax_values, 1000):
        for asset_id, ax_no in db.query(FixedAsset.id, FixedAsset.fixed_asset_number_ax).filter(
            FixedAsset.fixed_asset_number_ax.in_(chunk)
        ):
            asset_by_no[ax_no] = asset_id
        for asset_id, asset_no in db.query(FixedAsset.id, FixedAsset.asset_no).filter(
            FixedAsset.asset_no.in_(chunk)
        ):
            asset_by_no.setdefault(asset_no, asset_id)

    # ---- Phase 3: upsert by (year, asset, batch, type) ---------------------
    existing: dict[tuple, AcquisitionDisposal] = {}
    for record in db.query(AcquisitionDisposal).filter(
        AcquisitionDisposal.year_ref == year_ref
    ):
        existing[
            approval_key(
                record.year_ref,
                record.fixed_asset_no,
                record.asset_name,
                record.bookslip_no,
                record.application,
                # Normalise on the way in too, so a legacy row whose status is
                # still "Disposals" is updated instead of duplicated.
                normalize_approval_type(record.status, record.application),
            )
        ] = record

    written = 0
    for item in parsed:
        key = approval_key(
            item["year_ref"],
            item["fixed_asset_no"],
            item["asset_name"],
            item["bookslip_no"],
            item["application"],
            item["status"],
        )
        asset_id = (
            asset_by_no.get(item["fixed_asset_no"] or "")
            or asset_by_no.get(item["asset_no"] or "")
        )

        record = existing.get(key)
        if record is None:
            record = AcquisitionDisposal(asset_id=asset_id, **{
                k: v for k, v in item.items() if k != "asset_no"
            })
            db.add(record)
            existing[key] = record
            written += 1
            continue

        changed = False
        for field, value in item.items():
            if field in ("asset_no", "year_ref"):
                continue
            if getattr(record, field) != value:
                setattr(record, field, value)
                changed = True
        if asset_id is not None and record.asset_id != asset_id:
            record.asset_id = asset_id
            changed = True
        if changed:
            written += 1

    return written


def run_import(xlsx_path: str, wb=None):
    """
    Main entry point. Accepts either a file path (str) or a pre-loaded
    openpyxl workbook (for use from FastAPI endpoint).
    """
    if wb is None:
        print(f"Opening: {xlsx_path}")
        wb = openpyxl.load_workbook(xlsx_path, data_only=True)

    print(f"Sheets: {wb.sheetnames}")

    # Detect year_ref from sheet date or filename
    year_ref = 2026  # default

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    results = {}
    try:
        # Import FA sheets
        for sheet_name in wb.sheetnames:
            if sheet_name.startswith('FA_'):
                try:
                    yr = int(sheet_name.split('_')[1])
                except (IndexError, ValueError):
                    yr = year_ref
                n = import_fa_sheet(wb[sheet_name], yr, db)
                results[sheet_name] = n
                print(f"  {sheet_name}: {n} assets imported (year_ref={yr})")
                db.commit()

        # Import List Approval sheets only. The "Disposal 20xx" sheet is a
        # different report (cost / acc. depreciation / NBV / proceeds) and must
        # never be parsed with the List Approval column layout.
        for sheet_name in wb.sheetnames:
            sn_lower = sheet_name.lower()
            if 'list approval' in sn_lower:
                # Extract year from sheet name
                import re
                years_found = re.findall(r'20\d{2}', sheet_name)
                yr = int(years_found[-1]) if years_found else year_ref
                n = import_approval_sheet(wb[sheet_name], yr, db)
                results[sheet_name] = n
                print(f"  {sheet_name}: {n} records imported")
                db.commit()

        total_assets = sum(v for k, v in results.items() if k.startswith('FA_'))
        print(f"\nDone. Total assets: {total_assets}")
        return results

    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import Excel (auto-detect format)")
    parser.add_argument(
        "--file",
        default=r"E:\Asset-depre\Est-Depreciation_Calculation_for_2026_.xlsx",
        help="Path to the Excel file",
    )
    args = parser.parse_args()
    run_import(args.file)
