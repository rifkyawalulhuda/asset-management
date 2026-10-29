"""Normalise the stored depreciation summary fields to the full-year convention.

The logic lives in `app.services.depreciation_normalize` so that an import applies
exactly the same rules; this module is the command-line entry point.

Usage:
    python -m scripts.normalize_depreciation                 # dry run
    python -m scripts.normalize_depreciation --year 2026     # one year
    python -m scripts.normalize_depreciation --confirm       # write
"""
import argparse
import json
import os
from datetime import datetime
from decimal import Decimal

from app.database import SessionLocal
from app.models.depreciation_monthly import DepreciationMonthly
from app.models.fixed_asset import FixedAsset
from app.services.depreciation_normalize import (
    CENT,
    NORMALISED_FIELDS,
    allowed_months,
    cap_at_cost,
    differs,
    load_schedules,
    target_values,
)


def collect(db, year: int | None):
    schedules = load_schedules(db)
    query = db.query(FixedAsset).order_by(FixedAsset.fixed_asset_number_ax)
    if year:
        query = query.filter(FixedAsset.year_ref == year)

    changes = []
    truncations = []
    non_depreciable = []
    skipped = []
    for asset in query.all():
        ref_year = asset.year_ref or 2026
        amounts = schedules.get((asset.id, ref_year))
        if not amounts:
            skipped.append((asset, "no monthly rows"))
            continue

        if not asset.depreciation_period_total and asset.purchase_price:
            price = Decimal(str(asset.purchase_price))
            current_nbv = asset.net_book_value_curr
            current_acc = asset.acc_depreciation_curr
            if (current_nbv is None or abs(Decimal(str(current_nbv)) - price) > CENT) or current_acc is None:
                non_depreciable.append((asset, price))
                continue

        limit = allowed_months(asset)
        trimmed = amounts
        if limit is not None:
            trimmed = {month: (Decimal("0") if month > limit else amount) for month, amount in amounts.items()}
        trimmed = cap_at_cost(asset, trimmed)
        if any(trimmed[month] != amounts[month] for month in amounts):
            truncations.append((asset, limit, amounts, trimmed))

        target = target_values(asset, trimmed)
        if target is None:
            skipped.append((asset, "missing price, period or prior-period months"))
            continue
        if differs(asset, target):
            changes.append((asset, target))

    return changes, truncations, non_depreciable, skipped


def report(changes, truncations, non_depreciable, skipped, db):
    print(f"assets needing normalisation: {len(changes)}")
    print(f"monthly schedules to truncate: {len(truncations)}")
    print(f"non-depreciable assets with a wrong carrying value: {len(non_depreciable)}")
    print(f"assets skipped               : {len(skipped)}\n")

    if non_depreciable:
        print("non-depreciable assets (no useful life) whose NBV is not the cost")
        for asset, price in non_depreciable[:12]:
            print(
                f"  {asset.fixed_asset_number_ax:12} y{asset.year_ref} "
                f"cost={price:,.0f} nbv={asset.net_book_value_curr} acc={asset.acc_depreciation_curr} "
                f"group={asset.group_name or '-'}"
            )
        if len(non_depreciable) > 12:
            print(f"  … {len(non_depreciable) - 12} more")
        print()

    if truncations:
        print("months charged beyond the useful life")
        for asset, limit, before, after in truncations[:12]:
            charged = sum(1 for amount in before.values() if amount > 0)
            kept = sum(1 for amount in after.values() if amount > 0)
            removed = sum(before.values(), Decimal("0")) - sum(after.values(), Decimal("0"))
            detail = (
                f"allowed={limit} months {charged} -> {kept}"
                if charged != kept
                else f"rounding removed {removed:.2f}"
            )
            print(
                f"  {asset.fixed_asset_number_ax:12} y{asset.year_ref} "
                f"period={asset.depreciation_period_total} prior={asset.dep_period_acc_prev_year} {detail}"
            )
        if len(truncations) > 12:
            print(f"  … {len(truncations) - 12} more")
        print()

    before_expense = Decimal("0")
    after_expense = Decimal("0")
    before_acc = Decimal("0")
    after_acc = Decimal("0")
    for asset, target in changes:
        before_expense += Decimal(str(asset.dep_expense_current or 0))
        after_expense += target["dep_expense_current"]
        before_acc += Decimal(str(asset.acc_depreciation_curr or 0))
        after_acc += target["acc_depreciation_curr"]

    print("totals over the affected rows")
    print(f"  yearly expense   : {before_expense:>22,.2f} -> {after_expense:>22,.2f}  (delta {after_expense - before_expense:,.2f})")
    print(f"  acc. depreciation: {before_acc:>22,.2f} -> {after_acc:>22,.2f}  (delta {after_acc - before_acc:,.2f})")

    print("\nlargest changes")
    ranked = sorted(
        changes,
        key=lambda item: abs(item[1]["dep_expense_current"] - Decimal(str(item[0].dep_expense_current or 0))),
        reverse=True,
    )
    for asset, target in ranked[:12]:
        print(
            f"  {asset.fixed_asset_number_ax:12} y{asset.year_ref} "
            f"months {asset.dep_period_yearly} -> {target['dep_period_yearly']} | "
            f"expense {Decimal(str(asset.dep_expense_current or 0)):,.0f} -> {target['dep_expense_current']:,.0f} | "
            f"acc {Decimal(str(asset.acc_depreciation_curr or 0)):,.0f} -> {target['acc_depreciation_curr']:,.0f}"
        )

    if skipped:
        print("\nskipped (left exactly as they are)")
        for asset, reason in skipped[:10]:
            print(f"  {asset.fixed_asset_number_ax or asset.asset_no:12} y{asset.year_ref}  {reason}")
        if len(skipped) > 10:
            print(f"  … {len(skipped) - 10} more")


def snapshot(changes, truncations, db) -> str | None:
    if not changes and not truncations:
        return None
    payload = {
        "created_at": datetime.now().isoformat(),
        "kind": "normalize_depreciation",
        "assets": [
            {
                "id": asset.id,
                "fixed_asset_number_ax": asset.fixed_asset_number_ax,
                "year_ref": asset.year_ref,
                **{
                    field: (str(getattr(asset, field)) if getattr(asset, field) is not None else None)
                    for field in NORMALISED_FIELDS
                },
            }
            for asset, _ in changes
        ],
        "monthly": [
            {
                "asset_id": asset.id,
                "year": asset.year_ref or 2026,
                "months": {str(month): str(amount) for month, amount in before.items()},
            }
            for asset, _limit, before, _after in truncations
        ],
    }
    directory = os.path.join(os.path.dirname(os.path.dirname(__file__)), "import_snapshots")
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(directory, f"normalize_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False)
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, default=None)
    parser.add_argument("--confirm", action="store_true")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        changes, truncations, non_depreciable, skipped = collect(db, args.year)
        report(changes, truncations, non_depreciable, skipped, db)

        if not args.confirm:
            print("\ndry run — pass --confirm to write")
            return

        path = snapshot(changes, truncations, db)
        if path:
            print(f"\nsnapshot: {path}")

        for asset, _limit, _before, after in truncations:
            year = asset.year_ref or 2026
            for month, amount in after.items():
                db.query(DepreciationMonthly).filter(
                    DepreciationMonthly.asset_id == asset.id,
                    DepreciationMonthly.year == year,
                    DepreciationMonthly.month == month,
                ).update({DepreciationMonthly.amount: amount}, synchronize_session=False)

        for asset, target in changes:
            for field, value in target.items():
                setattr(asset, field, value)

        for asset, price in non_depreciable:
            asset.acc_depreciation_curr = Decimal("0")
            asset.acc_depreciation_prev = Decimal("0")
            asset.net_book_value_curr = price
            asset.net_book_value_prev = price

        db.commit()
        print(
            f"assets updated: {len(changes)}, schedules truncated: {len(truncations)}, "
            f"non-depreciable carrying values fixed: {len(non_depreciable)}"
        )

        remaining, remaining_truncations, remaining_non_dep, _ = collect(db, args.year)
        print(f"remaining out of convention: {len(remaining)}")
        print(f"remaining schedules to truncate: {len(remaining_truncations)}")
        print(f"remaining non-depreciable with wrong NBV: {len(remaining_non_dep)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()