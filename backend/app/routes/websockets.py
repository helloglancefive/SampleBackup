"""WebSocket endpoints — dashboard feed and notification feed."""
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session

from app.websockets.connection_manager import manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websockets"])


async def _authenticate_ws(ws: WebSocket, token: str) -> dict | None:
    """Validate JWT from query param. Returns payload or None."""
    try:
        from config import get_settings
        from app.security.jwt import verify_token
        settings = get_settings()
        return verify_token(token, settings.jwt_secret, settings.jwt_algorithm)
    except Exception:
        return None


@router.websocket("/ws/v1/dashboard/{client_id}")
async def dashboard_ws(client_id: int, ws: WebSocket, token: str = Query(...)):
    """Real-time dashboard feed for a client. Broadcasts fetch events."""
    payload = await _authenticate_ws(ws, token)
    if not payload:
        await ws.close(code=4001)
        return

    role = payload.get("role", "")
    token_client_id = payload.get("client_id")
    if role != "Admin" and token_client_id != client_id:
        await ws.close(code=4003)
        return

    key = f"client:{client_id}"
    await manager.connect(key, ws)
    try:
        while True:
            # Keep connection alive — client sends pings, we send pongs
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(key, ws)


@router.websocket("/ws/v1/notifications/{user_id}")
async def notifications_ws(user_id: int, ws: WebSocket, token: str = Query(...)):
    """Real-time notification feed for a user."""
    payload = await _authenticate_ws(ws, token)
    if not payload:
        await ws.close(code=4001)
        return

    token_user_id = int(payload.get("sub", 0))
    role = payload.get("role", "")
    if role != "Admin" and token_user_id != user_id:
        await ws.close(code=4003)
        return

    key = f"user:{user_id}"
    await manager.connect(key, ws)
    try:
        while True:
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(key, ws)
