from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String
from sqlalchemy.orm import relationship
from .base import Base


class SubscriptionTier(Base):
    __tablename__ = "subscription_tiers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    price_monthly = Column(Numeric(10, 2), nullable=True)
    max_clients = Column(Integer, nullable=True)
    max_users_per_client = Column(Integer, nullable=True)
    report_fetch_freq = Column(String(50), default="daily", nullable=False)
    export_limit_monthly = Column(Integer, nullable=True)
    api_access = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    clients = relationship("Client", back_populates="subscription_tier")
