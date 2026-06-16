from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class ProductSummary(BaseModel):
    asin: str
    parent_asin: Optional[str] = None
    sku: Optional[str] = None
    title: Optional[str] = None
    first_seen: Optional[date] = None
    last_seen: Optional[date] = None

    model_config = {"from_attributes": True}


class BusinessMetricsDaily(BaseModel):
    report_date: date
    asin: str
    parent_asin: Optional[str] = None
    sku: Optional[str] = None
    title: Optional[str] = None

    # Sessions
    sessions_mobile_app: Optional[int] = None
    sessions_browser: Optional[int] = None
    sessions_total: Optional[int] = None
    sessions_total_b2b: Optional[int] = None

    # Session Percentage
    session_pct_total: Optional[float] = None

    # Page Views
    page_views_mobile_app: Optional[int] = None
    page_views_browser: Optional[int] = None
    page_views_total: Optional[int] = None

    # Buy Box
    featured_offer_pct: Optional[float] = None

    # Orders
    units_ordered: Optional[int] = None
    units_ordered_b2b: Optional[int] = None
    unit_session_pct: Optional[float] = None
    ordered_product_sales: Optional[float] = None
    ordered_product_sales_b2b: Optional[float] = None
    total_order_items: Optional[int] = None

    # Refunds
    units_refunded: Optional[int] = None
    refund_rate: Optional[float] = None

    # Shipped
    shipped_product_sales: Optional[float] = None
    units_shipped: Optional[int] = None
    orders_shipped: Optional[int] = None

    model_config = {"from_attributes": True}


class BusinessSummary(BaseModel):
    """Aggregated summary for a date range."""
    start_date: date
    end_date: date
    asin_count: int
    total_sessions: int
    total_page_views: int
    total_units_ordered: int
    total_ordered_sales: float
    total_units_refunded: int
    avg_conversion_rate: Optional[float] = None
    avg_buy_box_pct: Optional[float] = None


class SpFetchRequest(BaseModel):
    start_date: str   # YYYY-MM-DD
    end_date: str


class ProductProfitabilityRow(BaseModel):
    """Unified view: organic + paid combined per ASIN."""
    asin: str
    title: Optional[str] = None

    # Organic (SP-API)
    organic_sessions: Optional[int] = None
    organic_page_views: Optional[int] = None
    organic_units_ordered: Optional[int] = None
    organic_sales: Optional[float] = None
    conversion_rate: Optional[float] = None
    refund_rate: Optional[float] = None

    # Paid (Ads API)
    ad_spend: Optional[float] = None
    ad_sales: Optional[float] = None
    ad_orders: Optional[int] = None
    acos: Optional[float] = None
    roas: Optional[float] = None

    # Combined
    total_sales: Optional[float] = None
    total_orders: Optional[int] = None
