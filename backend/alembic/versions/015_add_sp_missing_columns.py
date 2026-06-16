"""Add unfilled featured offer percentage columns to product_business_daily.

Amazon SP-API GET_SALES_AND_TRAFFIC_REPORT includes "Featured Offer – Unfilled
Percentage" and its B2B variant, which were missing from the initial schema.

Revision ID: 015
Revises: 014
Create Date: 2026-06-16
"""
from alembic import op
import sqlalchemy as sa

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("product_business_daily") as batch_op:
        batch_op.add_column(sa.Column(
            "unfilled_featured_offer_pct",
            sa.Numeric(10, 4),
            nullable=True,
        ))
        batch_op.add_column(sa.Column(
            "unfilled_featured_offer_pct_b2b",
            sa.Numeric(10, 4),
            nullable=True,
        ))


def downgrade() -> None:
    with op.batch_alter_table("product_business_daily") as batch_op:
        batch_op.drop_column("unfilled_featured_offer_pct_b2b")
        batch_op.drop_column("unfilled_featured_offer_pct")
