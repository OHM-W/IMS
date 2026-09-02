import asyncio
import json
import logging
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Set
import asyncpg
from fastapi import WebSocket
from app.config import settings
from app.db import db

logger = logging.getLogger("floorplan.broadcaster")

# Primary SQL with active alarm cross-referencing and staleness detection
PRIMARY_TELEMETRY_SQL = f"""
WITH latest_telemetry AS (
  SELECT DISTINCT ON (d.eqp_id)
    d.eqp_id,
    d.state,
    ROUND(d.temperature::NUMERIC, 1) AS temperature,
    ROUND(d.humidity::NUMERIC, 1) AS humidity,
    ROUND(d.resist_dosage::NUMERIC, 2) AS resist_dosage,
    ROUND(d.scan_speed::NUMERIC, 1) AS scan_speed,
    ROUND(d.air_vacuum::NUMERIC, 1) AS air_vacuum,
    ROUND(d.thickness::NUMERIC, 3) AS thickness,
    d.board_no,
    d.total_board,
    ROUND(d.total_time::NUMERIC, 1) AS total_time,
    d.mo,
    d.fpn,
    d.layer_name,
    d."time" AS last_seen
  FROM public.ldi_data d
  ORDER BY d.eqp_id, d."time" DESC
),
active_alarms AS (
  SELECT DISTINCT a.equipmentid
  FROM public.ldi_alarm_log a
  JOIN public.ldi_alarm_ms_code m ON a.errorcode::TEXT = m.alarm_code::TEXT
  WHERE a.logdate > NOW() - INTERVAL '{settings.ALARM_WINDOW_MINUTES} minutes'
    AND m.severity IN ('Critical', 'Major')
)
SELECT
  t.eqp_id,
  CASE
    WHEN t.last_seen < NOW() - INTERVAL '{settings.STALENESS_THRESHOLD_MINUTES} minutes' THEN 0
    WHEN a.equipmentid IS NOT NULL THEN 3
    WHEN t.state = true THEN 1
    ELSE 2
  END AS status,
  t.temperature,
  t.humidity,
  t.resist_dosage,
  t.scan_speed,
  t.air_vacuum,
  t.thickness,
  t.board_no,
  t.total_board,
  t.total_time,
  t.mo,
  t.fpn,
  t.layer_name,
  t.last_seen
FROM latest_telemetry t
LEFT JOIN active_alarms a ON a.equipmentid = t.eqp_id
ORDER BY t.eqp_id;
"""

# Fallback SQL without alarm table dependency
FALLBACK_TELEMETRY_SQL = f"""
SELECT DISTINCT ON (eqp_id)
  eqp_id,
  CASE
    WHEN "time" < NOW() - INTERVAL '{settings.STALENESS_THRESHOLD_MINUTES} minutes' THEN 0
    WHEN state = true THEN 1
    ELSE 2
  END AS status,
  ROUND(temperature::NUMERIC, 1) AS temperature,
  ROUND(humidity::NUMERIC, 1) AS humidity,
  ROUND(resist_dosage::NUMERIC, 2) AS resist_dosage,
  ROUND(scan_speed::NUMERIC, 1) AS scan_speed,
  ROUND(air_vacuum::NUMERIC, 1) AS air_vacuum,
  ROUND(thickness::NUMERIC, 3) AS thickness,
  board_no,
  total_board,
  ROUND(total_time::NUMERIC, 1) AS total_time,
  mo,
  fpn,
  layer_name,
  "time" AS last_seen
FROM public.ldi_data
ORDER BY eqp_id, "time" DESC;
"""


def serialize_row(row: Any) -> Dict[str, Any]:
    """Serialize asyncpg Record or dictionary into clean JSON-compliant dict."""
    d = dict(row)
    if isinstance(d.get("last_seen"), datetime):
        d["last_seen"] = d["last_seen"].isoformat()

    float_keys = [
        "temperature",
        "humidity",
        "resist_dosage",
        "scan_speed",
        "air_vacuum",
        "thickness",
        "total_time",
    ]
    for key in float_keys:
        val = d.get(key)
        if val is not None:
            d[key] = float(val) if isinstance(val, (Decimal, int, float, str)) else val

    int_keys = ["board_no", "total_board", "status"]
    for key in int_keys:
        val = d.get(key)
        if val is not None:
            d[key] = int(val)

    return d


class Broadcaster:
    """Manages connected WebSocket clients and coordinates periodic telemetry broadcasting."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.cached_snapshot: List[Dict[str, Any]] = []
        self._task: Optional[asyncio.Task] = None
        self._running: bool = False

    async def connect(self, websocket: WebSocket) -> None:
        """Accept WebSocket connection and immediately transmit cached snapshot if available."""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info("WebSocket client connected. Total active clients: %d", len(self.active_connections))
        if self.cached_snapshot:
            try:
                await websocket.send_text(json.dumps(self.cached_snapshot))
            except Exception as e:
                logger.warning("Failed to send initial snapshot to new client: %s", e)

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove WebSocket connection."""
        self.active_connections.discard(websocket)
        logger.info("WebSocket client disconnected. Total active clients: %d", len(self.active_connections))

    async def broadcast(self, data_json: str) -> None:
        """Broadcast payload to all connected clients, removing failed connections."""
        if not self.active_connections:
            return

        dead_connections: Set[WebSocket] = set()
        for ws in list(self.active_connections):
            try:
                await ws.send_text(data_json)
            except Exception as e:
                logger.debug("Broadcasting failed for client (%s). Marking dead.", e)
                dead_connections.add(ws)

        for dead in dead_connections:
            self.disconnect(dead)

    async def fetch_snapshot(self) -> List[Dict[str, Any]]:
        """Fetch latest telemetry snapshot from TimescaleDB."""
        if not db.pool:
            return self.cached_snapshot

        async with db.pool.acquire() as conn:
            try:
                rows = await conn.fetch(PRIMARY_TELEMETRY_SQL)
                return [serialize_row(r) for r in rows]
            except Exception as primary_err:
                logger.debug("Primary query failed, falling back to simple query: %s", primary_err)
                rows = await conn.fetch(FALLBACK_TELEMETRY_SQL)
                return [serialize_row(r) for r in rows]

    async def _poll_loop(self) -> None:
        """Periodic background poll loop querying TimescaleDB and broadcasting updates."""
        logger.info(
            "Telemetry broadcaster background poll loop started (interval: %.1fs).",
            settings.POLL_INTERVAL_SECONDS,
        )
        while self._running:
            try:
                snapshot = await self.fetch_snapshot()
                if snapshot:
                    self.cached_snapshot = snapshot
                    payload_json = json.dumps(snapshot)
                    await self.broadcast(payload_json)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Telemetry poll loop error: %s", e)

            try:
                await asyncio.sleep(settings.POLL_INTERVAL_SECONDS)
            except asyncio.CancelledError:
                break

    def start(self) -> None:
        """Start the background polling task."""
        if not self._running:
            self._running = True
            self._task = asyncio.create_task(self._poll_loop())

    async def stop(self) -> None:
        """Stop the background polling task."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
            logger.info("Telemetry broadcaster background poll loop stopped.")


broadcaster = Broadcaster()
