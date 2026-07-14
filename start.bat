@echo off
title Asset Management - Startup
color 0A
echo ================================================
echo   PT. Sankyu Indonesia International
echo   Fixed Asset ^& Depreciation Management
echo ================================================
echo.

:: ── Step 1: Start PostgreSQL via Docker ──────────────────────────────────────
echo [1/3] Starting PostgreSQL (Docker)...

:: Cek apakah container asset-depre-db-1 sudah running
docker inspect -f "{{.State.Running}}" asset-depre-db-1 >nul 2>&1
if %errorlevel% neq 0 (
    :: Container tidak ada, coba start via docker compose
    docker compose -f "%~dp0docker-compose.yml" up -d db >nul 2>&1
    if %errorlevel% neq 0 (
        echo   ERROR: Gagal start PostgreSQL. Pastikan Docker Desktop sudah berjalan.
        pause
        exit /b 1
    )
) else (
    :: Container ada, cek apakah running
    for /f "tokens=*" %%i in ('docker inspect -f "{{.State.Running}}" asset-depre-db-1 2^>nul') do set DB_RUNNING=%%i
    if "%DB_RUNNING%"=="false" (
        docker start asset-depre-db-1 >nul 2>&1
    )
)

:: Wait for DB to be ready (max 15 detik)
set /a retries=0
:wait_db
set /a retries+=1
if %retries% gtr 15 (
    echo   ERROR: Database tidak merespons setelah 15 detik.
    pause
    exit /b 1
)
docker exec asset-depre-db-1 pg_isready -U sankyu -d sankyu_assets >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 1 /nobreak >nul
    goto wait_db
)
echo   OK: PostgreSQL ready on port 5436.
echo.

:: ── Step 2: Start Backend ─────────────────────────────────────────────────────
echo [2/3] Starting Backend (FastAPI port 8000)...
start "Asset Backend" cmd /k "cd /d %~dp0backend && call venv\Scripts\activate && uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo   OK: Backend starting...
echo.

:: Wait a moment for backend to boot
timeout /t 3 /nobreak >nul

:: ── Step 3: Build & Serve Frontend ───────────────────────────────────────────
echo [3/3] Starting Frontend (port 3000)...

:: Check if 'serve' is installed
where serve >nul 2>&1
if %errorlevel% neq 0 (
    echo   'serve' not found. Installing globally...
    npm install -g serve >nul 2>&1
)

:: Build frontend jika dist belum ada atau .env berubah
if not exist "%~dp0frontend\dist\index.html" (
    echo   Building frontend...
    cd /d "%~dp0frontend"
    call npm run build >nul 2>&1
    if %errorlevel% neq 0 (
        echo   ERROR: Frontend build gagal.
        pause
        exit /b 1
    )
    cd /d "%~dp0"
)

start "Asset Frontend" cmd /k "serve -s %~dp0frontend\dist -l 3000"
echo   OK: Frontend starting...
echo.

:: ── Done ─────────────────────────────────────────────────────────────────────
echo ================================================
echo   Semua service sudah berjalan!
echo.
echo   Frontend  : http://localhost:3000
echo   Backend   : http://localhost:8000
echo   API Docs  : http://localhost:8000/docs
echo   Database  : localhost:5436
echo ================================================
echo.
echo   Tekan Enter untuk membuka browser...
pause >nul
start http://localhost:3000
