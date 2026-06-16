from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    user_id: Optional[int] = None
    client_id: Optional[int] = None
    type: str
    message: str
    is_read: bool
    created_at: datetime


class NotificationMarkRead(BaseModel):
    notification_ids: list[int]
