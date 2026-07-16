# Panduan Deploy — PostgreSQL Native (Tanpa Docker)
**PT. Sankyu Indonesia International**

> Deploy ke mesin Windows 11 baru menggunakan PostgreSQL native (port 5432)
> Gunakan panduan ini jika tidak ingin menggunakan Docker.

---

## Prasyarat

Install software berikut sebelum mulai:

| Software | Versi | Download |
|----------|-------|----------|
| Python | 3.14+ | https://www.python.org/downloads/ |
| Node.js | 20+ | https://nodejs.org/ |
| Git | terbaru | https://git-scm.com/ |
| PostgreSQL | 16 | https://www.enterprisedb.com/downloads/postgres-postgresql-downloads |

> Saat install Python, centang **"Add Python to PATH"**.
> Saat install PostgreSQL, catat password untuk user `postgres` yang diminta saat instalasi.

---

## Step 1 — Install PostgreSQL 16

1. Download installer dari link di atas, pilih **Windows x86-64**
2. Jalankan installer, ikuti wizard:
   - Installation Directory: biarkan default (`C:\Program Files\PostgreSQL\16`)
   - Port: **5432** (default, jangan diubah)
   - Password untuk superuser `postgres`: catat password ini
   - Locale: biarkan default
3. Saat selesai, **jangan centang** Stack Builder — klik Finish

Verifikasi PostgreSQL berjalan:
```cmd
sc query postgresql-x64-16
```

Output yang diharapkan:
```
STATE : 4 RUNNING
```

---

## Step 2 — Buat Database dan User

Buka **Command Prompt** sebagai Administrator, lalu:

```cmd
:: Masuk ke psql sebagai superuser postgres
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres
```

Masukkan password `postgres` yang dibuat saat instalasi. Lalu jalankan perintah berikut di dalam psql:

```sql
-- Buat user sankyu
CREATE USER sankyu WITH PASSWORD 'sankyu123';

-- Buat database
CREATE DATABASE sankyu_assets OWNER sankyu;

-- Berikan semua hak akses
GRANT ALL PRIVILEGES ON DATABASE sankyu_assets TO sankyu;

-- Keluar dari psql
\q
```

Verifikasi koneksi dengan user baru:

```cmd
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U sankyu -d sankyu_assets -h localhost
```

Masukkan password `sankyu123`. Jika berhasil masuk, ketik `\q` untuk keluar.

---

## Step 3 — Clone Repository

```cmd
git clone <URL_REPO> C:\Apps\asset-management
cd C:\Apps\asset-management
```

Ganti `<URL_REPO>` dengan URL git repository yang diberikan.

---

## Step 4 — Setup Backend

```cmd
cd C:\Apps\asset-management\backend

:: Buat virtual environment
python -m venv venv

:: Aktifkan venv
venv\Scripts\activate

:: Install dependencies
pip install -r requirements.txt
```

### Update Konfigurasi Database

Edit file `C:\Apps\asset-management\backend\.env`:

```
DATABASE_URL=postgresql://sankyu:sankyu123@localhost:5432/sankyu_assets
```

> Perhatikan: port **5432** (native), bukan 5436 (Docker).

Verifikasi instalasi:

```cmd
python -c "from app.main import app; print('OK')"
```

---

## Step 5 — Migrasi Database (WAJIB untuk mesin baru)

```cmd
:: Pastikan venv sudah aktif
cd C:\Apps\asset-management\backend
venv\Scripts\activate

alembic upgrade head
```

Output yang diharapkan:

```
INFO  [alembic.runtime.migration] Running upgrade  -> 001, initial migration
```

---

## Step 6 — Import Data dari Excel

```cmd
:: Pastikan venv sudah aktif
cd C:\Apps\asset-management\backend
venv\Scripts\activate

:: File pertama (2025 + lama)
python -m app.utils.excel_importer_v2 --file "C:\Apps\asset-management\Est-Depreciation_Calculation_for_2026_.xlsx"

:: File kedua (2026 terbaru)
python -m app.utils.excel_importer_v2 --file "C:\Apps\asset-management\Fixed Asset_202606.xlsx"
```

Verifikasi data ter-import:

```cmd
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U sankyu -d sankyu_assets -h localhost -c "SELECT year_ref, COUNT(*) FROM fixed_assets GROUP BY year_ref ORDER BY year_ref"
```

Output yang diharapkan:

```
 year_ref | count
----------+-------
     2025 |   224
     2026 |  1045
```

---

## Step 7 — Setup Frontend

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

---

## Step 8 — Install Static File Server

```cmd
npm install -g serve
```

---

## Step 9 — Jalankan Aplikasi

Double-click file `start-no-docker.bat` di folder `C:\Apps\asset-management\`.

Atau jalankan dari Command Prompt:

```cmd
C:\Apps\asset-management\start-no-docker.bat
```

> Pastikan PostgreSQL service sudah berjalan sebelum menjalankan aplikasi.
> PostgreSQL native akan otomatis berjalan saat Windows startup setelah instalasi.

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

PostgreSQL native sudah otomatis start saat Windows boot (diinstall sebagai Windows Service).

Untuk backend dan frontend, tambahkan shortcut `start-no-docker.bat` ke Startup:

1. Tekan `Win + R`, ketik `shell:startup`, tekan Enter
2. Buat shortcut `start-no-docker.bat` dan taruh di folder yang terbuka

---

## Troubleshooting

### PostgreSQL service tidak berjalan

```cmd
:: Cek status service
sc query postgresql-x64-16

:: Start service
net start postgresql-x64-16
```

---

### Backend error `connection refused` port 5432

Pastikan `backend\.env` berisi port yang benar:

```
DATABASE_URL=postgresql://sankyu:sankyu123@localhost:5432/sankyu_assets
```

---

### Backend error `password authentication failed`

Pastikan user `sankyu` sudah dibuat dengan password yang benar:

```cmd
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "ALTER USER sankyu WITH PASSWORD 'sankyu123';"
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

## Perbedaan dengan Deploy Docker

| Aspek | Docker (`start.bat`) | Native (`start-no-docker.bat`) |
|-------|---------------------|-------------------------------|
| PostgreSQL port | 5436 | 5432 |
| `backend/.env` | `...@localhost:5436/...` | `...@localhost:5432/...` |
| Script startup | `start.bat` | `start-no-docker.bat` |
| Butuh Docker Desktop | Ya | Tidak |
| Auto-start DB | Via Docker restart policy | Via Windows Service |

---

## Struktur Folder Setelah Deploy

```
C:\Apps\asset-management\
├── backend\
│   ├── venv\              <- virtual environment Python
│   ├── app\               <- source code backend
│   └── .env               <- DATABASE_URL=...localhost:5432...
├── frontend\
│   ├── dist\              <- hasil build (yang di-serve)
│   ├── .env               <- default config (VITE_API_URL=localhost)
│   └── .env.local         <- config lokal per mesin
└── start-no-docker.bat    <- script startup tanpa Docker
```

---

## Checklist Deploy

- [ ] Python 3.14+ terinstall dan ada di PATH
- [ ] Node.js 20+ terinstall
- [ ] PostgreSQL 16 terinstall dan service running (`sc query postgresql-x64-16`)
- [ ] User `sankyu` dan database `sankyu_assets` sudah dibuat
- [ ] Repository sudah di-clone
- [ ] `backend\.env` sudah diupdate ke port **5432**
- [ ] `pip install -r requirements.txt` berhasil
- [ ] `alembic upgrade head` berhasil — tabel ter-buat di DB
- [ ] Data Excel sudah di-import — 1045 assets di `year_ref=2026`
- [ ] `npm install` berhasil
- [ ] `frontend\.env.local` sudah dikonfigurasi dengan URL yang benar
- [ ] `npm run build` berhasil — folder `dist\` ter-buat
- [ ] `serve` sudah terinstall global (`npm install -g serve`)
- [ ] `start-no-docker.bat` berjalan dan aplikasi bisa diakses di http://localhost:3000

---

*Last updated: 2026-07-16*
