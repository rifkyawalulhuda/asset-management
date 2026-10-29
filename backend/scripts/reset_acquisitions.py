"""Reset acquisition/disposal rows for selected years, then optionally re-import.

The 2025/2026 rows are duplicated and partially column-shifted because older
importer versions appended rows on every run and parsed the "Disposal 20xx"
sheet with the wrong layout. Re-importing the workbook from a clean slate is
deterministic; deleting only the years present in the workbook keeps 2021/2022
untouched.

Run from the `backend/` directory:

    python scripts/reset_acquisitions.py --dry-run
    python scripts/reset_acquisitions.py --confirm
    python scripts/reset_acquisitions.py --year 2026 --confirm \
        --import-file "../Fixed Asset_202606.xlsx"
"""
import argparse
import os
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import AcquisitionDisposal
from app.utils.excel_importer_v2 import run_import


def summarize(db, years: list[int]) -> dict[int, Counter]:
    result: dict[int, Counter] = defaultdict(Counter)
    rows = (
        db.query(AcquisitionDisposal.year_ref, AcquisitionDisposal.status)
        .filter(AcquisitionDisposal.year_ref.in_(years))
        .all()
    )
    for year_ref, status in rows:
        result[year_ref][status or "(none)"] += 1
    return result


def print_summary(title: str, summary: dict[int, Counter]) -> None:
    print(title)
    total = 0
    for year in sorted(summary):
        counter = summary[year]
        count = sum(counter.values())
        total += count
        breakdown = ", ".join(f"{name}: {n}" for name, n in counter.most_common(6))
        print(f"  {year}: {count} rows" + (f"  [{breakdown}]" if breakdown else ""))
    print(f"  total: {total} rows")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--year",
        type=int,
        action="append",
        help="Year to reset (repeatable). Default: 2025 and 2026.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the report only (the default when --confirm is absent).",
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Actually delete the rows. Without this flag only a report is printed.",
    )
    parser.add_argument(
        "--import-file",
        help="Workbook to import after the reset (e.g. '../Fixed Asset_202606.xlsx').",
    )
    args = parser.parse_args()

    if args.confirm and args.dry_run:
        parser.error("--confirm and --dry-run are mutually exclusive")

    years = sorted(set(args.year or [2025, 2026]))
    db = SessionLocal()
    try:
        before = summarize(db, years)
        print_summary(f"Before - years {years}:", before)

        if not args.confirm:
            print("\nDRY RUN - nothing was deleted. Re-run with --confirm to apply.")
            return 0

        deleted = (
            db.query(AcquisitionDisposal)
            .filter(AcquisitionDisposal.year_ref.in_(years))
            .delete(synchronize_session=False)
        )
        db.commit()
        print(f"\nDeleted {deleted} rows for years {years}.")

        after = summarize(db, years)
        print_summary("After:", after)

        if args.import_file:
            path = os.path.abspath(args.import_file)
            if not os.path.exists(path):
                print(f"ERROR: workbook not found: {path}")
                return 1
            print(f"\nImporting {path} ...")
            results = run_import(path)
            print("Import results:")
            for sheet, count in results.items():
                print(f"  {sheet}: {count} rows written")
            print_summary("After import:", summarize(db, years))
        else:
            print("\nNo --import-file given. Upload the workbook from the Import page.")

        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())