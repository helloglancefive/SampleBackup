"""
Amazon Ads reporting layer — 9 tables replacing the old wide ad_metrics table.

Design:
  - amazon_ads_raw_reports : one row per API download (raw JSON preserved)
  - campaigns_master       : campaign dimension (upserted from every campaign-level report)
  - campaign_daily_metrics : SP/SB/SD campaign-level daily performance
  - product_ads_daily      : SP spProductAds + SD sdAdvertising
  - search_term_daily      : SP spSearchTerm + SB sbSearchTerm
  - targeting_daily        : SP spTargeting + SB sbTargeting + SD sdTargeting + SD sdMatchedTarget
  - placement_daily        : SP spCampaignPlacement + SB sbCampaignPlacement
  - purchased_product_daily: SP spPurchasedProduct + SD sdPurchasedProduct
  - invalid_traffic_daily  : SP/SB/SD gross & invalid traffic reports
"""
from datetime import datetime
from sqlalchemy import (
    BigInteger, Column, Date, DateTime,
    ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint,
)
from .base import Base


class AmazonAdsRawReport(Base):
    __tablename__ = "amazon_ads_raw_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    profile_id = Column(String(50), nullable=True)
    report_type = Column(String(50), nullable=False)
    report_date = Column(Date, nullable=False)          # start_date of the request
    raw_data = Column(Text, nullable=True)              # full JSON string
    download_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    processing_status = Column(String(20), default="pending", nullable=False)
    # processing_status: pending | processed | failed

    __table_args__ = (
        Index("ix_raw_reports_client_type_date", "client_id", "report_type", "report_date"),
    )


class CampaignsMaster(Base):
    __tablename__ = "campaigns_master"

    id = Column(Integer, primary_key=True, autoincrement=True)
    campaign_id = Column(BigInteger, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    profile_id = Column(String(50), nullable=True)
    campaign_name = Column(String(500), nullable=True)
    campaign_type = Column(String(30), nullable=True)   # SPONSORED_PRODUCTS | SPONSORED_BRANDS | SPONSORED_DISPLAY
    status = Column(String(50), nullable=True)
    daily_budget = Column(Numeric(12, 2), nullable=True)
    targeting_type = Column(String(20), nullable=True)  # auto | manual (not always available from metrics)
    start_date = Column(Date, nullable=True)
    created_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_time = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("client_id", "campaign_id", name="uq_campaigns_master_client_campaign"),
        Index("ix_campaigns_master_client", "client_id"),
    )


class CampaignDailyMetrics(Base):
    __tablename__ = "campaign_daily_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    report_type = Column(String(50), nullable=False)    # spCampaigns | sbCampaigns | sdCampaigns
    campaign_id = Column(BigInteger, nullable=False)
    campaign_name = Column(String(500), nullable=True)
    impressions = Column(Integer, nullable=True, default=0)
    clicks = Column(Integer, nullable=True, default=0)
    spend = Column(Numeric(12, 4), nullable=True, default=0)
    sales = Column(Numeric(12, 2), nullable=True)       # sales14d (SP) or sales (SB/SD)
    orders = Column(Integer, nullable=True)             # purchases14d (SP) or purchases (SB/SD)
    ctr = Column(Numeric(12, 6), nullable=True)
    cpc = Column(Numeric(10, 4), nullable=True)
    acos = Column(Numeric(10, 4), nullable=True)
    roas = Column(Numeric(10, 4), nullable=True)

    __table_args__ = (
        UniqueConstraint("date", "client_id", "report_type", "campaign_id",
                         name="uq_campaign_daily"),
        Index("ix_campaign_daily_client_date", "client_id", "date"),
        Index("ix_campaign_daily_campaign", "campaign_id"),
    )


class ProductAdsDaily(Base):
    __tablename__ = "product_ads_daily"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    report_type = Column(String(50), nullable=False)    # spProductAds | sdAdvertising
    campaign_id = Column(BigInteger, nullable=False)
    ad_group_id = Column(BigInteger, nullable=True)
    asin = Column(String(20), nullable=True)            # advertisedAsin (SP) | promotedAsin (SD)
    sku = Column(String(255), nullable=True)            # advertisedSku (SP) | promotedSku (SD)
    impressions = Column(Integer, nullable=True, default=0)
    clicks = Column(Integer, nullable=True, default=0)
    spend = Column(Numeric(12, 4), nullable=True, default=0)
    sales = Column(Numeric(12, 2), nullable=True)
    orders = Column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint("date", "client_id", "report_type", "campaign_id", "ad_group_id", "asin",
                         name="uq_product_ads_daily"),
        Index("ix_product_ads_daily_client_date", "client_id", "date"),
        Index("ix_product_ads_daily_asin", "asin"),
    )


class SearchTermDaily(Base):
    __tablename__ = "search_term_daily"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    report_type = Column(String(50), nullable=False)    # spSearchTerm | sbSearchTerm
    campaign_id = Column(BigInteger, nullable=False)
    ad_group_id = Column(BigInteger, nullable=True)
    keyword = Column(String(500), nullable=True)        # the keyword/targeting that triggered the search
    search_term = Column(String(500), nullable=True)    # the actual search term customer typed
    match_type = Column(String(50), nullable=True)
    clicks = Column(Integer, nullable=True, default=0)
    spend = Column(Numeric(12, 4), nullable=True, default=0)
    sales = Column(Numeric(12, 2), nullable=True)
    orders = Column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint("date", "client_id", "report_type", "campaign_id",
                         "ad_group_id", "keyword", "search_term", name="uq_search_term_daily"),
        Index("ix_search_term_daily_client_date", "client_id", "date"),
    )


class TargetingDaily(Base):
    __tablename__ = "targeting_daily"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    report_type = Column(String(50), nullable=False)    # spTargeting | sbTargeting | sdTargeting | sdMatchedTarget
    campaign_id = Column(BigInteger, nullable=False)
    ad_group_id = Column(BigInteger, nullable=True)
    target = Column(String(500), nullable=True)         # targeting text / keyword / matched ASIN
    target_type = Column(String(50), nullable=True)     # matchType or targetingType
    bid = Column(Numeric(10, 4), nullable=True)
    impressions = Column(Integer, nullable=True, default=0)
    clicks = Column(Integer, nullable=True, default=0)
    spend = Column(Numeric(12, 4), nullable=True, default=0)
    sales = Column(Numeric(12, 2), nullable=True)
    orders = Column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint("date", "client_id", "report_type", "campaign_id",
                         "ad_group_id", "target", name="uq_targeting_daily"),
        Index("ix_targeting_daily_client_date", "client_id", "date"),
    )


class PlacementDaily(Base):
    __tablename__ = "placement_daily"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    report_type = Column(String(50), nullable=False)    # spCampaignPlacement | sbCampaignPlacement
    campaign_id = Column(BigInteger, nullable=False)
    placement = Column(String(100), nullable=True)      # placementClassification value
    impressions = Column(Integer, nullable=True, default=0)
    clicks = Column(Integer, nullable=True, default=0)
    spend = Column(Numeric(12, 4), nullable=True, default=0)
    sales = Column(Numeric(12, 2), nullable=True)
    orders = Column(Integer, nullable=True)

    __table_args__ = (
        UniqueConstraint("date", "client_id", "report_type", "campaign_id", "placement",
                         name="uq_placement_daily"),
        Index("ix_placement_daily_client_date", "client_id", "date"),
    )


class PurchasedProductDaily(Base):
    __tablename__ = "purchased_product_daily"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    report_type = Column(String(50), nullable=False)    # spPurchasedProduct | sdPurchasedProduct
    campaign_id = Column(BigInteger, nullable=False)
    purchased_asin = Column(String(20), nullable=True)  # purchasedAsin (SP) | asinBrandHalo (SD)
    sales = Column(Numeric(12, 2), nullable=True)       # sales14d (SP) | salesBrandHalo (SD)
    orders = Column(Integer, nullable=True)             # purchases14d (SP) | conversionsBrandHalo (SD)
    units = Column(Integer, nullable=True)              # unitsSoldClicks14d (SP) | unitsSoldBrandHalo (SD)

    __table_args__ = (
        UniqueConstraint("date", "client_id", "report_type", "campaign_id", "purchased_asin",
                         name="uq_purchased_product_daily"),
        Index("ix_purchased_product_daily_client_date", "client_id", "date"),
    )


class InvalidTrafficDaily(Base):
    __tablename__ = "invalid_traffic_daily"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(Date, nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    report_type = Column(String(50), nullable=False)    # spGrossAndInvalids | sbGrossAndInvalids | sdGrossAndInvalids
    campaign_id = Column(BigInteger, nullable=False)
    invalid_clicks = Column(Integer, nullable=True)
    invalid_impressions = Column(Integer, nullable=True)
    invalid_spend = Column(Numeric(12, 4), nullable=True)   # not returned by API; reserved for future

    __table_args__ = (
        UniqueConstraint("date", "client_id", "report_type", "campaign_id",
                         name="uq_invalid_traffic_daily"),
        Index("ix_invalid_traffic_daily_client_date", "client_id", "date"),
    )
