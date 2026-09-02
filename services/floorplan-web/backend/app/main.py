import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.broadcaster import broadcaster
from app.config import settings
from app.db import db
from app.routes import health, layout, telemetry, ws

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("floorplan.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager for startup and shutdown event handling."""
    logger.info("Initializing %s...", settings.APP_NAME)

    # Attempt connection to TimescaleDB
    connected = await db.connect_with_retry(max_retries=5, initial_backoff=1.0)
    if not connected:
        logger.warning(
            "Initial database connection could not be established. "
            "Backend will operate in degraded mode until database is reachable."
        )

    # Start background telemetry broadcaster loop
    broadcaster.start()

    yield

    # Graceful shutdown
    logger.info("Shutting down %s...", settings.APP_NAME)
    await broadcaster.stop()
    await db.disconnect()
    logger.info("Shutdown complete.")


app = FastAPI(
    title=settings.APP_NAME,
    description="FastAPI Backend & WebSocket Broadcaster for IMS Real-time 2D Factory Floorplan Digital Twin",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for frontend UI communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(health.router)
app.include_router(layout.router)
app.include_router(telemetry.router)
app.include_router(ws.router)


@app.get("/", tags=["root"])
async def root():
    """Root status summary endpoint."""
    return {
        "service": settings.APP_NAME,
        "status": "running",
        "endpoints": {
            "health": "/api/health",
            "machines": "/api/machines",
            "snapshot": "/api/snapshot",
            "history": "/api/history/{eqp_id}",
            "websocket": "/ws/ldi",
            "docs": "/docs",
        },
    }
