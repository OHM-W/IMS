from datetime import datetime, timezone
from fastapi import APIRouter
from app.db import db
from app.broadcaster import broadcaster
from app.models import HealthResponse

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """System health check endpoint reporting DB connection and WebSocket status."""
    is_connected = await db.check_health()
    free_conn, used_conn = db.get_pool_stats()

    return HealthResponse(
        status="healthy" if is_connected else "degraded",
        db_connected=is_connected,
        ws_clients_count=len(broadcaster.active_connections),
        pool_free=free_conn,
        pool_used=used_conn,
        timestamp=datetime.now(timezone.utc),
    )
