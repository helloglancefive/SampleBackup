"""create clients

Revision ID: 002
Revises: 001
Create Date: 2026-05-09
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "clients",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("subscription_tier_id", sa.Integer, sa.ForeignKey("subscription_tiers.id"), nullable=True),
        sa.Column("subscription_status", sa.String(50), nullable=False, server_default="Active"),
        sa.Column("amazon_region", sa.String(50), nullable=False, server_default="eu"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_clients_is_active", "clients", ["is_active"])


def downgrade() -> None:
    op.drop_table("clients")
