"""Extend client_amazon_credentials with SP-API fields and region

Revision ID: 010
Revises: 009
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("client_amazon_credentials",
        sa.Column("sp_refresh_token", sa.Text, nullable=True))
    op.add_column("client_amazon_credentials",
        sa.Column("sp_seller_id", sa.String(100), nullable=True))
    op.add_column("client_amazon_credentials",
        sa.Column("sp_marketplace_id", sa.String(50), nullable=True))
    op.add_column("client_amazon_credentials",
        sa.Column("sp_last_token_refresh", sa.DateTime, nullable=True))
    op.add_column("client_amazon_credentials",
        sa.Column("amazon_region", sa.String(10), nullable=False, server_default="EU"))


def downgrade() -> None:
    op.drop_column("client_amazon_credentials", "amazon_region")
    op.drop_column("client_amazon_credentials", "sp_last_token_refresh")
    op.drop_column("client_amazon_credentials", "sp_marketplace_id")
    op.drop_column("client_amazon_credentials", "sp_seller_id")
    op.drop_column("client_amazon_credentials", "sp_refresh_token")
