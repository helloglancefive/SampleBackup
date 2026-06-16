"""Fix unique constraints: add ad_group_id to targeting_daily, search_term_daily,
and product_ads_daily so the same keyword/target in different ad groups is distinct.

Revision ID: 014
Revises: 013
Create Date: 2026-06-15
"""
from alembic import op
import sqlalchemy as sa

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── targeting_daily: (date, client_id, report_type, campaign_id, ad_group_id, target) ──
    op.drop_table("targeting_daily")
    op.create_table(
        "targeting_daily",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("campaign_id", sa.BigInteger(), nullable=False),
        sa.Column("ad_group_id", sa.BigInteger(), nullable=True),
        sa.Column("target", sa.String(500), nullable=True),
        sa.Column("target_type", sa.String(50), nullable=True),
        sa.Column("bid", sa.Numeric(10, 4), nullable=True),
        sa.Column("impressions", sa.Integer(), nullable=True),
        sa.Column("clicks", sa.Integer(), nullable=True),
        sa.Column("spend", sa.Numeric(12, 4), nullable=True),
        sa.Column("sales", sa.Numeric(12, 2), nullable=True),
        sa.Column("orders", sa.Integer(), nullable=True),
        sa.UniqueConstraint("date", "client_id", "report_type", "campaign_id",
                            "ad_group_id", "target", name="uq_targeting_daily"),
    )
    op.create_index("ix_targeting_daily_client_date", "targeting_daily", ["client_id", "date"])

    # ── search_term_daily: (date, client_id, report_type, campaign_id, ad_group_id, keyword, search_term) ──
    op.drop_table("search_term_daily")
    op.create_table(
        "search_term_daily",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("campaign_id", sa.BigInteger(), nullable=False),
        sa.Column("ad_group_id", sa.BigInteger(), nullable=True),
        sa.Column("keyword", sa.String(500), nullable=True),
        sa.Column("search_term", sa.String(500), nullable=True),
        sa.Column("match_type", sa.String(50), nullable=True),
        sa.Column("clicks", sa.Integer(), nullable=True),
        sa.Column("spend", sa.Numeric(12, 4), nullable=True),
        sa.Column("sales", sa.Numeric(12, 2), nullable=True),
        sa.Column("orders", sa.Integer(), nullable=True),
        sa.UniqueConstraint("date", "client_id", "report_type", "campaign_id",
                            "ad_group_id", "keyword", "search_term", name="uq_search_term_daily"),
    )
    op.create_index("ix_search_term_daily_client_date", "search_term_daily", ["client_id", "date"])

    # ── product_ads_daily: (date, client_id, report_type, campaign_id, ad_group_id, asin) ──
    op.drop_table("product_ads_daily")
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
        sa.UniqueConstraint("date", "client_id", "report_type", "campaign_id",
                            "ad_group_id", "asin", name="uq_product_ads_daily"),
    )
    op.create_index("ix_product_ads_daily_client_date", "product_ads_daily", ["client_id", "date"])
    op.create_index("ix_product_ads_daily_asin", "product_ads_daily", ["asin"])


def downgrade() -> None:
    # Restore original (broken) constraints — for completeness only
    op.drop_table("product_ads_daily")
    op.drop_table("search_term_daily")
    op.drop_table("targeting_daily")
