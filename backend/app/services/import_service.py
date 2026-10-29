"""Import pipeline: parse -> diff -> apply.

Split into three steps so the workbook can be inspected before anything is
written. Repeated imports are the normal way this application is updated, and a
single wrong file used to overwrite a thousand rows with no way back.
"""
import hashlib
import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.acquisition_disposal import AcquisitionDisposal
from app.models.depreciation_monthly import DepreciationMonthly
from app.models.fixed_asset import FixedAsset
from app.models.import_run import ImportRun
from app.services.depreciation_normalize import NORMALISED_FIELDS, normalize_year
from app.utils.excel_importer_v2 import (
    approval_key,
    normalize_approval_type,
    parse_approval_sheet,
    parse_fa_sheet,
)

SNAPSHOT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "import_snapshots")

# Category is maintained in the application, keyed to the asset number; the
# workbook has no such column. It must never be overwritten by an import.
APP_OWNED_FIELDS = {"category"}

# Fields that are reported in the preview but not treated as a change on their own.
#
# The normalised columns are derived from the monthly schedule by this very
# pipeline, so comparing them against the workbook's snapshot columns would
# report hundreds of changes on every import, none of them actionable.
IGNORED_IN_DIFF = {"no", "category", *NORMALISED_FIELDS}


class ImportRejected(Exception):
    """The workbook is not something this application can import."""


@dataclass
class AssetSection:
    sheet: str
    year_ref: int
    rows: Dict[str, Any] = field(default_factory=dict)
    has_category: bool = False


@dataclass
class ApprovalSection:
    sheet: str
    year_ref: int
    rows: List[dict] = field(default_factory=list)


@dataclass
class Plan:
    filename: str
    file_hash: str
    assets: List[AssetSection] = field(default_factory=list)
    approvals: List[ApprovalSection] = field(default_factory=list)

    @property
    def years(self) -> List[int]:
        return sorted({section.year_ref for section in self.assets})


def fingerprint(contents: bytes) -> str:
    return hashlib.sha256(contents).hexdigest()


def build_plan(wb, filename: str, file_hash: str) -> Plan:
    """Read the workbook into memory. Nothing is written."""
    plan = Plan(filename=filename, file_hash=file_hash)

    for sheet_name in wb.sheetnames:
        if sheet_name.startswith("FA_"):
            try:
                year_ref = int(sheet_name.split("_")[1])
            except (IndexError, ValueError):
                continue
            parsed, has_category = parse_fa_sheet(wb[sheet_name], year_ref)
            plan.assets.append(
                AssetSection(
                    sheet=sheet_name,
                    year_ref=year_ref,
                    rows=parsed,
                    has_category=has_category,
                )
            )

    for sheet_name in wb.sheetnames:
        if "list approval" not in sheet_name.lower():
            continue
        years = re.findall(r"20\d{2}", sheet_name)
        year_ref = int(years[-1]) if years else (plan.years[0] if plan.years else 2026)
        rows = parse_approval_sheet(wb[sheet_name], year_ref)
        if rows:
            plan.approvals.append(ApprovalSection(sheet=sheet_name, year_ref=year_ref, rows=rows))

    if not plan.assets and not plan.approvals:
        raise ImportRejected(
            "No importable sheet found. Expected a sheet named FA_<year> or containing "
            "'List Approval'."
        )

    return plan


def _decimal_equal(left, right) -> bool:
    if left is None and right is None:
        return True
    if left is None or right is None:
        return False
    return Decimal(str(left)) == Decimal(str(right))


def _changed_fields(asset: FixedAsset, data: dict) -> List[str]:
    changed = []
    for key, value in data.items():
        if key in IGNORED_IN_DIFF:
            continue
        current = getattr(asset, key, None)
        if isinstance(value, Decimal) or isinstance(current, Decimal):
            same = _decimal_equal(current, value)
        else:
            same = current == value
        if not same:
            changed.append(key)
    return changed


def diff_plan(db: Session, plan: Plan) -> Dict[str, Any]:
    """Compare the workbook with the database without writing anything."""
    summary = {
        "filename": plan.filename,
        "file_hash": plan.file_hash,
        "years": plan.years,
        "assets": {"created": 0, "updated": 0, "unchanged": 0, "deactivated": 0, "reactivated": 0},
        "approvals": {"created": 0, "updated": 0},
        "create_samples": [],
        "update_samples": [],
        "deactivate_samples": [],
        "reactivate_samples": [],
        "warnings": [],
    }

    for section in plan.assets:
        existing = (
            db.query(FixedAsset)
            .filter(FixedAsset.year_ref == section.year_ref)
            .all()
        )
        by_ax = {asset.fixed_asset_number_ax: asset for asset in existing if asset.fixed_asset_number_ax}

        for ax_no, (data, _months) in section.rows.items():
            asset = by_ax.get(ax_no)
            if asset is None:
                summary["assets"]["created"] += 1
                if len(summary["create_samples"]) < 25:
                    summary["create_samples"].append({
                        "ax": ax_no,
                        "name": data.get("name"),
                        "purchase_price": float(data["purchase_price"]) if data.get("purchase_price") else None,
                    })
                continue

            if not asset.is_active:
                summary["assets"]["reactivated"] += 1
                if len(summary["reactivate_samples"]) < 25:
                    summary["reactivate_samples"].append({"ax": ax_no, "name": asset.name})

            changed = _changed_fields(asset, data)
            if changed:
                summary["assets"]["updated"] += 1
                if len(summary["update_samples"]) < 25:
                    summary["update_samples"].append({
                        "ax": ax_no,
                        "name": asset.name,
                        "fields": changed[:8],
                        "field_count": len(changed),
                    })
            else:
                summary["assets"]["unchanged"] += 1

        # Only assets that carry a number can be proven absent; a row without one
        # is left untouched rather than guessed at.
        for asset in existing:
            if not asset.is_active or not asset.fixed_asset_number_ax:
                continue
            if asset.fixed_asset_number_ax in section.rows:
                continue
            summary["assets"]["deactivated"] += 1
            if len(summary["deactivate_samples"]) < 50:
                summary["deactivate_samples"].append({
                    "ax": asset.fixed_asset_number_ax,
                    "name": asset.name,
                    "purchase_price": float(asset.purchase_price) if asset.purchase_price else None,
                    "dep_expense": float(asset.dep_expense_current) if asset.dep_expense_current else None,
                })

    for section in plan.approvals:
        existing_keys = {
            approval_key(
                record.year_ref,
                record.fixed_asset_no,
                record.asset_name,
                record.bookslip_no,
                record.application,
                normalize_approval_type(record.status, record.application),
            )
            for record in db.query(AcquisitionDisposal).filter(
                AcquisitionDisposal.year_ref == section.year_ref
            )
        }
        for item in section.rows:
            key = approval_key(
                item["year_ref"],
                item["fixed_asset_no"],
                item["asset_name"],
                item["bookslip_no"],
                item["application"],
                item["status"],
            )
            summary["approvals"]["created" if key not in existing_keys else "updated"] += 1

    if not plan.years:
        summary["warnings"].append("The workbook has no FA_<year> sheet, so no asset list was read.")
    if summary["assets"]["deactivated"]:
        summary["warnings"].append(
            f"{summary['assets']['deactivated']} asset(s) are in the database but not in this file and "
            "will be marked inactive (they leave every report, but the rows are kept)."
        )
    if summary["assets"]["created"] > 50:
        summary["warnings"].append(
            f"{summary['assets']['created']} new assets — verify this is the intended file."
        )

    return summary


def _snapshot(db: Session, plan: Plan, summary: Dict[str, Any]) -> Optional[str]:
    """Write the current state of every row an import can touch.

    Rows that are only updated matter as much as rows that are deactivated, so
    the whole year is captured together with its monthly schedule. That makes the
    file a real rollback artifact instead of a partial note.
    """
    payload = {"created_at": datetime.now().isoformat(), "plan": summary, "assets": [], "monthly": []}
    for section in plan.assets:
        year = section.year_ref
        assets = db.query(FixedAsset).filter(FixedAsset.year_ref == year).all()
        for asset in assets:
            payload["assets"].append({
                "id": asset.id,
                "is_active": asset.is_active,
                **{
                    column.name: (str(getattr(asset, column.name)) if getattr(asset, column.name) is not None else None)
                    for column in FixedAsset.__table__.columns
                    if column.name not in ("id", "created_at", "updated_at")
                },
            })
            for row in asset.depreciation_monthly:
                if row.year != year:
                    continue
                payload["monthly"].append({
                    "asset_id": row.asset_id,
                    "year": row.year,
                    "month": row.month,
                    "amount": str(row.amount) if row.amount is not None else None,
                })

    if not payload["assets"]:
        return None

    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    path = os.path.join(SNAPSHOT_DIR, f"import_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False)
    return path


def apply_plan(db: Session, plan: Plan, summary: Dict[str, Any], elapsed_ms: int = 0) -> ImportRun:
    """Write the plan. The caller owns the transaction: one commit, no partial state."""
    snapshot_path = _snapshot(db, plan, summary)
    now = datetime.now()

    created = updated = unchanged = reactivated = 0
    total_deactivated = 0

    for section in plan.assets:
        existing = {
            asset.fixed_asset_number_ax: asset
            for asset in db.query(FixedAsset).filter(FixedAsset.year_ref == section.year_ref)
            if asset.fixed_asset_number_ax
        }

        touched: List[FixedAsset] = []
        touched_by_ax: Dict[str, FixedAsset] = {}

        for ax_no, (data, months) in section.rows.items():
            asset = existing.get(ax_no)
            if asset is None:
                asset = FixedAsset(**data)
                db.add(asset)
                created += 1
            else:
                if not asset.is_active:
                    asset.is_active = True
                    reactivated += 1
                changed = _changed_fields(asset, data)
                for key, value in data.items():
                    if key in APP_OWNED_FIELDS:
                        continue
                    setattr(asset, key, value)
                if changed:
                    updated += 1
                else:
                    unchanged += 1
            asset.last_seen_at = now
            touched.append(asset)
            touched_by_ax[ax_no] = asset

        deactivated = 0
        for ax_no, asset in existing.items():
            if not asset.is_active:
                continue
            if ax_no in section.rows:
                continue
            asset.is_active = False
            deactivated += 1

        db.flush()

        # Replace the monthly schedule for every asset present in the file.
        ids = [asset.id for asset in touched]
        for start in range(0, len(ids), 1000):
            db.query(DepreciationMonthly).filter(
                DepreciationMonthly.asset_id.in_(ids[start:start + 1000]),
                DepreciationMonthly.year == section.year_ref,
            ).delete(synchronize_session=False)

        monthly_rows = [
            DepreciationMonthly(
                asset_id=touched_by_ax[ax_no].id,
                year=section.year_ref,
                month=month,
                amount=amount,
            )
            for ax_no, (_data, months) in section.rows.items()
            for month, amount in months
        ]
        if monthly_rows:
            db.bulk_save_objects(monthly_rows)

        db.flush()

        # The workbook's summary columns are a snapshot from the day the file was
        # closed, while its monthly columns cover the whole year. Writing both
        # verbatim leaves two different yearly figures for the same assets, so the
        # full-year convention is applied here, in the same transaction.
        #
        # The whole year is normalised, not just the rows in this file: an asset
        # that was deactivated still has a schedule, and leaving it inconsistent
        # would resurface the moment it comes back.
        normalized = normalize_year(db, section.year_ref)
        summary["normalized"] = {
            key: summary.get("normalized", {}).get(key, 0) + value
            for key, value in normalized.items()
        }

        total_deactivated += deactivated

    approval_created = approval_updated = 0

    for section in plan.approvals:
        ax_values = sorted({
            value
            for item in section.rows
            for value in (item["fixed_asset_no"], item["asset_no"])
            if value
        })
        asset_by_no: Dict[str, int] = {}
        for start in range(0, len(ax_values), 1000):
            chunk = ax_values[start:start + 1000]
            for asset_id, ax_no in db.query(FixedAsset.id, FixedAsset.fixed_asset_number_ax).filter(
                FixedAsset.fixed_asset_number_ax.in_(chunk)
            ):
                asset_by_no[ax_no] = asset_id
            for asset_id, asset_no in db.query(FixedAsset.id, FixedAsset.asset_no).filter(
                FixedAsset.asset_no.in_(chunk)
            ):
                asset_by_no.setdefault(asset_no, asset_id)

        existing_records: Dict[tuple, AcquisitionDisposal] = {}
        for record in db.query(AcquisitionDisposal).filter(
            AcquisitionDisposal.year_ref == section.year_ref
        ):
            existing_records[
                approval_key(
                    record.year_ref,
                    record.fixed_asset_no,
                    record.asset_name,
                    record.bookslip_no,
                    record.application,
                    normalize_approval_type(record.status, record.application),
                )
            ] = record

        for item in section.rows:
            key = approval_key(
                item["year_ref"],
                item["fixed_asset_no"],
                item["asset_name"],
                item["bookslip_no"],
                item["application"],
                item["status"],
            )
            asset_id = asset_by_no.get(item["fixed_asset_no"] or "") or asset_by_no.get(item["asset_no"] or "")
            record = existing_records.get(key)

            if record is None:
                record = AcquisitionDisposal(
                    asset_id=asset_id,
                    **{k: v for k, v in item.items() if k != "asset_no"},
                )
                db.add(record)
                existing_records[key] = record
                approval_created += 1
                continue

            changed = False
            for field_name, value in item.items():
                if field_name in ("asset_no", "year_ref"):
                    continue
                if getattr(record, field_name) != value:
                    setattr(record, field_name, value)
                    changed = True
            if asset_id is not None and record.asset_id != asset_id:
                record.asset_id = asset_id
                changed = True
            if changed:
                approval_updated += 1

    run = ImportRun(
        filename=plan.filename,
        file_hash=plan.file_hash,
        status="applied",
        years=",".join(str(year) for year in plan.years),
        assets_created=created,
        assets_updated=updated,
        assets_unchanged=unchanged,
        assets_deactivated=total_deactivated,
        assets_reactivated=reactivated,
        approval_created=approval_created,
        approval_updated=approval_updated,
        elapsed_ms=elapsed_ms,
        snapshot_path=snapshot_path,
        note=(
            f"normalised: {summary['normalized']['updated']} updated, "
            f"{summary['normalized']['truncated']} truncated, "
            f"{summary['normalized']['non_depreciable_fixed']} non-depreciable fixed"
            if summary.get("normalized")
            else None
        ),
    )
    db.add(run)
    db.flush()

    return run