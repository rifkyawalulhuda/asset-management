# Panduan Konfigurasi PostgreSQL
**PT. Sankyu Indonesia International**

> Instruksi untuk mengganti port, username, password, atau nama database PostgreSQL.

---

## File yang Perlu Diubah

Terdapat **3 file utama** yang perlu diupdate saat mengganti konfigurasi PostgreSQL:

| File | Keterangan |
|------|------------|
| `backend/.env` | Koneksi string database untuk backend FastAPI |
| `docker-compose.yml` | Konfigurasi container PostgreSQL (khusus deploy Docker) |
| `start.bat` | Script startup (khusus deploy Docker) |

Untuk **deploy native** (tanpa Docker), `docker-compose.yml` dan `start.bat` tidak perlu diubah — cukup ubah `backend/.env` dan konfigurasi PostgreSQL native.

---

## Konfigurasi Default

| Parameter | Nilai Default (Docker) | Nilai Default (Native) |
|-----------|----------------------|----------------------|
| Host | `localhost` | `localhost` |
| Port | `5436` | `5432` |
| Username | `sankyu` | `sankyu` |
| Password | `sankyu123` | `sankyu123` |
| Database | `sankyu_assets` | `sankyu_assets` |

---

## A. Mengganti Port

### Deploy Docker (`start.bat`)

**1. `backend/.env`**
```
DATABASE_URL=postgresql://sankyu:sankyu123@localhost:XXXX/sankyu_assets
```
Ganti `XXXX` dengan port baru (contoh: `5437`).

**2. `docker-compose.yml`**
```yaml
ports:
  - "XXXX:5432"
```
Ganti `XXXX` dengan port baru yang sama (contoh: `5437`).

**3. `start.bat`** — update baris info display:
```bat
echo   Database  : localhost:XXXX
```

Setelah selesai, restart container:
```cmd
docker compose down
docker compose up -d db
```

---

### Deploy Native (`start-no-docker.bat`)

**Hanya satu file yang perlu diubah:**

**`backend/.env`**
```
DATABASE_URL=postgresql://sankyu:sankyu123@localhost:XXXX/sankyu_assets
```

Kemudian update konfigurasi port di PostgreSQL native:

1. Buka file `postgresql.conf`:
   ```
   C:\Program Files\PostgreSQL\16\data\postgresql.conf
   ```
2. Cari dan ubah baris:
   ```
   port = XXXX
   ```
3. Restart service PostgreSQL:
   ```cmd
   net stop postgresql-x64-16
   net start postgresql-x64-16
   ```

---

## B. Mengganti Username

### Deploy Docker

**1. `backend/.env`**
```
DATABASE_URL=postgresql://USERNAME_BARU:sankyu123@localhost:5436/sankyu_assets
```

**2. `docker-compose.yml`**
```yaml
environment:
  POSTGRES_USER: USERNAME_BARU
```

**3. `start.bat`** — update baris pg_isready:
```bat
docker exec asset-depre-db-1 pg_isready -U USERNAME_BARU -d sankyu_assets >nul 2>&1
```

> **Penting:** Mengganti username di `docker-compose.yml` hanya berlaku untuk container baru.
> Jika container sudah ada dengan data, hapus dulu volume lama:
> ```cmd
> docker compose down -v
> docker compose up -d db
> ```
> Lalu jalankan ulang `alembic upgrade head` dan import data Excel.

---

### Deploy Native

**`backend/.env`**
```
DATABASE_URL=postgresql://USERNAME_BARU:sankyu123@localhost:5432/sankyu_assets
```

Buat user baru di PostgreSQL:
```cmd
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres
```
```sql
CREATE USER username_baru WITH PASSWORD 'sankyu123';
GRANT ALL PRIVILEGES ON DATABASE sankyu_assets TO username_baru;
\q
```

---

## C. Mengganti Password

### Deploy Docker

**1. `backend/.env`**
```
DATABASE_URL=postgresql://sankyu:PASSWORD_BARU@localhost:5436/sankyu_assets
```

**2. `docker-compose.yml`**
```yaml
environment:
  POSTGRES_PASSWORD: PASSWORD_BARU
```

> **Penting:** Sama seperti username, mengganti password di `docker-compose.yml` hanya berlaku
> untuk container baru. Jika container sudah ada:
> ```cmd
> docker exec asset-depre-db-1 psql -U sankyu -d sankyu_assets -c "ALTER USER sankyu WITH PASSWORD 'PASSWORD_BARU';"
> ```
> Lalu update `backend/.env` dengan password baru.

---

### Deploy Native

**`backend/.env`**
```
DATABASE_URL=postgresql://sankyu:PASSWORD_BARU@localhost:5432/sankyu_assets
```

Update password user di PostgreSQL:
```cmd
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres
```
```sql
ALTER USER sankyu WITH PASSWORD 'PASSWORD_BARU';
\q
```

---

## D. Mengganti Nama Database

### Deploy Docker

**1. `backend/.env`**
```
DATABASE_URL=postgresql://sankyu:sankyu123@localhost:5436/NAMA_DB_BARU
```

**2. `docker-compose.yml`**
```yaml
environment:
  POSTGRES_DB: NAMA_DB_BARU
```

**3. `start.bat`** — update baris pg_isready:
```bat
docker exec asset-depre-db-1 pg_isready -U sankyu -d NAMA_DB_BARU >nul 2>&1
```

> **Penting:** Sama seperti username/password, perubahan ini hanya berlaku untuk container baru.
> ```cmd
> docker compose down -v
> docker compose up -d db
> ```
> Lalu jalankan ulang `alembic upgrade head` dan import data Excel.

---

### Deploy Native

**`backend/.env`**
```
DATABASE_URL=postgresql://sankyu:sankyu123@localhost:5432/NAMA_DB_BARU
```

Buat database baru di PostgreSQL:
```cmd
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres
```
```sql
CREATE DATABASE nama_db_baru OWNER sankyu;
GRANT ALL PRIVILEGES ON DATABASE nama_db_baru TO sankyu;
\q
```

Lalu jalankan migrasi dan import data:
```cmd
cd C:\Apps\asset-management\backend
venv\Scripts\activate
alembic upgrade head
python -m app.utils.excel_importer_v2 --file "..\Est-Depreciation_Calculation_for_2026_.xlsx"
python -m app.utils.excel_importer_v2 --file "..\Fixed Asset_202606.xlsx"
```

---

## E. Mengganti Semua Sekaligus (Full Custom)

Format `DATABASE_URL` secara lengkap:

```
DATABASE_URL=postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

Contoh:
```
DATABASE_URL=postgresql://myuser:mypassword@localhost:5433/mydb
```

Update semua file sesuai nilai baru:

**`backend/.env`**
```
DATABASE_URL=postgresql://myuser:mypassword@localhost:5433/mydb
```

**`docker-compose.yml`** (khusus Docker)
```yaml
services:
  db:
    environment:
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
      POSTGRES_DB: mydb
    ports:
      - "5433:5432"
```

**`start.bat`** (khusus Docker)
```bat
docker exec asset-depre-db-1 pg_isready -U myuser -d mydb >nul 2>&1
...
echo   Database  : localhost:5433
```

---

## Verifikasi Setelah Perubahan

### Docker
```cmd
:: Restart container
docker compose down
docker compose up -d db

:: Test koneksi
docker exec asset-depre-db-1 psql -U USERNAME -d DATABASE -c "SELECT 1"
```

### Native
```cmd
:: Test koneksi
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U USERNAME -d DATABASE -h localhost -p PORT -c "SELECT 1"
```

### Backend
```cmd
cd C:\Apps\asset-management\backend
venv\Scripts\activate
python -c "from app.database import engine; engine.connect(); print('OK')"
```

---

## Ringkasan Checklist

Setelah mengganti konfigurasi, pastikan semua langkah ini sudah dilakukan:

- [ ] `backend/.env` sudah diupdate dengan nilai baru
- [ ] `docker-compose.yml` sudah diupdate (khusus Docker)
- [ ] `start.bat` sudah diupdate (khusus Docker, jika port atau username berubah)
- [ ] Container/service PostgreSQL sudah di-restart
- [ ] Koneksi berhasil diverifikasi
- [ ] `alembic upgrade head` sudah dijalankan (jika database baru)
- [ ] Data Excel sudah di-import (jika database baru)
- [ ] Frontend bisa mengakses backend — cek di http://localhost:3000

---

*Last updated: 2026-07-16*
