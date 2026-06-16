"""Create SP-API business report tables: products_master + product_business_daily

Revision ID: 012
Revises: 011
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── products_master ───────────────────────────────────────────────────────
    op.create_table(
        "products_master",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("asin", sa.String(20), nullable=False),
        sa.Column("parent_asin", sa.String(20), nullable=True),
        sa.Column("sku", sa.String(255), nullable=True),
        sa.Column("title", sa.Text, nullable=True),
        sa.Column("brand", sa.String(255), nullable=True),
        sa.Column("category", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="1"),
        sa.Column("first_seen", sa.Date, nullable=True),
        sa.Column("last_seen", sa.Date, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("client_id", "asin", name="uq_products_master_client_asin"),
    )
    op.create_index("ix_products_master_client", "products_master", ["client_id"])
    op.create_index("ix_products_master_asin", "products_master", ["asin"])

    # ── product_business_daily ────────────────────────────────────────────────
    op.create_table(
        "product_business_daily",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_date", sa.Date, nullable=False),
        sa.Column("marketplace_id", sa.String(50), nullable=False),
        sa.Column("asin", sa.String(20), nullable=False),
        sa.Column("parent_asin", sa.String(20), nullable=True),
        sa.Column("sku", sa.String(255), nullable=True),
        sa.Column("title", sa.Text, nullable=True),
        # Sessions
        sa.Column("sessions_mobile_app", sa.Integer, nullable=True),
        sa.Column("sessions_mobile_app_b2b", sa.Integer, nullable=True),
        sa.Column("sessions_browser", sa.Integer, nullable=True),
        sa.Column("sessions_browser_b2b", sa.Integer, nullable=True),
        sa.Column("sessions_total", sa.Integer, nullable=True),
        sa.Column("sessions_total_b2b", sa.Integer, nullable=True),
        # Session Percentage
        sa.Column("session_pct_mobile_app", sa.Numeric(10, 4), nullable=True),
        sa.Column("session_pct_mobile_app_b2b", sa.Numeric(10, 4), nullable=True),
        sa.Column("session_pct_browser", sa.Numeric(10, 4), nullable=True),
        sa.Column("session_pct_browser_b2b", sa.Numeric(10, 4), nullable=True),
        sa.Column("session_pct_total", sa.Numeric(10, 4), nullable=True),
        sa.Column("session_pct_total_b2b", sa.Numeric(10, 4), nullable=True),
        # Page Views
        sa.Column("page_views_mobile_app", sa.Integer, nullable=True),
        sa.Column("page_views_mobile_app_b2b", sa.Integer, nullable=True),
        sa.Column("page_views_browser", sa.Integer, nullable=True),
        sa.Column("page_views_browser_b2b", sa.Integer, nullable=True),
        sa.Column("page_views_total", sa.Integer, nullable=True),
        sa.Column("page_views_total_b2b", sa.Integer, nullable=True),
        # Page View Percentage
        sa.Column("page_view_pct_mobile_app", sa.Numeric(10, 4), nullable=True),
        sa.Column("page_view_pct_mobile_app_b2b", sa.Numeric(10, 4), nullable=True),
        sa.Column("page_view_pct_browser", sa.Numeric(10, 4), nullable=True),
        sa.Column("page_view_pct_browser_b2b", sa.Numeric(10, 4), nullable=True),
        sa.Column("page_view_pct_total", sa.Numeric(10, 4), nullable=True),
        sa.Column("page_view_pct_total_b2b", sa.Numeric(10, 4), nullable=True),
        # Buy Box
        sa.Column("featured_offer_pct", sa.Numeric(10, 4), nullable=True),
        sa.Column("featured_offer_pct_b2b", sa.Numeric(10, 4), nullable=True),
        # Orders / Units
        sa.Column("units_ordered", sa.Integer, nullable=True),
        sa.Column("units_ordered_b2b", sa.Integer, nullable=True),
        sa.Column("unit_session_pct", sa.Numeric(10, 4), nullable=True),
        sa.Column("unit_session_pct_b2b", sa.Numeric(10, 4), nullable=True),
        sa.Column("ordered_product_sales", sa.Numeric(14, 2), nullable=True),
        sa.Column("ordered_product_sales_b2b", sa.Numeric(14, 2), nullable=True),
        sa.Column("total_order_items", sa.Integer, nullable=True),
        sa.Column("total_order_items_b2b", sa.Integer, nullable=True),
        # Refunds
        sa.Column("units_refunded", sa.Integer, nullable=True),
        sa.Column("units_refunded_b2b", sa.Integer, nullable=True),
        sa.Column("refund_rate", sa.Numeric(10, 4), nullable=True),
        sa.Column("refund_rate_b2b", sa.Numeric(10, 4), nullable=True),
        # Shipped
        sa.Column("shipped_product_sales", sa.Numeric(14, 2), nullable=True),
        sa.Column("shipped_product_sales_b2b", sa.Numeric(14, 2), nullable=True),
        sa.Column("units_shipped", sa.Integer, nullable=True),
        sa.Column("units_shipped_b2b", sa.Integer, nullable=True),
        sa.Column("orders_shipped", sa.Integer, nullable=True),
        sa.Column("orders_shipped_b2b", sa.Integer, nullable=True),
        # Metadata
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint(
            "client_id", "asin", "report_date", "marketplace_id",
            name="uq_product_business_daily",
        ),
    )
    op.create_index("ix_pbd_client_date", "product_business_daily", ["client_id", "report_date"])
    op.create_index("ix_pbd_asin_date", "product_business_daily", ["asin", "report_date"])
    op.create_index("ix_pbd_client_asin", "product_business_daily", ["client_id", "asin"])


def downgrade() -> None:
    op.drop_table("product_business_daily")
    op.drop_table("products_master")
