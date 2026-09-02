import os
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    APP_NAME: str = "IMS Floorplan Digital Twin API"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000

    # PostgreSQL / TimescaleDB Connection
    PGHOST: str = "ims-timescaledb"
    PGPORT: int = 5432
    PGDATABASE: str = "ims"
    PGUSER: str = "ims_admin"
    PGPASSWORD: str = "CHANGE_ME"

    # Database Pool Settings
    DB_POOL_MIN_SIZE: int = 2
    DB_POOL_MAX_SIZE: int = 10
    DB_COMMAND_TIMEOUT: float = 10.0
    STATEMENT_CACHE_SIZE: int = 0  # Crucial: Must be 0 for PgBouncer transaction pooling compatibility

    # Polling & Broadcast Settings
    POLL_INTERVAL_SECONDS: float = 2.0
    STALENESS_THRESHOLD_MINUTES: int = 5
    ALARM_WINDOW_MINUTES: int = 5

    # CORS Settings
    CORS_ORIGINS: Union[List[str], str] = ["*"]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )


settings = Settings()
