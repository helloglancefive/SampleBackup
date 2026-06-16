"""create report_fetches

Revision ID: 006
Revises: 005
Create Date: 2026-05-09
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "report_fetches",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("client_id", sa.Integer, sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("amazon_report_id", sa.String(255), nullable=True),
        sa.Column("start_date", sa.DateTime, nullable=True),
        sa.Column("end_date", sa.DateTime, nullable=True),
        sa.Column("records_count", sa.Integer, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("fetch_time_seconds", sa.Float, nullable=True),
        sa.Column("triggered_by", sa.String(50), nullable=False, server_default="scheduled"),
        sa.Column("triggered_by_user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("fetched_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_report_fetches_client_date", "report_fetches", ["client_id", "fetched_at"])
    op.create_index("ix_report_fetches_status", "report_fetches", ["status"])


def downgrade() -> None:
    op.drop_table("report_fetches")
