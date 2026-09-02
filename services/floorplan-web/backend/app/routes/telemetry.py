import logging
from decimal import Decimal
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, Query, status
from app.broadcaster import broadcaster
from app.db import db
from app.models import HistoryRecord, LdiMachineTelemetry, MachineInfo

logger = logging.getLogger("floorplan.telemetry")
router = APIRouter(prefix="/api", tags=["telemetry"])


@router.get("/machines", response_model=List[MachineInfo])
async def get_machines() -> List[MachineInfo]:
    """Retrieve list of registered LDI machines."""
    if not db.pool:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection pool is not initialized",
        )

    try:
        async with db.pool.acquire() as conn:
            try:
                rows = await conn.fetch(
                    "SELECT device_id AS eqp_id, location, enabled FROM public.devices "
                    "WHERE device_type = 'ldi' AND enabled = true ORDER BY device_id;"
                )
                if rows:
                    return [
                        MachineInfo(
                            eqp_id=r["eqp_id"],
                            location=r.get("location"),
                            enabled=bool(r.get("enabled", True)),
                        )
                        for r in rows
                    ]
            except Exception as e:
                logger.debug("public.devices query failed, falling back to public.ldi_data: %s", e)

            # Fallback: discover distinct machines from telemetry table
            rows = await conn.fetch(
                "SELECT DISTINCT eqp_id FROM public.ldi_data ORDER BY eqp_id;"
            )
            return [
                MachineInfo(
                    eqp_id=r["eqp_id"],
                    location="Cleanroom Photolithography",
                    enabled=True,
                )
                for r in rows
            ]
    except Exception as err:
        logger.error("Failed to query machines: %s", err)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve machine inventory",
        )


@router.get("/snapshot", response_model=List[LdiMachineTelemetry])
async def get_snapshot() -> List[Dict[str, Any]]:
    """Retrieve instantaneous telemetry snapshot for all machines."""
    try:
        snapshot = await broadcaster.fetch_snapshot()
        return snapshot
    except Exception as err:
        logger.error("Failed to fetch telemetry snapshot: %s", err)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve telemetry snapshot",
        )


@router.get("/history/{eqp_id}", response_model=List[HistoryRecord])
async def get_machine_history(
    eqp_id: str,
    minutes: int = Query(60, ge=1, le=1440, description="History window in minutes"),
    limit: int = Query(200, ge=1, le=1000, description="Max rows to return"),
) -> List[HistoryRecord]:
    """Retrieve historical telemetry time-series for a specific machine."""
    if not db.pool:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection pool is not initialized",
        )

    history_sql = """
    SELECT
      "time",
      ROUND(temperature::NUMERIC, 1) AS temperature,
      ROUND(humidity::NUMERIC, 1) AS humidity,
      ROUND(resist_dosage::NUMERIC, 2) AS resist_dosage,
      ROUND(scan_speed::NUMERIC, 1) AS scan_speed,
      ROUND(air_vacuum::NUMERIC, 1) AS air_vacuum,
      ROUND(thickness::NUMERIC, 3) AS thickness,
      board_no,
      total_board,
      state
    FROM public.ldi_data
    WHERE eqp_id = $1
      AND "time" >= NOW() - ($2 || ' minutes')::INTERVAL
    ORDER BY "time" ASC
    LIMIT $3;
    """

    try:
        async with db.pool.acquire() as conn:
            rows = await conn.fetch(history_sql, eqp_id, str(minutes), limit)
            records: List[HistoryRecord] = []
            for r in rows:
                records.append(
                    HistoryRecord(
                        time=r["time"],
                        temperature=float(r["temperature"]) if r["temperature"] is not None else None,
                        humidity=float(r["humidity"]) if r["humidity"] is not None else None,
                        resist_dosage=float(r["resist_dosage"]) if r["resist_dosage"] is not None else None,
                        scan_speed=float(r["scan_speed"]) if r["scan_speed"] is not None else None,
                        air_vacuum=float(r["air_vacuum"]) if r["air_vacuum"] is not None else None,
                        thickness=float(r["thickness"]) if r["thickness"] is not None else None,
                        board_no=int(r["board_no"]) if r["board_no"] is not None else None,
                        total_board=int(r["total_board"]) if r["total_board"] is not None else None,
                        state=bool(r["state"]) if r["state"] is not None else None,
                    )
                )
            return records
    except Exception as err:
        logger.error("Failed to query machine history for %s: %s", eqp_id, err)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query history for machine {eqp_id}",
        )
