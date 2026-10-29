import io
import time

import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.import_run import ImportRun
from app.services.import_service import (
    ImportRejected,
    apply_plan,
    build_plan,
    diff_plan,
    fingerprint,
)

router = APIRouter(prefix="/import", tags=["import"])

MAX_UPLOAD_MB = 40
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024


def _load(file: UploadFile, contents: bytes):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="File must be .xlsx or .xls")
    size = file.size if file.size is not None else len(contents)
    if size > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({size / 1024 / 1024:.1f} MB). Maximum is {MAX_UPLOAD_MB} MB.",
        )
    try:
        return openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read Excel file: {exc}")


def _plan_for(file: UploadFile, contents: bytes):
    workbook = _load(file, contents)
    try:
        return build_plan(workbook, file.filename or "<upload>", fingerprint(contents))
    except ImportRejected as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    finally:
        workbook.close()


# NOTE: these endpoints are sync `def` on purpose. FastAPI runs them in a worker
# thread, so the heavy openpyxl + DB work never blocks the event loop.
@router.post("/preview")
def preview_import(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Parse the workbook and report what would change. Writes nothing."""
    started = time.perf_counter()
    contents = file.file.read()
    plan = _plan_for(file, contents)
    summary = diff_plan(db, plan)
    summary["elapsed_ms"] = round((time.perf_counter() - started) * 1000)
    return summary


@router.post("/excel")
def import_excel(
    file: UploadFile = File(...),
    confirm: bool = Query(False, description="Apply the import. Without it the call only previews."),
    expected_hash: str | None = Query(None, description="Hash shown by the preview, for safety."),
    db: Session = Depends(get_db),
):
    """Apply the workbook.

    With `confirm=false` this behaves like `/preview`, so an accidental POST can
    never write. Applying is a single transaction: either the whole workbook
    lands or nothing does.
    """
    started = time.perf_counter()
    contents = file.file.read()
    plan = _plan_for(file, contents)

    summary = diff_plan(db, plan)
    if not confirm:
        summary["elapsed_ms"] = round((time.perf_counter() - started) * 1000)
        summary["applied"] = False
        return summary

    if expected_hash and expected_hash != plan.file_hash:
        raise HTTPException(
            status_code=409,
            detail="The file differs from the one that was previewed. Preview it again before applying.",
        )

    try:
        run = apply_plan(db, plan, summary, elapsed_ms=round((time.perf_counter() - started) * 1000))
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import failed, nothing was written: {exc}")

    total_assets = run.assets_created + run.assets_updated
    message = (
        f"Imported {total_assets} assets "
        f"({run.assets_created} new, {run.assets_updated} updated, "
        f"{run.assets_unchanged} unchanged, {run.assets_deactivated} deactivated)"
    )

    return {
        "applied": True,
        "message": message,
        "run_id": run.id,
        "details": {
            "assets_created": run.assets_created,
            "assets_updated": run.assets_updated,
            "assets_unchanged": run.assets_unchanged,
            "assets_deactivated": run.assets_deactivated,
            "assets_reactivated": run.assets_reactivated,
            "approval_created": run.approval_created,
            "approval_updated": run.approval_updated,
        },
        "normalized": summary.get("normalized"),
        "years": run.years,
        "snapshot": run.snapshot_path,
        "elapsed_ms": run.elapsed_ms,
    }


@router.get("/runs")
def list_import_runs(limit: int = Query(20, ge=1, le=200), db: Session = Depends(get_db)):
    """Recent imports, newest first."""
    runs = (
        db.query(ImportRun)
        .order_by(ImportRun.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": run.id,
            "filename": run.filename,
            "file_hash": run.file_hash,
            "status": run.status,
            "years": run.years,
            "assets_created": run.assets_created,
            "assets_updated": run.assets_updated,
            "assets_unchanged": run.assets_unchanged,
            "assets_deactivated": run.assets_deactivated,
            "assets_reactivated": run.assets_reactivated,
            "approval_created": run.approval_created,
            "approval_updated": run.approval_updated,
            "elapsed_ms": run.elapsed_ms,
            "snapshot_path": run.snapshot_path,
            "created_at": run.created_at,
        }
        for run in runs
    ]