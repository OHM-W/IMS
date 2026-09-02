import pytest
from app.config import Settings


def test_default_settings():
    """Verify default application configuration values."""
    cfg = Settings()
    assert cfg.APP_NAME == "IMS Floorplan Digital Twin API"
    assert cfg.APP_PORT == 8000
    assert cfg.PGHOST == "ims-timescaledb"
    assert cfg.PGPORT == 5432
    assert cfg.PGDATABASE == "ims"
    assert cfg.PGUSER == "ims_admin"
    # Ensure statement cache size is 0 for PgBouncer compatibility
    assert cfg.STATEMENT_CACHE_SIZE == 0
    assert cfg.POLL_INTERVAL_SECONDS == 2.0
    assert cfg.STALENESS_THRESHOLD_MINUTES == 5
    assert cfg.ALARM_WINDOW_MINUTES == 5


def test_cors_origins_parsing():
    """Verify CORS origins parsing from string and list."""
    cfg1 = Settings(CORS_ORIGINS="http://localhost:3000,http://localhost:8080")
    assert cfg1.CORS_ORIGINS == ["http://localhost:3000", "http://localhost:8080"]

    cfg2 = Settings(CORS_ORIGINS=["http://localhost:5173"])
    assert cfg2.CORS_ORIGINS == ["http://localhost:5173"]

    cfg3 = Settings(CORS_ORIGINS="*")
    assert cfg3.CORS_ORIGINS == ["*"]


def test_environment_overrides(monkeypatch):
    """Verify configuration loads properly from environment variables."""
    monkeypatch.setenv("APP_NAME", "Custom Factory API")
    monkeypatch.setenv("PGHOST", "postgres-host")
    monkeypatch.setenv("PGPORT", "5433")
    monkeypatch.setenv("PGDATABASE", "factory_test")
    monkeypatch.setenv("POLL_INTERVAL_SECONDS", "1.5")

    cfg = Settings()
    assert cfg.APP_NAME == "Custom Factory API"
    assert cfg.PGHOST == "postgres-host"
    assert cfg.PGPORT == 5433
    assert cfg.PGDATABASE == "factory_test"
    assert cfg.POLL_INTERVAL_SECONDS == 1.5
