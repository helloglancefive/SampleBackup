"""
Route Amazon Ads API rows to the correct reporting table and perform UPSERT.

Each report_type maps to one analytics table plus an optional campaigns_master upsert.
Sales/orders fields are normalized across SP (windowed, e.g. sales14d) and SB/SD (non-windowed, e.g. sales).
"""
import json
import logging
from datetime import date as date_type, datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.reporting import (
    AmazonAdsRawReport,
    CampaignsMaster,
    CampaignDailyMetrics,
    ProductAdsDaily,
    SearchTermDaily,
    TargetingDaily,
    PlacementDaily,
    PurchasedProductDaily,
    InvalidTrafficDaily,
)

logger = logging.getLogger(__name__)

# ── adProduct per report_type ──────────────────────────────────────────────────
_AD_PRODUCT: dict[str, str] = {
    "spCampaigns":         "SPONSORED_PRODUCTS",
    "spCampaignPlacement": "SPONSORED_PRODUCTS",
    "spTargeting":         "SPONSORED_PRODUCTS",
    "spSearchTerm":        "SPONSORED_PRODUCTS",
    "spProductAds":        "SPONSORED_PRODUCTS",
    "spPurchasedProduct":  "SPONSORED_PRODUCTS",
    "spGrossAndInvalids":  "SPONSORED_PRODUCTS",
    "sbCampaigns":         "SPONSORED_BRANDS",
    "sbCampaignPlacement": "SPONSORED_BRANDS",
    "sbTargeting":         "SPONSORED_BRANDS",
    "sbSearchTerm":        "SPONSORED_BRANDS",
    "sbGrossAndInvalids":  "SPONSORED_BRANDS",
    "sdCampaigns":         "SPONSORED_DISPLAY",
    "sdMatchedTarget":     "SPONSORED_DISPLAY",
    "sdAdvertising":       "SPONSORED_DISPLAY",
    "sdTargeting":         "SPONSORED_DISPLAY",
    "sdPurchasedProduct":  "SPONSORED_DISPLAY",
    "sdGrossAndInvalids":  "SPONSORED_DISPLAY",
}

# ── Helpers ────────────────────────────────────────────────────────────────────

def _int(v) -> Optional[int]:
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _dec(v) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _str(v, maxlen: int = None) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    if maxlen:
        s = s[:maxlen]
    return s or None


def _date(v) -> Optional[date_type]:
    if not v:
        return None
    try:
        return date_type.fromisoformat(str(v))
    except ValueError:
        return None


def _sales(row: dict, report_type: str) -> Optional[float]:
    """Normalize sales: SP uses windowed sales14d, SB/SD use non-windowed sales."""
    if report_type.startswith("sp"):
        return _dec(row.get("sales14d"))
    return _dec(row.get("sales"))


def _orders(row: dict, report_type: str) -> Optional[int]:
    """Normalize orders: SP uses purchases14d, SB/SD use purchases."""
    if report_type.startswith("sp"):
        return _int(row.get("purchases14d"))
    return _int(row.get("purchases"))


def _campaign_id(row: dict) -> Optional[int]:
    return _int(row.get("campaignId"))


# ── campaigns_master upsert ────────────────────────────────────────────────────

def _upsert_campaign(db: Session, row: dict, client_id: int, profile_id: str,
                     report_type: str) -> None:
    cid = _campaign_id(row)
    if not cid:
        return
    existing = (
        db.query(CampaignsMaster)
        .filter(CampaignsMaster.client_id == client_id, CampaignsMaster.campaign_id == cid)
        .first()
    )
    if existing:
        existing.campaign_name = _str(row.get("campaignName"), 500) or existing.campaign_name
        existing.status = _str(row.get("campaignStatus"), 50) or existing.status
        existing.daily_budget = _dec(row.get("campaignBudgetAmount")) or existing.daily_budget
        existing.updated_time = datetime.utcnow()
    else:
        db.add(CampaignsMaster(
            campaign_id=cid,
            client_id=client_id,
            profile_id=profile_id,
            campaign_name=_str(row.get("campaignName"), 500),
            campaign_type=_AD_PRODUCT.get(report_type),
            status=_str(row.get("campaignStatus"), 50),
            daily_budget=_dec(row.get("campaignBudgetAmount")),
            created_time=datetime.utcnow(),
            updated_time=datetime.utcnow(),
        ))


# ── Per-table row parsers ──────────────────────────────────────────────────────

def _parse_campaign_daily(row: dict, client_id: int, report_type: str) -> Optional[dict]:
    d = _date(row.get("date"))
    cid = _campaign_id(row)
    if not d or not cid:
        return None
    return {
        "date": d,
        "client_id": client_id,
        "report_type": report_type,
        "campaign_id": cid,
        "campaign_name": _str(row.get("campaignName"), 500),
        "impressions": _int(row.get("impressions")),
        "clicks": _int(row.get("clicks")),
        "spend": _dec(row.get("cost") or row.get("spend")),
        "sales": _sales(row, report_type),
        "orders": _orders(row, report_type),
        "ctr": _dec(row.get("clickThroughRate")),
        "cpc": _dec(row.get("costPerClick")),
        "acos": _dec(row.get("acosClicks14d")),
        "roas": _dec(row.get("roasClicks14d")),
    }


def _parse_product_ads(row: dict, client_id: int, report_type: str) -> Optional[dict]:
    d = _date(row.get("date"))
    cid = _campaign_id(row)
    if not d or not cid:
        return None
    asin = _str(row.get("advertisedAsin") or row.get("promotedAsin"), 20)
    sku = _str(row.get("advertisedSku") or row.get("promotedSku"), 255)
    return {
        "date": d,
        "client_id": client_id,
        "report_type": report_type,
        "campaign_id": cid,
        "ad_group_id": _int(row.get("adGroupId")),
        "asin": asin,
        "sku": sku,
        "impressions": _int(row.get("impressions")),
        "clicks": _int(row.get("clicks")),
        "spend": _dec(row.get("cost") or row.get("spend")),
        "sales": _sales(row, report_type),
        "orders": _orders(row, report_type),
    }


def _parse_search_term(row: dict, client_id: int, report_type: str) -> Optional[dict]:
    d = _date(row.get("date"))
    cid = _campaign_id(row)
    if not d or not cid:
        return None
    keyword = _str(row.get("targeting") or row.get("keywordText"), 500)
    return {
        "date": d,
        "client_id": client_id,
        "report_type": report_type,
        "campaign_id": cid,
        "ad_group_id": _int(row.get("adGroupId")),
        "keyword": keyword,
        "search_term": _str(row.get("searchTerm"), 500),
        "match_type": _str(row.get("matchType"), 50),
        "clicks": _int(row.get("clicks")),
        "spend": _dec(row.get("cost") or row.get("spend")),
        "sales": _sales(row, report_type),
        "orders": _orders(row, report_type),
    }


def _parse_targeting(row: dict, client_id: int, report_type: str) -> Optional[dict]:
    d = _date(row.get("date"))
    cid = _campaign_id(row)
    if not d or not cid:
        return None
    if report_type == "sdMatchedTarget":
        target = _str(row.get("matchedTargetAsin"), 500)
        target_type = "matched_asin"
    else:
        target = _str(
            row.get("targeting") or row.get("targetingText") or row.get("keywordText"), 500
        )
        target_type = _str(row.get("matchType") or row.get("targetingType"), 50)
    return {
        "date": d,
        "client_id": client_id,
        "report_type": report_type,
        "campaign_id": cid,
        "ad_group_id": _int(row.get("adGroupId")),
        "target": target,
        "target_type": target_type,
        "bid": _dec(row.get("keywordBid")),
        "impressions": _int(row.get("impressions")),
        "clicks": _int(row.get("clicks")),
        "spend": _dec(row.get("cost") or row.get("spend")),
        "sales": _sales(row, report_type),
        "orders": _orders(row, report_type),
    }


def _parse_placement(row: dict, client_id: int, report_type: str) -> Optional[dict]:
    d = _date(row.get("date"))
    cid = _campaign_id(row)
    if not d or not cid:
        return None
    return {
        "date": d,
        "client_id": client_id,
        "report_type": report_type,
        "campaign_id": cid,
        "placement": _str(row.get("placementClassification"), 100),
        "impressions": _int(row.get("impressions")),
        "clicks": _int(row.get("clicks")),
        "spend": _dec(row.get("cost") or row.get("spend")),
        "sales": _sales(row, report_type),
        "orders": _orders(row, report_type),
    }


def _parse_purchased_product(row: dict, client_id: int, report_type: str) -> Optional[dict]:
    d = _date(row.get("date"))
    cid = _campaign_id(row)
    if not d or not cid:
        return None
    # SP: purchasedAsin, sales14d, purchases14d, unitsSoldClicks14d
    # SD: asinBrandHalo, salesBrandHalo, conversionsBrandHalo, unitsSoldBrandHalo
    if report_type == "spPurchasedProduct":
        purchased_asin = _str(row.get("purchasedAsin"), 20)
        sales = _dec(row.get("sales14d"))
        orders = _int(row.get("purchases14d"))
        units = _int(row.get("unitsSoldClicks14d"))
    else:  # sdPurchasedProduct
        purchased_asin = _str(row.get("asinBrandHalo"), 20)
        sales = _dec(row.get("salesBrandHalo"))
        orders = _int(row.get("conversionsBrandHalo"))
        units = _int(row.get("unitsSoldBrandHalo"))
    return {
        "date": d,
        "client_id": client_id,
        "report_type": report_type,
        "campaign_id": cid,
        "purchased_asin": purchased_asin,
        "sales": sales,
        "orders": orders,
        "units": units,
    }


def _parse_invalid_traffic(row: dict, client_id: int, report_type: str) -> Optional[dict]:
    d = _date(row.get("date"))
    cid = _campaign_id(row)
    if not d or not cid:
        return None
    return {
        "date": d,
        "client_id": client_id,
        "report_type": report_type,
        "campaign_id": cid,
        "invalid_clicks": _int(row.get("invalidClickThroughs")),
        "invalid_impressions": _int(row.get("invalidImpressions")),
        "invalid_spend": None,  # Amazon API does not return this field
    }


# ── Routing table ──────────────────────────────────────────────────────────────

_CAMPAIGNS_LEVEL = {"spCampaigns", "sbCampaigns", "sdCampaigns"}
_PLACEMENT_LEVEL = {"spCampaignPlacement", "sbCampaignPlacement"}
_TARGETING_LEVEL = {"spTargeting", "sbTargeting", "sdTargeting", "sdMatchedTarget"}
_SEARCH_TERM_LEVEL = {"spSearchTerm", "sbSearchTerm"}
_PRODUCT_ADS_LEVEL = {"spProductAds", "sdAdvertising"}
_PURCHASED_PRODUCT_LEVEL = {"spPurchasedProduct", "sdPurchasedProduct"}
_INVALID_TRAFFIC_LEVEL = {"spGrossAndInvalids", "sbGrossAndInvalids", "sdGrossAndInvalids"}

# report_types that produce a campaigns_master side-effect
_HAS_CAMPAIGN_DIMENSION = (
    _CAMPAIGNS_LEVEL | _PLACEMENT_LEVEL | _TARGETING_LEVEL
    | _SEARCH_TERM_LEVEL | _PRODUCT_ADS_LEVEL | _INVALID_TRAFFIC_LEVEL
)


def _find_existing(db: Session, model, filters: dict):
    q = db.query(model)
    for col, val in filters.items():
        q = q.filter(getattr(model, col) == val)
    return q.first()


def _upsert_row(db: Session, model, rec: dict, unique_keys: list[str]) -> None:
    filters = {k: rec[k] for k in unique_keys}
    existing = _find_existing(db, model, filters)
    if existing:
        for col, val in rec.items():
            if col not in unique_keys:
                setattr(existing, col, val)
    else:
        db.add(model(**rec))


# ── Public API ─────────────────────────────────────────────────────────────────

def save_raw(
    db: Session,
    client_id: int,
    profile_id: str,
    report_type: str,
    start_date: str,
    rows: list,
    status: str = "processed",
) -> None:
    """Persist raw API rows as JSON to amazon_ads_raw_reports."""
    try:
        raw_date = date_type.fromisoformat(start_date)
    except ValueError:
        raw_date = datetime.utcnow().date()

    db.add(AmazonAdsRawReport(
        client_id=client_id,
        profile_id=profile_id,
        report_type=report_type,
        report_date=raw_date,
        raw_data=json.dumps(rows),
        download_time=datetime.utcnow(),
        processing_status=status,
    ))
    db.flush()


def store_report(
    db: Session,
    rows: list,
    client_id: int,
    profile_id: str,
    report_type: str,
) -> int:
    """Parse rows and upsert into the correct analytics table(s). Returns count stored."""
    stored = 0
    # Batch-level dedup sets — prevent duplicate INSERTs within a single store_report() call.
    # Keys are tuples of the unique constraint columns for each table.
    seen_campaigns: set[int] = set()
    seen_keys: set[tuple] = set()

    for i, row in enumerate(rows):
        # ── campaigns_master side-effect (once per unique campaign per call) ──
        if report_type in _HAS_CAMPAIGN_DIMENSION:
            cid = _campaign_id(row)
            if cid and cid not in seen_campaigns:
                _upsert_campaign(db, row, client_id, profile_id, report_type)
                db.flush()
                seen_campaigns.add(cid)

        # ── route to analytics table ──────────────────────────────────────────
        if report_type in _CAMPAIGNS_LEVEL:
            rec = _parse_campaign_daily(row, client_id, report_type)
            if rec:
                uk = ("date", "client_id", "report_type", "campaign_id")
                key = tuple(rec[k] for k in uk)
                if key not in seen_keys:
                    _upsert_row(db, CampaignDailyMetrics, rec, list(uk))
                    seen_keys.add(key)
                    stored += 1

        elif report_type in _PLACEMENT_LEVEL:
            rec = _parse_placement(row, client_id, report_type)
            if rec:
                uk = ("date", "client_id", "report_type", "campaign_id", "placement")
                key = tuple(rec.get(k) for k in uk)
                if key not in seen_keys:
                    _upsert_row(db, PlacementDaily, rec, list(uk))
                    seen_keys.add(key)
                    stored += 1

        elif report_type in _TARGETING_LEVEL:
            rec = _parse_targeting(row, client_id, report_type)
            if rec:
                uk = ("date", "client_id", "report_type", "campaign_id", "ad_group_id", "target")
                key = tuple(rec.get(k) for k in uk)
                if key not in seen_keys:
                    _upsert_row(db, TargetingDaily, rec, list(uk))
                    seen_keys.add(key)
                    stored += 1

        elif report_type in _SEARCH_TERM_LEVEL:
            rec = _parse_search_term(row, client_id, report_type)
            if rec:
                uk = ("date", "client_id", "report_type", "campaign_id", "ad_group_id", "keyword", "search_term")
                key = tuple(rec.get(k) for k in uk)
                if key not in seen_keys:
                    _upsert_row(db, SearchTermDaily, rec, list(uk))
                    seen_keys.add(key)
                    stored += 1

        elif report_type in _PRODUCT_ADS_LEVEL:
            rec = _parse_product_ads(row, client_id, report_type)
            if rec:
                uk = ("date", "client_id", "report_type", "campaign_id", "ad_group_id", "asin")
                key = tuple(rec.get(k) for k in uk)
                if key not in seen_keys:
                    _upsert_row(db, ProductAdsDaily, rec, list(uk))
                    seen_keys.add(key)
                    stored += 1

        elif report_type in _PURCHASED_PRODUCT_LEVEL:
            rec = _parse_purchased_product(row, client_id, report_type)
            if rec:
                uk = ("date", "client_id", "report_type", "campaign_id", "purchased_asin")
                key = tuple(rec.get(k) for k in uk)
                if key not in seen_keys:
                    _upsert_row(db, PurchasedProductDaily, rec, list(uk))
                    seen_keys.add(key)
                    stored += 1

        elif report_type in _INVALID_TRAFFIC_LEVEL:
            rec = _parse_invalid_traffic(row, client_id, report_type)
            if rec:
                uk = ("date", "client_id", "report_type", "campaign_id")
                key = tuple(rec.get(k) for k in uk)
                if key not in seen_keys:
                    _upsert_row(db, InvalidTrafficDaily, rec, list(uk))
                    seen_keys.add(key)
                    stored += 1

        else:
            logger.warning("store_report: unknown report_type=%s, row skipped", report_type)

        if i % 500 == 0:
            db.flush()

    db.commit()
    return stored
