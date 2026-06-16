from app.dependencies import get_db
from app.models import User, Client, SubscriptionTier, AdMetrics
from datetime import date, timedelta
import random

db = next(get_db())

user = db.query(User).first()
print('User:', user.email, '| current client_id:', user.client_id)

tier = db.query(SubscriptionTier).first()
print('Tier:', tier.name)

if not user.client_id:
    client = Client(name='My Amazon Store', subscription_tier_id=tier.id, is_active=True)
    db.add(client)
    db.commit()
    db.refresh(client)
    user.client_id = client.id
    db.commit()
    print('Client created, id:', client.id)
else:
    client = db.query(Client).filter(Client.id == user.client_id).first()
    print('Using existing client id:', client.id)

random.seed(42)
campaigns = [
    (111111111, 'Sponsored - Brand Awareness'),
    (222222222, 'Retargeting - High Intent'),
    (333333333, 'Competitor Keywords'),
]

for i in range(30):
    d = date.today() - timedelta(days=i)
    for cid, cname in campaigns:
        cost = round(random.uniform(20, 200), 2)
        sales = round(random.uniform(100, 1000), 2)
        clicks = random.randint(50, 500)
        impressions = random.randint(1000, 10000)
        db.add(AdMetrics(
            client_id=client.id,
            metric_date=d,
            campaign_id=cid,
            campaign_name=cname,
            grain_type='campaign',
            report_type='spCampaigns',
            impressions=impressions,
            clicks=clicks,
            cost=cost,
            sales_14d=sales,
            acos_clicks_14d=round((cost / sales) * 100, 2) if sales else None,
            roas_clicks_14d=round(sales / cost, 2) if cost else None,
        ))

db.commit()
print('90 rows seeded across 30 days and 3 campaigns.')
print('Sign out and sign back in at http://localhost:5173')
