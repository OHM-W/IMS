"""Adversarial stress-testing and empirical challenge harness for FastAPI backend.

Tests parameter boundaries, fuzzing, concurrency, failure recovery,
and data serialization under edge cases.
"""

import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.db import Database, db
from app.broadcaster import Broadcaster, broadcaster, serialize_row
from app.models import HealthResponse, HistoryRecord, LdiMachineTelemetry, MachineInfo


@pytest.fixture
def client():
    """Create test client without launching lifespan background tasks."""
    return TestClient(app)


# ============================================================================
# Vector 1: API Endpoint Boundary & Input Fuzzing
# ============================================================================

class TestEndpointBoundaryAndFuzzing:
    """Stress tests and boundary checks on REST API endpoints."""

    @pytest.mark.parametrize("limit_val", [1, 200, 500, 1000])
    def test_history_limit_valid_boundaries(self, client, limit_val):
        """Verify history endpoint accepts valid boundary values for limit (1 to 1000)."""
        now = datetime(2026, 9, 1, 2, 0, 0, tzinfo=timezone.utc)
        mock_conn = AsyncMock()
        mock_conn.fetch.return_value = [
            {
                "time": now,
                "temperature": Decimal("22.5"),
                "humidity": Decimal("55.0"),
                "resist_dosage": Decimal("45.0"),
                "scan_speed": Decimal("350.0"),
                "air_vacuum": Decimal("-22.5"),
                "thickness": Decimal("1.6"),
                "board_no": 1,
                "total_board": 100,
                "state": True,
            }
        ]
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

        with patch.object(db, "pool", mock_pool):
            response = client.get(f"/api/history/LDI-01?limit={limit_val}")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1

    @pytest.mark.parametrize("limit_val", [0, -1, -50, 1001, 2000, 999999, "invalid", "1e3", "0.5"])
    def test_history_limit_invalid_boundaries(self, client, limit_val):
        """Verify history endpoint rejects out-of-bounds or non-integer limit with 422."""
        response = client.get(f"/api/history/LDI-01?limit={limit_val}")
        assert response.status_code == 422

    @pytest.mark.parametrize("min_val", [1, 60, 720, 1440])
    def test_history_minutes_valid_boundaries(self, client, min_val):
        """Verify history endpoint accepts valid boundary values for minutes (1 to 1440)."""
        mock_conn = AsyncMock()
        mock_conn.fetch.return_value = []
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

        with patch.object(db, "pool", mock_pool):
            response = client.get(f"/api/history/LDI-01?minutes={min_val}")
            assert response.status_code == 200
            assert response.json() == []

    @pytest.mark.parametrize("min_val", [0, -1, -100, 1441, 5000, "abc", "null"])
    def test_history_minutes_invalid_boundaries(self, client, min_val):
        """Verify history endpoint rejects out-of-bounds or non-integer minutes with 422."""
        response = client.get(f"/api/history/LDI-01?minutes={min_val}")
        assert response.status_code == 422

    def test_history_non_existent_machine_returns_empty_list(self, client):
        """Verify querying non-existent machine ID returns 200 OK with empty list."""
        mock_conn = AsyncMock()
        mock_conn.fetch.return_value = []
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

        with patch.object(db, "pool", mock_pool):
            response = client.get("/api/history/LDI-UNKNOWN-999")
            assert response.status_code == 200
            assert response.json() == []

    @pytest.mark.parametrize("adversarial_id", [
        "' OR '1'='1' --",
        "LDI-01'; DROP TABLE public.ldi_data; --",
        "LDI-01' UNION SELECT * FROM public.ldi_data --",
        "เครื่องจักร-01",  # UTF-8 Thai text
        "LDI 01 with spaces",
        "A" * 300,  # Long string
        "<script>alert(1)<_script>",
        "LDI-01#test",
    ])
    def test_history_sql_injection_and_special_chars_resilience(self, client, adversarial_id):
        """Verify parameterized queries handle SQL injection and special chars safely."""
        import urllib.parse
        mock_conn = AsyncMock()
        mock_conn.fetch.return_value = []
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

        with patch.object(db, "pool", mock_pool):
            encoded_id = urllib.parse.quote(adversarial_id, safe='')
            response = client.get(f"/api/history/{encoded_id}")
            assert response.status_code == 200
            assert response.json() == []
            # Verify parameterized query arguments passed out-of-band to asyncpg
            call_args = mock_conn.fetch.call_args[0]
            assert call_args[1] == adversarial_id

    @pytest.mark.parametrize("traversal_path", [
        "../../etc/passwd",
        "../../../windows/win.ini",
    ])
    def test_history_path_traversal_blocked_by_router(self, client, traversal_path):
        """Verify unencoded directory traversal attempts are safely rejected by HTTP router."""
        response = client.get(f"/api/history/{traversal_path}")
        assert response.status_code == 404

    def test_history_null_and_zero_values_handling(self, client):
        """Verify history serializer handles null optional fields and zero/false values cleanly."""
        now = datetime(2026, 9, 1, 2, 0, 0, tzinfo=timezone.utc)
        mock_rows = [
            {
                "time": now,
                "temperature": None,
                "humidity": None,
                "resist_dosage": None,
                "scan_speed": None,
                "air_vacuum": None,
                "thickness": None,
                "board_no": None,
                "total_board": None,
                "state": None,
            },
            {
                "time": now,
                "temperature": Decimal("0.0"),
                "humidity": Decimal("0.0"),
                "resist_dosage": Decimal("0.00"),
                "scan_speed": Decimal("0.0"),
                "air_vacuum": Decimal("0.0"),
                "thickness": Decimal("0.000"),
                "board_no": 0,
                "total_board": 0,
                "state": False,
            },
        ]
        mock_conn = AsyncMock()
        mock_conn.fetch.return_value = mock_rows
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

        with patch.object(db, "pool", mock_pool):
            response = client.get("/api/history/LDI-01")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            # Check row 1 (all nulls)
            assert data[0]["temperature"] is None
            assert data[0]["board_no"] is None
            assert data[0]["state"] is None
            # Check row 2 (explicit zeros and False)
            assert data[1]["temperature"] == 0.0
            assert data[1]["board_no"] == 0
            assert data[1]["state"] is False


# ============================================================================
# Vector 2: Inventory & Snapshot Edge Cases
# ============================================================================

class TestInventoryAndSnapshotEdgeCases:
    """Stress tests on /api/machines and /api/snapshot."""

    def test_machines_empty_fleet(self, client):
        """Verify /api/machines returns empty list when no machines exist."""
        mock_conn = AsyncMock()
        mock_conn.fetch.side_effect = [
            [],  # public.devices is empty
            [],  # public.ldi_data is empty
        ]
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

        with patch.object(db, "pool", mock_pool):
            response = client.get("/api/machines")
            assert response.status_code == 200
            assert response.json() == []

    def test_machines_large_fleet_scale(self, client):
        """Verify /api/machines scales to 200 machines without failure."""
        mock_rows = [
            {"eqp_id": f"LDI-{i:03d}", "location": f"Zone-{i % 5}", "enabled": True}
            for i in range(1, 201)
        ]
        mock_conn = AsyncMock()
        mock_conn.fetch.return_value = mock_rows
        mock_pool = MagicMock()
        mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

        with patch.object(db, "pool", mock_pool):
            response = client.get("/api/machines")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 200
            assert data[0]["eqp_id"] == "LDI-001"
            assert data[199]["eqp_id"] == "LDI-200"

    def test_snapshot_returns_complete_15_fields(self, client):
        """Verify /api/snapshot validates all 15 required telemetry fields."""
        now_iso = "2026-09-01T02:30:00+00:00"
        mock_snapshot = [
            {
                "eqp_id": f"LDI-{i:02d}",
                "status": 1 if i % 2 == 0 else 2,
                "temperature": 22.0 + i * 0.1,
                "humidity": 50.0 + i * 0.5,
                "resist_dosage": 45.0 + i * 0.2,
                "scan_speed": 350.0,
                "air_vacuum": -22.5,
                "thickness": 1.6,
                "board_no": i * 10,
                "total_board": 100,
                "total_time": 18.0 + i * 0.1,
                "mo": f"MO-2026-{i:04d}",
                "fpn": f"PCB-{i:04d}",
                "layer_name": f"L{i}-TOP",
                "last_seen": now_iso,
            }
            for i in range(1, 11)
        ]
        with patch.object(broadcaster, "fetch_snapshot", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_snapshot
            response = client.get("/api/snapshot")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 10
            for item in data:
                # Validate all 15 fields exist
                assert "eqp_id" in item
                assert "status" in item
                assert "temperature" in item
                assert "humidity" in item
                assert "resist_dosage" in item
                assert "scan_speed" in item
                assert "air_vacuum" in item
                assert "thickness" in item
                assert "board_no" in item
                assert "total_board" in item
                assert "total_time" in item
                assert "mo" in item
                assert "fpn" in item
                assert "layer_name" in item
                assert "last_seen" in item


# ============================================================================
# Vector 3: Serialization & Broadcaster Concurrency Stress
# ============================================================================

class TestSerializationAndBroadcasterStress:
    """Stress tests on row serialization, Decimal/datetime conversion, and WebSocket broadcasting."""

    def test_serialize_row_fuzzing_types(self):
        """Stress serialize_row with various extreme types and edge cases."""
        now = datetime(2026, 9, 1, 2, 30, 0, tzinfo=timezone.utc)
        raw_row = {
            "eqp_id": "LDI-01",
            "status": Decimal("1"),
            "temperature": Decimal("22.3456"),
            "humidity": Decimal("55.123"),
            "resist_dosage": Decimal("45.99"),
            "scan_speed": Decimal("350.00"),
            "air_vacuum": Decimal("-22.45"),
            "thickness": Decimal("1.600"),
            "board_no": Decimal("42"),
            "total_board": Decimal("100"),
            "total_time": Decimal("18.55"),
            "mo": "MO-TEST",
            "fpn": "FPN-TEST",
            "layer_name": "L1",
            "last_seen": now,
            "extra_unexpected_field": "test_pass_through",
        }

        serialized = serialize_row(raw_row)
        assert serialized["status"] == 1
        assert isinstance(serialized["status"], int)
        assert serialized["board_no"] == 42
        assert isinstance(serialized["board_no"], int)
        assert serialized["total_board"] == 100
        assert isinstance(serialized["total_board"], int)
        assert isinstance(serialized["temperature"], float)
        assert pytest.approx(serialized["temperature"], 0.001) == 22.3456
        assert serialized["last_seen"] == now.isoformat()
        assert serialized["extra_unexpected_field"] == "test_pass_through"

    def test_serialize_row_all_nulls_and_empty(self):
        """Verify serialize_row does not crash on empty dictionary or all None values."""
        empty_row = {}
        serialized_empty = serialize_row(empty_row)
        assert serialized_empty == {}

        none_row = {
            "eqp_id": "LDI-02",
            "status": None,
            "temperature": None,
            "humidity": None,
            "resist_dosage": None,
            "scan_speed": None,
            "air_vacuum": None,
            "thickness": None,
            "board_no": None,
            "total_board": None,
            "total_time": None,
            "last_seen": None,
        }
        serialized_none = serialize_row(none_row)
        assert serialized_none["temperature"] is None
        assert serialized_none["status"] is None
        assert serialized_none["last_seen"] is None

    @pytest.mark.asyncio
    async def test_broadcast_concurrency_mass_clients_with_failures(self):
        """Stress broadcast with 50 connected clients where 10 abruptly disconnect."""
        test_broadcaster = Broadcaster()
        clients: List[AsyncMock] = []
        failing_clients: List[AsyncMock] = []

        # Create 40 healthy clients
        for _ in range(40):
            ws = AsyncMock()
            ws.send_text = AsyncMock()
            clients.append(ws)
            test_broadcaster.active_connections.add(ws)

        # Create 10 failing/dropped clients
        for _ in range(10):
            ws = AsyncMock()
            ws.send_text = AsyncMock(side_effect=RuntimeError("Client connection abruptly closed"))
            failing_clients.append(ws)
            clients.append(ws)
            test_broadcaster.active_connections.add(ws)

        assert len(test_broadcaster.active_connections) == 50

        # Broadcast payload
        payload = '{"test": "payload_mass"}'
        await test_broadcaster.broadcast(payload)

        # Verify all 40 healthy clients received the broadcast
        for ws in clients[:40]:
            ws.send_text.assert_called_once_with(payload)

        # Verify the 10 failing clients were automatically pruned from active_connections
        assert len(test_broadcaster.active_connections) == 40
        for ws in failing_clients:
            assert ws not in test_broadcaster.active_connections

    @pytest.mark.asyncio
    async def test_broadcaster_poll_loop_recovers_from_repeated_errors(self):
        """Verify broadcaster poll loop survives DB exceptions and keeps running."""
        test_broadcaster = Broadcaster()
        call_count = 0

        async def faulty_fetch():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Transient DB connection drop")
            elif call_count == 2:
                return [{"eqp_id": "LDI-01", "status": 1}]
            else:
                await asyncio.sleep(10)
                return []

        with patch.object(test_broadcaster, "fetch_snapshot", side_effect=faulty_fetch):
            with patch("app.broadcaster.settings.POLL_INTERVAL_SECONDS", 0.01):
                test_broadcaster.start()
                await asyncio.sleep(0.05)
                await test_broadcaster.stop()

        assert call_count >= 2
        assert test_broadcaster.cached_snapshot == [{"eqp_id": "LDI-01", "status": 1}]


# ============================================================================
# Vector 4: Database Connection Pool Failure Recovery
# ============================================================================

class TestDatabasePoolRecovery:
    """Stress tests on Database connection pool retry, health check, and failure recovery."""

    @pytest.mark.asyncio
    async def test_connect_with_retry_eventual_success(self):
        """Verify connect_with_retry succeeds when connection recovers on 3rd attempt."""
        test_db = Database()
        mock_pool = MagicMock()

        attempts = 0
        async def mock_create_pool(**kwargs):
            nonlocal attempts
            attempts += 1
            if attempts < 3:
                raise ConnectionRefusedError(f"PostgreSQL not ready (attempt {attempts})")
            return mock_pool

        with patch("asyncpg.create_pool", side_effect=mock_create_pool):
            result = await test_db.connect_with_retry(max_retries=5, initial_backoff=0.01, max_backoff=0.05)
            assert result is True
            assert attempts == 3
            assert test_db.pool == mock_pool

    @pytest.mark.asyncio
    async def test_connect_with_retry_exhaustion_returns_false(self):
        """Verify connect_with_retry returns False without raising unhandled exception when all retries fail."""
        test_db = Database()
        with patch("asyncpg.create_pool", side_effect=ConnectionRefusedError("Host unreachable")):
            result = await test_db.connect_with_retry(max_retries=3, initial_backoff=0.01, max_backoff=0.02)
            assert result is False
            assert test_db.pool is None

    @pytest.mark.asyncio
    async def test_check_health_handles_pool_exceptions(self):
        """Verify check_health gracefully catches query/acquire exceptions."""
        test_db = Database()
        mock_pool = MagicMock()
        mock_pool.acquire.side_effect = TimeoutError("Connection acquisition timeout")
        test_db.pool = mock_pool

        health = await test_db.check_health()
        assert health is False

    def test_pool_stats_safety_under_broken_pool(self):
        """Verify get_pool_stats returns (0, 0) if pool methods throw exceptions."""
        test_db = Database()
        mock_pool = MagicMock()
        mock_pool.get_idle_size.side_effect = RuntimeError("Pool closed")
        test_db.pool = mock_pool

        free, used = test_db.get_pool_stats()
        assert free == 0
        assert used == 0

    @pytest.mark.asyncio
    async def test_disconnect_idempotent(self):
        """Verify disconnect can be called multiple times without error."""
        test_db = Database()
        # Case 1: pool is None
        await test_db.disconnect()
        assert test_db.pool is None

        # Case 2: pool is active
        mock_pool = AsyncMock()
        test_db.pool = mock_pool
        await test_db.disconnect()
        mock_pool.close.assert_awaited_once()
        assert test_db.pool is None

        # Case 3: repeated disconnect
        await test_db.disconnect()
        assert test_db.pool is None


# ============================================================================
# Vector 5: Standing Rules & Architectural Compliance
# ============================================================================

class TestArchitecturalCompliance:
    """Verify strict adherence to AGENTS.md ironclad rules."""

    def test_statement_cache_size_zero_for_pgbouncer(self):
        """Ironclad Rule: statement_cache_size must be 0 for PgBouncer transaction pooling."""
        assert settings.STATEMENT_CACHE_SIZE == 0

    def test_health_response_schema_structure(self, client):
        """Verify HealthResponse structure matches monitoring contract."""
        with patch.object(db, "check_health", new_callable=AsyncMock) as mock_h:
            mock_h.return_value = True
            with patch.object(db, "get_pool_stats", return_value=(8, 2)):
                resp = client.get("/api/health")
                assert resp.status_code == 200
                data = resp.json()
                health = HealthResponse(**data)
                assert health.status == "healthy"
                assert health.db_connected is True
                assert health.pool_free == 8
                assert health.pool_used == 2

    def test_history_no_db_pool_returns_503(self, client):
        """Verify history endpoint returns 503 when db pool is not initialized."""
        with patch.object(db, "pool", None):
            resp = client.get("/api/history/LDI-01")
            assert resp.status_code == 503
            assert resp.json()["detail"] == "Database connection pool is not initialized"

    def test_cors_origins_unsupported_type_fallback(self):
        """Verify CORS origins validator defaults to ['*'] for unsupported types."""
        from app.config import Settings
        res = Settings.assemble_cors_origins(12345)
        assert res == ["*"]

    @pytest.mark.asyncio
    async def test_broadcaster_stop_task_cancellation(self):
        """Verify Broadcaster.stop() gracefully handles task cancellation exception."""
        test_broadcaster = Broadcaster()
        test_broadcaster._running = True

        async def forever_loop():
            try:
                await asyncio.sleep(100)
            except asyncio.CancelledError:
                raise

        test_broadcaster._task = asyncio.create_task(forever_loop())
        await test_broadcaster.stop()
        assert test_broadcaster._running is False
        assert test_broadcaster._task is None

