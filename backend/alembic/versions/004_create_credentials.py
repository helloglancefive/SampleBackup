"""create client_amazon_credentials

Revision ID: 004
Revises: 003
Create Date: 2026-05-09
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "client_amazon_credentials",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("amazon_client_id", sa.Text, nullable=False),
        sa.Column("amazon_client_secret", sa.Text, nullable=False),
        sa.Column("amazon_refresh_token", sa.Text, nullable=False),
        sa.Column("amazon_profile_id", sa.String(255), nullable=True),
        sa.Column("last_token_refresh", sa.DateTime, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_credentials_client_id", "client_amazon_credentials", ["client_id"])


def downgrade() -> None:
    op.drop_table("client_amazon_credentials")
