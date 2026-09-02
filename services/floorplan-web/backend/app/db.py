import asyncio
import logging
from typing import Optional, Tuple
import asyncpg
from app.config import settings

logger = logging.getLogger("floorplan.db")


class Database:
    """Manages asyncpg database connection pool lifecycle."""

    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None

    async def connect_with_retry(
        self,
        max_retries: int = 5,
        initial_backoff: float = 1.0,
        max_backoff: float = 16.0,
    ) -> bool:
        """Establish asyncpg connection pool with exponential backoff retry.
        
        Returns True if connected successfully, False otherwise.
        """
        backoff = initial_backoff
        for attempt in range(1, max_retries + 1):
            try:
                logger.info(
                    "Connecting to PostgreSQL/TimescaleDB at %s:%d/%s (attempt %d/%d)...",
                    settings.PGHOST,
                    settings.PGPORT,
                    settings.PGDATABASE,
                    attempt,
                    max_retries,
                )
                self.pool = await asyncpg.create_pool(
                    host=settings.PGHOST,
                    port=settings.PGPORT,
                    database=settings.PGDATABASE,
                    user=settings.PGUSER,
                    password=settings.PGPASSWORD,
                    min_size=settings.DB_POOL_MIN_SIZE,
                    max_size=settings.DB_POOL_MAX_SIZE,
                    command_timeout=settings.DB_COMMAND_TIMEOUT,
                    statement_cache_size=settings.STATEMENT_CACHE_SIZE,
                )
                logger.info("Database connection pool established successfully.")
                return True
            except Exception as e:
                logger.warning(
                    "Database connection attempt %d/%d failed: %s",
                    attempt,
                    max_retries,
                    e,
                )
                if attempt == max_retries:
                    logger.error("Exhausted all %d database connection attempts.", max_retries)
                    return False
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, max_backoff)
        return False

    async def disconnect(self) -> None:
        """Gracefully close asyncpg connection pool."""
        if self.pool:
            logger.info("Closing database connection pool...")
            await self.pool.close()
            self.pool = None
            logger.info("Database connection pool closed.")

    async def check_health(self) -> bool:
        """Check if database pool is alive and accepting queries."""
        if not self.pool:
            return False
        try:
            async with self.pool.acquire() as conn:
                val = await conn.fetchval("SELECT 1")
                return val == 1
        except Exception as e:
            logger.warning("Database health check failed: %s", e)
            return False

    def get_pool_stats(self) -> Tuple[int, int]:
        """Return (pool_free, pool_used)."""
        if not self.pool:
            return 0, 0
        try:
            free = self.pool.get_idle_size()
            total = self.pool.get_size()
            used = max(0, total - free)
            return free, used
        except Exception:
            return 0, 0


db = Database()
