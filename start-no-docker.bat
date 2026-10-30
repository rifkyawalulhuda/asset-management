@echo off
setlocal EnableExtensions
title Asset Management - Startup (Native PostgreSQL)
color 0A

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

echo ================================================
echo   PT. Sankyu Indonesia International
echo   Fixed Asset ^& Depreciation Management
echo   Mode: Native PostgreSQL
echo ================================================
echo.

:: ── Step 0: Pastikan venv & dependencies siap ───────────────────────────────
:: venv/ dan .env tidak ikut ter-deploy (masuk .gitignore), jadi pada server
:: baru keduanya belum ada. Tanpa langkah ini backend gagal dengan
:: "'uvicorn' is not recognized as an internal or external command".
echo [0/2] Memeriksa environment backend...
call "%ROOT%setup-backend.bat" --quiet
if errorlevel 1 (
    echo.
    echo   Backend belum siap - startup dibatalkan.
    pause
    exit /b 1
)
echo.

:: ── Step 1: Start Backend ───────────────────────────────────────────────────
:: Panggil python milik venv secara langsung. Jangan bergantung pada perintah
:: "uvicorn" di PATH - itulah sumber error di server.
echo [1/2] Starting Backend (FastAPI port 8000)...
start "Asset Backend" /D "%BACKEND%" cmd /k "venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

where curl >nul 2>&1
if errorlevel 1 (
    echo   curl tidak tersedia, menunggu 8 detik...
    timeout /t 8 /nobreak >nul
    goto :backend_skip
)

set /a tries=0
:wait_backend
set /a tries+=1
curl -s -o nul -m 2 http://127.0.0.1:8000/docs
if not errorlevel 1 goto :backend_up
if %tries% geq 30 goto :backend_timeout
timeout /t 2 /nobreak >nul
goto :wait_backend

:backend_up
echo   OK: Backend merespons di http://127.0.0.1:8000
goto :backend_skip

:backend_timeout
echo   [!] Backend belum merespons setelah 60 detik.
echo       Periksa jendela "Asset Backend" untuk pesan error.
echo       Penyebab paling umum: PostgreSQL belum berjalan, atau
echo       .env menunjuk port database yang salah.
:backend_skip
echo.

:: ── Step 2: Build & Serve Frontend ──────────────────────────────────────────
echo [2/2] Starting Frontend (port 3100)...

where npm >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Node.js/npm tidak ditemukan di PATH.
    pause
    exit /b 1
)

where serve >nul 2>&1
if errorlevel 1 (
    echo   'serve' belum ada. Menginstall global...
    call npm install -g serve >nul 2>&1
)

if not exist "%FRONTEND%\node_modules" (
    echo   node_modules belum ada. Menjalankan npm install...
    pushd "%FRONTEND%"
    call npm install
    set "NPMRC=%errorlevel%"
    popd
    if not "%NPMRC%"=="0" (
        echo   ERROR: npm install gagal - pesan error di atas.
        pause
        exit /b 1
    )
)

:: Build selalu dijalankan agar perubahan kode / .env tidak tertinggal di dist lama.
:: Error TIDAK disembunyikan, supaya penyebab kegagalan langsung terlihat.
echo   Building frontend...
pushd "%FRONTEND%"
call npm run build
set "BUILDRC=%errorlevel%"
popd
if not "%BUILDRC%"=="0" (
    echo   ERROR: Frontend build gagal - pesan error di atas.
    pause
    exit /b 1
)

start "Asset Frontend" /D "%FRONTEND%" cmd /k "serve -s dist -l 3100"
echo   OK: Frontend starting...
echo.

:: ── Done ────────────────────────────────────────────────────────────────────
echo ================================================
echo   Semua service sudah berjalan!
echo.
echo   Frontend  : http://localhost:3100
echo   Backend   : http://localhost:8000
echo   API Docs  : http://localhost:8000/docs
echo.
echo   Catatan: Pastikan PostgreSQL native sudah
echo   berjalan sebelum membuka aplikasi.
echo ================================================
echo.
echo   Tekan Enter untuk membuka browser...
pause >nul
start http://localhost:3100