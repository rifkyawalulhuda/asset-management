# Panduan Deploy — Fixed Asset & Depreciation App
**PT. Sankyu Indonesia International**

> Deploy ke mesin Windows 11 baru (lokal, tanpa server/nginx)

---

## Prasyarat

Install software berikut sebelum mulai:

| Software | Versi | Download |
|----------|-------|----------|
| Python | 3.14+ | https://www.python.org/downloads/ |
| Node.js | 20+ | https://nodejs.org/ |
| Git | terbaru | https://git-scm.com/ |
| Docker Desktop | terbaru | https://www.docker.com/products/docker-desktop/ |

> Saat install Python, centang **"Add Python to PATH"**.
> Setelah install Docker Desktop, pastikan sudah **login** dan **engine sudah running**
> (ikon Docker di taskbar berwarna biru/putih, bukan merah).

---

## Step 1 — Clone Repository

Buka **Command Prompt**, lalu:

```cmd
git clone <URL_REPO> C:\Apps\asset-management
cd C:\Apps\asset-management
```

Ganti `<URL_REPO>` dengan URL git repository yang diberikan.

> Folder instalasi bisa disesuaikan, tapi pastikan path tidak mengandung spasi.

---

## Step 2 — Start Database (PostgreSQL via Docker)

```cmd
cd C:\Apps\asset-management
docker compose up -d db
```

Verifikasi container berjalan:

```cmd
docker ps --filter "name=asset-depre-db-1"
```

Output yang diharapkan:

```
NAMES              STATUS          PORTS
asset-depre-db-1   Up X seconds    0.0.0.0:5436->5432/tcp
```

---

## Step 3 — Setup Backend

```cmd
cd C:\Apps\asset-management\backend

:: Buat virtual environment
python -m venv venv

:: Aktifkan venv
venv\Scripts\activate

:: Install dependencies
pip install -r requirements.txt
```

Verifikasi instalasi:

```cmd
python -c "from app.main import app; print('OK')"
```

---

## Step 4 — Migrasi Database (WAJIB untuk mesin baru)

```cmd
:: Pastikan venv sudah aktif dan berada di folder backend
cd C:\Apps\asset-management\backend
venv\Scripts\activate

alembic upgrade head
```

Output yang diharapkan:

```
INFO  [alembic.runtime.migration] Running upgrade  -> 001, initial migration
```

---

## Step 5 — Import Data dari Excel

Jalankan dua kali untuk dua file Excel:

```cmd
:: File pertama (2025 + lama)
python -m app.utils.excel_importer_v2 --file "C:\Apps\asset-management\Est-Depreciation_Calculation_for_2026_.xlsx"

:: File kedua (2026 terbaru)
python -m app.utils.excel_importer_v2 --file "C:\Apps\asset-management\Fixed Asset_202606.xlsx"
```

Verifikasi data ter-import:

```cmd
docker exec asset-depre-db-1 psql -U sankyu -d sankyu_assets -c "SELECT year_ref, COUNT(*) FROM fixed_assets GROUP BY year_ref ORDER BY year_ref"
```

Output yang diharapkan:

```
 year_ref | count
----------+-------
     2025 |   224
     2026 |  1045
```

---

## Step 6 — Setup Frontend

```cmd
cd C:\Apps\asset-management\frontend
npm install
```

### Konfigurasi API URL

Buat file `C:\Apps\asset-management\frontend\.env.local`:

```
# Jika hanya diakses dari mesin ini sendiri:
VITE_API_URL=http://localhost:8000/api

# Jika diakses dari PC lain di jaringan (ganti dengan IP mesin ini):
VITE_API_URL=http://192.168.1.XXX:8000/api
```

> Cari IP mesin dengan menjalankan `ipconfig` di Command Prompt,
> lihat bagian **IPv4 Address** pada adapter jaringan yang aktif.

### Build Frontend

```cmd
cd C:\Apps\asset-management\frontend
npm run build
```

Output yang diharapkan:

```
built in X.XXs
dist/index.html   ...
dist/assets/...
```

---

## Step 7 — Install Static File Server

```cmd
npm install -g serve
```

---

## Step 8 — Jalankan Aplikasi

Double-click file `start.bat` di folder `C:\Apps\asset-management\`.

Atau jalankan dari Command Prompt:

```cmd
C:\Apps\asset-management\start.bat
```

Akan terbuka 2 window baru (backend & frontend), lalu browser otomatis membuka aplikasi.

---

## Akses Aplikasi

| Service | URL |
|---------|-----|
| **Aplikasi (Frontend)** | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Documentation | http://localhost:8000/docs |

Jika diakses dari PC lain di jaringan, ganti `localhost` dengan IP mesin ini.
Contoh: `http://192.168.1.100:3000`

---

## Izinkan Port di Windows Firewall (jika diakses dari jaringan LAN)

Buka **PowerShell as Administrator**:

```powershell
# Izinkan port Frontend
netsh advfirewall firewall add rule name="Asset App Frontend" dir=in action=allow protocol=TCP localport=3000

# Izinkan port Backend
netsh advfirewall firewall add rule name="Asset App Backend" dir=in action=allow protocol=TCP localport=8000
```

---

## Menjalankan Otomatis saat Windows Boot (Opsional)

### Cara 1 — Startup Folder

1. Tekan `Win + R`, ketik `shell:startup`, tekan Enter
2. Buat shortcut `start.bat` dan taruh di folder yang terbuka

### Cara 2 — Task Scheduler

1. Buka **Task Scheduler** → **Create Basic Task**
2. Trigger: **At startup**
3. Action: **Start a program** → Browse ke `start.bat`
4. Centang **Run with highest privileges**

---

## Troubleshooting

### Port 5436 sudah dipakai

```
Error: Bind for 0.0.0.0:5436 failed: port is already allocated
```

Cek proses yang memakai port tersebut:

```cmd
netstat -ano | findstr :5436
```

Jika ada proses lain, matikan atau ganti port di `docker-compose.yml` dan `backend\.env`.

---

### Container DB tidak bisa start

```cmd
:: Cek status container
docker ps -a --filter "name=asset-depre-db-1"

:: Start container yang sudah ada
docker start asset-depre-db-1

:: Cek log jika masih error
docker logs asset-depre-db-1
```

---

### Backend error `connection refused` atau `password authentication failed`

Pastikan `backend\.env` berisi:

```
DATABASE_URL=postgresql://sankyu:sankyu123@localhost:5436/sankyu_assets
```

---

### Frontend menampilkan halaman kosong atau error CORS

Pastikan `VITE_API_URL` di `.env.local` sudah sesuai, lalu build ulang:

```cmd
cd C:\Apps\asset-management\frontend
npm run build
```

---

### `alembic` tidak dikenali

Pastikan virtual environment sudah aktif:

```cmd
cd C:\Apps\asset-management\backend
venv\Scripts\activate
alembic upgrade head
```

---

## Struktur Folder Setelah Deploy

```
C:\Apps\asset-management\
├── backend\
│   ├── venv\              <- virtual environment Python
│   ├── app\               <- source code backend
│   └── .env               <- konfigurasi database
├── frontend\
│   ├── dist\              <- hasil build (yang di-serve)
│   ├── .env               <- default config (VITE_API_URL=localhost)
│   └── .env.local         <- config lokal per mesin (tidak di-commit)
├── docker-compose.yml     <- konfigurasi PostgreSQL Docker
└── start.bat              <- script untuk menjalankan semua service
```

---

## Checklist Deploy

- [ ] Python 3.14+ terinstall dan ada di PATH
- [ ] Node.js 20+ terinstall
- [ ] Docker Desktop terinstall dan engine running
- [ ] Repository sudah di-clone
- [ ] `docker compose up -d db` berhasil — container `asset-depre-db-1` running
- [ ] `pip install -r requirements.txt` berhasil
- [ ] `alembic upgrade head` berhasil — tabel ter-buat di DB
- [ ] Data Excel sudah di-import — 1045 assets di `year_ref=2026`
- [ ] `npm install` berhasil
- [ ] `frontend\.env.local` sudah dikonfigurasi dengan URL yang benar
- [ ] `npm run build` berhasil — folder `dist\` ter-buat
- [ ] `serve` sudah terinstall global (`npm install -g serve`)
- [ ] `start.bat` berjalan dan aplikasi bisa diakses di http://localhost:3000

---

*Last updated: 2026-07-14*
