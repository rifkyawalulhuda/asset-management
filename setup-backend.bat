@echo off
setlocal EnableExtensions
title Asset Management - Backend Environment Setup

set "BACKEND=%~dp0backend"
set "QUIET=0"
if /i "%~1"=="--quiet" set "QUIET=1"

echo ================================================
echo   Pemeriksaan environment backend
echo ================================================
echo.

:: ── Pilih interpreter Python ────────────────────────────────────────────────
:: Utamakan "python" di PATH bila versinya 3.11+. Bila tidak ada, cari lewat
:: py launcher (3.13 / 3.12 / 3.11) supaya server dengan beberapa versi Python
:: tetap memakai interpreter yang didukung.
set "PYEXE="
where python >nul 2>&1
if errorlevel 1 goto :pick_py_launcher

for /f "tokens=2" %%v in ('python --version 2^>^&1') do set "PYVER=%%v"
for /f "tokens=1,2 delims=." %%a in ("%PYVER%") do set "PYMAJ=%%a"
for /f "tokens=1,2 delims=." %%a in ("%PYVER%") do set "PYMIN=%%b"
if not defined PYMAJ goto :pick_py_launcher
if %PYMAJ% LSS 3 goto :pick_py_launcher
if %PYMAJ% EQU 3 if %PYMIN% LSS 11 goto :pick_py_launcher
set "PYEXE=python"
goto :have_py

:pick_py_launcher
py -3.13 -c "import sys" >nul 2>&1
if not errorlevel 1 set "PYEXE=py -3.13"
if defined PYEXE goto :have_py
py -3.12 -c "import sys" >nul 2>&1
if not errorlevel 1 set "PYEXE=py -3.12"
if defined PYEXE goto :have_py
py -3.11 -c "import sys" >nul 2>&1
if not errorlevel 1 set "PYEXE=py -3.11"
if defined PYEXE goto :have_py

echo   [X] Tidak ada Python 3.11+ yang bisa dipakai.
echo       Install Python 3.11 - 3.14 dan centang "Add python.exe to PATH".
goto :fail

:have_py
for /f "tokens=*" %%v in ('%PYEXE% --version 2^>^&1') do echo   Python : %%v  ^(via %PYEXE%^)

:: ── venv valid? ─────────────────────────────────────────────────────────────
:: venv/ tidak ikut ter-deploy (masuk .gitignore). Bila folder venv terlanjur
:: tersalin dari mesin lain, Scripts\python.exe menunjuk ke lokasi Python yang
:: tidak ada di server dan setiap perintah gagal dengan
:: "did not find executable at ...". Deteksi lewat uji eksekusi, lalu buat ulang.
set "VPY=%BACKEND%\venv\Scripts\python.exe"

if exist "%VPY%" (
    "%VPY%" -c "import sys" >nul 2>&1
    if errorlevel 1 (
        echo   [!] venv yang ada tidak bisa dipakai ^(salinan dari mesin lain^).
        echo       [..] Menghapus dan membuat ulang venv...
        rmdir /s /q "%BACKEND%\venv"
    )
)

if not exist "%VPY%" (
    echo   [..] venv belum ada, membuat virtual environment...
    %PYEXE% -m venv "%BACKEND%\venv"
    if errorlevel 1 (
        echo   [X] Gagal membuat venv.
        goto :fail
    )
    echo   [OK] venv dibuat.
)

:: ── Dependencies lengkap? ───────────────────────────────────────────────────
"%VPY%" -c "import uvicorn, psycopg2, fastapi" >nul 2>&1
if errorlevel 1 (
    echo   [..] Dependencies belum lengkap, menjalankan pip install...
    echo        (proses ini bisa beberapa menit pada instalasi pertama)
    "%VPY%" -m pip install --disable-pip-version-check --upgrade pip
    "%VPY%" -m pip install --disable-pip-version-check -r "%BACKEND%\requirements.txt"
    if errorlevel 1 (
        echo.
        echo   [X] pip install gagal - lihat pesan error di atas.
        echo       Penyebab umum pada server baru:
        echo         * tidak ada koneksi internet / proxy
        echo         * versi Python tidak punya wheel untuk salah satu paket
        echo           ^(pakai Python 3.11 - 3.14^)
        goto :fail
    )
)

"%VPY%" -c "import uvicorn" >nul 2>&1
if errorlevel 1 (
    echo   [X] uvicorn masih belum bisa di-import setelah instalasi.
    goto :fail
)
echo   [OK] Dependencies siap ^(uvicorn terpasang di venv^).

:: ── .env ada? (juga tidak ter-deploy karena masuk .gitignore) ────────────────
:: Dicek SEBELUM smoke test supaya masalah .env tidak tertutup error import.
if exist "%BACKEND%\.env" (
    echo   [OK] Ditemukan %BACKEND%\.env
) else (
    echo.
    echo   [!] PERHATIAN: %BACKEND%\.env TIDAK ditemukan.
    if exist "%BACKEND%\.env.txt" (
        echo       Ada file ".env.txt" - Windows mungkin menyembunyikan ekstensi.
        echo       Rename menjadi ".env" ^(tanpa .txt^).
    )
    echo       Backend akan memakai default localhost:5432, sedangkan
    echo       PostgreSQL proyek ini berjalan di port 5436.
    echo       Buat file tersebut berisi baris:
    echo         DATABASE_URL=postgresql://sankyu:sankyu123@localhost:5436/sankyu_assets
    echo       ^(postgresql+psycopg:// juga diterima^)
)

:: ── Diagnosa konfigurasi database ───────────────────────────────────────────
:: pydantic-settings memberi prioritas lebih tinggi ke environment variable OS
:: daripada isi backend\.env. Jadi DATABASE_URL yang di-set lewat "set"/"setx"
:: akan MENIMPA .env tanpa terlihat - sumber kebingungan saat troubleshooting.
pushd "%BACKEND%"
echo   [i] Konfigurasi database yang terbaca:
"%VPY%" -c "import os,sys;sys.path.insert(0,'.');from app.config import settings;env=os.environ.get('DATABASE_URL');print('      env var OS :', env if env else '(tidak di-set)');print('      dipakai    :', settings.DATABASE_URL)"
if defined DATABASE_URL echo   [!] Env var DATABASE_URL terdeteksi - nilainya MENIMPA isi backend\.env
popd

:: ── Smoke test: pastikan aplikasi bisa di-import ────────────────────────────
:: Menangkap lebih awal error seperti driver database tidak terpasang
:: (ModuleNotFoundError: No module named 'psycopg') sebelum backend dijalankan.
pushd "%BACKEND%"
"%VPY%" -c "import app.main" >nul 2>&1
set "IMPORTRC=%errorlevel%"
if not "%IMPORTRC%"=="0" (
    popd
    echo   [X] app.main gagal di-import. Menampilkan detail error:
    pushd "%BACKEND%"
    "%VPY%" -c "import app.main"
    popd
    goto :fail
)
popd
echo   [OK] app.main berhasil di-import.

:: ── Done — .env sudah di-check di atas sebelum smoke test ─────────────────────

echo.
echo   Backend siap.
if "%QUIET%"=="0" pause
exit /b 0

:fail
echo.
if "%QUIET%"=="0" pause
exit /b 1
