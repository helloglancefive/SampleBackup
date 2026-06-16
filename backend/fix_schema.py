"""Drop and recreate ad_metrics with correct constraints (no campaign-grain unique constraint)."""
import sqlite3
from sqlalchemy import create_engine
from app.models.ad_metrics import AdMetrics

print("Dropping old ad_metrics table...")
conn = sqlite3.connect("dev.db")
conn.execute("DROP TABLE IF EXISTS ad_metrics")
conn.commit()
conn.close()

print("Recreating with correct schema...")
engine = create_engine("sqlite:///./dev.db", connect_args={"check_same_thread": False})
AdMetrics.__table__.create(bind=engine, checkfirst=True)

print("Done. Trigger a new fetch from the UI.")
