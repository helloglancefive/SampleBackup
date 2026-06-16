from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from .base import Base


class ReportFetch(Base):
    __tablename__ = "report_fetches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    report_type = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False)
    amazon_report_id = Column(String(255), nullable=True)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    records_count = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    fetch_time_seconds = Column(Float, nullable=True)
    triggered_by = Column(String(50), default="scheduled", nullable=False)
    triggered_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    fetched_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    client = relationship("Client", back_populates="report_fetches")

    __table_args__ = (
        Index("ix_report_fetches_client_date", "client_id", "fetched_at"),
        Index("ix_report_fetches_status", "status"),
    )
