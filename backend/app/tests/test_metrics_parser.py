"""Unit tests for metrics_parser — no Amazon API calls needed."""
from datetime import date

from app.services.metrics_parser import parse_row, parse_records, GRAIN_TYPE


def _sp_campaign_row():
    return {
        "date": "2024-01-15",
        "campaignId": 123456789012345,
        "campaignName": "Test Campaign",
        "campaignStatus": "ENABLED",
        "campaignBudgetAmount": 100.0,
        "campaignBudgetCurrencyCode": "GBP",
        "campaignBudgetType": "DAILY",
        "impressions": 5000,
        "clicks": 100,
        "cost": 45.50,
        "sales14d": 220.00,
        "purchases14d": 5,
        "unitsSoldClicks14d": 5,
        "costPerClick": 0.455,
        "clickThroughRate": 0.02,
        "acosClicks14d": 0.2068,
        "roasClicks14d": 4.84,
        "retailer": "AMAZON",
    }


def _sp_targeting_row():
    return {
        "date": "2024-01-15",
        "campaignId": 123456789012345,
        "adGroupId": 987654321098765,
        "keywordId": 111222333444555,
        "keyword": "running shoes",
        "keywordType": "BROAD",
        "matchType": "BROAD",
        "impressions": 1000,
        "clicks": 20,
        "cost": 8.00,
        "sales14d": 60.00,
        "purchases14d": 2,
        "unitsSoldClicks14d": 2,
        "acosClicks14d": 0.1333,
        "roasClicks14d": 7.5,
    }


def _sb_search_term_row():
    return {
        "date": "2024-01-15",
        "campaignId": 111111111111111,
        "adGroupId": 222222222222222,
        "keywordId": 333333333333333,
        "keywordText": "brand keyword",
        "keywordType": "EXACT",
        "searchTerm": "brand keyword exact",
        "impressions": 500,
        "clicks": 10,
        "cost": 3.50,
        "sales": 40.00,
        "purchases": 1,
        "unitsSold": 1,
    }


# ── Grain type tests ────────────────────────────────────────────────────────

def test_grain_type_mapping():
    assert GRAIN_TYPE["spCampaigns"] == "campaign"
    assert GRAIN_TYPE["spTargeting"] == "targeting"
    assert GRAIN_TYPE["sbTargeting"] == "targeting"
    assert GRAIN_TYPE["sdTargeting"] == "targeting"
    assert GRAIN_TYPE["spSearchTerm"] == "search_term"
    assert GRAIN_TYPE["sbSearchTerm"] == "search_term"
    assert GRAIN_TYPE["spProductAds"] == "product_ad"
    assert GRAIN_TYPE["sdAdvertising"] == "product_ad"


# ── parse_row tests ─────────────────────────────────────────────────────────

def test_parse_row_sp_campaign():
    rec = parse_row(_sp_campaign_row(), client_id=1, report_type="spCampaigns")
    assert rec is not None
    assert rec["client_id"] == 1
    assert rec["report_type"] == "spCampaigns"
    assert rec["grain_type"] == "campaign"
    assert rec["metric_date"] == date(2024, 1, 15)
    assert rec["campaign_id"] == 123456789012345
    assert isinstance(rec["campaign_id"], int)
    assert rec["impressions"] == 5000
    assert rec["clicks"] == 100
    assert float(rec["cost"]) == 45.50
    assert float(rec["sales_14d"]) == 220.00
    assert rec["purchases_14d"] == 5


def test_parse_row_sp_targeting():
    rec = parse_row(_sp_targeting_row(), client_id=2, report_type="spTargeting")
    assert rec is not None
    assert rec["grain_type"] == "targeting"
    assert rec["keyword_id"] == 111222333444555
    assert rec["keyword"] == "running shoes"
    assert "keyword_text" not in rec or rec.get("keyword_text") is None


def test_parse_row_sb_search_term():
    rec = parse_row(_sb_search_term_row(), client_id=3, report_type="sbSearchTerm")
    assert rec is not None
    assert rec["grain_type"] == "search_term"
    assert rec["keyword_text"] == "brand keyword"
    assert rec["search_term"] == "brand keyword exact"
    assert rec["sales"] == 40.00
    # SP windowed fields should not be present
    assert rec.get("sales_14d") is None


def test_parse_row_missing_date_returns_none():
    row = {"campaignId": 123, "impressions": 100}
    assert parse_row(row, client_id=1, report_type="spCampaigns") is None


def test_parse_row_nullable_metrics_when_zero_activity():
    row = {
        "date": "2024-01-15",
        "campaignId": 999,
        "impressions": 100,
        "clicks": 0,
        "cost": 0.0,
        # Amazon returns null for ACOS/ROAS when no sales
    }
    rec = parse_row(row, client_id=1, report_type="spCampaigns")
    assert rec is not None
    assert rec.get("acos_clicks_14d") is None
    assert rec.get("roas_clicks_14d") is None


def test_parse_row_bigint_ids_are_ints():
    row = {
        "date": "2024-01-15",
        "campaignId": "123456789012345",  # Amazon sometimes returns as string
        "impressions": 10,
        "clicks": 1,
        "cost": 0.5,
    }
    rec = parse_row(row, client_id=1, report_type="spCampaigns")
    assert rec is not None
    assert isinstance(rec["campaign_id"], int)


# ── parse_records tests ─────────────────────────────────────────────────────

def test_parse_records_filters_invalid():
    rows = [
        _sp_campaign_row(),
        {"no_date": True},  # invalid — no date
        _sp_campaign_row(),
    ]
    records = parse_records(rows, client_id=1, report_type="spCampaigns")
    assert len(records) == 2


def test_parse_records_empty_list():
    assert parse_records([], client_id=1, report_type="spCampaigns") == []


def test_spend_alias_maps_to_cost():
    row = {
        "date": "2024-01-15",
        "campaignId": 1,
        "impressions": 100,
        "clicks": 5,
        "spend": 2.50,  # 'spend' is alias for 'cost' in some report types
    }
    rec = parse_row(row, client_id=1, report_type="spCampaigns")
    assert rec is not None
    assert float(rec["cost"]) == 2.50
