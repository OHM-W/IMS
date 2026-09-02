"""FastAPI route modules for IMS Floorplan Web."""

from app.routes import health, telemetry, ws

__all__ = ["health", "telemetry", "ws"]
