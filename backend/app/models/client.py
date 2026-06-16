from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship
from .base import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    subscription_tier_id = Column(Integer, ForeignKey("subscription_tiers.id"), nullable=True)
    subscription_status = Column(String(50), default="Active", nullable=False)
    amazon_region = Column(String(50), default="eu", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    subscription_tier = relationship("SubscriptionTier", back_populates="clients")
    users = relationship("User", back_populates="client", cascade="all, delete-orphan")
    amazon_credentials = relationship("ClientAmazonCredentials", back_populates="client", uselist=False, cascade="all, delete-orphan")
    report_fetches = relationship("ReportFetch", back_populates="client", cascade="all, delete-orphan")
    exports = relationship("Export", back_populates="client", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="client", cascade="all, delete-orphan")
