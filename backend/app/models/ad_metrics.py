"""
AdMetrics — wide denormalized table storing all Amazon Advertising API fields.

Schema derived from analysis of real downloaded reports across all 8 report types.
Key design decisions:
  - Amazon IDs are BIGINT (15-digit integers, not strings)
  - SP uses windowed metrics (sales_14d), SB/SD use non-windowed (sales) — both stored
  - Nullable ACOS/ROAS/CTR/CPC (Amazon returns NULL when no activity, not 0)
  - grain_type distinguishes campaign/targeting/search_term/product_ad level records
  - 4 unique constraints per grain type, all include metric_date (partition key requirement)
"""
from datetime import datetime
from sqlalchemy import (
    BigInteger, Boolean, Column, Date, DateTime, Float,
    ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, text
)
from sqlalchemy.orm import relationship
from .base import Base


class AdMetrics(Base):
    __tablename__ = "ad_metrics"

    # --- Identity ---
    id = Column(Integer, primary_key=True, autoincrement=True)  # Integer works for SQLite; PostgreSQL maps to SERIAL
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    report_type = Column(String(50), nullable=False)
    metric_date = Column(Date, nullable=False)
    grain_type = Column(String(20), nullable=False)
    # grain_type values: campaign | targeting | search_term | product_ad

    # --- Campaign dimensions (all report types) ---
    campaign_id = Column(BigInteger, nullable=False)
    campaign_name = Column(String(500), nullable=True)
    campaign_status = Column(String(50), nullable=True)
    campaign_budget_amount = Column(Numeric(12, 2), nullable=True)
    campaign_budget_type = Column(String(50), nullable=True)
    campaign_budget_currency = Column(String(10), nullable=True)
    portfolio_id = Column(BigInteger, nullable=True)

    # --- Ad group ---
    ad_group_id = Column(BigInteger, nullable=True)
    ad_group_name = Column(String(500), nullable=True)

    # --- Keyword/Targeting (spTargeting, sbTargeting, sdTargeting) ---
    keyword_id = Column(BigInteger, nullable=True)
    keyword = Column(String(500), nullable=True)        # SP: 'keyword' field
    keyword_text = Column(String(500), nullable=True)   # SB: 'keywordText' field
    keyword_type = Column(String(50), nullable=True)
    keyword_bid = Column(Numeric(10, 4), nullable=True)
    ad_keyword_status = Column(String(50), nullable=True)
    match_type = Column(String(50), nullable=True)
    targeting_id = Column(BigInteger, nullable=True)
    targeting_text = Column(String(500), nullable=True)
    targeting_type = Column(String(50), nullable=True)
    targeting_expression = Column(Text, nullable=True)

    # --- Search term (spSearchTerm, sbSearchTerm) ---
    search_term = Column(String(500), nullable=True)

    # --- Ad/Product (spProductAds, sdAdvertising) ---
    ad_id = Column(BigInteger, nullable=True)
    ad_name = Column(String(500), nullable=True)
    advertised_asin = Column(String(20), nullable=True)
    advertised_sku = Column(String(255), nullable=True)
    promoted_asin = Column(String(20), nullable=True)
    promoted_sku = Column(String(255), nullable=True)
    bid_optimization = Column(String(50), nullable=True)

    # --- Core performance metrics ---
    impressions = Column(Integer, nullable=False, default=0)
    viewable_impressions = Column(Integer, nullable=True)
    impressions_views = Column(Integer, nullable=True)
    impressions_frequency_avg = Column(Numeric(8, 4), nullable=True)
    clicks = Column(Integer, nullable=False, default=0)
    cost = Column(Numeric(12, 4), nullable=False, default=0)
    cost_type = Column(String(10), nullable=True)
    cost_per_click = Column(Numeric(10, 4), nullable=True)       # NULL when clicks=0
    click_through_rate = Column(Numeric(12, 6), nullable=True)   # NULL when impr=0
    view_click_through_rate = Column(Numeric(10, 4), nullable=True)
    viewability_rate = Column(Numeric(10, 4), nullable=True)
    top_of_search_impression_share = Column(Numeric(10, 4), nullable=True)
    purchase_click_rate_14d = Column(Numeric(10, 4), nullable=True)

    # --- Sales: SP windowed ---
    sales_14d = Column(Numeric(12, 2), nullable=True)
    sales_1d = Column(Numeric(12, 2), nullable=True)
    sales_7d = Column(Numeric(12, 2), nullable=True)
    sales_30d = Column(Numeric(12, 2), nullable=True)
    attributed_sales_same_sku_1d = Column(Numeric(12, 2), nullable=True)
    attributed_sales_same_sku_7d = Column(Numeric(12, 2), nullable=True)
    attributed_sales_same_sku_14d = Column(Numeric(12, 2), nullable=True)
    attributed_sales_same_sku_30d = Column(Numeric(12, 2), nullable=True)
    sales_other_sku_7d = Column(Numeric(12, 2), nullable=True)
    sales_other_sku_14d = Column(Numeric(12, 2), nullable=True)

    # --- Sales: SB/SD non-windowed ---
    sales = Column(Numeric(12, 2), nullable=True)
    sales_clicks = Column(Numeric(12, 2), nullable=True)
    sales_promoted = Column(Numeric(12, 2), nullable=True)
    sales_promoted_clicks = Column(Numeric(12, 2), nullable=True)

    # --- Purchases: SP windowed ---
    purchases_14d = Column(Integer, nullable=True)
    purchases_1d = Column(Integer, nullable=True)
    purchases_7d = Column(Integer, nullable=True)
    purchases_30d = Column(Integer, nullable=True)
    purchases_same_sku_1d = Column(Integer, nullable=True)
    purchases_same_sku_7d = Column(Integer, nullable=True)
    purchases_same_sku_14d = Column(Integer, nullable=True)
    purchases_same_sku_30d = Column(Integer, nullable=True)

    # --- Purchases: SB/SD non-windowed ---
    purchases = Column(Integer, nullable=True)
    purchases_clicks = Column(Integer, nullable=True)
    purchases_promoted = Column(Integer, nullable=True)

    # --- Units sold: SP windowed ---
    units_sold_clicks_14d = Column(Integer, nullable=True)
    units_sold_clicks_1d = Column(Integer, nullable=True)
    units_sold_clicks_7d = Column(Integer, nullable=True)
    units_sold_clicks_30d = Column(Integer, nullable=True)
    units_sold_same_sku_1d = Column(Integer, nullable=True)
    units_sold_same_sku_7d = Column(Integer, nullable=True)
    units_sold_same_sku_14d = Column(Integer, nullable=True)
    units_sold_same_sku_30d = Column(Integer, nullable=True)
    units_sold_other_sku_7d = Column(Integer, nullable=True)
    units_sold_other_sku_14d = Column(Integer, nullable=True)

    # --- Units sold: SB/SD non-windowed ---
    units_sold = Column(Integer, nullable=True)
    units_sold_clicks = Column(Integer, nullable=True)

    # --- ROAS / ACOS (NULL when no sales activity) ---
    acos_clicks_7d = Column(Numeric(10, 4), nullable=True)
    acos_clicks_14d = Column(Numeric(10, 4), nullable=True)
    roas_clicks_7d = Column(Numeric(10, 4), nullable=True)
    roas_clicks_14d = Column(Numeric(10, 4), nullable=True)

    # --- Detail page / funnel ---
    detail_page_views = Column(Integer, nullable=True)
    detail_page_views_clicks = Column(Integer, nullable=True)
    add_to_cart = Column(Integer, nullable=True)
    add_to_cart_clicks = Column(Integer, nullable=True)
    add_to_cart_views = Column(Integer, nullable=True)
    add_to_cart_rate = Column(Numeric(10, 4), nullable=True)
    ecp_add_to_cart = Column(Numeric(10, 4), nullable=True)
    add_to_list = Column(Integer, nullable=True)
    add_to_list_from_clicks = Column(Integer, nullable=True)
    add_to_list_from_views = Column(Integer, nullable=True)

    # --- New to brand (SB, SD) ---
    new_to_brand_sales = Column(Numeric(12, 2), nullable=True)
    new_to_brand_sales_clicks = Column(Numeric(12, 2), nullable=True)
    new_to_brand_sales_pct = Column(Numeric(10, 4), nullable=True)
    new_to_brand_purchases = Column(Integer, nullable=True)
    new_to_brand_purchases_clicks = Column(Integer, nullable=True)
    new_to_brand_purchases_rate = Column(Numeric(10, 4), nullable=True)
    new_to_brand_purchases_pct = Column(Numeric(10, 4), nullable=True)
    new_to_brand_units_sold = Column(Integer, nullable=True)
    new_to_brand_units_sold_clicks = Column(Integer, nullable=True)
    new_to_brand_units_sold_pct = Column(Numeric(10, 4), nullable=True)
    new_to_brand_dpv = Column(Integer, nullable=True)
    new_to_brand_dpv_clicks = Column(Integer, nullable=True)
    new_to_brand_dpv_views = Column(Integer, nullable=True)
    new_to_brand_dpv_rate = Column(Numeric(10, 4), nullable=True)
    new_to_brand_ecp_dpv = Column(Numeric(10, 4), nullable=True)

    # --- Video metrics (SB, SD) ---
    video_5s_views = Column(Integer, nullable=True)
    video_5s_view_rate = Column(Numeric(10, 4), nullable=True)
    video_complete_views = Column(Integer, nullable=True)
    video_first_quartile_views = Column(Integer, nullable=True)
    video_midpoint_views = Column(Integer, nullable=True)
    video_third_quartile_views = Column(Integer, nullable=True)
    video_unmutes = Column(Integer, nullable=True)

    # --- Branded search (SB, SD) ---
    branded_searches = Column(Integer, nullable=True)
    branded_searches_clicks = Column(Integer, nullable=True)
    branded_searches_views = Column(Integer, nullable=True)
    branded_search_rate = Column(Numeric(10, 4), nullable=True)
    ecp_brand_search = Column(Numeric(10, 4), nullable=True)

    # --- Campaign features (placement/bidding — SP/SB campaign reports) ---
    campaign_bidding_strategy = Column(String(50), nullable=True)
    placement_classification = Column(String(100), nullable=True)
    campaign_rule_based_budget_amount = Column(Numeric(12, 2), nullable=True)
    campaign_applicable_budget_rule_id = Column(String(255), nullable=True)
    campaign_applicable_budget_rule_name = Column(String(500), nullable=True)

    # --- Long-term metrics (SB/SD campaign reports) ---
    long_term_sales = Column(Numeric(12, 2), nullable=True)
    long_term_roas = Column(Numeric(10, 4), nullable=True)

    # --- SD Matched Target report ---
    matched_target_asin = Column(String(20), nullable=True)

    # --- Gross & Invalid Traffic (SP/SB/SD gross invalid reports) ---
    gross_impressions = Column(Integer, nullable=True)
    invalid_impressions = Column(Integer, nullable=True)
    invalid_impression_rate = Column(Numeric(10, 4), nullable=True)
    gross_click_throughs = Column(Integer, nullable=True)
    invalid_click_throughs = Column(Integer, nullable=True)
    invalid_click_through_rate = Column(Numeric(10, 4), nullable=True)

    # --- SP Purchased Product report ---
    purchased_asin = Column(String(20), nullable=True)
    purchases_other_sku_1d = Column(Integer, nullable=True)
    purchases_other_sku_7d = Column(Integer, nullable=True)
    purchases_other_sku_14d = Column(Integer, nullable=True)
    purchases_other_sku_30d = Column(Integer, nullable=True)
    sales_other_sku_1d = Column(Numeric(12, 2), nullable=True)
    sales_other_sku_30d = Column(Numeric(12, 2), nullable=True)
    units_sold_other_sku_1d = Column(Integer, nullable=True)
    units_sold_other_sku_30d = Column(Integer, nullable=True)

    # --- SD Purchased Product report (brand halo metrics) ---
    asin_brand_halo = Column(String(20), nullable=True)
    sales_brand_halo = Column(Numeric(12, 2), nullable=True)
    sales_brand_halo_clicks = Column(Numeric(12, 2), nullable=True)
    units_sold_brand_halo = Column(Integer, nullable=True)
    units_sold_brand_halo_clicks = Column(Integer, nullable=True)
    conversions_brand_halo = Column(Integer, nullable=True)
    conversions_brand_halo_clicks = Column(Integer, nullable=True)

    # --- SD-specific ---
    cumulative_reach = Column(Integer, nullable=True)
    lead_form_opens = Column(Integer, nullable=True)
    leads = Column(Integer, nullable=True)
    link_outs = Column(Integer, nullable=True)
    landing_page_url = Column(Text, nullable=True)

    # --- Kindle/Borrows (SP, SB) ---
    kindle_pages_read_14d = Column(Integer, nullable=True)
    kindle_pages_royalties_14d = Column(Numeric(12, 4), nullable=True)
    qualified_borrows = Column(Integer, nullable=True)
    qualified_borrows_clicks = Column(Integer, nullable=True)
    qualified_borrows_views = Column(Integer, nullable=True)
    royalty_qualified_borrows = Column(Integer, nullable=True)
    royalty_qualified_borrows_clicks = Column(Integer, nullable=True)
    royalty_qualified_borrows_views = Column(Integer, nullable=True)

    # --- Metadata ---
    retailer = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    client = relationship("Client", back_populates="ad_metrics")

    __table_args__ = (
        # Performance indexes
        Index("ix_ad_metrics_client_date", "client_id", "metric_date"),
        Index("ix_ad_metrics_client_campaign_date", "client_id", "campaign_id", "metric_date"),
        Index("ix_ad_metrics_client_search_term", "client_id", "search_term"),
        Index("ix_ad_metrics_asin_date", "advertised_asin", "metric_date"),
        Index("ix_ad_metrics_grain", "grain_type"),
        # Partial unique indexes — each only applies to its own grain_type.
        # SQLite enforces UniqueConstraints on ALL rows regardless of grain, so we use
        # partial indexes (sqlite_where) instead. PostgreSQL uses these natively.
        Index("uq_campaign_grain", "client_id", "report_type", "campaign_id", "metric_date",
              unique=True, sqlite_where=text("grain_type = 'campaign'")),
        Index("uq_targeting_grain", "client_id", "report_type", "campaign_id", "keyword_id", "metric_date",
              unique=True, sqlite_where=text("grain_type = 'targeting'")),
        Index("uq_search_term_grain", "client_id", "report_type", "campaign_id", "keyword_id", "search_term", "metric_date",
              unique=True, sqlite_where=text("grain_type = 'search_term'")),
        Index("uq_product_ad_grain", "client_id", "report_type", "campaign_id", "ad_id", "metric_date",
              unique=True, sqlite_where=text("grain_type = 'product_ad'")),
        # New grain types for reports 9-18
        Index("uq_campaign_placement_grain", "client_id", "report_type", "campaign_id",
              "placement_classification", "metric_date",
              unique=True, sqlite_where=text("grain_type = 'campaign_placement'")),
        Index("uq_matched_target_grain", "client_id", "report_type", "campaign_id",
              "matched_target_asin", "metric_date",
              unique=True, sqlite_where=text("grain_type = 'matched_target'")),
        Index("uq_purchased_product_grain", "client_id", "report_type", "campaign_id",
              "purchased_asin", "asin_brand_halo", "metric_date",
              unique=True, sqlite_where=text("grain_type = 'purchased_product'")),
    )
