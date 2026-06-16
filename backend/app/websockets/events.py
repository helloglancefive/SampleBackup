"""WebSocket event type constants and constructors."""
from datetime import datetime


FETCH_STARTED = "fetch_started"
FETCH_PROGRESS = "fetch_progress"
FETCH_COMPLETED = "fetch_completed"
FETCH_FAILED = "fetch_failed"
NOTIFICATION = "notification"


def fetch_started(client_id: int, report_type: str, task_id: str) -> dict:
    return {
        "type": FETCH_STARTED,
        "client_id": client_id,
        "report_type": report_type,
        "task_id": task_id,
        "ts": datetime.utcnow().isoformat(),
    }


def fetch_progress(client_id: int, report_type: str, status: str, detail: str = "") -> dict:
    return {
        "type": FETCH_PROGRESS,
        "client_id": client_id,
        "report_type": report_type,
        "status": status,
        "detail": detail,
        "ts": datetime.utcnow().isoformat(),
    }


def fetch_completed(client_id: int, report_type: str, records: int) -> dict:
    return {
        "type": FETCH_COMPLETED,
        "client_id": client_id,
        "report_type": report_type,
        "records": records,
        "ts": datetime.utcnow().isoformat(),
    }


def fetch_failed(client_id: int, report_type: str, error: str) -> dict:
    return {
        "type": FETCH_FAILED,
        "client_id": client_id,
        "report_type": report_type,
        "error": error,
        "ts": datetime.utcnow().isoformat(),
    }


def notification_event(notification_id: int, notif_type: str, message: str) -> dict:
    return {
        "type": NOTIFICATION,
        "id": notification_id,
        "notif_type": notif_type,
        "message": message,
        "ts": datetime.utcnow().isoformat(),
    }
