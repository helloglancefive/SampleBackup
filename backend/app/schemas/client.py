from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ClientResponse(BaseModel):
    id: int
    name: str
    subscription_status: str
    amazon_region: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ClientCreate(BaseModel):
    name: str
    amazon_region: str = "eu"
    subscription_tier_id: Optional[int] = None


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    amazon_region: Optional[str] = None
    subscription_status: Optional[str] = None
