"""Add missing columns to ad_metrics for 10 new report types

Revision ID: 011
Revises: 010
Create Date: 2026-06-14

Adds columns needed for:
  - SP/SB/SD Gross & Invalid Traffic reports
  - SP/SB Campaign Placement reports
  - SB/SD Campaign long-term metrics
  - SD Matched Target report
  - SP Purchased Product report
  - SD Purchased Product (brand halo) report
"""
from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None

NEW_COLUMNS = [
    # Campaign placement / bidding
    ("campaign_bidding_strategy",          sa.String(50),     True),
    ("placement_classification",           sa.String(100),    True),
    ("campaign_rule_based_budget_amount",  sa.Numeric(12, 2), True),
    ("campaign_applicable_budget_rule_id", sa.String(255),    True),
    ("campaign_applicable_budget_rule_name", sa.String(500),  True),
    # Long-term metrics
    ("long_term_sales",                    sa.Numeric(12, 2), True),
    ("long_term_roas",                     sa.Numeric(10, 4), True),
    # SD Matched Target
    ("matched_target_asin",               sa.String(20),     True),
    # Gross & Invalid Traffic
    ("gross_impressions",                  sa.Integer,        True),
    ("invalid_impressions",                sa.Integer,        True),
    ("invalid_impression_rate",            sa.Numeric(10, 4), True),
    ("gross_click_throughs",               sa.Integer,        True),
    ("invalid_click_throughs",             sa.Integer,        True),
    ("invalid_click_through_rate",         sa.Numeric(10, 4), True),
    # SP Purchased Product
    ("purchased_asin",                     sa.String(20),     True),
    ("purchases_other_sku_1d",             sa.Integer,        True),
    ("purchases_other_sku_7d",             sa.Integer,        True),
    ("purchases_other_sku_14d",            sa.Integer,        True),
    ("purchases_other_sku_30d",            sa.Integer,        True),
    ("sales_other_sku_1d",                 sa.Numeric(12, 2), True),
    ("sales_other_sku_30d",                sa.Numeric(12, 2), True),
    ("units_sold_other_sku_1d",            sa.Integer,        True),
    ("units_sold_other_sku_30d",           sa.Integer,        True),
    # SD Purchased Product (brand halo)
    ("asin_brand_halo",                    sa.String(20),     True),
    ("sales_brand_halo",                   sa.Numeric(12, 2), True),
    ("sales_brand_halo_clicks",            sa.Numeric(12, 2), True),
    ("units_sold_brand_halo",              sa.Integer,        True),
    ("units_sold_brand_halo_clicks",       sa.Integer,        True),
    ("conversions_brand_halo",             sa.Integer,        True),
    ("conversions_brand_halo_clicks",      sa.Integer,        True),
]


def upgrade() -> None:
    for col_name, col_type, nullable in NEW_COLUMNS:
        op.add_column("ad_metrics", sa.Column(col_name, col_type, nullable=nullable))

    # New partial unique indexes for new grain types
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("""
            CREATE UNIQUE INDEX uq_campaign_placement_grain
            ON ad_metrics (client_id, report_type, campaign_id, placement_classification, metric_date)
            WHERE grain_type = 'campaign_placement'
        """)
        op.execute("""
            CREATE UNIQUE INDEX uq_matched_target_grain
            ON ad_metrics (client_id, report_type, campaign_id, matched_target_asin, metric_date)
            WHERE grain_type = 'matched_target'
        """)
        op.execute("""
            CREATE UNIQUE INDEX uq_purchased_product_grain
            ON ad_metrics (client_id, report_type, campaign_id, purchased_asin, asin_brand_halo, metric_date)
            WHERE grain_type = 'purchased_product'
        """)
    # SQLite: partial indexes are created automatically by SQLAlchemy model __table_args__


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS uq_campaign_placement_grain")
        op.execute("DROP INDEX IF EXISTS uq_matched_target_grain")
        op.execute("DROP INDEX IF EXISTS uq_purchased_product_grain")

    for col_name, _, _ in reversed(NEW_COLUMNS):
        op.drop_column("ad_metrics", col_name)
