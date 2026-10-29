import io
import time

import openpyxl
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.utils.excel_importer_v2 import run_import

router = APIRouter(prefix="/import", tags=["import"])

MAX_UPLOAD_MB = 40
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024


# NOTE: this endpoint is intentionally a sync `def` (not `async def`).
# FastAPI runs sync endpoints in a worker thread, so the heavy openpyxl + DB
# work below never blocks the event loop — the rest of the API stays
# responsive while a large workbook is being imported.
@router.post("/excel")
def import_excel(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="File must be .xlsx or .xls")

    size = file.size
    if size is not None and size > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File terlalu besar ({size / 1024 / 1024:.1f} MB). Maksimal {MAX_UPLOAD_MB} MB.",
        )

    started = time.perf_counter()
    contents = file.file.read()

    try:
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read Excel file: {exc}")

    try:
        results = run_import(xlsx_path="<upload>", wb=wb)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Import failed: {exc}")
    finally:
        wb.close()

    total_assets = sum(v for k, v in results.items() if k.startswith("FA_"))
    message = f"Imported {total_assets} assets: " + ", ".join(f"{k}: {v}" for k, v in results.items())

    return {
        "message": message,
        "details": results,
        "elapsed_ms": round((time.perf_counter() - started) * 1000),
    }