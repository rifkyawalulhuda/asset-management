from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.assets import router as assets_router
from app.routers.summary import router as summary_router
from app.routers.acquisitions import router as acquisitions_router
from app.routers.import_excel import router as import_router
from app.routers.forecast import router as forecast_router
from app.routers.export import router as export_router
from app.routers.planned_assets import router as planned_assets_router

app = FastAPI(
    title="Fixed Asset & Depreciation API",
    description="PT. Sankyu Indonesia International — Fixed Asset Management",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets_router, prefix="/api")
app.include_router(summary_router, prefix="/api")
app.include_router(acquisitions_router, prefix="/api")
app.include_router(import_router, prefix="/api")
app.include_router(forecast_router, prefix="/api")
app.include_router(export_router, prefix="/api")
app.include_router(planned_assets_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
