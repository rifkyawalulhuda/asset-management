from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://sankyu:sankyu123@localhost:5432/sankyu_assets"

    model_config = {"env_file": ".env"}

settings = Settings()
