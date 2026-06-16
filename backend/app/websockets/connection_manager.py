"""In-memory WebSocket connection registry."""
import logging
from typing import DefaultDict
from collections import defaultdict

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Maintains per-key sets of active WebSocket connections.

    Keys use namespaced strings:
      - client:{client_id}  — dashboard feeds
      - user:{user_id}      — notification feeds
    """

    def __init__(self):
        self._connections: DefaultDict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, key: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections[key].add(ws)
        logger.debug("WS connected: key=%s  total=%d", key, len(self._connections[key]))

    def disconnect(self, key: str, ws: WebSocket) -> None:
        self._connections[key].discard(ws)
        logger.debug("WS disconnected: key=%s  remaining=%d", key, len(self._connections[key]))

    async def broadcast(self, key: str, payload: dict) -> None:
        dead: set[WebSocket] = set()
        for ws in list(self._connections.get(key, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._connections[key].discard(ws)

    def connection_count(self, key: str) -> int:
        return len(self._connections.get(key, set()))

    def total_connections(self) -> int:
        return sum(len(v) for v in self._connections.values())


# Single in-process instance — Celery workers use Redis pub/sub to reach it
manager = ConnectionManager()
