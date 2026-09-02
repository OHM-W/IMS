import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.broadcaster import broadcaster

logger = logging.getLogger("floorplan.ws")
router = APIRouter(tags=["websocket"])


@router.websocket("/ws/ldi")
async def websocket_ldi_endpoint(websocket: WebSocket) -> None:
    """WebSocket endpoint streaming real-time LDI telemetry every 2 seconds."""
    await broadcaster.connect(websocket)
    try:
        while True:
            # Receive client messages / heartbeats / pings
            data = await websocket.receive_text()
            logger.debug("Received message from WS client: %s", data)
    except WebSocketDisconnect:
        broadcaster.disconnect(websocket)
    except Exception as err:
        logger.debug("WebSocket client error: %s", err)
        broadcaster.disconnect(websocket)
