"""SP-API Business Report models: products_master and product_business_daily.

Columns in product_business_daily mirror the exact headers from the
GET_SALES_AND_TRAFFIC_REPORT (CHILD asinGranularity, DAY dateGranularity):

  Child ASIN, SKUs, Title,
  Sessions - Mobile App / Browser / Total (+ B2B variants),
  Session Percentage (6 variants),
  Page Views (6 variants), Page Views Percentage (6 variants),
  Featured Offer Percentage (+ B2B), Featured Offer – Unfilled Percentage (+ B2B),
  Units Ordered (+ B2B), Unit Session Percentage (+ B2B),
  Ordered Product Sales (+ B2B), Total Order Items (+ B2B),
  Units Refunded (+ B2B), Refund Rate (+ B2B),
  Shipped Product Sales (+ B2B), Units Shipped (+ B2B), Orders Shipped (+ B2B)
"""
from datetime import datetime
from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float, ForeignKey,
    Index, Integer, Numeric, String, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship
from .base import Base


class ProductsMaster(Base):
    """Canonical product catalog — one row per (client, ASIN)."""
    __tablename__ = "products_master"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    asin = Column(String(20), nullable=False)
    parent_asin = Column(String(20), nullable=True)
    sku = Column(String(255), nullable=True)
    title = Column(Text, nullable=True)
    brand = Column(String(255), nullable=True)
    category = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    first_seen = Column(Date, nullable=True)
    last_seen = Column(Date, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("client_id", "asin", name="uq_products_master_client_asin"),
        Index("ix_products_master_client", "client_id"),
        Index("ix_products_master_asin", "asin"),
    )


class ProductBusinessDaily(Base):
    """
    Daily organic business metrics per ASIN from SP-API GET_SALES_AND_TRAFFIC_REPORT.
    Unique key: (client_id, asin, report_date, marketplace_id)
    """
    __tablename__ = "product_business_daily"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)

    # ── Date & Product identity ───────────────────────────────────────────────
    report_date = Column(Date, nullable=False)
    marketplace_id = Column(String(50), nullable=False)
    asin = Column(String(20), nullable=False)           # Child ASIN
    parent_asin = Column(String(20), nullable=True)
    sku = Column(String(255), nullable=True)            # May be comma-separated (multiple SKUs)
    title = Column(Text, nullable=True)

    # ── Sessions ─────────────────────────────────────────────────────────────
    sessions_mobile_app = Column(Integer, nullable=True)
    sessions_mobile_app_b2b = Column(Integer, nullable=True)
    sessions_browser = Column(Integer, nullable=True)
    sessions_browser_b2b = Column(Integer, nullable=True)
    sessions_total = Column(Integer, nullable=True)
    sessions_total_b2b = Column(Integer, nullable=True)

    # ── Session Percentage ────────────────────────────────────────────────────
    session_pct_mobile_app = Column(Numeric(10, 4), nullable=True)
    session_pct_mobile_app_b2b = Column(Numeric(10, 4), nullable=True)
    session_pct_browser = Column(Numeric(10, 4), nullable=True)
    session_pct_browser_b2b = Column(Numeric(10, 4), nullable=True)
    session_pct_total = Column(Numeric(10, 4), nullable=True)
    session_pct_total_b2b = Column(Numeric(10, 4), nullable=True)

    # ── Page Views ───────────────────────────────────────────────────────────
    page_views_mobile_app = Column(Integer, nullable=True)
    page_views_mobile_app_b2b = Column(Integer, nullable=True)
    page_views_browser = Column(Integer, nullable=True)
    page_views_browser_b2b = Column(Integer, nullable=True)
    page_views_total = Column(Integer, nullable=True)
    page_views_total_b2b = Column(Integer, nullable=True)

    # ── Page View Percentage ──────────────────────────────────────────────────
    page_view_pct_mobile_app = Column(Numeric(10, 4), nullable=True)
    page_view_pct_mobile_app_b2b = Column(Numeric(10, 4), nullable=True)
    page_view_pct_browser = Column(Numeric(10, 4), nullable=True)
    page_view_pct_browser_b2b = Column(Numeric(10, 4), nullable=True)
    page_view_pct_total = Column(Numeric(10, 4), nullable=True)
    page_view_pct_total_b2b = Column(Numeric(10, 4), nullable=True)

    # ── Buy Box ───────────────────────────────────────────────────────────────
    featured_offer_pct = Column(Numeric(10, 4), nullable=True)       # "Featured Offer Percentage"
    featured_offer_pct_b2b = Column(Numeric(10, 4), nullable=True)
    unfilled_featured_offer_pct = Column(Numeric(10, 4), nullable=True)     # "Featured Offer – Unfilled Percentage"
    unfilled_featured_offer_pct_b2b = Column(Numeric(10, 4), nullable=True)

    # ── Orders / Units ────────────────────────────────────────────────────────
    units_ordered = Column(Integer, nullable=True)
    units_ordered_b2b = Column(Integer, nullable=True)
    unit_session_pct = Column(Numeric(10, 4), nullable=True)          # Conversion rate
    unit_session_pct_b2b = Column(Numeric(10, 4), nullable=True)
    ordered_product_sales = Column(Numeric(14, 2), nullable=True)
    ordered_product_sales_b2b = Column(Numeric(14, 2), nullable=True)
    total_order_items = Column(Integer, nullable=True)
    total_order_items_b2b = Column(Integer, nullable=True)

    # ── Refunds ───────────────────────────────────────────────────────────────
    units_refunded = Column(Integer, nullable=True)
    units_refunded_b2b = Column(Integer, nullable=True)
    refund_rate = Column(Numeric(10, 4), nullable=True)
    refund_rate_b2b = Column(Numeric(10, 4), nullable=True)

    # ── Shipped ───────────────────────────────────────────────────────────────
    shipped_product_sales = Column(Numeric(14, 2), nullable=True)
    shipped_product_sales_b2b = Column(Numeric(14, 2), nullable=True)
    units_shipped = Column(Integer, nullable=True)
    units_shipped_b2b = Column(Integer, nullable=True)
    orders_shipped = Column(Integer, nullable=True)
    orders_shipped_b2b = Column(Integer, nullable=True)

    # ── Metadata ──────────────────────────────────────────────────────────────
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "client_id", "asin", "report_date", "marketplace_id",
            name="uq_product_business_daily",
        ),
        Index("ix_pbd_client_date", "client_id", "report_date"),
        Index("ix_pbd_asin_date", "asin", "report_date"),
        Index("ix_pbd_client_asin", "client_id", "asin"),
    )
