import importlib.util

from pydantic import field_validator
from pydantic_settings import BaseSettings


def _has_module(name: str) -> bool:
    try:
        return importlib.util.find_spec(name) is not None
    except (ImportError, ValueError):
        return False


def _resolve_pg_driver(url: str) -> str:
    """Samakan driver PostgreSQL dengan paket yang benar-benar terpasang.

    URL bisa ditulis sebagai postgresql://, postgresql+psycopg://, atau
    postgresql+psycopg2://. Bila driver yang diminta tidak ada, pakai driver
    lain yang tersedia supaya backend tidak gagal saat import.

    Catatan penting: SQLAlchemy 2.x memetakan URL tanpa driver
    (postgresql://...) ke psycopg (v3), BUKAN psycopg2. Karena proyek ini
    memakai psycopg2-binary, URL tanpa driver harus ditulis eksplisit menjadi
    postgresql+psycopg2:// agar tidak gagal dengan
    "ModuleNotFoundError: No module named 'psycopg'".
    """
    if not url.startswith("postgresql"):
        return url

    scheme, sep, rest = url.partition("://")
    if not sep:
        return url

    driver = scheme.split("+", 1)[1] if "+" in scheme else ""

    if driver == "":
        # Tanpa driver eksplisit: pilih yang benar-benar terpasang, dengan
        # prioritas psycopg2 (paket yang ada di requirements.txt).
        if _has_module("psycopg2"):
            return f"postgresql+psycopg2://{rest}"
        if _has_module("psycopg"):
            return f"postgresql+psycopg://{rest}"
        return url

    if driver == "psycopg" and not _has_module("psycopg"):
        if _has_module("psycopg2"):
            return f"postgresql+psycopg2://{rest}"
    elif driver == "psycopg2" and not _has_module("psycopg2"):
        if _has_module("psycopg"):
            return f"postgresql+psycopg://{rest}"

    return url


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://sankyu:sankyu123@localhost:5432/sankyu_assets"

    model_config = {"env_file": ".env"}

    @field_validator("DATABASE_URL")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        return _resolve_pg_driver(value)


settings = Settings()
