"""Fresh DB setup + demo data in one shot."""
import subprocess, sys, os

# Re-run migrations
print("Running migrations...")
result = subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], capture_output=True, text=True)
print(result.stdout or result.stderr)

# Import after migrations so tables exist
from app.dependencies import get_db
from app.models import User, Client, SubscriptionTier, AdMetrics
from app.security.password import hash_password
from datetime import date, timedelta
import random

db = next(get_db())

# Seed tiers
tiers_data = [
    dict(name="Free",         price_monthly=0,    max_clients=1,  max_users_per_client=3,  report_fetch_freq=1440, export_limit_monthly=10,  api_access=False),
    dict(name="Starter",      price_monthly=49,   max_clients=5,  max_users_per_client=5,  report_fetch_freq=360,  export_limit_monthly=100, api_access=False),
    dict(name="Professional", price_monthly=149,  max_clients=20, max_users_per_client=10, report_fetch_freq=60,   export_limit_monthly=500, api_access=True),
    dict(name="Enterprise",   price_monthly=499,  max_clients=0,  max_users_per_client=0,  report_fetch_freq=15,   export_limit_monthly=0,   api_access=True),
]
for t in tiers_data:
    if not db.query(SubscriptionTier).filter(SubscriptionTier.name == t["name"]).first():
        db.add(SubscriptionTier(**t))
db.commit()
print("Tiers seeded.")

tier = db.query(SubscriptionTier).first()

# Create demo user
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
    print(f"User created: demo@glancefive.com / Demo123!  (client_id={user.client_id})")
else:
    client = db.query(Client).filter(Client.id == user.client_id).first()
    print(f"User already exists, client_id={user.client_id}")

# Seed 30 days of fake metrics
random.seed(42)
campaigns = [
    (111111111, "Sponsored - Brand Awareness"),
    (222222222, "Retargeting - High Intent"),
    (333333333, "Competitor Keywords"),
]
for i in range(30):
    d = date.today() - timedelta(days=i)
    for cid, cname in campaigns:
        cost  = round(random.uniform(20, 200), 2)
        sales = round(random.uniform(100, 1000), 2)
        clicks = random.randint(50, 500)
        impr   = random.randint(1000, 10000)
        db.add(AdMetrics(
            client_id=user.client_id,
            metric_date=d,
            campaign_id=cid,
            campaign_name=cname,
            grain_type="campaign",
            report_type="spCampaigns",
            impressions=impr,
            clicks=clicks,
            cost=cost,
            sales_14d=sales,
            acos_clicks_14d=round((cost / sales) * 100, 2) if sales else None,
            roas_clicks_14d=round(sales / cost, 2) if cost else None,
        ))
db.commit()
print("90 metric rows seeded across 30 days.")
print()
print("=== DONE ===")
print("Login at http://localhost:5173 with:")
print("  Email:    demo@glancefive.com")
print("  Password: Demo123!")
