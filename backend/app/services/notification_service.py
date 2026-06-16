"""Notification creation and delivery."""
import asyncio
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.notification import Notification

logger = logging.getLogger(__name__)


def create_notification(
    db: Session,
    notif_type: str,
    message: str,
    user_id: int | None = None,
    client_id: int | None = None,
) -> Notification:
    notif = Notification(type=notif_type, message=message, user_id=user_id, client_id=client_id)
    db.add(notif)
    db.commit()
    db.refresh(notif)

    # Push to WebSocket if user has active connection
    if user_id:
        _push_ws(user_id, notif)

    return notif


def _push_ws(user_id: int, notif: Notification) -> None:
    try:
        from app.websockets.connection_manager import manager
        from app.websockets.events import notification_event
        payload = notification_event(notif.id, notif.type, notif.message)

        # Schedule coroutine on the running event loop if available
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(manager.broadcast(f"user:{user_id}", payload))
        except RuntimeError:
            # No running loop (e.g. called from sync test context) — skip push
            pass
    except Exception as exc:
        logger.debug("WS push failed (non-critical): %s", exc)


def get_notifications(
    db: Session,
    user_id: int,
    unread_only: bool = False,
    page: int = 1,
    per_page: int = 20,
) -> list[Notification]:
    q = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        q = q.filter(Notification.is_read.is_(False))
    offset = (page - 1) * per_page
    return q.order_by(Notification.created_at.desc()).offset(offset).limit(per_page).all()


def count_notifications(db: Session, user_id: int, unread_only: bool = False) -> int:
    q = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        q = q.filter(Notification.is_read.is_(False))
    return q.count()


def mark_read(db: Session, notification_ids: list[int], user_id: int) -> int:
    updated = (
        db.query(Notification)
        .filter(Notification.id.in_(notification_ids), Notification.user_id == user_id)
        .all()
    )
    for n in updated:
        n.is_read = True
    db.commit()
    return len(updated)


def mark_all_read(db: Session, user_id: int) -> int:
    rows = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read.is_(False),
    ).all()
    for n in rows:
        n.is_read = True
    db.commit()
    return len(rows)


def unread_count(db: Session, user_id: int) -> int:
    return db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read.is_(False),
    ).count()
