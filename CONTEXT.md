# Project Context: Fixed Asset & Depreciation App
**PT. Sankyu Indonesia International**
Last updated: 2026-07-14

---

## Overview

Web application untuk mengelola Fixed Asset dan kalkulasi depresiasi multi-tahun.
Menggantikan workflow Microsoft Excel dengan CRUD penuh, kalkulasi otomatis, dan laporan per periode.

**Stack:** React (Vite) + FastAPI (Python) + PostgreSQL
**Status:** Production-ready, actively developed

---

## Repository Structure

```
E:\Asset-depre\
├── backend/                          # FastAPI Python backend
│   ├── app/
│   │   ├── main.py                   # FastAPI app entry, CORS, router registration
│   │   ├── config.py                 # Pydantic settings, reads .env
│   │   ├── database.py               # SQLAlchemy engine, SessionLocal, Base, get_db()
│   │   ├── models/
│   │   │   ├── fixed_asset.py        # FixedAsset model (main table)
│   │   │   ├── depreciation_monthly.py # DepreciationMonthly model
│   │   │   └── acquisition_disposal.py # AcquisitionDisposal model
│   │   ├── schemas/
│   │   │   ├── fixed_asset.py        # Pydantic schemas (Create/Update/Response)
│   │   │   └── acquisition_disposal.py
│   │   ├── routers/
│   │   │   ├── assets.py             # GET/POST/PUT/DELETE /api/assets
│   │   │   ├── summary.py            # GET /api/summary/* endpoints
│   │   │   ├── acquisitions.py       # GET/POST/PUT/DELETE /api/acquisitions
│   │   │   └── import_excel.py       # POST /api/import/excel
│   │   ├── services/
│   │   │   └── depreciation.py       # Straight-line depreciation calc service
│   │   └── utils/
│   │       ├── excel_importer.py     # Legacy importer (file lama, hardcoded cols)
│   │       └── excel_importer_v2.py  # Active importer (auto-detect format)
│   ├── alembic/                      # DB migrations
│   │   └── versions/001_initial.py   # Initial migration (all tables)
│   ├── .env                          # DATABASE_URL=postgresql://sankyu:sankyu123@localhost:5436/sankyu_assets
│   ├── alembic.ini                   # sqlalchemy.url = port 5436
│   ├── requirements.txt              # Python dependencies
│   └── start.bat                     # Quick start script
├── frontend/                         # React + Vite frontend
│   └── src/
│       ├── App.tsx                   # Router, QueryClientProvider
│       ├── components/
│       │   └── Layout.tsx            # Nav header, Outlet
│       ├── pages/
│       │   ├── Dashboard.tsx         # Summary cards, SVG bar chart, tables
│       │   ├── AssetList.tsx         # Excel-style table, filters, pagination
│       │   ├── AssetDetail.tsx       # Asset info + depreciation schedule
│       │   ├── AssetForm.tsx         # Add/Edit form (react-hook-form + zod)
│       │   ├── SummaryReport.tsx     # Monthly + by-group report
│       │   ├── Acquisitions.tsx      # Acquisition/disposal CRUD
│       │   └── ImportExcel.tsx       # Drag & drop Excel upload
│       ├── services/
│       │   ├── api.ts                # axios instance (baseURL: http://localhost:8000/api)
│       │   └── assets.ts             # All API service functions
│       ├── types/index.ts            # TypeScript interfaces
│       └── utils/format.ts           # formatIDR, formatDate, formatNumber
├── docker-compose.yml                # PostgreSQL on port 5436
├── Est-Depreciation_Calculation_for_2026_.xlsx  # File lama (header row 23-24, has Category col)
└── Fixed Asset_202606.xlsx           # File baru (header row 7-8, no Category col)
```

---

## Tech Stack & Versions

### Backend
| Package | Version |
|---------|---------|
| Python | 3.14 (via `C:\Python314\python.exe`) |
| FastAPI | 0.139.0 |
| SQLAlchemy | 2.0.51 |
| Alembic | 1.18.5 |
| psycopg2-binary | 2.9.12 |
| Pydantic | 2.13.4 |
| pydantic-settings | 2.14.2 |
| openpyxl | 3.1.5 |
| uvicorn | 0.51.0 |

### Frontend
| Package | Version |
|---------|---------|
| React | 18.3.1 |
| Vite | 9.x |
| TanStack Query | 5.40.0 |
| TanStack Table | 8.17.3 |
| react-hook-form | 7.52.0 |
| zod | 3.23.8 |
| axios | 1.7.2 |
| Tailwind CSS | 3.4.4 |
| TypeScript | 5.x |

### Infrastructure
| Component | Detail |
|-----------|--------|
| PostgreSQL | 16 via Docker, port **5436** (host) → 5432 (container) |
| Container name | `asset-depre-db-1` |
| DB name | `sankyu_assets` |
| DB user/pass | `sankyu` / `sankyu123` |

---

## Running the App

### Prerequisites
```bash
# Start PostgreSQL
docker-compose up -d db

# Verify DB is running
docker ps --filter "name=asset-depre"
```

### Backend
```bash
cd E:\Github\asset-management
venv\Scripts\activate          # or: start.bat
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs

### Frontend
```bash
cd E:\Github\asset-management
npm run dev                    # http://localhost:5173
```

### First-time Setup (if DB is empty)
```bash
cd E:\Asset-depre\backend
venv\Scripts\python -m app.utils.excel_importer_v2 --file "E:\Asset-depre\Est-Depreciation_Calculation_for_2026_.xlsx"
venv\Scripts\python -m app.utils.excel_importer_v2 --file "E:\Asset-depre\Fixed Asset_202606.xlsx"
```

---

## Database Schema

### `fixed_assets` (main table)
Key columns:
- `id` — SERIAL PK (internal use only)
- `fixed_asset_number_ax` — natural key, e.g. `BLD000048` (used in URLs)
- `asset_no` — asset number, e.g. `CLC131-001`
- `year_ref` — year reference (2025, 2026) — IMPORTANT: same AX number can exist for multiple years
- `category` — `WH1`, `WH2`, `TRP`, `BALI`, `MDN`, `PBG`, `MKS`, `SBY`, `OTHERS`, or `None`
- `site_location` — `CLC`, `CLGC`, `ASC`, `HCT`, `JKTC`, etc. (24 unique values)
- `group_name` — `Building`, `Structures`, `Machinary and Equipment`, `Tools Furniture Fixtures`, `Vehicles`
- `purchase_price` — NUMERIC(20,4)
- `monthly_depreciation` — b = purchase_price / depreciation_period_total
- `depreciation_period_total` — total months
- `acc_depreciation_prev` — accumulated depreciation end of previous year
- `net_book_value_prev` — NBV end of previous year
- `dep_expense_current` — yearly depreciation current year
- `acc_depreciation_curr` — accumulated depreciation end of current year
- `net_book_value_curr` — NBV end of current year

**Unique constraint:** `uq_ax_year_ref` on (`fixed_asset_number_ax`, `year_ref`)

### `depreciation_monthly`
- `asset_id` FK → `fixed_assets.id` (CASCADE DELETE)
- `year`, `month` (1-12), `amount`
- Unique: (`asset_id`, `year`, `month`)

### `acquisition_disposals`
- Tracks acquisitions and disposals per year
- `status`: `Acquisition` or `Disposal`

---

## API Endpoints

### Assets
```
GET    /api/assets                     # List with filters: year_ref, category, group_name,
                                       # site_location, job, search, page, size
POST   /api/assets                     # Create asset
GET    /api/assets/{ax_number}         # Get by fixed_asset_number_ax (e.g. BLD000048)
PUT    /api/assets/{ax_number}         # Update (fallback to integer id if no AX)
DELETE /api/assets/{ax_number}         # Delete
GET    /api/assets/{ax_number}/depreciation  # Monthly depreciation schedule
```

### Summary
```
GET /api/summary/monthly?year_ref=2026&site_location=CLC
    # Returns: {job: {jan:N, feb:N, ..., total:N}}
GET /api/summary/by-group?year_ref=2026&site_location=CLC
    # Returns: {group_name: {yearly_depreciation, purchase_price, acc_depreciation, net_book_value, count}}
GET /api/summary/by-category?year_ref=2026&site_location=CLC
    # Returns: {category: {yearly_depreciation, purchase_price, acc_depreciation, net_book_value, count}}
GET /api/summary/totals?year_ref=2026&site_location=CLC
    # Returns: {total_assets, total_purchase_price, total_acc_depreciation, total_net_book_value, total_yearly_depreciation}
GET /api/summary/site-locations?year_ref=2026
    # Returns: [{site_location, count}]
```

### Import/Export
```
POST /api/import/excel    # Upload XLSX file (multipart/form-data, field: "file")
```

### Acquisitions
```
GET/POST       /api/acquisitions
PUT/DELETE     /api/acquisitions/{id}
```

---

## Data & Business Rules

### Depreciation Method
**Straight-line method:**
```
monthly_depreciation = purchase_price / depreciation_period_total
yearly_depreciation  = monthly_depreciation × months_active_in_year
acc_depreciation     = monthly_depreciation × periods_elapsed
net_book_value       = purchase_price - acc_depreciation
```

### Asset Identifier
- Primary URL key: `fixed_asset_number_ax` (e.g. `BLD000048`)
- Assets without AX number are skipped during import
- Fallback in URL: integer `id` (for 2 assets without AX)

### Year Reference
- Same physical asset exists in both `year_ref=2025` and `year_ref=2026`
- Unique constraint is `(fixed_asset_number_ax, year_ref)`
- Default filter: `year_ref=2026`

### Category
- **File lama** (`Est-Depreciation_Calculation_for_2026_.xlsx`): has Category column → `WH1`, `WH2`, `TRP`, `BALI`, `OTHERS`, `MDN`, `PBG`, `MKS`, `SBY`
- **File baru** (`Fixed Asset_202606.xlsx`): NO Category column → category preserved from file lama, new assets get `NULL`
- **IMPORTANT**: Never derive category from `site_location` — user inputs manually

### Data Stats (as of 2026-07-14)
- year_ref=2026: **1,045 assets**
- year_ref=2025: 224 assets
- depreciation_monthly rows: ~15,000+
- acquisition_disposals: 294 records
- Categories with data: WH1(15), WH2(23), TRP(76), OTHERS(93), BALI(3), MDN/PBG/MKS/SBY(small)
- Assets with NULL category: 821 (from file baru)

---

## Excel Import System

### `excel_importer_v2.py` (ACTIVE — use this)
Auto-detects file format:
- Scans rows 1-40 for header containing keywords: `"no."`, `"name of fixed asset"`, `"purchase price"`, `"fixed asset number"`
- Builds dynamic column map from header — no hardcoded indices
- **File lama**: header at row 23-24, data from row 26
- **File baru**: header at row 7-8, data from row 10

**Category logic:**
- If file has Category column (`has_category=True`): use it
- If file has NO Category column: set `category=None`, preserve existing DB value on upsert

**Upsert key:** `fixed_asset_number_ax + year_ref`

**Import order matters:**
1. Import file lama first (with Category)
2. Import file baru second (preserves Category from step 1)

### `excel_importer.py` (LEGACY — do not use for new imports)
Hardcoded column indices for file lama only.

---

## Frontend Architecture

### State Management
- **TanStack Query** for all server state (no Redux/Zustand)
- Query keys pattern: `['assets', filters]`, `['summary-monthly', year, site]`

### Asset URL Key
- Uses `fixed_asset_number_ax` as URL param: `/assets/BLD000048`
- Implemented in `AssetList.tsx`: `const key = asset.fixed_asset_number_ax || String(asset.id)`

### Chart (Dashboard)
- **SVG bar chart** (custom, no Recharts) — Recharts was removed due to render issues
- Component: `SvgBarChart` in `Dashboard.tsx`
- Stacked bars per job, reactive to `year` and `site` filter changes
- Y-axis labels use `idrShort()` (B/M/K format)

### Excel-style Table (AssetList)
- Multi-level header (3 rows): group headers → sub-headers → formula labels
- Frozen columns (sticky): No, Site, Job, Asset No, Name
- Color-coded column groups: blue (ID), green (purchase), yellow (period), orange (2025 values), blue (monthly 2026), purple (2026 values)
- Grand total footer row

### Known Issues / Past Bugs Fixed
- `ResponsiveContainer` from Recharts failed to render in Vite → replaced with custom SVG
- `summary/monthly` 500 error with 1045 assets → fixed by using JOIN instead of IN clause
- Category derived from site_location on file baru → fixed to preserve or set NULL
- Unique constraint `uq_asset_no_year_ref` → changed to `uq_ax_year_ref` to support duplicate asset_no in new file

---

## Environment Notes

### Python
- System Python: `C:\Python314\python.exe` (Python 3.14.5) — used for backend venv
- Backend venv: `E:\Asset-depre\backend\venv\`
- Run backend scripts: `& "E:\Asset-depre\backend\venv\Scripts\python.exe" -m app.utils.excel_importer_v2`

### PowerShell Quirks
- Use `;` not `&&` for command chaining
- Use `workdir` parameter in bash tool instead of `cd` inside commands
- Call executable with spaces: `& "path\to\exe" args`

### Ports in Use (local machine)
- 5432: `ngopicode-postgres`
- 5434: `app-karyawan-postgres`
- 5435: `kokarsi-postgres`
- **5436: `asset-depre-db-1`** ← this project
- 8000: FastAPI backend (this project)
- 5173: Vite frontend (this project)

---

## Common Tasks

### Re-import all data from scratch
```bash
# Drop and recreate tables
venv\Scripts\python -c "
from app.database import engine, Base
from app.models import FixedAsset, DepreciationMonthly, AcquisitionDisposal
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
"
# Import file lama first (has Category)
venv\Scripts\python -m app.utils.excel_importer_v2 --file "E:\Asset-depre\Est-Depreciation_Calculation_for_2026_.xlsx"
# Import file baru second (preserves Category)
venv\Scripts\python -m app.utils.excel_importer_v2 --file "E:\Asset-depre\Fixed Asset_202606.xlsx"
```

### Check data in DB
```bash
venv\Scripts\python -c "
import sys; sys.path.insert(0, r'E:\Asset-depre\backend')
from app.database import SessionLocal
from sqlalchemy import text
db = SessionLocal()
r = db.execute(text('SELECT year_ref, COUNT(*) FROM fixed_assets GROUP BY year_ref'))
for row in r: print(row)
db.close()
"
```

### Verify backend syntax
```bash
& "E:\Asset-depre\backend\venv\Scripts\python.exe" -c "from app.main import app; print('OK')"
```

### Build frontend
```bash
npm run build   # from E:\Asset-depre\frontend
```

---

## Frontend Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Dashboard | Summary cards, SVG chart, monthly table, by-group, by-category |
| `/assets` | AssetList | Excel-style table with 50+ columns, filters |
| `/assets/new` | AssetForm | Add new asset |
| `/assets/:id` | AssetDetail | Detail + Jan-Dec schedule |
| `/assets/:id/edit` | AssetForm | Edit existing asset |
| `/summary` | SummaryReport | Monthly by job + by group |
| `/acquisitions` | Acquisitions | Acquisition/disposal CRUD |
| `/import` | ImportExcel | Drag & drop XLSX upload |
