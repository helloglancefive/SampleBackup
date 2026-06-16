from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import User
from app.schemas.notification import NotificationResponse, NotificationMarkRead
from app.services import notification_service

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    unread_only: bool = False,
    page: int = 1,
    per_page: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = notification_service.get_notifications(db, current_user.id, unread_only, page, per_page)
    total = notification_service.count_notifications(db, current_user.id, unread_only)
    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.get("/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"count": notification_service.unread_count(db, current_user.id)}


@router.post("/mark-read", status_code=status.HTTP_200_OK)
def mark_read(
    body: NotificationMarkRead,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = notification_service.mark_read(db, body.notification_ids, current_user.id)
    return {"marked_read": updated}


@router.post("/mark-all-read", status_code=status.HTTP_200_OK)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = notification_service.mark_all_read(db, current_user.id)
    return {"marked_read": updated}
