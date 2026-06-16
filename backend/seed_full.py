"""
Full demo seed — populates all 4 grain types needed by the dashboard:
  campaign, targeting, search_term, product_ad
Deletes existing ad_metrics for client 1, then re-seeds 30 days of data.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

import random
from datetime import date, timedelta
from app.dependencies import get_db
from app.models import User, Client, AdMetrics

random.seed(99)

db = next(get_db())

user = db.query(User).first()
client = db.query(Client).filter(Client.id == user.client_id).first()
CID = client.id
print(f"Seeding for client_id={CID} ({user.email})")

# ── Wipe existing ad_metrics for this client ─────────────────────────────────
deleted = db.query(AdMetrics).filter(AdMetrics.client_id == CID).delete()
db.commit()
print(f"Deleted {deleted} existing rows")

TODAY = date.today()
DAYS = 30
rows = []

# ─────────────────────────────────────────────────────────────────────────────
# CAMPAIGNS  (grain_type='campaign', report_type='spCampaigns')
# ─────────────────────────────────────────────────────────────────────────────
CAMPAIGNS = [
    dict(campaign_id=111111111, campaign_name="SP | Electronics | Exact Match",
         campaign_status="enabled", budget=1500.0, acos_base=0.18, roas_base=5.5),
    dict(campaign_id=222222222, campaign_name="SP | Electronics | Broad Match",
         campaign_status="enabled", budget=800.0,  acos_base=0.28, roas_base=3.6),
    dict(campaign_id=333333333, campaign_name="SP | Brand Awareness | Auto",
         campaign_status="enabled", budget=600.0,  acos_base=0.35, roas_base=2.9),
    dict(campaign_id=444444444, campaign_name="SP | Competitor Targeting",
         campaign_status="enabled", budget=500.0,  acos_base=0.22, roas_base=4.5),
]

for i in range(DAYS):
    d = TODAY - timedelta(days=i)
    dow = d.weekday()            # 0=Mon … 6=Sun
    mult = 1.3 if dow >= 5 else 1.0  # weekends +30%
    for c in CAMPAIGNS:
        spend = round(random.uniform(c["budget"] * 0.55, c["budget"] * 0.95) * mult, 2)
        sales = round(spend / c["acos_base"] * random.uniform(0.88, 1.12), 2)
        impressions = int(spend * random.uniform(55, 90))
        clicks = int(impressions * random.uniform(0.006, 0.015))
        purchases = max(1, int(clicks * random.uniform(0.10, 0.22)))
        units = max(purchases, int(purchases * random.uniform(1.0, 1.6)))
        rows.append(AdMetrics(
            client_id=CID, metric_date=d,
            grain_type="campaign", report_type="spCampaigns",
            campaign_id=c["campaign_id"], campaign_name=c["campaign_name"],
            campaign_status=c["campaign_status"],
            campaign_budget_amount=c["budget"], campaign_budget_type="daily",
            impressions=impressions, clicks=clicks, cost=spend,
            sales_14d=sales, purchases_14d=purchases, units_sold_clicks_14d=units,
            acos_clicks_14d=round((spend / sales) * 100, 2),
            roas_clicks_14d=round(sales / spend, 2),
            top_of_search_impression_share=round(random.uniform(0.15, 0.65), 3),
        ))

# ─────────────────────────────────────────────────────────────────────────────
# KEYWORDS  (grain_type='targeting', report_type='spTargeting')
# ─────────────────────────────────────────────────────────────────────────────
KEYWORDS = [
    # (keyword_text, match_type, campaign_id, bid, avg_acos)
    ("bluetooth speaker",        "exact",  111111111, 18.0, 0.16),
    ("bluetooth speaker",        "phrase", 111111111, 14.0, 0.21),
    ("wireless earphones",       "exact",  111111111, 22.0, 0.14),
    ("wireless earphones",       "phrase", 111111111, 16.0, 0.19),
    ("noise cancelling headphone","exact", 111111111, 25.0, 0.13),
    ("tws earbuds",              "exact",  111111111, 20.0, 0.17),
    ("best bluetooth speaker",   "broad",  222222222,  9.0, 0.29),
    ("portable speaker",         "broad",  222222222,  8.0, 0.31),
    ("earphones under 1000",     "broad",  222222222,  7.0, 0.34),
    ("gaming headset",           "phrase", 222222222, 12.0, 0.26),
    ("sony earphones",           "phrase", 333333333, 10.0, 0.38),
    ("boat rockerz",             "phrase", 333333333,  9.5, 0.41),
    ("jbl speaker",              "phrase", 444444444, 15.0, 0.24),
    ("wireless headphones",      "exact",  444444444, 19.0, 0.20),
    ("type c earphones",         "exact",  444444444, 13.0, 0.23),
]

for i in range(DAYS):
    d = TODAY - timedelta(days=i)
    for kw in KEYWORDS:
        ktext, mtype, camp_id, bid, acos = kw
        camp_name = next(c["campaign_name"] for c in CAMPAIGNS if c["campaign_id"] == camp_id)
        spend = round(bid * random.uniform(0.4, 1.8) * random.uniform(0.8, 1.2), 2)
        sales = round(spend / acos * random.uniform(0.85, 1.15), 2) if spend > 0.5 else 0.0
        impressions = int(spend * random.uniform(60, 120))
        clicks = int(impressions * random.uniform(0.005, 0.015))
        purchases = int(clicks * random.uniform(0.08, 0.20))
        units = int(purchases * random.uniform(1.0, 1.5))
        rows.append(AdMetrics(
            client_id=CID, metric_date=d,
            grain_type="targeting", report_type="spTargeting",
            campaign_id=camp_id, campaign_name=camp_name,
            keyword=ktext, keyword_text=ktext, match_type=mtype,
            keyword_bid=bid,
            impressions=impressions, clicks=clicks, cost=spend,
            sales_14d=sales, purchases_14d=purchases, units_sold_clicks_14d=units,
            acos_clicks_14d=round((spend / sales) * 100, 2) if sales else None,
            roas_clicks_14d=round(sales / spend, 2) if spend else None,
        ))

# Also add a few product-targeting rows (ASIN targeting)
PRODUCT_TARGETS = [
    ("B09X7FVGSM", "targeting_expression",            444444444, 0.22),
    ("B08N5WRWNW", "targeting_expression",            444444444, 0.25),
    ("B07PFFMP9L", "targeting_expression_predefined", 444444444, 0.30),
    ("electronics:headphones", "targeting_expression_predefined", 333333333, 0.35),
]

for i in range(DAYS):
    d = TODAY - timedelta(days=i)
    for tgt_asin, mtype, camp_id, acos in PRODUCT_TARGETS:
        camp_name = next(c["campaign_name"] for c in CAMPAIGNS if c["campaign_id"] == camp_id)
        spend = round(random.uniform(5, 40), 2)
        sales = round(spend / acos * random.uniform(0.85, 1.15), 2)
        impressions = int(spend * random.uniform(40, 80))
        clicks = int(impressions * random.uniform(0.004, 0.010))
        purchases = int(clicks * random.uniform(0.08, 0.18))
        units = purchases
        rows.append(AdMetrics(
            client_id=CID, metric_date=d,
            grain_type="targeting", report_type="spTargeting",
            campaign_id=camp_id, campaign_name=camp_name,
            keyword=None, match_type=mtype,
            targeting_text=tgt_asin, targeting_expression=tgt_asin,
            impressions=impressions, clicks=clicks, cost=spend,
            sales_14d=sales, purchases_14d=purchases, units_sold_clicks_14d=units,
        ))

# ─────────────────────────────────────────────────────────────────────────────
# SEARCH TERMS  (grain_type='search_term', report_type='spSearchTerm')
# ─────────────────────────────────────────────────────────────────────────────
SEARCH_TERMS = [
    # (search_term, keyword, match_type, campaign_id, acos)
    ("bluetooth speaker",                "bluetooth speaker",        "exact",  111111111, 0.15),
    ("best bluetooth speaker 2024",      "bluetooth speaker",        "phrase", 111111111, 0.19),
    ("bluetooth speaker under 1500",     "bluetooth speaker",        "phrase", 111111111, 0.23),
    ("wireless earphones",               "wireless earphones",       "exact",  111111111, 0.13),
    ("wireless earphones for mobile",    "wireless earphones",       "phrase", 111111111, 0.18),
    ("earphones with mic",               "wireless earphones",       "broad",  222222222, 0.26),
    ("noise cancelling headphone",       "noise cancelling headphone","exact", 111111111, 0.12),
    ("anc headphone india",              "noise cancelling headphone","broad", 222222222, 0.28),
    ("tws earbuds",                      "tws earbuds",              "exact",  111111111, 0.16),
    ("true wireless earbuds under 2000", "tws earbuds",              "broad",  222222222, 0.30),
    ("gaming headset pc",                "gaming headset",           "phrase", 222222222, 0.24),
    ("boat earphones",                   "boat rockerz",             "phrase", 333333333, 0.42),
    ("sony wf 1000xm4",                  "sony earphones",           "phrase", 333333333, 0.36),
    ("jbl bluetooth speaker",            "jbl speaker",              "phrase", 444444444, 0.22),
    ("wireless headphone with mic",      "wireless headphones",      "exact",  444444444, 0.19),
    ("type c wired earphones",           "type c earphones",         "exact",  444444444, 0.20),
    ("portable bluetooth speaker waterproof", "portable speaker",    "broad",  222222222, 0.33),
    ("cheap bluetooth earphones",        "earphones under 1000",     "broad",  222222222, 0.38),
    ("in ear headphones",                "wireless earphones",       "broad",  222222222, 0.29),
    ("neckband bluetooth",               "wireless headphones",      "broad",  222222222, 0.25),
]

for i in range(DAYS):
    d = TODAY - timedelta(days=i)
    for st in SEARCH_TERMS:
        sterm, kw, mtype, camp_id, acos = st
        camp_name = next(c["campaign_name"] for c in CAMPAIGNS if c["campaign_id"] == camp_id)
        spend = round(random.uniform(2, 45), 2)
        sales = round(spend / acos * random.uniform(0.80, 1.20), 2)
        impressions = int(spend * random.uniform(50, 100))
        clicks = int(impressions * random.uniform(0.004, 0.018))
        purchases = int(clicks * random.uniform(0.07, 0.22))
        units = int(purchases * random.uniform(1, 1.5))
        rows.append(AdMetrics(
            client_id=CID, metric_date=d,
            grain_type="search_term", report_type="spSearchTerm",
            campaign_id=camp_id, campaign_name=camp_name,
            keyword=kw, keyword_text=kw, match_type=mtype,
            search_term=sterm,
            impressions=impressions, clicks=clicks, cost=spend,
            sales_14d=sales, purchases_14d=purchases, units_sold_clicks_14d=units,
        ))

# ─────────────────────────────────────────────────────────────────────────────
# PRODUCT ADS  (grain_type='product_ad', report_type='spProductAds')
# ─────────────────────────────────────────────────────────────────────────────
PRODUCTS = [
    # (asin, sku, camp_id, price, daily_units_min, daily_units_max, acos)
    dict(asin="B09X7FVGSM", sku="BTH-SPK-001", camp_id=111111111, price=1299, umin=3, umax=9,  acos=0.16),
    dict(asin="B08N5WRWNW", sku="EAR-WL-002",  camp_id=111111111, price=999,  umin=5, umax=14, acos=0.14),
    dict(asin="B07PFFMP9L", sku="EAR-TWS-003", camp_id=222222222, price=1499, umin=2, umax=7,  acos=0.20),
    dict(asin="B0B8P3VXKK", sku="HPH-NC-004",  camp_id=111111111, price=2499, umin=1, umax=4,  acos=0.13),
    dict(asin="B0BDF5QLNX", sku="SPK-PT-005",  camp_id=222222222, price=799,  umin=3, umax=10, acos=0.25),
    dict(asin="B09WX3YQ5R", sku="EAR-GM-006",  camp_id=333333333, price=1799, umin=1, umax=4,  acos=0.32),
    dict(asin="B0BVZQ1K2M", sku="HPH-NB-007",  camp_id=444444444, price=1199, umin=2, umax=6,  acos=0.21),
    dict(asin="B0C1FMXKTR", sku="EAR-TC-008",  camp_id=444444444, price=599,  umin=4, umax=12, acos=0.23),
]

for i in range(DAYS):
    d = TODAY - timedelta(days=i)
    dow = (TODAY - timedelta(days=i)).weekday()
    for p in PRODUCTS:
        camp_name = next(c["campaign_name"] for c in CAMPAIGNS if c["campaign_id"] == p["camp_id"])
        wk_mult = 1.3 if dow >= 5 else 1.0
        units = max(1, int(random.randint(p["umin"], p["umax"]) * wk_mult))
        sales = round(units * p["price"] * random.uniform(0.97, 1.03), 2)
        spend = round(sales * p["acos"] * random.uniform(0.90, 1.10), 2)
        impressions = int(spend * random.uniform(45, 95))
        clicks = int(impressions * random.uniform(0.006, 0.022))
        purchases = max(1, int(units * random.uniform(0.90, 1.0)))
        rows.append(AdMetrics(
            client_id=CID, metric_date=d,
            grain_type="product_ad", report_type="spProductAds",
            campaign_id=p["camp_id"], campaign_name=camp_name,
            advertised_asin=p["asin"], advertised_sku=p["sku"],
            impressions=impressions, clicks=clicks, cost=spend,
            sales_14d=sales, purchases_14d=purchases, units_sold_clicks_14d=units,
            acos_clicks_14d=round((spend / sales) * 100, 2) if sales else None,
            roas_clicks_14d=round(sales / spend, 2) if spend else None,
        ))

# ─────────────────────────────────────────────────────────────────────────────
db.bulk_save_objects(rows)
db.commit()

print(f"\nSeeded {len(rows)} rows across all grain types:")
by_grain = {}
for r in rows:
    by_grain[r.grain_type] = by_grain.get(r.grain_type, 0) + 1
for g, cnt in sorted(by_grain.items()):
    print(f"  {g}: {cnt}")
print(f"\n✓ Done. Refresh the dashboard at http://localhost:5173")
