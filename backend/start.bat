@echo off
echo Starting Fixed Asset & Depreciation Backend...
echo DATABASE: postgresql://sankyu:sankyu123@localhost:5436/sankyu_assets
echo.
cd /d %~dp0
call venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
