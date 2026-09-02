import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.db import db
from app.broadcaster import broadcaster


def test_lifespan_startup_and_shutdown_connected():
    """Verify application lifespan startup with successful DB connection and shutdown."""
    with patch.object(db, "connect_with_retry", new_callable=AsyncMock) as mock_conn:
        mock_conn.return_value = True
        with patch.object(broadcaster, "start") as mock_b_start:
            with patch.object(broadcaster, "stop", new_callable=AsyncMock) as mock_b_stop:
                with patch.object(db, "disconnect", new_callable=AsyncMock) as mock_disc:
                    with TestClient(app) as client:
                        mock_conn.assert_called_once()
                        mock_b_start.assert_called_once()
                        res = client.get("/")
                        assert res.status_code == 200
                    mock_b_stop.assert_called_once()
                    mock_disc.assert_called_once()


def test_lifespan_startup_degraded_db():
    """Verify application lifespan startup when DB connection fails."""
    with patch.object(db, "connect_with_retry", new_callable=AsyncMock) as mock_conn:
        mock_conn.return_value = False
        with patch.object(broadcaster, "start") as mock_b_start:
            with patch.object(broadcaster, "stop", new_callable=AsyncMock) as mock_b_stop:
                with patch.object(db, "disconnect", new_callable=AsyncMock) as mock_disc:
                    with TestClient(app) as client:
                        mock_conn.assert_called_once()
                        mock_b_start.assert_called_once()
                        res = client.get("/")
                        assert res.status_code == 200
                    mock_b_stop.assert_called_once()
                    mock_disc.assert_called_once()
