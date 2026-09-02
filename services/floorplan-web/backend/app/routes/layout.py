import json
import logging
import os
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("floorplan.routes.layout")

router = APIRouter(prefix="/api/layout", tags=["layout"])

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
LAYOUT_FILE = os.path.join(DATA_DIR, "custom_fleet.json")


class MachineCustomDef(BaseModel):
    id: str
    name: str | None = None
    process: str | None = "DRILLING_MAIN"
    processGroup: str | None = "CUSTOM"
    telemetryId: str | None = None
    svgX: float
    svgY: float
    cardWidth: float | None = None
    cardHeight: float | None = None
    isCompact: bool | None = True
    hasLiveFeed: bool | None = False


class SaveFullLayoutRequest(BaseModel):
    machines: List[MachineCustomDef]
    deletedIds: List[str] = []


@router.get("")
async def get_custom_layout():
    """Retrieve full custom fleet and layout modifications."""
    if os.path.exists(LAYOUT_FILE):
        try:
            with open(LAYOUT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {"custom": True, **data}
        except Exception as e:
            logger.error("Failed to read custom layout: %s", e)
    return {"custom": False, "machines": [], "deletedIds": []}


@router.post("")
async def save_custom_layout(req: SaveFullLayoutRequest):
    """Save complete custom layout with add, rename, resize, move, and delete support."""
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        data = {
            "machines": [m.model_dump() for m in req.machines],
            "deletedIds": req.deletedIds,
        }
        with open(LAYOUT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        logger.info("Saved %d custom machines (deleted: %d)", len(data["machines"]), len(req.deletedIds))
        return {"status": "success", "machine_count": len(data["machines"])}
    except Exception as e:
        logger.error("Failed to save layout: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("")
async def reset_custom_layout():
    """Reset all custom layouts to default."""
    if os.path.exists(LAYOUT_FILE):
        os.remove(LAYOUT_FILE)
    return {"status": "reset"}
