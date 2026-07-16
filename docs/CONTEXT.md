# Project Context: Fixed Asset & Depreciation App
**PT. Sankyu Indonesia International**
Last updated: 2026-07-16

---

## Overview

Web application untuk mengelola Fixed Asset dan kalkulasi depresiasi multi-tahun.
Menggantikan workflow Microsoft Excel dengan CRUD penuh, kalkulasi otomatis, laporan per periode, dan simulasi forecast.

**Stack:** React (Vite) + FastAPI (Python) + PostgreSQL
**Status:** Production-ready, actively developed

---

## Repository Structure

```
E:\Github\asset-management\
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI app entry, CORS, 7 routers registered
│   │   ├── config.py                 # Pydantic settings, reads .env
│   │   ├── database.py               # SQLAlchemy engine, SessionLocal, Base, get_db()
│   │   ├── models/
│   │   │   ├── fixed_asset.py        # FixedAsset model (main table)
│   │   │   ├── depreciation_monthly.py
│   │   │   ├── acquisition_disposal.py
│   │   │   └── planned_asset.py      # PlannedAsset model (forecast simulation)
│   │   ├── schemas/
│   │   │   ├── fixed_asset.py        # Pydantic schemas (Create/Update/Response)
│   │   │   ├── acquisition_disposal.py
│   │   │   └── planned_asset.py      # PlannedAsset schemas
│   │   ├── routers/
│   │   │   ├── assets.py             # GET/POST/PUT/DELETE /api/assets (size max: 350)
│   │   │   ├── summary.py            # GET /api/summary/* + /jobs endpoint
│   │   │   │                         # group_by param, all use depreciation_monthly as source
│   │   │   ├── acquisitions.py       # GET/POST/PUT/DELETE /api/acquisitions
│   │   │   ├── import_excel.py       # POST /api/import/excel
│   │   │   ├── forecast.py           # GET /api/forecast/* (on-the-fly calc, include_planned param)
│   │   │   │                         # months_elapsed imported from services.depreciation (Level 1 fix)
│   │   │   ├── export.py             # GET /api/export/excel + /forecast-excel (multi-sheet .xlsx)
│   │   │   │                         # months_elapsed imported from services.depreciation (Level 1 fix)
│   │   │   └── planned_assets.py     # GET/POST/PUT/DELETE /api/planned-assets
│   │   ├── services/
│   │   │   └── depreciation.py       # SOURCE OF TRUTH untuk months_elapsed + recalculate_*
│   │   │                             # recalculate_asset() + recalculate_summary_fields()
│   │   └── utils/
│   │       ├── excel_importer.py     # Legacy importer (hardcoded cols, do not use)
│   │       └── excel_importer_v2.py  # Active importer (auto-detect format)
│   ├── alembic/
│   │   └── versions/
│   │       ├── 001_initial.py        # Initial migration (all tables)
│   │       └── 002_planned_assets.py # Migration: planned_assets table
│   ├── .env                          # DATABASE_URL=postgresql://sankyu:sankyu123@localhost:5436/sankyu_assets
│   ├── alembic.ini
│   ├── requirements.txt
│   └── start.bat                     # Backend-only startup script
├── frontend/
│   └── src/
│       ├── App.tsx                   # Router, QueryClientProvider (7 routes)
│       ├── components/
│       │   └── Layout.tsx            # Nav: Dashboard, Fixed Assets, Forecast, Export, Acquisitions, Import Excel
│       ├── pages/
│       │   ├── Dashboard.tsx         # Summary cards, SVG bar chart, monthly/by-group/by-category
│       │   │                         # by-group & by-category: toggle Summary/Monthly view
│       │   ├── AssetList.tsx         # Excel-style table, client-side sort (all cols), dep filter (Active/Completed), pagination
│       │   ├── AssetDetail.tsx       # Asset info + depreciation schedule (Total/Year fix)
│       │   ├── AssetForm.tsx         # Add/Edit form + realtime depreciation preview panel
│       │   ├── SummaryReport.tsx     # Export Center dengan 2 tabs:
│       │   │                         # Tab 1: Actual Export (5 sheets)
│       │   │                         # Tab 2: Forecast Export (4 sheets, planned assets included)
│       │   ├── ForecastPage.tsx      # /forecast: 2 tabs:
│       │   │                         # Tab 1: Forecast (year dynamic, include_planned toggle)
│       │   │                         # Tab 2: Planned Assets (CRUD, site searchable, job dependent dropdown)
│       │   │                         # Purchase Price input: realtime IDR format
│       │   ├── Acquisitions.tsx      # Acquisition/disposal CRUD
│       │   └── ImportExcel.tsx       # Drag & drop XLSX upload
│       ├── services/
│       │   ├── api.ts                # axios instance — baseURL dari VITE_API_URL env var
│       │   └── assets.ts             # All API service functions incl. fetchForecast*, fetchPlannedAssets*,
│       │                             # fetchJobs, downloadForecastExcel
│       ├── types/index.ts            # TypeScript interfaces
│       └── utils/format.ts           # formatIDR/formatNumber — accept string|number
├── docker-compose.yml                # PostgreSQL only (container_name: asset-depre-db-1, port 5436)
├── start.bat                         # One-click startup: Docker DB + Backend + Frontend
├── start-no-docker.bat               # One-click startup tanpa Docker (PostgreSQL native)
├── docs/
│   ├── CONTEXT.md                    # File ini
│   ├── DEPLOY.md                     # Panduan deploy Windows 11 (Docker, port 5436)
│   ├── DEPLOY-NATIVE.md              # Panduan deploy Windows 11 (PostgreSQL native, port 5432)
│   └── POSTGRES-CONFIG.md           # Instruksi ganti port/username/password/database
├── frontend/.env                     # VITE_API_URL=http://localhost:8000/api (default)
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

### Cara Cepat (One-click)
Double-click `start.bat` di root project. Otomatis start DB, backend, frontend, buka browser.

### Manual

**PostgreSQL:**
```bash
docker compose up -d db
```

**Backend:**
```bash
cd E:\Github\asset-management\backend
& ".\venv\Scripts\activate.ps1"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd E:\Github\asset-management\frontend
npm run dev    # http://localhost:5173
# atau serve dist:
serve -s dist -l 3000
```

**Access:**
- Frontend: http://localhost:3000 (serve) atau http://localhost:5173 (dev)
- API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs

### First-time Setup (DB kosong)
```bash
cd E:\Github\asset-management\backend
venv\Scripts\activate
alembic upgrade head
python -m app.utils.excel_importer_v2 --file "..\Est-Depreciation_Calculation_for_2026_.xlsx"
python -m app.utils.excel_importer_v2 --file "..\Fixed Asset_202606.xlsx"
```

---

## Database Schema

### `fixed_assets` (main table)
Key columns:
- `id` — SERIAL PK (internal use only)
- `fixed_asset_number_ax` — natural key, e.g. `BLD000048` (used in URLs)
- `asset_no` — asset number, e.g. `CLC131-001`
- `year_ref` — year reference (2025, 2026) — same AX number dapat exist untuk multiple years
- `category` — `WH1`, `WH2`, `TRP`, `BALI`, `MDN`, `PBG`, `MKS`, `SBY`, `OTHERS`, atau `None`
- `site_location` — `CLC`, `CLGC`, `ASC`, `HCT`, `JKTC`, dll. (24 unique values)
- `group_name` — `Building`, `Structures`, `Machinary and Equipment`, `Tools Furniture Fixtures`, `Vehicles`
- `purchase_price` — NUMERIC(20,4)
- `monthly_depreciation` — b = purchase_price / depreciation_period_total
- `depreciation_period_total` — total months
- `dep_period_acc_prev_year`, `dep_period_yearly`, `dep_period_until_year`, `dep_period_remain`
- `acc_depreciation_prev`, `net_book_value_prev`
- `dep_expense_current`, `acc_depreciation_curr`, `net_book_value_curr`

**Unique constraint:** `uq_ax_year_ref` on (`fixed_asset_number_ax`, `year_ref`)

### `depreciation_monthly`
- `asset_id` FK → `fixed_assets.id` (CASCADE DELETE)
- `year`, `month` (1-12), `amount`
- Unique: (`asset_id`, `year`, `month`)

### `acquisition_disposals`
- Tracks acquisitions and disposals per year
- `status`: `Acquisition` or `Disposal`

### `planned_assets` (NEW)
- Planned assets untuk forecast simulation
- `forecast_year` — tahun referensi planning
- `planned_purchase_month` (1-12) + `planned_purchase_year` — kapan asset akan dibeli
- `purchase_price`, `depreciation_period_total`, `name`, `group_name`, `category`, `site_location`, `job`
- Asset ini masuk ke forecast untuk semua tahun yang dicakup masa depresiasinya (bukan hanya `forecast_year`)

---

## API Endpoints

### Assets
```
GET    /api/assets                     # Filters: year_ref, category, group_name, site_location,
                                       # job, search, page, size (max 350)
POST   /api/assets                     # Create asset (triggers recalculate_asset)
GET    /api/assets/{ax_number}         # Get by fixed_asset_number_ax
PUT    /api/assets/{ax_number}         # Update (triggers recalculate_asset)
DELETE /api/assets/{ax_number}
GET    /api/assets/{ax_number}/depreciation
```

### Summary
```
GET /api/summary/monthly?year_ref=2026&site_location=CLC&group_by=job
    # group_by: job (default) | category | group_name
    # Source: depreciation_monthly table
GET /api/summary/by-group?year_ref=2026&site_location=CLC
GET /api/summary/by-category?year_ref=2026&site_location=CLC
GET /api/summary/totals?year_ref=2026&site_location=CLC
GET /api/summary/site-locations?year_ref=2026
GET /api/summary/jobs?site_location=CLC&year_ref=2026
    # Returns: [{ job: "CLCWH", count: 45 }, ...] — untuk dependent dropdown
```

### Forecast
```
GET /api/forecast/totals?forecast_year=2027&site_location=CLC&include_planned=true
GET /api/forecast/monthly?forecast_year=2027&site_location=CLC&group_by=job&include_planned=true
    # group_by: job | category | group_name
    # Response includes: { job: { jan:N, ..., planned: { jan:N, ... }, planned_total: N } }
GET /api/forecast/by-group?forecast_year=2027&include_planned=true
    # Response includes: planned_yearly, planned_count per group
GET /api/forecast/by-category?forecast_year=2027&include_planned=true
GET /api/forecast/assets?forecast_year=2027&include_planned=true&page=1&size=100
    # forecast_year: any year >= 2026
    # Planned assets masuk jika masa depresiasi mencakup forecast_year
```

### Planned Assets
```
GET    /api/planned-assets?forecast_year=2027&site_location=CLC
POST   /api/planned-assets
PUT    /api/planned-assets/{id}
DELETE /api/planned-assets/{id}
```

### Export
```
GET /api/export/excel?year_ref=2026&site_location=CLC
    # 5 sheets: Asset List | Monthly Depreciation | Summary by Group |
    #           Summary by Category | Acquisitions & Disposals
    # Filename: depreciation_{year}_{site}_{YYYYMMDD}.xlsx

GET /api/export/forecast-excel?forecast_year=2027&site_location=CLC
    # 4 sheets: Planned Assets | Forecast Monthly | Forecast by Group | Forecast by Category
    # Filename: forecast_{year}_{site}_{YYYYMMDD}.xlsx
```

### Import & Acquisitions
```
POST /api/import/excel
GET/POST /api/acquisitions
PUT/DELETE /api/acquisitions/{id}
```

---

## Data & Business Rules

### Depreciation Method — Straight-line
**Source of truth: `app/services/depreciation.py:months_elapsed()`**
`forecast.py` dan `export.py` import dari sini (Level 1 fix — tidak ada duplikasi lagi)

```
monthly_depreciation      = purchase_price / depreciation_period_total
dep_period_acc_prev_year  = months_elapsed(purchase_date, year_ref-1, 12), capped at period_total
dep_period_yearly         = months active in year_ref
dep_period_until_year     = dep_period_acc_prev_year + dep_period_yearly
dep_period_remain         = period_total - dep_period_until_year
acc_depreciation_prev     = monthly × dep_period_acc_prev_year
net_book_value_prev       = purchase_price - acc_depreciation_prev
dep_expense_current       = monthly × dep_period_yearly
acc_depreciation_curr     = monthly × dep_period_until_year
net_book_value_curr       = purchase_price - acc_depreciation_curr
```

- Semua values floored ke 0
- `purchase_date = null` → only `monthly_depreciation` di-set, period fields skip
- `recalculate_asset()` dipanggil di setiap POST dan PUT

### Summary Data Source (PENTING)
Semua summary endpoints pakai `depreciation_monthly.amount` sebagai source, **bukan** `dep_expense_current`. Ini menjamin konsistensi grand total di semua view.

### Planned Assets — Forecast Logic
Asset masuk ke `forecast_year` jika masa depresiasinya mencakup tahun tersebut:
- `planned_purchase_year <= forecast_year` (sudah dimulai beli)
- `depreciation_period_total > (forecast_year - purchase_year) * 12 - purchase_month + 1` (belum selesai)

Artinya: forklift beli Maret 2027 period 60 bulan → muncul di forecast 2027, 2028, 2029, 2030, 2031 (selesai Feb 2032).

### Asset URL Key
- Primary: `fixed_asset_number_ax` (e.g. `BLD000048`)
- Fallback: integer `id`

### Year Reference
- Same physical asset exist untuk multiple `year_ref`
- Unique constraint: `(fixed_asset_number_ax, year_ref)`
- Default: `year_ref=2026`

### Category
- Dari file lama: `WH1`, `WH2`, `TRP`, `BALI`, `OTHERS`, `MDN`, `PBG`, `MKS`, `SBY`
- Dari file baru: no Category col → preserved from file lama atau NULL untuk new assets

### AssetForm Edit
- Empty string fields (`""`) di-clean ke `null` sebelum PUT request
- Root cause: `purchase_date=""` menyebabkan Pydantic 422

### Data Stats (per 2026-07-14)
- year_ref=2026: **1,045 assets**
- year_ref=2025: 224 assets
- depreciation_monthly rows: ~17,900+
- acquisition_disposals: 294 records

---

## Frontend Architecture

### State Management
- TanStack Query untuk semua server state
- Query key patterns: `['assets', filters]`, `['summary-monthly', year, site]`, `['forecast-totals', year, site, includePlanned]`

### AssetList Features
- **Client-side sorting**: semua kolom, asc → desc → reset. `SortIcon` component
- **Dep Status filter**: All / Active (remain > 0) / Completed (remain = 0) — client-side
- **Size options**: 50, 100, 200, 350 rows

### AssetForm Features
- Realtime depreciation preview panel via `watch()` + `useMemo`
- Shows: Monthly Dep, Period breakdown, NBV, Dep Expense

### Dashboard Features
- Monthly Depreciation: group_by=job
- By Group + By Category: toggle Summary/Monthly (group_by param)
- Semua summary dari `depreciation_monthly` table

### ForecastPage (/forecast)
- **Tab "Forecast"**: Year selector (dynamic dari planned assets), site filter, include_planned toggle
  - Summary cards: combined existing + planned saat toggle aktif
  - Monthly/By Group/By Category: existing + `row.planned[k]` saat toggle aktif
  - Asset Detail: include_planned di query key
- **Tab "Planned Assets"**: CRUD form
  - Site: searchable combobox dropdown
  - Job: dependent dropdown (refetch saat site berubah via `/api/summary/jobs`)
  - Purchase Price: realtime IDR format (`type="text"`, `inputMode="numeric"`, `replace(/\D/g, '')`)
  - Quick preview: Monthly Dep + Start Date

### Export Center (/summary — SummaryReport.tsx)
- **Tab "Actual Data Export"**: Step 1 Filter → Step 2 Preview → Step 3 Sheets → Step 4 Download
  - 5 sheets: Asset List, Monthly Dep, by Group, by Category, Acquisitions
- **Tab "Forecast Export"**: Step 1-4 dengan orange color scheme
  - 4 sheets: Planned Assets, Forecast Monthly, by Group, by Category
  - Dynamic forecast year dari planned assets
  - Badge count planned assets di tab

---

## Excel Export (openpyxl)

### Actual Export (`/api/export/excel`)
5-sheet workbook:
1. **Asset List** — 36 columns, navy header
2. **Monthly Depreciation** — per job Jan-Des, dark blue header
3. **Summary by Group** — gray header
4. **Summary by Category** — cyan header + % of total
5. **Acquisitions & Disposals** — green header

### Forecast Export (`/api/export/forecast-excel`)
4-sheet workbook:
1. **Planned Assets** — per asset + Jan-Des breakdown, orange header `#C05621`
2. **Forecast Monthly** — per job + sub-rows planned, dark blue
3. **Forecast by Group** — existing vs planned breakdown, gray
4. **Forecast by Category** — existing vs planned + %, cyan

Styling: bold headers, fill colors, auto column width, freeze row 1, number format `#,##0`, sheet tab colors.

---

## Known Issues / Past Bugs Fixed
- `ResponsiveContainer` Recharts failed in Vite → replaced with custom SVG
- `summary/monthly` 500 → fixed by JOIN
- Category derived from site_location → fixed to preserve/NULL
- `uq_asset_no_year_ref` → `uq_ax_year_ref`
- `purchase_date=""` → 422 on PUT → clean empty strings to null in `onSubmit`
- Summary inconsistency: `/by-group` used `dep_expense_current` → fixed all to use `depreciation_monthly`
- `AssetDetail` Total/Year `RpNaN` → FastAPI `Decimal` → string → fixed `format.ts` + `AssetDetail.tsx`
- `docker-compose.yml` port conflict → removed unused backend/frontend services
- `start.bat` docker-compose v1 → updated to v2 + smart container detection
- Toggle "Include Planned" tidak berubah di Monthly/Group/Category → fix 3 `useMemo` baca `row.planned[k]`
- Planned asset hanya muncul di tahun pembelian → fix `get_planned_assets` range check
- `months_elapsed` duplikat di 3 file → Level 1 fix: import dari `services/depreciation.py`

---

## Code Review Findings (Outstanding)
| Priority | Item | Status |
|----------|------|--------|
| Critical | Tidak ada authentication/authorization | Open |
| High | CORS `allow_origins=["*"]` | Open |
| High | Kredensial DB di dokumentasi | Open |
| Medium | `ForecastPage.tsx` 1100+ baris | Open |
| Medium | Tidak ada unit tests | Open |
| Low | `idr`/`idrShort` duplikat di 4+ file | Open |
| Low | Import tidak terpakai: `numbers` di `export.py` | Open |
| Resolved | `months_elapsed` duplikat 3x | Fixed (Level 1) |
| Resolved | Blob URL leak di download | Fixed via `try/finally` |

---

## Environment Notes

### Python
- System Python: `C:\Python314\python.exe`
- Backend venv: `E:\Github\asset-management\backend\venv\`

### PowerShell Quirks
- Gunakan `;` bukan `&&`
- Gunakan `workdir` param di bash tool, bukan `cd` di dalam command
- Executable dengan spasi: `& "path\to\exe" args`

### Ports in Use
- 5432: `ngopicode-postgres`
- 5434: `app-karyawan-postgres`
- 5435: `kokarsi-postgres`
- **5436: `asset-depre-db-1`** ← project ini (Docker)
- **5432: PostgreSQL native** ← jika deploy tanpa Docker
- 8000: FastAPI backend
- 3000: serve (production frontend)
- 5173: Vite dev server

---

## Common Tasks

### Verify backend syntax
```bash
& "E:\Github\asset-management\backend\venv\Scripts\python.exe" -c "from app.main import app; print('OK')"
```

### Build frontend
```bash
npm run build   # dari E:\Github\asset-management\frontend
```

### Run migration
```bash
cd E:\Github\asset-management\backend
venv\Scripts\activate
alembic upgrade head
```

### Connect to DB
```bash
docker exec asset-depre-db-1 psql -U sankyu -d sankyu_assets -c "SELECT COUNT(*) FROM fixed_assets WHERE year_ref=2026"
```

---

## Frontend Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Dashboard | Summary cards, SVG chart, monthly/group/category tables dengan toggles |
| `/assets` | AssetList | Excel-style table, sort all cols, dep filter, size up to 350 |
| `/assets/new` | AssetForm | Add asset + realtime depreciation preview |
| `/assets/:id` | AssetDetail | Detail + Jan-Dec schedule |
| `/assets/:id/edit` | AssetForm | Edit asset + realtime depreciation preview |
| `/forecast` | ForecastPage | Tab Forecast (2027+) + Tab Planned Assets (CRUD) |
| `/summary` | SummaryReport | Export Center — Tab Actual + Tab Forecast Excel |
| `/acquisitions` | Acquisitions | Acquisition/disposal CRUD |
| `/import` | ImportExcel | Drag & drop XLSX upload |

---

## Overview

Web application untuk mengelola Fixed Asset dan kalkulasi depresiasi multi-tahun.
Menggantikan workflow Microsoft Excel dengan CRUD penuh, kalkulasi otomatis, dan laporan per periode.

**Stack:** React (Vite) + FastAPI (Python) + PostgreSQL
**Status:** Production-ready, actively developed

---

## Repository Structure

```
E:\Github\asset-management\
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI app entry, CORS, router registration (5 routers)
│   │   ├── config.py                 # Pydantic settings, reads .env
│   │   ├── database.py               # SQLAlchemy engine, SessionLocal, Base, get_db()
│   │   ├── models/
│   │   │   ├── fixed_asset.py        # FixedAsset model (main table)
│   │   │   ├── depreciation_monthly.py
│   │   │   └── acquisition_disposal.py
│   │   ├── schemas/
│   │   │   ├── fixed_asset.py        # Pydantic schemas (Create/Update/Response)
│   │   │   └── acquisition_disposal.py
│   │   ├── routers/
│   │   │   ├── assets.py             # GET/POST/PUT/DELETE /api/assets (size max: 350)
│   │   │   ├── summary.py            # GET /api/summary/* (monthly group_by param, all use depreciation_monthly as source)
│   │   │   ├── acquisitions.py       # GET/POST/PUT/DELETE /api/acquisitions
│   │   │   ├── import_excel.py       # POST /api/import/excel
│   │   │   ├── forecast.py           # GET /api/forecast/* (on-the-fly calc, no DB writes)
│   │   │   └── export.py             # GET /api/export/excel (multi-sheet .xlsx via openpyxl)
│   │   ├── services/
│   │   │   └── depreciation.py       # recalculate_asset() + recalculate_summary_fields() — full straight-line calc
│   │   └── utils/
│   │       ├── excel_importer.py     # Legacy importer (hardcoded cols, do not use)
│   │       └── excel_importer_v2.py  # Active importer (auto-detect format)
│   ├── alembic/
│   │   └── versions/001_initial.py
│   ├── .env                          # DATABASE_URL=postgresql://sankyu:sankyu123@localhost:5436/sankyu_assets
│   ├── alembic.ini
│   ├── requirements.txt
│   └── start.bat
├── frontend/
│   └── src/
│       ├── App.tsx                   # Router, QueryClientProvider (6 routes incl. /forecast)
│       ├── components/
│       │   └── Layout.tsx            # Nav: Dashboard, Fixed Assets, Forecast, Export, Acquisitions, Import Excel
│       ├── pages/
│       │   ├── Dashboard.tsx         # Summary cards, SVG bar chart, monthly table, by-group, by-category
│       │   │                         # by-group & by-category: toggle Summary/Monthly view
│       │   ├── AssetList.tsx         # Excel-style table, client-side sort (all cols), dep filter, pagination
│       │   ├── AssetDetail.tsx       # Asset info + depreciation schedule
│       │   ├── AssetForm.tsx         # Add/Edit form + realtime depreciation preview panel
│       │   ├── SummaryReport.tsx     # Export Center: filter → preview → download .xlsx
│       │   ├── ForecastPage.tsx      # /forecast: year 2027-2030, monthly/by-group/by-category/asset detail
│       │   ├── Acquisitions.tsx      # Acquisition/disposal CRUD
│       │   └── ImportExcel.tsx       # Drag & drop XLSX upload
│       ├── services/
│       │   ├── api.ts                # axios instance — baseURL dari VITE_API_URL env var (fallback localhost:8000/api)
│       │   └── assets.ts             # All API service functions incl. fetchForecast* functions
│       ├── types/index.ts            # TypeScript interfaces
│       └── utils/format.ts           # formatIDR/formatNumber — accept string|number (FastAPI Decimal → string fix)
├── docker-compose.yml                # PostgreSQL only (backend & frontend services dihapus — tidak terpakai)
├── start.bat                         # One-click startup: Docker DB + Backend + Frontend
├── DEPLOY.md                         # Panduan deploy ke Windows 11 baru
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
cd E:\Github\asset-management\backend
& "E:\Github\asset-management\backend\venv\Scripts\activate.ps1"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs

### Frontend
```bash
cd E:\Github\asset-management\frontend
npm run dev    # http://localhost:5173
```

### First-time Setup (if DB is empty)
```bash
cd E:\Github\asset-management\backend
& venv\Scripts\python.exe -m app.utils.excel_importer_v2 --file "E:\Github\asset-management\Est-Depreciation_Calculation_for_2026_.xlsx"
& venv\Scripts\python.exe -m app.utils.excel_importer_v2 --file "E:\Github\asset-management\Fixed Asset_202606.xlsx"
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
- `dep_period_acc_prev_year`, `dep_period_yearly`, `dep_period_until_year`, `dep_period_remain`
- `acc_depreciation_prev`, `net_book_value_prev`
- `dep_expense_current`, `acc_depreciation_curr`, `net_book_value_curr`

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
GET    /api/assets                     # Filters: year_ref, category, group_name, site_location,
                                       # job, search, page, size (max 350)
POST   /api/assets                     # Create asset (triggers recalculate_asset)
GET    /api/assets/{ax_number}         # Get by fixed_asset_number_ax
PUT    /api/assets/{ax_number}         # Update (triggers recalculate_asset)
DELETE /api/assets/{ax_number}
GET    /api/assets/{ax_number}/depreciation
```

### Summary
```
GET /api/summary/monthly?year_ref=2026&site_location=CLC&group_by=job
    # group_by: job (default) | category | group_name
    # Source: depreciation_monthly table (consistent with other summary endpoints)
GET /api/summary/by-group?year_ref=2026&site_location=CLC
    # yearly_depreciation from depreciation_monthly (NOT dep_expense_current)
GET /api/summary/by-category?year_ref=2026&site_location=CLC
GET /api/summary/totals?year_ref=2026&site_location=CLC
GET /api/summary/site-locations?year_ref=2026
```

### Forecast
```
GET /api/forecast/totals?forecast_year=2027&site_location=CLC
GET /api/forecast/monthly?forecast_year=2027&site_location=CLC&group_by=job
    # group_by: job | category | group_name
GET /api/forecast/by-group?forecast_year=2027&site_location=CLC
GET /api/forecast/by-category?forecast_year=2027&site_location=CLC
GET /api/forecast/assets?forecast_year=2027&site_location=CLC&page=1&size=100
    # On-the-fly calc from year_ref=2026 data, no DB writes
    # forecast_year range: 2027-2030 (any year >= 2026 accepted)
```

### Export
```
GET /api/export/excel?year_ref=2026&site_location=CLC
    # Returns: StreamingResponse (.xlsx file, multi-sheet)
    # Sheets: Asset List | Monthly Depreciation | Summary by Group |
    #         Summary by Category | Acquisitions & Disposals
    # Filename: depreciation_{year}_{site}_{YYYYMMDD}.xlsx
```

### Import
```
POST /api/import/excel    # Upload XLSX (multipart/form-data, field: "file")
```

### Acquisitions
```
GET/POST       /api/acquisitions
PUT/DELETE     /api/acquisitions/{id}
```

---

## Data & Business Rules

### Depreciation Method
**Straight-line (recalculate_summary_fields in depreciation.py):**
```
monthly_depreciation      = purchase_price / depreciation_period_total
dep_period_acc_prev_year  = months elapsed from purchase_date to Dec (year_ref-1), capped at period_total
dep_period_yearly         = months active in year_ref
dep_period_until_year     = dep_period_acc_prev_year + dep_period_yearly
dep_period_remain         = period_total - dep_period_until_year
acc_depreciation_prev     = monthly × dep_period_acc_prev_year
net_book_value_prev       = purchase_price - acc_depreciation_prev
dep_expense_current       = monthly × dep_period_yearly
acc_depreciation_curr     = monthly × dep_period_until_year
net_book_value_curr       = purchase_price - acc_depreciation_curr
```
- All values floored to 0
- If `purchase_date` is null: only `monthly_depreciation` is set, period fields remain as-is
- `recalculate_asset()` is called on every POST and PUT

### Summary Data Source (IMPORTANT)
All summary endpoints (`/summary/monthly`, `/summary/by-group`, `/summary/by-category`, `/summary/totals`) now use `depreciation_monthly.amount` as source — NOT `fixed_assets.dep_expense_current`. This ensures consistency across all summary views.

### Asset URL Key
- Primary URL key: `fixed_asset_number_ax` (e.g. `BLD000048`)
- Fallback: integer `id` (for assets without AX)

### Year Reference
- Same physical asset exists for multiple `year_ref` values
- Unique constraint: `(fixed_asset_number_ax, year_ref)`
- Default: `year_ref=2026`

### Category
- From file lama: `WH1`, `WH2`, `TRP`, `BALI`, `OTHERS`, `MDN`, `PBG`, `MKS`, `SBY`
- From file baru: no Category col → preserved from file lama or NULL for new assets
- Never derive category from `site_location`

### AssetForm Edit Bug Fix
- Empty string fields (`""`) from react-hook-form are converted to `null` before PUT request
- Root cause: `purchase_date=""` caused Pydantic 422 error

### Data Stats (as of 2026-07-14)
- year_ref=2026: **1,045 assets**
- year_ref=2025: 224 assets
- depreciation_monthly rows: ~17,900+
- acquisition_disposals: 294 records

---

## Frontend Architecture

### State Management
- TanStack Query for all server state
- Query key patterns: `['assets', filters]`, `['summary-monthly', year, site]`, `['forecast-totals', year, site]`

### AssetList Features
- **Client-side sorting**: all columns, click to toggle asc → desc → reset. `SortIcon` component shows ↑↓/↑/↓
- **Dep filter**: dropdown "All / Active (Remain > 0) / Completed (Remain = 0)" — client-side from fetched data
- **Size options**: 50, 100, 200, 350 rows (backend max also 350)

### AssetForm Features
- Realtime depreciation preview panel — `useMemo` on `purchase_price`, `depreciation_period_total`, `purchase_date`, `year_ref`
- Shows: Monthly Dep, Period breakdown (acc/yearly/until/remain), NBV prev/curr, Dep Expense
- Warning badge if `purchase_date` empty

### Dashboard Features
- Monthly Depreciation Detail: group_by=job (default)
- Summary by Asset Group: toggle Summary/Monthly (group_by=group_name)
- Summary by Category: toggle Summary/Monthly (group_by=category)
- All summary data sourced from `depreciation_monthly` table (consistent grand totals)

### ForecastPage (/forecast)
- Year selector: 2027, 2028, 2029, 2030
- Site filter
- 5 summary cards
- Monthly Forecast table (per job)
- By Asset Group + By Category with Summary/Monthly toggle
- Asset Detail table: 2-row grouped header, sticky cols (No, Name), Period/Remain with "mo" unit, "Done" badge for Remain=0, pagination (First/Prev/Page X of Y/Next/Last)

### Export Center (/summary → SummaryReport.tsx)
- Filter: Year + Site
- Preview: 4 summary cards + by-group table + category badges
- Sheet list: 5 sheets description
- Download button with loading spinner + error handling
- Triggers `GET /api/export/excel` with `responseType: 'blob'`

### Chart (Dashboard)
- Custom SVG stacked bar chart (no Recharts — removed due to render issues)

---

## Excel Export (openpyxl)
5-sheet workbook:
1. **Asset List** — 36 columns, zebra striping, navy header
2. **Monthly Depreciation** — per job Jan-Des, totals, dark blue header
3. **Summary by Group** — gray header
4. **Summary by Category** — cyan header + % of total
5. **Acquisitions & Disposals** — green header

Styling: bold headers, fill colors, auto column width, freeze row 1, number format `#,##0`, sheet tab colors.

---

## Known Issues / Past Bugs Fixed
- `ResponsiveContainer` Recharts failed in Vite → replaced with custom SVG
- `summary/monthly` 500 with 1045 assets → fixed by JOIN instead of IN clause
- Category derived from site_location → fixed to preserve or set NULL
- `uq_asset_no_year_ref` → changed to `uq_ax_year_ref`
- `purchase_date=""` from react-hook-form → 422 on PUT → fixed by cleaning empty strings to null in `onSubmit`
- Summary inconsistency: `/by-group` used `dep_expense_current` (stale Excel snapshot) while `/monthly` used `depreciation_monthly.amount` → fixed all summary to use `depreciation_monthly` as source
- `AssetDetail` Total/Year showing `RpNaN` → FastAPI serializes Python `Decimal` as string → fixed `formatIDR`/`formatNumber` in `format.ts` to accept `string|number` and call `Number()` before format; also fixed `reduce` in `AssetDetail.tsx` to use `Number(d.amount || 0)`
- `docker-compose.yml` contained unused `backend` and `frontend` services → removed, kept only `db` service with explicit `container_name: asset-depre-db-1`
- `start.bat` used `docker-compose` (v1) → updated to `docker compose` (v2); also added smart container detection to avoid port conflict when `asset-depre-db-1` already running

---

## Environment Notes

### Python
- System Python: `C:\Python314\python.exe`
- Backend venv: `E:\Github\asset-management\backend\venv\`

### PowerShell Quirks
- Use `;` not `&&` for chaining
- Use `workdir` param in bash tool instead of `cd` inside commands
- Executable with spaces: `& "path\to\exe" args`

### Ports in Use
- 5432: `ngopicode-postgres`
- 5434: `app-karyawan-postgres`
- 5435: `kokarsi-postgres`
- **5436: `asset-depre-db-1`** ← this project
- 8000: FastAPI backend
- 5173: Vite frontend

---

## Common Tasks

### Verify backend syntax
```bash
& "E:\Github\asset-management\backend\venv\Scripts\python.exe" -c "from app.main import app; print('OK')"
```

### Build frontend
```bash
npm run build   # from E:\Github\asset-management\frontend
```

### Connect to DB (via docker exec)
```bash
docker exec asset-depre-db-1 psql -U sankyu -d sankyu_assets -c "SELECT COUNT(*) FROM fixed_assets WHERE year_ref=2026"
```

### Re-import all data from scratch
```bash
docker exec asset-depre-db-1 psql -U sankyu -d sankyu_assets -c "TRUNCATE fixed_assets CASCADE"
& "E:\Github\asset-management\backend\venv\Scripts\python.exe" -m app.utils.excel_importer_v2 --file "E:\Github\asset-management\Est-Depreciation_Calculation_for_2026_.xlsx"
& "E:\Github\asset-management\backend\venv\Scripts\python.exe" -m app.utils.excel_importer_v2 --file "E:\Github\asset-management\Fixed Asset_202606.xlsx"
```

---

## Frontend Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Dashboard | Summary cards, SVG chart, monthly/group/category tables with toggles |
| `/assets` | AssetList | Excel-style table, sort all cols, dep filter, size up to 350 |
| `/assets/new` | AssetForm | Add asset + realtime depreciation preview |
| `/assets/:id` | AssetDetail | Detail + Jan-Dec schedule |
| `/assets/:id/edit` | AssetForm | Edit asset + realtime depreciation preview |
| `/forecast` | ForecastPage | Forecast 2027-2030, monthly/group/category, asset detail |
| `/summary` | SummaryReport | Export Center — download multi-sheet .xlsx |
| `/acquisitions` | Acquisitions | Acquisition/disposal CRUD |
| `/import` | ImportExcel | Drag & drop XLSX upload |
