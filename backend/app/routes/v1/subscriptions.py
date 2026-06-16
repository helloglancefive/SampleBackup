"""Subscription tier listing and current-plan endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import User, Client
from app.models.subscription_tier import SubscriptionTier

router = APIRouter(prefix="/api/v1/subscriptions", tags=["subscriptions"])


class TierResponse(BaseModel):
    id: int
    name: str
    price_monthly: Optional[float] = None
    max_clients: Optional[int] = None
    max_users_per_client: Optional[int] = None
    report_fetch_freq: str = "daily"
    export_limit_monthly: Optional[int] = None
    api_access: bool = False

    model_config = {"from_attributes": True}


class MyPlanResponse(BaseModel):
    client_name: Optional[str] = None
    subscription_status: str
    tier: Optional[TierResponse] = None


@router.get("/tiers", response_model=list[TierResponse])
def list_tiers(db: Session = Depends(get_db)):
    """Return all available subscription plans ordered by price."""
    return (
        db.query(SubscriptionTier)
        .order_by(SubscriptionTier.price_monthly)
        .all()
    )


@router.get("/my-plan", response_model=MyPlanResponse)
def my_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the current user's client subscription details."""
    if not current_user.client_id:
        return MyPlanResponse(subscription_status="None")

    client = db.query(Client).filter(Client.id == current_user.client_id).first()
    if not client:
        return MyPlanResponse(subscription_status="None")

    tier = None
    if client.subscription_tier_id:
        tier = db.query(SubscriptionTier).filter(
            SubscriptionTier.id == client.subscription_tier_id
        ).first()

    return MyPlanResponse(
        client_name=client.name,
        subscription_status=client.subscription_status,
        tier=tier,
    )
