import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.db import Database


@pytest.mark.asyncio
async def test_database_initial_state():
    """Verify database object initial state."""
    db = Database()
    assert db.pool is None
    assert db.get_pool_stats() == (0, 0)
    assert await db.check_health() is False


@pytest.mark.asyncio
async def test_database_health_check_healthy():
    """Verify database health check when connected."""
    db = Database()
    mock_conn = AsyncMock()
    mock_conn.fetchval.return_value = 1

    mock_pool = MagicMock()
    # Mock acquire context manager
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

    db.pool = mock_pool
    assert await db.check_health() is True
    mock_conn.fetchval.assert_called_once_with("SELECT 1")


@pytest.mark.asyncio
async def test_database_health_check_failure():
    """Verify database health check returns False on error."""
    db = Database()
    mock_conn = AsyncMock()
    mock_conn.fetchval.side_effect = Exception("Connection lost")

    mock_pool = MagicMock()
    mock_pool.acquire.return_value.__aenter__.return_value = mock_conn

    db.pool = mock_pool
    assert await db.check_health() is False


def test_database_pool_stats():
    """Verify pool statistics calculation."""
    db = Database()
    mock_pool = MagicMock()
    mock_pool.get_idle_size.return_value = 4
    mock_pool.get_size.return_value = 6

    db.pool = mock_pool
    free, used = db.get_pool_stats()
    assert free == 4
    assert used == 2


@pytest.mark.asyncio
async def test_database_disconnect():
    """Verify disconnect properly closes the asyncpg pool."""
    db = Database()
    mock_pool = AsyncMock()
    db.pool = mock_pool

    await db.disconnect()
    mock_pool.close.assert_called_once()
    assert db.pool is None


@pytest.mark.asyncio
async def test_connect_with_retry_failure():
    """Verify connect_with_retry exhausts retries and returns False on persistent error."""
    db = Database()
    with patch("asyncpg.create_pool", side_effect=Exception("Database unreachable")):
        success = await db.connect_with_retry(max_retries=2, initial_backoff=0.01)
        assert success is False
        assert db.pool is None


@pytest.mark.asyncio
async def test_connect_with_retry_success():
    """Verify connect_with_retry establishes pool on first attempt."""
    db = Database()
    mock_pool = MagicMock()
    with patch("asyncpg.create_pool", new_callable=AsyncMock) as mock_create_pool:
        mock_create_pool.return_value = mock_pool
        success = await db.connect_with_retry(max_retries=1)
        assert success is True
        assert db.pool == mock_pool


def test_database_pool_stats_exception():
    """Verify pool stats returns (0, 0) if pool methods raise exception."""
    db = Database()
    mock_pool = MagicMock()
    mock_pool.get_idle_size.side_effect = Exception("Pool internal error")
    db.pool = mock_pool
    assert db.get_pool_stats() == (0, 0)

