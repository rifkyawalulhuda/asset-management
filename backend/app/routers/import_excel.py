import io
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.utils.excel_importer_v2 import run_import
import openpyxl

router = APIRouter(prefix="/import", tags=["import"])


@router.post("/excel")
async def import_excel(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be .xlsx or .xls")

    contents = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read Excel file: {e}")

    try:
        results = run_import(xlsx_path="<upload>", wb=wb)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {e}")

    total_assets = sum(v for k, v in results.items() if k.startswith('FA_'))
    message = f"Imported {total_assets} assets: " + ", ".join(f"{k}: {v}" for k, v in results.items())

    return {"message": message, "details": results}
