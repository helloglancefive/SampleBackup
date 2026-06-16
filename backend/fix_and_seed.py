"""Fix ad_metrics schema and seed demo data without deleting dev.db."""
import sqlite3
from app.dependencies import get_db
from app.models import User, Client, SubscriptionTier, AdMetrics
from app.models.base import Base
from app.security.password import hash_password
from datetime import date, timedelta
import random

# Fix ad_metrics table — drop and recreate with correct INTEGER PK
print("Fixing ad_metrics table schema...")
conn = sqlite3.connect("dev.db")
conn.execute("DROP TABLE IF EXISTS ad_metrics")
conn.commit()
conn.close()
print("Dropped old ad_metrics table.")

# Recreate it with the correct schema via SQLAlchemy
from sqlalchemy import create_engine
engine = create_engine("sqlite:///./dev.db", connect_args={"check_same_thread": False})
AdMetrics.__table__.create(bind=engine, checkfirst=True)
print("Recreated ad_metrics with correct schema.")

# Now seed
db = next(get_db())

# Ensure tiers exist
tiers_data = [
    dict(name="Free",         price_monthly=0,   max_clients=1,  max_users_per_client=3,  report_fetch_freq=1440, export_limit_monthly=10,  api_access=False),
    dict(name="Starter",      price_monthly=49,  max_clients=5,  max_users_per_client=5,  report_fetch_freq=360,  export_limit_monthly=100, api_access=False),
    dict(name="Professional", price_monthly=149, max_clients=20, max_users_per_client=10, report_fetch_freq=60,   export_limit_monthly=500, api_access=True),
    dict(name="Enterprise",   price_monthly=499, max_clients=0,  max_users_per_client=0,  report_fetch_freq=15,   export_limit_monthly=0,   api_access=True),
]
for t in tiers_data:
    if not db.query(SubscriptionTier).filter(SubscriptionTier.name == t["name"]).first():
        db.add(SubscriptionTier(**t))
db.commit()

tier = db.query(SubscriptionTier).first()

# Create/reuse demo user
user = db.query(User).filter(User.email == "demo@glancefive.com").first()
if not user:
    client = Client(name="My Amazon Store", subscription_tier_id=tier.id, is_active=True)
    db.add(client)
    db.flush()
    user = User(
        email="demo@glancefive.com",
        password_hash=hash_password("Demo123!"),
        full_name="Demo User",
        role="Seller",
        client_id=client.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"Created user: demo@glancefive.com (client_id={user.client_id})")
else:
    client = db.query(Client).filter(Client.id == user.client_id).first()
    if not client:
        client = Client(name="My Amazon Store", subscription_tier_id=tier.id, is_active=True)
        db.add(client)
        db.flush()
        user.client_id = client.id
        db.commit()
    print(f"Using existing user (client_id={user.client_id})")

# Seed 30 days of fake metrics
random.seed(42)
campaigns = [
    (111111111, "Sponsored - Brand Awareness"),
    (222222222, "Retargeting - High Intent"),
    (333333333, "Competitor Keywords"),
]
rows = 0
for i in range(30):
    d = date.today() - timedelta(days=i)
    for cid, cname in campaigns:
        cost  = round(random.uniform(20, 200), 2)
        sales = round(random.uniform(100, 1000), 2)
        db.add(AdMetrics(
            client_id=user.client_id,
            metric_date=d,
            campaign_id=cid,
            campaign_name=cname,
            grain_type="campaign",
            report_type="spCampaigns",
            impressions=random.randint(1000, 10000),
            clicks=random.randint(50, 500),
            cost=cost,
            sales_14d=sales,
            acos_clicks_14d=round((cost / sales) * 100, 2),
            roas_clicks_14d=round(sales / cost, 2),
        ))
        rows += 1
db.commit()
print(f"{rows} metric rows seeded.")
print()
print("=== DONE ===")
print("Login at http://localhost:5173")
print("  Email:    demo@glancefive.com")
print("  Password: Demo123!")
