@echo off
title Asset Management - Startup (Native PostgreSQL)
color 0A
echo ================================================
echo   PT. Sankyu Indonesia International
echo   Fixed Asset ^& Depreciation Management
echo   Mode: Native PostgreSQL
echo ================================================
echo.

:: ── Step 1: Start Backend ─────────────────────────────────────────────────────
echo [1/2] Starting Backend (FastAPI port 8000)...
start "Asset Backend" cmd /k "cd /d %~dp0backend && call venv\Scripts\activate && uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo   OK: Backend starting...
echo.

:: Wait a moment for backend to boot
timeout /t 3 /nobreak >nul

:: ── Step 2: Build & Serve Frontend ───────────────────────────────────────────
echo [2/2] Starting Frontend (port 3000)...

:: Check if 'serve' is installed
where serve >nul 2>&1
if %errorlevel% neq 0 (
    echo   'serve' not found. Installing globally...
    npm install -g serve >nul 2>&1
)

:: Build frontend jika dist belum ada
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
echo.
echo   Catatan: Pastikan PostgreSQL native sudah
echo   berjalan sebelum membuka aplikasi.
echo ================================================
echo.
echo   Tekan Enter untuk membuka browser...
pause >nul
start http://localhost:3000
