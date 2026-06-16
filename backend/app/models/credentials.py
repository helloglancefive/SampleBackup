from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from .base import Base


class ClientAmazonCredentials(Base):
    __tablename__ = "client_amazon_credentials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # ── Amazon Advertising API (Ads API) credentials ─────────────────────────
    amazon_client_id = Column(Text, nullable=False)       # AES-256-GCM encrypted
    amazon_client_secret = Column(Text, nullable=False)   # AES-256-GCM encrypted
    amazon_refresh_token = Column(Text, nullable=False)   # AES-256-GCM encrypted (Ads API LWA token)
    amazon_profile_id = Column(String(255), nullable=True)
    last_token_refresh = Column(DateTime, nullable=True)

    # ── Amazon SP-API (Selling Partner API) credentials ──────────────────────
    # SP-API uses the same LWA client_id/secret but a separate refresh token
    # obtained when the seller grants SP-API access through OAuth consent.
    sp_refresh_token = Column(Text, nullable=True)        # AES-256-GCM encrypted
    sp_seller_id = Column(String(100), nullable=True)     # e.g. "A2Z6V4KMKRM2N0"
    sp_marketplace_id = Column(String(50), nullable=True) # e.g. "A21TJRUUN4KGV" (IN), "ATVPDKIKX0DER" (US)
    sp_last_token_refresh = Column(DateTime, nullable=True)

    # ── Region ────────────────────────────────────────────────────────────────
    # Determines which API endpoint to use for both Ads and SP-API
    amazon_region = Column(String(10), nullable=False, default="EU")  # NA | EU | FE

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    client = relationship("Client", back_populates="amazon_credentials")
