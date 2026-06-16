"""Fast broker reachability check used by fetch endpoints."""
import socket
from urllib.parse import urlparse

from fastapi import HTTPException, status
from config import get_settings


def _broker_reachable() -> bool:
    """Return True if the Celery broker port is reachable within 2 seconds."""
    url = urlparse(get_settings().celery_broker_url)
    host = url.hostname or "localhost"
    port = url.port or 6379
    s = socket.socket()
    s.settimeout(2)
    try:
        s.connect((host, port))
        return True
    except OSError:
        return False
    finally:
        s.close()


def require_broker() -> None:
    """Raise 503 immediately if the task queue is not reachable."""
    if not _broker_reachable():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Task queue unavailable: cannot reach Redis broker",
        )
