"""Map Amazon Advertising API JSON fields → AdMetrics column names."""
from datetime import date
from typing import Optional

# Grain type per report type key used in _REPORT_CONFIGS
GRAIN_TYPE: dict[str, str] = {
    # SP — 7 report types
    "spCampaigns":          "campaign",
    "spCampaignPlacement":  "campaign_placement",
    "spTargeting":          "targeting",
    "spSearchTerm":         "search_term",
    "spProductAds":         "product_ad",        # spAdvertisedProduct groupBy=advertiser
    "spPurchasedProduct":   "purchased_product",
    "spGrossAndInvalids":   "campaign",           # campaign grain; report_type differentiates

    # SB — 5 report types
    "sbCampaigns":          "campaign",
    "sbCampaignPlacement":  "campaign_placement",
    "sbTargeting":          "targeting",
    "sbSearchTerm":         "search_term",
    "sbGrossAndInvalids":   "campaign",

    # SD — 6 report types
    "sdCampaigns":          "campaign",
    "sdMatchedTarget":      "matched_target",
    "sdAdvertising":        "product_ad",         # sdAdvertisedProduct groupBy=advertiser
    "sdTargeting":          "targeting",
    "sdPurchasedProduct":   "purchased_product",
    "sdGrossAndInvalids":   "campaign",
}

# Amazon camelCase field → AdMetrics snake_case column
_FIELD_MAP: dict[str, str] = {
    # ── Campaign ──────────────────────────────────────────────────────────────
    "campaignId":                       "campaign_id",
    "campaignName":                     "campaign_name",
    "campaignStatus":                   "campaign_status",
    "campaignBudgetAmount":             "campaign_budget_amount",
    "campaignBudgetType":               "campaign_budget_type",
    "campaignBudgetCurrencyCode":       "campaign_budget_currency",
    "portfolioId":                      "portfolio_id",
    "campaignBiddingStrategy":          "campaign_bidding_strategy",
    "campaignRuleBasedBudgetAmount":    "campaign_rule_based_budget_amount",
    "campaignApplicableBudgetRuleId":   "campaign_applicable_budget_rule_id",
    "campaignApplicableBudgetRuleName": "campaign_applicable_budget_rule_name",
    "placementClassification":          "placement_classification",
    "longTermSales":                    "long_term_sales",
    "longTermROAS":                     "long_term_roas",

    # ── Ad group ──────────────────────────────────────────────────────────────
    "adGroupId":        "ad_group_id",
    "adGroupName":      "ad_group_name",

    # ── Keyword / Targeting ───────────────────────────────────────────────────
    "keywordId":            "keyword_id",
    "keyword":              "keyword",
    "keywordText":          "keyword_text",
    "keywordType":          "keyword_type",
    "keywordBid":           "keyword_bid",
    "adKeywordStatus":      "ad_keyword_status",
    "matchType":            "match_type",
    "targetingId":          "targeting_id",
    "targetId":             "targeting_id",       # SP Purchased Product uses 'targetId'
    "targeting":            "keyword",            # SP search term / targeting reports use 'targeting'
    "targetingText":        "targeting_text",
    "targetingType":        "targeting_type",
    "targetingExpression":  "targeting_expression",
    "matchedTargetAsin":    "matched_target_asin",

    # ── Search term ───────────────────────────────────────────────────────────
    "searchTerm": "search_term",

    # ── Ad / Product ──────────────────────────────────────────────────────────
    "adId":             "ad_id",
    "adName":           "ad_name",
    "advertisedAsin":   "advertised_asin",
    "advertisedSku":    "advertised_sku",
    "promotedAsin":     "promoted_asin",
    "promotedSku":      "promoted_sku",
    "bidOptimization":  "bid_optimization",
    "purchasedAsin":    "purchased_asin",

    # ── Core metrics ──────────────────────────────────────────────────────────
    "impressions":              "impressions",
    "viewableImpressions":      "viewable_impressions",
    "impressionsViews":         "impressions_views",
    "impressionsFrequencyAverage": "impressions_frequency_avg",
    "clicks":                   "clicks",
    "cost":                     "cost",
    "spend":                    "cost",           # some reports use 'spend' as alias for cost
    "costType":                 "cost_type",
    "costPerClick":             "cost_per_click",
    "clickThroughRate":         "click_through_rate",
    "viewClickThroughRate":     "view_click_through_rate",
    "viewabilityRate":          "viewability_rate",
    "topOfSearchImpressionShare": "top_of_search_impression_share",
    "purchaseClickRate14d":     "purchase_click_rate_14d",

    # ── Gross & Invalid Traffic ───────────────────────────────────────────────
    "grossImpressions":         "gross_impressions",
    "invalidImpressions":       "invalid_impressions",
    "invalidImpressionRate":    "invalid_impression_rate",
    "grossClickThroughs":       "gross_click_throughs",
    "invalidClickThroughs":     "invalid_click_throughs",
    "invalidClickThroughRate":  "invalid_click_through_rate",

    # ── SP windowed sales ─────────────────────────────────────────────────────
    "sales14d":                     "sales_14d",
    "sales1d":                      "sales_1d",
    "sales7d":                      "sales_7d",
    "sales30d":                     "sales_30d",
    "attributedSalesSameSku1d":     "attributed_sales_same_sku_1d",
    "attributedSalesSameSku7d":     "attributed_sales_same_sku_7d",
    "attributedSalesSameSku14d":    "attributed_sales_same_sku_14d",
    "attributedSalesSameSku30d":    "attributed_sales_same_sku_30d",
    "salesOtherSku7d":              "sales_other_sku_7d",
    "salesOtherSku14d":             "sales_other_sku_14d",
    "salesOtherSku1d":              "sales_other_sku_1d",
    "salesOtherSku30d":             "sales_other_sku_30d",

    # ── SB/SD non-windowed sales ──────────────────────────────────────────────
    "sales":                "sales",
    "salesClicks":          "sales_clicks",
    "salesPromoted":        "sales_promoted",
    "salesPromotedClicks":  "sales_promoted_clicks",

    # ── SP windowed purchases ─────────────────────────────────────────────────
    "purchases14d":         "purchases_14d",
    "purchases1d":          "purchases_1d",
    "purchases7d":          "purchases_7d",
    "purchases30d":         "purchases_30d",
    "purchasesSameSku1d":   "purchases_same_sku_1d",
    "purchasesSameSku7d":   "purchases_same_sku_7d",
    "purchasesSameSku14d":  "purchases_same_sku_14d",
    "purchasesSameSku30d":  "purchases_same_sku_30d",
    "purchasesOtherSku1d":  "purchases_other_sku_1d",
    "purchasesOtherSku7d":  "purchases_other_sku_7d",
    "purchasesOtherSku14d": "purchases_other_sku_14d",
    "purchasesOtherSku30d": "purchases_other_sku_30d",

    # ── SB/SD non-windowed purchases ──────────────────────────────────────────
    "purchases":            "purchases",
    "purchasesClicks":      "purchases_clicks",
    "purchasesPromoted":    "purchases_promoted",
    "purchasesPromotedClicks": "purchases_clicks",  # SD alias

    # ── SP windowed units sold ────────────────────────────────────────────────
    "unitsSoldClicks14d":   "units_sold_clicks_14d",
    "unitsSoldClicks1d":    "units_sold_clicks_1d",
    "unitsSoldClicks7d":    "units_sold_clicks_7d",
    "unitsSoldClicks30d":   "units_sold_clicks_30d",
    "unitsSoldSameSku1d":   "units_sold_same_sku_1d",
    "unitsSoldSameSku7d":   "units_sold_same_sku_7d",
    "unitsSoldSameSku14d":  "units_sold_same_sku_14d",
    "unitsSoldSameSku30d":  "units_sold_same_sku_30d",
    "unitsSoldOtherSku7d":  "units_sold_other_sku_7d",
    "unitsSoldOtherSku14d": "units_sold_other_sku_14d",
    "unitsSoldOtherSku1d":  "units_sold_other_sku_1d",
    "unitsSoldOtherSku30d": "units_sold_other_sku_30d",

    # ── SB/SD non-windowed units ──────────────────────────────────────────────
    "unitsSold":        "units_sold",
    "unitsSoldClicks":  "units_sold_clicks",

    # ── ACOS / ROAS ───────────────────────────────────────────────────────────
    "acosClicks7d":     "acos_clicks_7d",
    "acosClicks14d":    "acos_clicks_14d",
    "roasClicks7d":     "roas_clicks_7d",
    "roasClicks14d":    "roas_clicks_14d",

    # ── Funnel ────────────────────────────────────────────────────────────────
    "detailPageViews":          "detail_page_views",
    "detailPageViewsClicks":    "detail_page_views_clicks",
    "addToCart":                "add_to_cart",
    "addToCartClicks":          "add_to_cart_clicks",
    "addToCartViews":           "add_to_cart_views",
    "addToCartRate":            "add_to_cart_rate",
    "eCPAddToCart":             "ecp_add_to_cart",
    "addToList":                "add_to_list",
    "addToListFromClicks":      "add_to_list_from_clicks",
    "addToListFromViews":       "add_to_list_from_views",

    # ── New to brand (SB, SD) ─────────────────────────────────────────────────
    "newToBrandSales":                  "new_to_brand_sales",
    "newToBrandSalesClicks":            "new_to_brand_sales_clicks",
    "newToBrandSalesPercentage":        "new_to_brand_sales_pct",
    "newToBrandPurchases":              "new_to_brand_purchases",
    "newToBrandPurchasesClicks":        "new_to_brand_purchases_clicks",
    "newToBrandPurchasesRate":          "new_to_brand_purchases_rate",
    "newToBrandPurchasesPercentage":    "new_to_brand_purchases_pct",
    "newToBrandUnitsSold":              "new_to_brand_units_sold",
    "newToBrandUnitsSoldClicks":        "new_to_brand_units_sold_clicks",
    "newToBrandUnitsSoldPercentage":    "new_to_brand_units_sold_pct",
    "newToBrandDetailPageViews":        "new_to_brand_dpv",
    "newToBrandDetailPageViewClicks":   "new_to_brand_dpv_clicks",
    "newToBrandDetailPageViewsClicks":  "new_to_brand_dpv_clicks",  # SB alias
    "newToBrandDetailPageViewViews":    "new_to_brand_dpv_views",
    "newToBrandDetailPageViewRate":     "new_to_brand_dpv_rate",
    "newToBrandECPDetailPageView":      "new_to_brand_ecp_dpv",

    # ── Video (SB, SD) ────────────────────────────────────────────────────────
    "video5SecondViews":            "video_5s_views",
    "video5SecondViewRate":         "video_5s_view_rate",
    "videoCompleteViews":           "video_complete_views",
    "videoFirstQuartileViews":      "video_first_quartile_views",
    "videoMidpointViews":           "video_midpoint_views",
    "videoThirdQuartileViews":      "video_third_quartile_views",
    "videoUnmutes":                 "video_unmutes",

    # ── Branded search (SB, SD) ───────────────────────────────────────────────
    "brandedSearches":      "branded_searches",
    "brandedSearchesClicks": "branded_searches_clicks",
    "brandedSearchesViews": "branded_searches_views",
    "brandedSearchRate":    "branded_search_rate",
    "eCPBrandSearch":       "ecp_brand_search",

    # ── SD Brand Halo (SD Purchased Product) ──────────────────────────────────
    "asinBrandHalo":            "asin_brand_halo",
    "salesBrandHalo":           "sales_brand_halo",
    "salesBrandHaloClicks":     "sales_brand_halo_clicks",
    "unitsSoldBrandHalo":       "units_sold_brand_halo",
    "unitsSoldBrandHaloClicks": "units_sold_brand_halo_clicks",
    "conversionsBrandHalo":     "conversions_brand_halo",
    "conversionsBrandHaloClicks": "conversions_brand_halo_clicks",

    # ── SD-specific ───────────────────────────────────────────────────────────
    "cumulativeReach":          "cumulative_reach",
    "leadFormOpens":            "lead_form_opens",
    "leads":                    "leads",
    "linkOuts":                 "link_outs",
    "landingPageURL":           "landing_page_url",

    # ── Kindle / Borrows ─────────────────────────────────────────────────────
    "kindleEditionNormalizedPagesRead14d":       "kindle_pages_read_14d",
    "kindleEditionNormalizedPagesRoyalties14d":  "kindle_pages_royalties_14d",
    "qualifiedBorrows":                 "qualified_borrows",
    "qualifiedBorrowsFromClicks":       "qualified_borrows_clicks",
    "qualifiedBorrowsFromViews":        "qualified_borrows_views",
    "royaltyQualifiedBorrows":          "royalty_qualified_borrows",
    "royaltyQualifiedBorrowsFromClicks": "royalty_qualified_borrows_clicks",
    "royaltyQualifiedBorrowsFromViews": "royalty_qualified_borrows_views",

    # ── Metadata ─────────────────────────────────────────────────────────────
    "retailer": "retailer",
}

# Columns that must stay integers (Amazon can return them as int or float-like strings)
_BIGINT_COLS = {
    "campaign_id", "portfolio_id", "ad_group_id",
    "keyword_id", "targeting_id", "ad_id",
}

# Columns where Amazon may return "<X%" strings for impression share metrics.
# We store None so the value is excluded from averages rather than silently treated as 0.
_PCT_STR_COLS = {
    "top_of_search_impression_share",
    "click_through_rate",
    "viewability_rate",
    "view_click_through_rate",
}


def _coerce_pct_str(value) -> Optional[float]:
    """Convert '<X%' / 'X%' strings → float ratio, unknown ranges → None."""
    if not isinstance(value, str):
        return value
    s = value.strip()
    if s.startswith("<"):
        # "<5%" means "somewhere between 0 and 5%" — store None so AVG skips it
        return None
    if s.endswith("%"):
        try:
            return float(s[:-1]) / 100.0
        except ValueError:
            return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_row(row: dict, client_id: int, report_type: str) -> Optional[dict]:
    """Map one Amazon API JSON row to an AdMetrics column dict. Returns None if date is missing."""
    raw_date = row.get("date")
    if not raw_date:
        return None

    record: dict = {
        "client_id": client_id,
        "report_type": report_type,
        "metric_date": date.fromisoformat(raw_date),
        "grain_type": GRAIN_TYPE.get(report_type, "campaign"),
    }

    for api_field, col_name in _FIELD_MAP.items():
        value = row.get(api_field)
        if value is None:
            continue
        if col_name in _BIGINT_COLS:
            try:
                value = int(value)
            except (TypeError, ValueError):
                value = None
        elif col_name in _PCT_STR_COLS:
            value = _coerce_pct_str(value)
        # 'cost' appears as both 'cost' and 'spend' — don't overwrite a real value
        if col_name == "cost" and col_name in record and value is None:
            continue
        record[col_name] = value

    return record


def parse_records(rows: list, client_id: int, report_type: str) -> list[dict]:
    """Parse a list of Amazon API rows into AdMetrics dicts, skipping invalid rows."""
    result = []
    for row in rows:
        parsed = parse_row(row, client_id, report_type)
        if parsed:
            result.append(parsed)
    return result
