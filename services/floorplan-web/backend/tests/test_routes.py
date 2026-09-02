from datetime import datetime, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch
from app.main import app
from app.db import db
from app.broadcaster import broadcaster


@pytest.fixture
def client():
    """Create test client without launching lifespan background tasks."""
    return TestClient(app)


def test_root_endpoint(client):
    """Verify root status summary endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "IMS Floorplan Digital Twin API"
    assert data["status"] == "running"
    assert "endpoints" in data
    assert data["endpoints"]["health"] == "/api/health"
    assert data["endpoints"]["websocket"] == "/ws/ldi"


def test_health_endpoint_healthy(client):
    """Verify /api/health endpoint when DB is connected."""
    with patch.object(db, "check_health", new_callable=AsyncMock) as mock_health:
        mock_health.return_value = True
        with patch.object(db, "get_pool_stats", return_value=(5, 2)):
            response = client.get("/api/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert data["db_connected"] is True
            assert data["pool_free"] == 5
            assert data["pool_used"] == 2
            assert "timestamp" in data


def test_health_endpoint_degraded(client):
    """Verify /api/health endpoint when DB is not connected."""
    with patch.object(db, "check_health", new_callable=AsyncMock) as mock_health:
        mock_health.return_value = False
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "degraded"
        assert data["db_connected"] is False


def test_snapshot_endpoint(client):
    """Verify /api/snapshot endpoint."""
    mock_snapshot = [
        {
            "eqp_id": "LDI-01",
            "status": 1,
            "temperature": 22.4,
            "humidity": 55.2,
            "resist_dosage": 45.12,
            "scan_speed": 350.0,
            "air_vacuum": -22.5,
            "thickness": 1.6,
            "board_no": 42,
            "total_board": 100,
            "total_time": 18.5,
            "mo": "MO-2026-0901",
            "fpn": "PCB-8891-B",
            "layer_name": "L3-SIGNAL",
            "last_seen": "2026-09-01T02:15:00Z",
        }
    ]
    with patch.object(broadcaster, "fetch_snapshot", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = mock_snapshot
        response = client.get("/api/snapshot")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["eqp_id"] == "LDI-01"
        assert data[0]["status"] == 1
        assert data[0]["temperature"] == 22.4


def test_machines_endpoint_with_pool(client):
    """Verify /api/machines endpoint returns list of devices."""
    mock_rows = [
        {"eqp_id": "LDI-01", "location": "Cleanroom Zone A", "enabled": True},
        {"eqp_id": "LDI-02", "location": "Cleanroom Zone A", "enabled": True},
    ]

    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = mock_rows

    mock_pool = MagicMock()
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

    with patch.object(db, "pool", mock_pool):
        response = client.get("/api/machines")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["eqp_id"] == "LDI-01"
        assert data[1]["eqp_id"] == "LDI-02"


def test_machines_endpoint_no_pool(client):
    """Verify /api/machines returns 503 when DB pool is unavailable."""
    with patch.object(db, "pool", None):
        response = client.get("/api/machines")
        assert response.status_code == 503


def test_history_endpoint(client):
    """Verify /api/history/{eqp_id} endpoint returns historical records."""
    now = datetime(2026, 9, 1, 2, 0, 0, tzinfo=timezone.utc)
    mock_rows = [
        {
            "time": now,
            "temperature": Decimal("22.3"),
            "humidity": Decimal("55.0"),
            "resist_dosage": Decimal("45.0"),
            "scan_speed": Decimal("350.0"),
            "air_vacuum": Decimal("-22.4"),
            "thickness": Decimal("1.6"),
            "board_no": 40,
            "total_board": 100,
            "state": True,
        }
    ]

    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = mock_rows

    mock_pool = MagicMock()
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

    with patch.object(db, "pool", mock_pool):
        response = client.get("/api/history/LDI-01?minutes=30&limit=50")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["temperature"] == 22.3
        assert data[0]["board_no"] == 40
        assert data[0]["state"] is True


def test_websocket_endpoint(client):
    """Verify WebSocket /ws/ldi connection and initial cached payload delivery."""
    broadcaster.cached_snapshot = [
        {
            "eqp_id": "LDI-01",
            "status": 1,
            "temperature": 22.4,
            "humidity": 55.2,
            "resist_dosage": 45.12,
            "scan_speed": 350.0,
            "air_vacuum": -22.5,
            "thickness": 1.6,
            "board_no": 42,
            "total_board": 100,
            "total_time": 18.5,
            "mo": "MO-2026-0901",
            "fpn": "PCB-8891-B",
            "layer_name": "L3-SIGNAL",
            "last_seen": "2026-09-01T02:15:00Z",
        }
    ]

    with client.websocket_connect("/ws/ldi") as ws:
        # Client should immediately receive the cached snapshot
        msg = ws.receive_json()
        assert isinstance(msg, list)
        assert len(msg) == 1
        assert msg[0]["eqp_id"] == "LDI-01"
        assert msg[0]["status"] == 1
        # Send a heartbeat/ping from client
        ws.send_text("ping")


def test_history_invalid_query_params(client):
    """Verify history endpoint validation rejection for out-of-range params."""
    # minutes < 1
    resp1 = client.get("/api/history/LDI-01?minutes=0")
    assert resp1.status_code == 422

    # limit > 1000
    resp2 = client.get("/api/history/LDI-01?limit=2000")
    assert resp2.status_code == 422


def test_snapshot_error_handling(client):
    """Verify snapshot endpoint returns 500 when fetch_snapshot raises exception."""
    with patch.object(broadcaster, "fetch_snapshot", side_effect=Exception("DB Error")):
        response = client.get("/api/snapshot")
        assert response.status_code == 500
        assert "detail" in response.json()


def test_machines_fallback_to_ldi_data(client):
    """Verify machines endpoint falls back to public.ldi_data if public.devices fails."""
    mock_conn = AsyncMock()
    # First query (devices) raises exception, second query (ldi_data) returns rows
    mock_conn.fetch.side_effect = [
        Exception("Relation public.devices does not exist"),
        [{"eqp_id": "LDI-01"}, {"eqp_id": "LDI-02"}],
    ]

    mock_pool = MagicMock()
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

    with patch.object(db, "pool", mock_pool):
        response = client.get("/api/machines")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["eqp_id"] == "LDI-01"
        assert data[0]["location"] == "Cleanroom Photolithography"


def test_machines_database_query_error(client):
    """Verify machines endpoint returns 500 if both devices and ldi_data queries fail."""
    mock_conn = AsyncMock()
    mock_conn.fetch.side_effect = Exception("Fatal database connection error")

    mock_pool = MagicMock()
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

    with patch.object(db, "pool", mock_pool):
        response = client.get("/api/machines")
        assert response.status_code == 500


def test_history_database_query_error(client):
    """Verify history endpoint returns 500 when query fails."""
    mock_conn = AsyncMock()
    mock_conn.fetch.side_effect = Exception("Query execution timeout")

    mock_pool = MagicMock()
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

    with patch.object(db, "pool", mock_pool):
        response = client.get("/api/history/LDI-01")
        assert response.status_code == 500


@pytest.mark.asyncio
async def test_websocket_endpoint_exception_handling():
    """Verify websocket endpoint catches exceptions and cleans up client."""
    from app.routes.ws import websocket_ldi_endpoint
    from starlette.websockets import WebSocketDisconnect

    mock_ws1 = AsyncMock()
    mock_ws1.receive_text.side_effect = WebSocketDisconnect(1000)

    with patch.object(broadcaster, "connect", new_callable=AsyncMock) as mock_connect:
        with patch.object(broadcaster, "disconnect") as mock_disconnect:
            await websocket_ldi_endpoint(mock_ws1)
            mock_connect.assert_called_once_with(mock_ws1)
            mock_disconnect.assert_called_once_with(mock_ws1)

    mock_ws2 = AsyncMock()
    mock_ws2.receive_text.side_effect = RuntimeError("Socket read failure")

    with patch.object(broadcaster, "connect", new_callable=AsyncMock) as mock_connect:
        with patch.object(broadcaster, "disconnect") as mock_disconnect:
            await websocket_ldi_endpoint(mock_ws2)
            mock_connect.assert_called_once_with(mock_ws2)
            mock_disconnect.assert_called_once_with(mock_ws2)


