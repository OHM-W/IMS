import asyncio
from datetime import datetime, timezone
from decimal import Decimal
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.broadcaster import Broadcaster, serialize_row


def test_serialize_row():
    """Verify serialize_row casts Decimals to floats and datetimes to ISO strings."""
    now = datetime(2026, 9, 1, 2, 15, 0, tzinfo=timezone.utc)
    raw_row = {
        "eqp_id": "LDI-01",
        "status": 1,
        "temperature": Decimal("22.4"),
        "humidity": Decimal("55.2"),
        "resist_dosage": Decimal("45.12"),
        "scan_speed": Decimal("350.0"),
        "air_vacuum": Decimal("-22.5"),
        "thickness": Decimal("1.600"),
        "board_no": 42,
        "total_board": 100,
        "total_time": Decimal("18.5"),
        "mo": "MO-2026-0901",
        "fpn": "PCB-8891-B",
        "layer_name": "L3-SIGNAL",
        "last_seen": now,
    }
    serialized = serialize_row(raw_row)
    assert serialized["eqp_id"] == "LDI-01"
    assert serialized["temperature"] == 22.4
    assert serialized["humidity"] == 55.2
    assert serialized["resist_dosage"] == 45.12
    assert serialized["scan_speed"] == 350.0
    assert serialized["air_vacuum"] == -22.5
    assert serialized["thickness"] == 1.6
    assert serialized["total_time"] == 18.5
    assert serialized["last_seen"] == "2026-09-01T02:15:00+00:00"
    assert isinstance(serialized["board_no"], int)


@pytest.mark.asyncio
async def test_broadcaster_connection_lifecycle():
    """Verify WebSocket client connection, caching, and disconnect."""
    b = Broadcaster()
    b.cached_snapshot = [{"eqp_id": "LDI-01", "status": 1}]

    mock_ws = AsyncMock()
    mock_ws.accept = AsyncMock()
    mock_ws.send_text = AsyncMock()

    # Connect client
    await b.connect(mock_ws)
    assert mock_ws in b.active_connections
    assert len(b.active_connections) == 1
    mock_ws.accept.assert_called_once()
    # Check that initial snapshot was transmitted
    mock_ws.send_text.assert_called_once_with(json.dumps(b.cached_snapshot))

    # Disconnect client
    b.disconnect(mock_ws)
    assert mock_ws not in b.active_connections
    assert len(b.active_connections) == 0


@pytest.mark.asyncio
async def test_broadcaster_broadcast_success():
    """Verify broadcasting message to multiple connected WebSocket clients."""
    b = Broadcaster()
    ws1 = AsyncMock()
    ws2 = AsyncMock()

    await b.connect(ws1)
    await b.connect(ws2)
    assert len(b.active_connections) == 2

    payload = json.dumps([{"eqp_id": "LDI-01", "status": 1}])
    await b.broadcast(payload)

    ws1.send_text.assert_called_with(payload)
    ws2.send_text.assert_called_with(payload)


@pytest.mark.asyncio
async def test_broadcaster_removes_dead_connections():
    """Verify dead connections that raise on send_text are automatically pruned."""
    b = Broadcaster()
    live_ws = AsyncMock()
    dead_ws = AsyncMock()
    dead_ws.send_text.side_effect = ConnectionResetError("Client disconnected abruptly")

    await b.connect(live_ws)
    await b.connect(dead_ws)
    assert len(b.active_connections) == 2

    payload = json.dumps([{"eqp_id": "LDI-01", "status": 1}])
    await b.broadcast(payload)

    # dead_ws should have been removed
    assert dead_ws not in b.active_connections
    assert live_ws in b.active_connections
    assert len(b.active_connections) == 1


@pytest.mark.asyncio
async def test_broadcaster_start_stop():
    """Verify background poll loop starts and stops gracefully."""
    b = Broadcaster()
    # Mock fetch_snapshot
    b.fetch_snapshot = AsyncMock(return_value=[{"eqp_id": "LDI-01", "status": 1}])

    b.start()
    assert b._running is True
    assert b._task is not None

    # Let loop run for a small fraction
    await asyncio.sleep(0.05)

    await b.stop()
    assert b._running is False
    assert b._task is None


@pytest.mark.asyncio
async def test_broadcaster_fetch_snapshot_no_pool():
    """Verify fetch_snapshot returns cached snapshot if db.pool is None."""
    b = Broadcaster()
    b.cached_snapshot = [{"eqp_id": "LDI-01", "status": 1}]
    with patch("app.broadcaster.db.pool", None):
        result = await b.fetch_snapshot()
        assert result == [{"eqp_id": "LDI-01", "status": 1}]


@pytest.mark.asyncio
async def test_broadcaster_fetch_snapshot_primary_success():
    """Verify fetch_snapshot successfully executes primary query."""
    now = datetime(2026, 9, 1, 2, 0, 0, tzinfo=timezone.utc)
    mock_rows = [
        {
            "eqp_id": "LDI-01",
            "status": 1,
            "temperature": Decimal("22.0"),
            "humidity": Decimal("55.0"),
            "resist_dosage": Decimal("45.0"),
            "scan_speed": Decimal("350.0"),
            "air_vacuum": Decimal("-22.0"),
            "thickness": Decimal("1.6"),
            "board_no": 1,
            "total_board": 100,
            "total_time": Decimal("18.0"),
            "mo": "MO-1",
            "fpn": "FPN-1",
            "layer_name": "L1",
            "last_seen": now,
        }
    ]

    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = mock_rows

    mock_pool = MagicMock()
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

    b = Broadcaster()
    with patch("app.broadcaster.db.pool", mock_pool):
        snapshot = await b.fetch_snapshot()
        assert len(snapshot) == 1
        assert snapshot[0]["eqp_id"] == "LDI-01"
        assert snapshot[0]["temperature"] == 22.0


@pytest.mark.asyncio
async def test_broadcaster_fetch_snapshot_fallback_query():
    """Verify fetch_snapshot executes fallback query if primary query fails."""
    now = datetime(2026, 9, 1, 2, 0, 0, tzinfo=timezone.utc)
    mock_rows = [
        {
            "eqp_id": "LDI-02",
            "status": 2,
            "temperature": Decimal("23.0"),
            "humidity": Decimal("54.0"),
            "resist_dosage": Decimal("44.0"),
            "scan_speed": Decimal("340.0"),
            "air_vacuum": Decimal("-21.0"),
            "thickness": Decimal("1.5"),
            "board_no": 2,
            "total_board": 50,
            "total_time": Decimal("19.0"),
            "mo": "MO-2",
            "fpn": "FPN-2",
            "layer_name": "L2",
            "last_seen": now,
        }
    ]

    mock_conn = AsyncMock()
    # Primary fails, fallback succeeds
    mock_conn.fetch.side_effect = [
        Exception("Alarm tables do not exist"),
        mock_rows,
    ]

    mock_pool = MagicMock()
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

    b = Broadcaster()
    with patch("app.broadcaster.db.pool", mock_pool):
        snapshot = await b.fetch_snapshot()
        assert len(snapshot) == 1
        assert snapshot[0]["eqp_id"] == "LDI-02"
        assert snapshot[0]["status"] == 2


@pytest.mark.asyncio
async def test_broadcaster_broadcast_empty():
    """Verify broadcast with no active connections does nothing gracefully."""
    b = Broadcaster()
    await b.broadcast(json.dumps([]))
    assert len(b.active_connections) == 0


@pytest.mark.asyncio
async def test_broadcaster_connect_send_initial_error():
    """Verify connect handles error when initial snapshot delivery fails."""
    b = Broadcaster()
    b.cached_snapshot = [{"eqp_id": "LDI-01", "status": 1}]

    mock_ws = AsyncMock()
    mock_ws.send_text.side_effect = Exception("Send failed immediately")

    await b.connect(mock_ws)
    # The client is still tracked in active_connections and does not raise
    assert mock_ws in b.active_connections

