"""Seed initial data — runs automatically on every container start (idempotent)."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from config import get_settings
from app.models import SubscriptionTier, User
from app.security.password import hash_password

TIERS = [
    {"name": "Free",         "price_monthly": 0.00,  "max_clients": 1,   "max_users_per_client": 3,   "report_fetch_freq": "daily",  "export_limit_monthly": 10,  "api_access": False},
    {"name": "Starter",      "price_monthly": 29.00, "max_clients": 5,   "max_users_per_client": 10,  "report_fetch_freq": "daily",  "export_limit_monthly": 100, "api_access": False},
    {"name": "Professional", "price_monthly": 99.00, "max_clients": 20,  "max_users_per_client": 50,  "report_fetch_freq": "daily",  "export_limit_monthly": 500, "api_access": False},
    {"name": "Enterprise",   "price_monthly": None,  "max_clients": 999, "max_users_per_client": 999, "report_fetch_freq": "hourly", "export_limit_monthly": 999, "api_access": True},
]


def seed():
    settings = get_settings()
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False} if settings.is_sqlite else {},
    )

    with Session(engine) as session:
        # ── Subscription tiers ────────────────────────────────────────────────
        for tier_data in TIERS:
            if not session.query(SubscriptionTier).filter_by(name=tier_data["name"]).first():
                session.add(SubscriptionTier(**tier_data))
                print(f"  [seed] Created tier: {tier_data['name']}")
            else:
                print(f"  [seed] Tier exists: {tier_data['name']}")

        # ── Admin user ────────────────────────────────────────────────────────
        # Credentials come from env vars so you can change them in .env.local
        # Defaults are intentionally obvious — change them before adding clients
        admin_email    = os.environ.get("ADMIN_EMAIL",    "admin@glancefive.com")
        admin_password = os.environ.get("ADMIN_PASSWORD", "GlanceFive@2026!")
        admin_name     = os.environ.get("ADMIN_NAME",     "GlanceFive Admin")

        existing_admin = session.query(User).filter_by(email=admin_email).first()
        if not existing_admin:
            session.add(User(
                email=admin_email,
                password_hash=hash_password(admin_password),
                full_name=admin_name,
                role="Admin",
                is_active=True,
            ))
            print(f"  [seed] Created admin user: {admin_email}")
            print(f"  [seed] Admin password:      {admin_password}")
            print(f"  [seed] IMPORTANT: Change the password after first login!")
        else:
            print(f"  [seed] Admin user exists: {admin_email}")

        session.commit()

    print("[seed] Done.")


if __name__ == "__main__":
    seed()
