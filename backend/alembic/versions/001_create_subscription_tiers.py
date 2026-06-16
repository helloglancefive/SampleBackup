"""create subscription_tiers

Revision ID: 001
Revises:
Create Date: 2026-05-09
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "subscription_tiers",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(100), unique=True, nullable=False),
        sa.Column("price_monthly", sa.Numeric(10, 2), nullable=True),
        sa.Column("max_clients", sa.Integer, nullable=True),
        sa.Column("max_users_per_client", sa.Integer, nullable=True),
        sa.Column("report_fetch_freq", sa.String(50), nullable=False, server_default="daily"),
        sa.Column("export_limit_monthly", sa.Integer, nullable=True),
        sa.Column("api_access", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("subscription_tiers")
