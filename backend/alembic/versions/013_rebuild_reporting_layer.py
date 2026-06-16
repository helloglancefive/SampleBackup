"""Rebuild Amazon Ads reporting layer: drop ad_metrics, create 9 clean reporting tables.

Protected tables left untouched:
  clients, client_amazon_credentials, refresh_tokens, report_fetches

Revision ID: 013
Revises: 012
Create Date: 2026-06-15
"""
from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Drop old wide analytics table ─────────────────────────────────────────
    op.drop_table("ad_metrics")

    # ── 1. amazon_ads_raw_reports ─────────────────────────────────────────────
    op.create_table(
        "amazon_ads_raw_reports",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("profile_id", sa.String(50), nullable=True),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("report_date", sa.Date(), nullable=False),
        sa.Column("raw_data", sa.Text(), nullable=True),
        sa.Column("download_time", sa.DateTime(), nullable=False),
        sa.Column("processing_status", sa.String(20), nullable=False, server_default="pending"),
    )
    op.create_index("ix_raw_reports_client_type_date", "amazon_ads_raw_reports",
                    ["client_id", "report_type", "report_date"])

    # ── 2. campaigns_master ───────────────────────────────────────────────────
    op.create_table(
        "campaigns_master",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("campaign_id", sa.BigInteger(), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("profile_id", sa.String(50), nullable=True),
        sa.Column("campaign_name", sa.String(500), nullable=True),
        sa.Column("campaign_type", sa.String(30), nullable=True),
        sa.Column("status", sa.String(50), nullable=True),
        sa.Column("daily_budget", sa.Numeric(12, 2), nullable=True),
        sa.Column("targeting_type", sa.String(20), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("created_time", sa.DateTime(), nullable=False),
        sa.Column("updated_time", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("client_id", "campaign_id", name="uq_campaigns_master_client_campaign"),
    )
    op.create_index("ix_campaigns_master_client", "campaigns_master", ["client_id"])

    # ── 3. campaign_daily_metrics ─────────────────────────────────────────────
    op.create_table(
        "campaign_daily_metrics",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("campaign_id", sa.BigInteger(), nullable=False),
        sa.Column("campaign_name", sa.String(500), nullable=True),
        sa.Column("impressions", sa.Integer(), nullable=True),
        sa.Column("clicks", sa.Integer(), nullable=True),
        sa.Column("spend", sa.Numeric(12, 4), nullable=True),
        sa.Column("sales", sa.Numeric(12, 2), nullable=True),
        sa.Column("orders", sa.Integer(), nullable=True),
        sa.Column("ctr", sa.Numeric(12, 6), nullable=True),
        sa.Column("cpc", sa.Numeric(10, 4), nullable=True),
        sa.Column("acos", sa.Numeric(10, 4), nullable=True),
        sa.Column("roas", sa.Numeric(10, 4), nullable=True),
        sa.UniqueConstraint("date", "client_id", "report_type", "campaign_id",
                            name="uq_campaign_daily"),
    )
    op.create_index("ix_campaign_daily_client_date", "campaign_daily_metrics", ["client_id", "date"])
    op.create_index("ix_campaign_daily_campaign", "campaign_daily_metrics", ["campaign_id"])

    # ── 4. product_ads_daily ──────────────────────────────────────────────────
    op.create_table(
        "product_ads_daily",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("campaign_id", sa.BigInteger(), nullable=False),
        sa.Column("ad_group_id", sa.BigInteger(), nullable=True),
        sa.Column("asin", sa.String(20), nullable=True),
        sa.Column("sku", sa.String(255), nullable=True),
        sa.Column("impressions", sa.Integer(), nullable=True),
        sa.Column("clicks", sa.Integer(), nullable=True),
        sa.Column("spend", sa.Numeric(12, 4), nullable=True),
        sa.Column("sales", sa.Numeric(12, 2), nullable=True),
        sa.Column("orders", sa.Integer(), nullable=True),
        sa.UniqueConstraint("date", "client_id", "report_type", "campaign_id", "asin",
                            name="uq_product_ads_daily"),
    )
    op.create_index("ix_product_ads_daily_client_date", "product_ads_daily", ["client_id", "date"])
    op.create_index("ix_product_ads_daily_asin", "product_ads_daily", ["asin"])

    # ── 5. search_term_daily ──────────────────────────────────────────────────
    op.create_table(
        "search_term_daily",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("campaign_id", sa.BigInteger(), nullable=False),
        sa.Column("keyword", sa.String(500), nullable=True),
        sa.Column("search_term", sa.String(500), nullable=True),
        sa.Column("match_type", sa.String(50), nullable=True),
        sa.Column("clicks", sa.Integer(), nullable=True),
        sa.Column("spend", sa.Numeric(12, 4), nullable=True),
        sa.Column("sales", sa.Numeric(12, 2), nullable=True),
        sa.Column("orders", sa.Integer(), nullable=True),
        sa.UniqueConstraint("date", "client_id", "report_type", "campaign_id", "search_term",
                            name="uq_search_term_daily"),
    )
    op.create_index("ix_search_term_daily_client_date", "search_term_daily", ["client_id", "date"])

    # ── 6. targeting_daily ────────────────────────────────────────────────────
    op.create_table(
        "targeting_daily",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("campaign_id", sa.BigInteger(), nullable=False),
        sa.Column("target", sa.String(500), nullable=True),
        sa.Column("target_type", sa.String(50), nullable=True),
        sa.Column("bid", sa.Numeric(10, 4), nullable=True),
        sa.Column("impressions", sa.Integer(), nullable=True),
        sa.Column("clicks", sa.Integer(), nullable=True),
        sa.Column("spend", sa.Numeric(12, 4), nullable=True),
        sa.Column("sales", sa.Numeric(12, 2), nullable=True),
        sa.Column("orders", sa.Integer(), nullable=True),
        sa.UniqueConstraint("date", "client_id", "report_type", "campaign_id", "target",
                            name="uq_targeting_daily"),
    )
    op.create_index("ix_targeting_daily_client_date", "targeting_daily", ["client_id", "date"])

    # ── 7. placement_daily ────────────────────────────────────────────────────
    op.create_table(
        "placement_daily",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("campaign_id", sa.BigInteger(), nullable=False),
        sa.Column("placement", sa.String(100), nullable=True),
        sa.Column("impressions", sa.Integer(), nullable=True),
        sa.Column("clicks", sa.Integer(), nullable=True),
        sa.Column("spend", sa.Numeric(12, 4), nullable=True),
        sa.Column("sales", sa.Numeric(12, 2), nullable=True),
        sa.Column("orders", sa.Integer(), nullable=True),
        sa.UniqueConstraint("date", "client_id", "report_type", "campaign_id", "placement",
                            name="uq_placement_daily"),
    )
    op.create_index("ix_placement_daily_client_date", "placement_daily", ["client_id", "date"])

    # ── 8. purchased_product_daily ────────────────────────────────────────────
    op.create_table(
        "purchased_product_daily",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("campaign_id", sa.BigInteger(), nullable=False),
        sa.Column("purchased_asin", sa.String(20), nullable=True),
        sa.Column("sales", sa.Numeric(12, 2), nullable=True),
        sa.Column("orders", sa.Integer(), nullable=True),
        sa.Column("units", sa.Integer(), nullable=True),
        sa.UniqueConstraint("date", "client_id", "report_type", "campaign_id", "purchased_asin",
                            name="uq_purchased_product_daily"),
    )
    op.create_index("ix_purchased_product_daily_client_date", "purchased_product_daily",
                    ["client_id", "date"])

    # ── 9. invalid_traffic_daily ──────────────────────────────────────────────
    op.create_table(
        "invalid_traffic_daily",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("campaign_id", sa.BigInteger(), nullable=False),
        sa.Column("invalid_clicks", sa.Integer(), nullable=True),
        sa.Column("invalid_impressions", sa.Integer(), nullable=True),
        sa.Column("invalid_spend", sa.Numeric(12, 4), nullable=True),
        sa.UniqueConstraint("date", "client_id", "report_type", "campaign_id",
                            name="uq_invalid_traffic_daily"),
    )
    op.create_index("ix_invalid_traffic_daily_client_date", "invalid_traffic_daily",
                    ["client_id", "date"])


def downgrade() -> None:
    op.drop_table("invalid_traffic_daily")
    op.drop_table("purchased_product_daily")
    op.drop_table("placement_daily")
    op.drop_table("targeting_daily")
    op.drop_table("search_term_daily")
    op.drop_table("product_ads_daily")
    op.drop_table("campaign_daily_metrics")
    op.drop_table("campaigns_master")
    op.drop_table("amazon_ads_raw_reports")
    # Note: ad_metrics is NOT recreated on downgrade — data is gone.
