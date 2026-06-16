"""Amazon Advertising report download, parse, and storage pipeline."""
import gzip
import json
import logging
import re
import time
from datetime import datetime
from typing import Optional

import requests
from sqlalchemy.orm import Session

from config import Settings
from app.models.report_fetch import ReportFetch
from app.services.amazon_auth_service import AmazonAuthService
from app.services.reporting_storage import save_raw, store_report

logger = logging.getLogger(__name__)

# ── Report configurations for all 18 Amazon Advertising report types ─────────
# Keys match the report_type values stored in ad_metrics.report_type
_REPORT_CONFIGS: dict[str, dict] = {

    # ── SPONSORED PRODUCTS (7 reports) ───────────────────────────────────────

    "spCampaigns": {
        "name": "sp-campaigns-report",
        "adProduct": "SPONSORED_PRODUCTS",
        "reportTypeId": "spCampaigns",
        "groupBy": ["campaign"],
        "columns": [
            "date", "campaignId", "campaignName", "campaignStatus", "campaignBudgetAmount",
            "campaignBudgetType", "campaignBudgetCurrencyCode", "campaignBiddingStrategy",
            "impressions", "clicks", "cost", "sales14d", "purchases14d", "unitsSoldClicks14d",
            "costPerClick", "clickThroughRate", "spend", "sales1d", "sales7d", "sales30d",
            "purchases1d", "purchases7d", "purchases30d", "unitsSoldClicks1d", "unitsSoldClicks7d",
            "unitsSoldClicks30d", "acosClicks14d", "roasClicks14d", "retailer",
            "topOfSearchImpressionShare", "campaignRuleBasedBudgetAmount",
            "campaignApplicableBudgetRuleId", "campaignApplicableBudgetRuleName",
            "attributedSalesSameSku1d", "attributedSalesSameSku7d", "attributedSalesSameSku14d",
            "attributedSalesSameSku30d", "purchasesSameSku1d", "purchasesSameSku7d",
            "purchasesSameSku14d", "purchasesSameSku30d", "unitsSoldSameSku1d", "unitsSoldSameSku7d",
            "unitsSoldSameSku14d", "unitsSoldSameSku30d",
            "kindleEditionNormalizedPagesRead14d", "kindleEditionNormalizedPagesRoyalties14d",
            "qualifiedBorrows", "royaltyQualifiedBorrows", "addToList",
        ],
    },

    "spCampaignPlacement": {
        "name": "sp-campaign-placement-report",
        "adProduct": "SPONSORED_PRODUCTS",
        "reportTypeId": "spCampaigns",
        "groupBy": ["campaignPlacement"],
        "columns": [
            "date", "campaignName", "campaignStatus", "campaignBudgetAmount",
            "campaignBiddingStrategy", "impressions", "clicks", "cost", "spend",
            "sales14d", "purchases14d", "unitsSoldClicks14d", "costPerClick", "clickThroughRate",
            "purchases1d", "purchases7d", "purchases30d", "purchasesSameSku1d",
            "purchasesSameSku7d", "purchasesSameSku14d", "purchasesSameSku30d",
            "unitsSoldClicks1d", "unitsSoldClicks7d", "unitsSoldClicks30d",
            "sales1d", "sales7d", "sales30d", "attributedSalesSameSku1d",
            "attributedSalesSameSku7d", "attributedSalesSameSku14d", "attributedSalesSameSku30d",
            "unitsSoldSameSku1d", "unitsSoldSameSku7d", "unitsSoldSameSku14d", "unitsSoldSameSku30d",
            "kindleEditionNormalizedPagesRead14d", "kindleEditionNormalizedPagesRoyalties14d",
            "qualifiedBorrows", "royaltyQualifiedBorrows", "addToList",
            "acosClicks14d", "roasClicks14d", "campaignBudgetCurrencyCode", "campaignId",
            "campaignBudgetType", "campaignRuleBasedBudgetAmount",
            "campaignApplicableBudgetRuleId", "campaignApplicableBudgetRuleName",
            "topOfSearchImpressionShare", "placementClassification", "retailer",
        ],
    },

    "spTargeting": {
        "name": "sp-targeting-report",
        "adProduct": "SPONSORED_PRODUCTS",
        "reportTypeId": "spTargeting",
        "groupBy": ["targeting"],
        "columns": [
            "date", "portfolioId", "campaignName", "campaignStatus", "campaignBudgetAmount",
            "adGroupName", "targeting", "matchType", "adKeywordStatus", "keywordBid",
            "impressions", "clicks", "cost", "sales14d", "purchases14d", "unitsSoldClicks14d",
            "costPerClick", "clickThroughRate", "purchases1d", "purchases7d", "purchases30d",
            "purchasesSameSku1d", "purchasesSameSku7d", "purchasesSameSku14d", "purchasesSameSku30d",
            "unitsSoldClicks1d", "unitsSoldClicks7d", "unitsSoldClicks30d",
            "sales1d", "sales7d", "sales30d", "attributedSalesSameSku1d", "attributedSalesSameSku7d",
            "attributedSalesSameSku14d", "attributedSalesSameSku30d",
            "unitsSoldSameSku1d", "unitsSoldSameSku7d", "unitsSoldSameSku14d", "unitsSoldSameSku30d",
            "kindleEditionNormalizedPagesRead14d", "kindleEditionNormalizedPagesRoyalties14d",
            "qualifiedBorrows", "royaltyQualifiedBorrows", "addToList", "salesOtherSku7d",
            "unitsSoldOtherSku7d", "acosClicks7d", "acosClicks14d", "roasClicks7d", "roasClicks14d",
            "keywordId", "keyword", "campaignBudgetCurrencyCode", "campaignId", "campaignBudgetType",
            "adGroupId", "keywordType", "topOfSearchImpressionShare", "retailer",
        ],
    },

    "spSearchTerm": {
        "name": "sp-searchterm-report",
        "adProduct": "SPONSORED_PRODUCTS",
        "reportTypeId": "spSearchTerm",
        "groupBy": ["searchTerm"],
        "columns": [
            "date", "portfolioId", "campaignName", "campaignStatus", "campaignBudgetAmount",
            "adGroupName", "targeting", "matchType", "adKeywordStatus", "keywordBid", "searchTerm",
            "impressions", "clicks", "cost", "sales14d", "purchases14d", "unitsSoldClicks14d",
            "costPerClick", "clickThroughRate", "spend", "purchases1d", "purchases7d", "purchases30d",
            "purchasesSameSku1d", "purchasesSameSku7d", "purchasesSameSku14d", "purchasesSameSku30d",
            "unitsSoldClicks1d", "unitsSoldClicks7d", "unitsSoldClicks30d",
            "sales1d", "sales7d", "sales30d", "attributedSalesSameSku1d", "attributedSalesSameSku7d",
            "attributedSalesSameSku14d", "attributedSalesSameSku30d",
            "unitsSoldSameSku1d", "unitsSoldSameSku7d", "unitsSoldSameSku14d", "unitsSoldSameSku30d",
            "kindleEditionNormalizedPagesRead14d", "kindleEditionNormalizedPagesRoyalties14d",
            "qualifiedBorrows", "royaltyQualifiedBorrows", "addToList",
            "salesOtherSku7d", "salesOtherSku14d", "unitsSoldOtherSku7d", "unitsSoldOtherSku14d",
            "purchaseClickRate14d", "acosClicks7d", "acosClicks14d", "roasClicks7d", "roasClicks14d",
            "keywordId", "keyword", "campaignBudgetCurrencyCode", "campaignId",
            "campaignBudgetType", "adGroupId", "keywordType", "retailer",
        ],
    },

    "spProductAds": {
        "name": "sp-advertised-product-report",
        "adProduct": "SPONSORED_PRODUCTS",
        "reportTypeId": "spAdvertisedProduct",
        "groupBy": ["advertiser"],
        "columns": [
            "date", "portfolioId", "campaignName", "campaignStatus", "campaignBudgetAmount",
            "adGroupName", "advertisedAsin", "advertisedSku", "impressions", "clicks", "cost",
            "sales14d", "purchases14d", "unitsSoldClicks14d", "campaignId", "adGroupId", "adId",
            "costPerClick", "clickThroughRate", "spend", "campaignBudgetCurrencyCode",
            "campaignBudgetType", "purchases1d", "purchases7d", "purchases30d",
            "purchasesSameSku1d", "purchasesSameSku7d", "purchasesSameSku30d",
            "unitsSoldClicks1d", "unitsSoldClicks7d", "unitsSoldClicks30d",
            "sales1d", "sales7d", "sales30d", "attributedSalesSameSku1d", "attributedSalesSameSku7d",
            "attributedSalesSameSku14d", "attributedSalesSameSku30d",
            "salesOtherSku7d", "unitsSoldSameSku1d", "unitsSoldSameSku7d",
            "unitsSoldSameSku14d", "unitsSoldSameSku30d", "unitsSoldOtherSku7d",
            "kindleEditionNormalizedPagesRead14d", "kindleEditionNormalizedPagesRoyalties14d",
            "qualifiedBorrows", "royaltyQualifiedBorrows", "addToList",
            "acosClicks7d", "acosClicks14d", "roasClicks7d", "roasClicks14d", "retailer",
        ],
    },

    "spPurchasedProduct": {
        "name": "sp-purchased-product-report",
        "adProduct": "SPONSORED_PRODUCTS",
        "reportTypeId": "spPurchasedProduct",
        "groupBy": ["asin"],
        "columns": [
            "date", "purchasesOtherSku7d", "unitsSoldClicks1d", "matchType",
            "unitsSoldOtherSku14d", "unitsSoldOtherSku30d", "sales7d", "salesOtherSku14d",
            "kindleEditionNormalizedPagesRoyalties14d", "salesOtherSku30d", "advertisedSku",
            "keyword", "salesOtherSku7d", "purchases7d", "targetId", "unitsSoldClicks14d",
            "adGroupName", "campaignId", "kindleEditionNormalizedPagesRead14d",
            "unitsSoldClicks30d", "qualifiedBorrows", "purchasesOtherSku30d", "portfolioId",
            "campaignBudgetCurrencyCode", "purchasesOtherSku14d", "purchasedAsin",
            "unitsSoldClicks7d", "keywordId", "royaltyQualifiedBorrows", "sales1d", "adGroupId",
            "addToList", "targeting", "unitsSoldOtherSku7d", "salesOtherSku1d", "keywordType",
            "advertisedAsin", "purchases1d", "purchasesOtherSku1d", "retailer",
            "sales14d", "sales30d", "unitsSoldOtherSku1d", "targetingExpression",
            "purchases14d", "purchases30d", "campaignName",
        ],
    },

    "spGrossAndInvalids": {
        "name": "sp-gross-invalid-traffic-report",
        "adProduct": "SPONSORED_PRODUCTS",
        "reportTypeId": "spGrossAndInvalids",
        "groupBy": ["campaign"],
        "columns": [
            "date", "grossImpressions", "impressions", "invalidImpressions",
            "invalidImpressionRate", "grossClickThroughs", "clicks", "invalidClickThroughs",
            "invalidClickThroughRate", "campaignId", "campaignName", "campaignStatus", "retailer",
        ],
    },

    # ── SPONSORED BRANDS (5 reports) ─────────────────────────────────────────

    "sbCampaigns": {
        "name": "sb-campaigns-report",
        "adProduct": "SPONSORED_BRANDS",
        "reportTypeId": "sbCampaigns",
        "groupBy": ["campaign"],
        "columns": [
            "date", "campaignName", "campaignId", "campaignStatus", "impressions", "clicks", "cost",
            "brandedSearches", "purchases", "purchasesPromoted", "detailPageViews",
            "newToBrandPurchasesRate", "newToBrandPurchases", "newToBrandPurchasesPercentage",
            "sales", "salesPromoted", "newToBrandSales", "newToBrandSalesPercentage",
            "newToBrandUnitsSold", "newToBrandUnitsSoldPercentage", "unitsSold",
            "viewClickThroughRate", "video5SecondViewRate", "video5SecondViews",
            "videoCompleteViews", "videoFirstQuartileViews", "videoMidpointViews",
            "videoThirdQuartileViews", "videoUnmutes", "viewableImpressions", "viewabilityRate",
            "brandedSearchesClicks", "purchasesClicks", "detailPageViewsClicks",
            "newToBrandPurchasesClicks", "salesClicks", "newToBrandSalesClicks",
            "newToBrandUnitsSoldClicks", "unitsSoldClicks", "costType",
            "campaignBudgetAmount", "campaignBudgetCurrencyCode", "campaignBudgetType",
            "newToBrandDetailPageViews", "newToBrandDetailPageViewsClicks",
            "newToBrandDetailPageViewRate", "newToBrandECPDetailPageView",
            "addToCart", "addToCartClicks", "addToCartRate", "eCPAddToCart",
            "kindleEditionNormalizedPagesRead14d", "kindleEditionNormalizedPagesRoyalties14d",
            "qualifiedBorrows", "qualifiedBorrowsFromClicks", "royaltyQualifiedBorrows",
            "royaltyQualifiedBorrowsFromClicks", "addToList", "addToListFromClicks",
            "longTermSales", "longTermROAS", "topOfSearchImpressionShare",
            "campaignRuleBasedBudgetAmount",
        ],
    },

    "sbCampaignPlacement": {
        "name": "sb-campaign-placement-report",
        "adProduct": "SPONSORED_BRANDS",
        "reportTypeId": "sbCampaignPlacement",
        "groupBy": ["campaignPlacement"],
        "columns": [
            "date", "campaignName", "campaignId", "campaignStatus", "impressions", "clicks", "cost",
            "brandedSearches", "purchases", "purchasesPromoted", "detailPageViews",
            "newToBrandPurchasesRate", "newToBrandPurchases", "newToBrandPurchasesPercentage",
            "sales", "salesPromoted", "newToBrandSales", "newToBrandSalesPercentage",
            "newToBrandUnitsSold", "newToBrandUnitsSoldPercentage", "unitsSold",
            "viewClickThroughRate", "video5SecondViewRate", "video5SecondViews",
            "videoCompleteViews", "videoFirstQuartileViews", "videoMidpointViews",
            "videoThirdQuartileViews", "videoUnmutes", "viewableImpressions", "viewabilityRate",
            "brandedSearchesClicks", "purchasesClicks", "detailPageViewsClicks",
            "newToBrandPurchasesClicks", "salesClicks", "newToBrandSalesClicks",
            "newToBrandUnitsSoldClicks", "unitsSoldClicks", "costType",
            "campaignBudgetAmount", "campaignBudgetCurrencyCode", "campaignBudgetType",
            "newToBrandDetailPageViews", "newToBrandDetailPageViewsClicks",
            "newToBrandDetailPageViewRate", "newToBrandECPDetailPageView",
            "addToCart", "addToCartClicks", "addToCartRate", "eCPAddToCart",
            "kindleEditionNormalizedPagesRead14d", "kindleEditionNormalizedPagesRoyalties14d",
            "qualifiedBorrows", "qualifiedBorrowsFromClicks", "royaltyQualifiedBorrows",
            "royaltyQualifiedBorrowsFromClicks", "addToList", "addToListFromClicks",
            "placementClassification",
        ],
    },

    "sbTargeting": {
        "name": "sb-targeting-report",
        "adProduct": "SPONSORED_BRANDS",
        "reportTypeId": "sbTargeting",
        "groupBy": ["targeting"],
        "columns": [
            "date", "campaignName", "campaignStatus", "campaignBudgetAmount", "adGroupName",
            "targetingText", "targetingType", "adKeywordStatus", "keywordBid", "impressions", "clicks",
            "cost", "sales", "purchases", "unitsSold", "keywordId", "keywordText", "keywordType",
            "matchType", "targetingId", "targetingExpression", "adGroupId", "campaignId",
            "brandedSearches", "purchasesPromoted", "detailPageViews", "newToBrandPurchasesRate",
            "newToBrandPurchases", "newToBrandPurchasesPercentage", "salesPromoted", "newToBrandSales",
            "newToBrandSalesPercentage", "newToBrandUnitsSold", "newToBrandUnitsSoldPercentage",
            "viewClickThroughRate", "video5SecondViewRate", "video5SecondViews", "videoCompleteViews",
            "videoFirstQuartileViews", "videoMidpointViews", "videoThirdQuartileViews", "videoUnmutes",
            "viewableImpressions", "viewabilityRate", "brandedSearchesClicks", "purchasesClicks",
            "detailPageViewsClicks", "newToBrandPurchasesClicks", "salesClicks", "newToBrandSalesClicks",
            "newToBrandUnitsSoldClicks", "unitsSoldClicks", "costType", "campaignBudgetCurrencyCode",
            "campaignBudgetType", "topOfSearchImpressionShare", "newToBrandDetailPageViews",
            "newToBrandDetailPageViewsClicks", "newToBrandDetailPageViewRate", "newToBrandECPDetailPageView",
            "addToCart", "addToCartClicks", "addToCartRate", "eCPAddToCart", "qualifiedBorrows",
            "qualifiedBorrowsFromClicks", "royaltyQualifiedBorrows", "royaltyQualifiedBorrowsFromClicks",
            "addToList", "addToListFromClicks",
        ],
    },

    "sbSearchTerm": {
        "name": "sb-searchterm-report",
        "adProduct": "SPONSORED_BRANDS",
        "reportTypeId": "sbSearchTerm",
        "groupBy": ["searchTerm"],
        "columns": [
            "date", "campaignName", "campaignStatus", "campaignBudgetAmount", "adGroupName",
            "keywordText", "keywordType", "adKeywordStatus", "keywordBid", "searchTerm",
            "impressions", "clicks", "cost", "sales", "purchases", "unitsSold", "adGroupId",
            "keywordId", "campaignId", "matchType", "viewClickThroughRate", "video5SecondViewRate",
            "video5SecondViews", "videoCompleteViews", "videoFirstQuartileViews", "videoMidpointViews",
            "videoThirdQuartileViews", "videoUnmutes", "viewableImpressions", "viewabilityRate",
            "purchasesClicks", "salesClicks", "costType", "campaignBudgetCurrencyCode",
            "campaignBudgetType", "kindleEditionNormalizedPagesRead14d",
            "kindleEditionNormalizedPagesRoyalties14d", "qualifiedBorrows", "qualifiedBorrowsFromClicks",
            "royaltyQualifiedBorrows", "royaltyQualifiedBorrowsFromClicks", "addToList",
            "addToListFromClicks",
        ],
    },

    "sbGrossAndInvalids": {
        "name": "sb-gross-invalid-traffic-report",
        "adProduct": "SPONSORED_BRANDS",
        "reportTypeId": "sbGrossAndInvalids",
        "groupBy": ["campaign"],
        "columns": [
            "date", "grossImpressions", "impressions", "invalidImpressions",
            "invalidImpressionRate", "grossClickThroughs", "clicks", "invalidClickThroughs",
            "invalidClickThroughRate", "campaignId", "campaignName", "campaignStatus",
        ],
    },

    # ── SPONSORED DISPLAY (6 reports) ────────────────────────────────────────

    "sdCampaigns": {
        "name": "sd-campaigns-report",
        "adProduct": "SPONSORED_DISPLAY",
        "reportTypeId": "sdCampaigns",
        "groupBy": ["campaign"],
        "columns": [
            "date", "purchasesClicks", "purchasesPromotedClicks", "detailPageViewsClicks",
            "newToBrandPurchasesClicks", "salesClicks", "salesPromotedClicks", "newToBrandSalesClicks",
            "unitsSoldClicks", "newToBrandUnitsSoldClicks", "campaignId", "campaignName", "clicks",
            "cost", "campaignBudgetCurrencyCode", "impressions", "purchases", "detailPageViews",
            "sales", "unitsSold", "impressionsViews", "newToBrandPurchases", "newToBrandUnitsSold",
            "brandedSearchesClicks", "brandedSearches", "brandedSearchesViews", "brandedSearchRate",
            "eCPBrandSearch", "videoCompleteViews", "videoFirstQuartileViews", "videoMidpointViews",
            "videoThirdQuartileViews", "videoUnmutes", "viewabilityRate", "viewClickThroughRate",
            "addToCart", "addToCartViews", "addToCartClicks", "addToCartRate", "eCPAddToCart",
            "qualifiedBorrows", "qualifiedBorrowsFromClicks", "qualifiedBorrowsFromViews",
            "royaltyQualifiedBorrows", "royaltyQualifiedBorrowsFromClicks",
            "royaltyQualifiedBorrowsFromViews", "addToList", "addToListFromClicks",
            "addToListFromViews", "linkOuts", "leadFormOpens", "leads",
            "longTermSales", "longTermROAS", "newToBrandSales", "campaignStatus",
            "campaignBudgetAmount", "costType", "impressionsFrequencyAverage", "cumulativeReach",
            "newToBrandDetailPageViews", "newToBrandDetailPageViewViews",
            "newToBrandDetailPageViewClicks", "newToBrandDetailPageViewRate",
            "newToBrandECPDetailPageView",
        ],
    },

    "sdMatchedTarget": {
        "name": "sd-matched-target-report",
        "adProduct": "SPONSORED_DISPLAY",
        "reportTypeId": "sdCampaigns",      # Amazon uses sdCampaigns with matchedTarget groupBy
        "groupBy": ["matchedTarget"],
        "columns": [
            "date", "purchasesClicks", "purchasesPromotedClicks", "detailPageViewsClicks",
            "newToBrandPurchasesClicks", "salesClicks", "salesPromotedClicks", "newToBrandSalesClicks",
            "unitsSoldClicks", "newToBrandUnitsSoldClicks", "campaignId", "campaignName", "clicks",
            "cost", "campaignBudgetCurrencyCode", "impressions", "purchases", "detailPageViews",
            "sales", "unitsSold", "impressionsViews", "newToBrandPurchases", "newToBrandUnitsSold",
            "brandedSearchesClicks", "brandedSearches", "brandedSearchesViews", "brandedSearchRate",
            "eCPBrandSearch", "videoCompleteViews", "videoFirstQuartileViews", "videoMidpointViews",
            "videoThirdQuartileViews", "videoUnmutes", "viewabilityRate", "viewClickThroughRate",
            "addToCart", "addToCartViews", "addToCartClicks", "addToCartRate", "eCPAddToCart",
            "qualifiedBorrows", "qualifiedBorrowsFromClicks", "qualifiedBorrowsFromViews",
            "royaltyQualifiedBorrows", "royaltyQualifiedBorrowsFromClicks",
            "royaltyQualifiedBorrowsFromViews", "addToList", "addToListFromClicks",
            "addToListFromViews", "linkOuts", "leadFormOpens", "leads",
            "longTermSales", "longTermROAS", "matchedTargetAsin",
        ],
    },

    "sdAdvertising": {
        "name": "sd-advertised-product-report",
        "adProduct": "SPONSORED_DISPLAY",
        "reportTypeId": "sdAdvertisedProduct",
        "groupBy": ["advertiser"],
        "columns": [
            "date", "campaignName", "adGroupName", "bidOptimization", "promotedSku", "promotedAsin",
            "impressions", "clicks", "cost", "sales", "purchases", "unitsSold",
            "newToBrandSalesClicks", "viewabilityRate", "purchasesClicks", "addToListFromViews",
            "detailPageViews", "addToCartViews", "qualifiedBorrowsFromClicks", "qualifiedBorrowsFromViews",
            "newToBrandDetailPageViewClicks", "addToListFromClicks", "viewClickThroughRate",
            "landingPageURL", "royaltyQualifiedBorrowsFromClicks", "royaltyQualifiedBorrowsFromViews",
            "newToBrandDetailPageViewRate", "newToBrandDetailPageViewViews", "campaignId",
            "leadFormOpens", "qualifiedBorrows", "adId", "campaignBudgetCurrencyCode", "leads",
            "videoCompleteViews", "impressionsViews", "salesClicks", "videoFirstQuartileViews",
            "unitsSoldClicks", "brandedSearches", "royaltyQualifiedBorrows", "newToBrandECPDetailPageView",
            "newToBrandPurchases", "cumulativeReach", "brandedSearchesClicks", "adGroupId",
            "newToBrandSales", "brandedSearchRate", "addToList", "impressionsFrequencyAverage",
            "linkOuts", "newToBrandPurchasesClicks", "brandedSearchesViews", "addToCartClicks",
            "videoUnmutes", "addToCart", "videoThirdQuartileViews", "addToCartRate", "adName",
            "salesPromotedClicks", "eCPBrandSearch", "newToBrandUnitsSold", "detailPageViewsClicks",
            "eCPAddToCart", "newToBrandDetailPageViews", "videoMidpointViews",
            "newToBrandUnitsSoldClicks",
        ],
    },

    "sdTargeting": {
        "name": "sd-targeting-report",
        "adProduct": "SPONSORED_DISPLAY",
        "reportTypeId": "sdTargeting",
        "groupBy": ["targeting"],
        "columns": [
            "date", "campaignName", "adGroupName", "targetingText", "adKeywordStatus",
            "impressions", "clicks", "cost", "sales", "purchases", "unitsSold",
            "newToBrandSalesClicks", "viewabilityRate", "purchasesClicks", "addToListFromViews",
            "detailPageViews", "addToCartViews", "qualifiedBorrowsFromClicks", "qualifiedBorrowsFromViews",
            "addToListFromClicks", "viewClickThroughRate", "royaltyQualifiedBorrowsFromClicks",
            "royaltyQualifiedBorrowsFromViews", "campaignId", "leadFormOpens", "qualifiedBorrows",
            "campaignBudgetCurrencyCode", "leads", "videoCompleteViews", "impressionsViews",
            "salesClicks", "videoFirstQuartileViews", "unitsSoldClicks", "brandedSearches",
            "royaltyQualifiedBorrows", "newToBrandPurchases", "brandedSearchesClicks", "adGroupId",
            "newToBrandSales", "brandedSearchRate", "addToList", "linkOuts",
            "newToBrandPurchasesClicks", "brandedSearchesViews", "addToCartClicks", "videoUnmutes",
            "addToCart", "videoThirdQuartileViews", "addToCartRate", "salesPromotedClicks",
            "targetingId", "eCPBrandSearch", "targetingExpression", "detailPageViewsClicks",
            "eCPAddToCart", "videoMidpointViews", "newToBrandUnitsSold", "newToBrandUnitsSoldClicks",
            "newToBrandDetailPageViewRate", "newToBrandDetailPageViewViews",
            "newToBrandDetailPageViewClicks", "newToBrandDetailPageViews", "newToBrandECPDetailPageView",
        ],
    },

    "sdPurchasedProduct": {
        "name": "sd-purchased-product-report",
        "adProduct": "SPONSORED_DISPLAY",
        "reportTypeId": "sdPurchasedProduct",
        "groupBy": ["asin"],
        "columns": [
            "date", "unitsSoldBrandHaloClicks", "asinBrandHalo", "addToListFromViews",
            "salesBrandHalo", "royaltyQualifiedBorrows", "promotedSku", "adGroupId",
            "qualifiedBorrowsFromClicks", "qualifiedBorrowsFromViews", "addToList",
            "conversionsBrandHaloClicks", "addToListFromClicks", "salesBrandHaloClicks",
            "conversionsBrandHalo", "royaltyQualifiedBorrowsFromClicks", "promotedAsin",
            "royaltyQualifiedBorrowsFromViews", "adGroupName", "campaignId", "qualifiedBorrows",
            "campaignBudgetCurrencyCode", "unitsSoldBrandHalo", "campaignName",
        ],
    },

    "sdGrossAndInvalids": {
        "name": "sd-gross-invalid-traffic-report",
        "adProduct": "SPONSORED_DISPLAY",
        "reportTypeId": "sdGrossAndInvalids",
        "groupBy": ["campaign"],
        "columns": [
            "date", "grossImpressions", "impressions", "invalidImpressions",
            "invalidImpressionRate", "grossClickThroughs", "clicks", "invalidClickThroughs",
            "invalidClickThroughRate", "campaignId", "campaignName", "campaignStatus",
        ],
    },
}

_UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I)


class ReportService:
    """Download, parse, and store one report type for one client."""

    MAX_POLL_ATTEMPTS = 120
    POLL_INTERVAL = 10
    TOKEN_REFRESH_SECS = 3000  # refresh token every 50 min during long polls

    def __init__(self, client_id: int, auth: AmazonAuthService, profile_id: str, settings: Settings):
        self._client_id = client_id
        self._auth = auth
        self._profile_id = profile_id
        self._settings = settings

    def fetch_and_store(
        self,
        db: Session,
        report_type: str,
        start_date: str,
        end_date: str,
        fetch_record_id: int,
    ) -> dict:
        """Full pipeline: request → poll → download → save raw → route → upsert. Returns summary."""
        started_at = datetime.utcnow()

        self._auth.invalidate_cache()
        self._auth.get_access_token(force_refresh=True)

        report_id = self._request_report(report_type, start_date, end_date)
        self._update_fetch(db, fetch_record_id, amazon_report_id=report_id)

        rows = self._poll_and_download(report_id)

        if not rows:
            save_raw(db, self._client_id, self._profile_id, report_type, start_date,
                     [], status="processed_empty")
            self._update_fetch(
                db, fetch_record_id,
                status="completed_empty",
                records_count=0,
                fetched_at=datetime.utcnow(),
                fetch_time_seconds=(datetime.utcnow() - started_at).total_seconds(),
            )
            logger.info("%s [client=%d]: empty report", report_type, self._client_id)
            return {"records": 0, "empty": True}

        # Save raw JSON before any transformation
        save_raw(db, self._client_id, self._profile_id, report_type, start_date, rows)

        # Route rows to the correct analytics table(s) and upsert
        count = store_report(db, rows, self._client_id, self._profile_id, report_type)

        elapsed = (datetime.utcnow() - started_at).total_seconds()
        self._update_fetch(
            db, fetch_record_id,
            status="completed",
            records_count=count,
            fetched_at=datetime.utcnow(),
            fetch_time_seconds=elapsed,
        )
        logger.info("%s [client=%d]: stored %d records in %.1fs",
                    report_type, self._client_id, count, elapsed)
        return {"records": count, "empty": False}

    # ── Amazon API helpers ────────────────────────────────────────────────────

    def _headers(self) -> dict:
        token = self._auth.get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Amazon-Advertising-API-ClientId": self._auth._amazon_client_id,
            "Amazon-Advertising-API-Scope": self._profile_id,
            "Content-Type": "application/json",
        }

    def _request_report(self, report_type: str, start_date: str, end_date: str) -> str:
        cfg = _REPORT_CONFIGS[report_type]
        body = {
            "name": cfg["name"],
            "startDate": start_date,
            "endDate": end_date,
            "configuration": {
                "adProduct": cfg["adProduct"],
                "reportTypeId": cfg["reportTypeId"],
                "groupBy": cfg["groupBy"],
                "columns": cfg["columns"],
                "filters": [],
                "timeUnit": "DAILY",
                "format": "GZIP_JSON",
            },
        }
        try:
            resp = requests.post(self._settings.amazon_reports_url, headers=self._headers(), json=body, timeout=30)
        except requests.RequestException as exc:
            raise RuntimeError(f"Network error requesting {report_type}: {exc}") from exc

        if resp.status_code in (200, 201):
            return resp.json()["reportId"]

        if resp.status_code == 425:
            detail = resp.json().get("detail", "")
            match = _UUID_RE.search(detail)
            if match:
                logger.info("%s: reusing existing report %s", report_type, match.group(0))
                return match.group(0)

        if resp.status_code == 429:
            raise RuntimeError(f"Rate limited requesting {report_type}")

        raise RuntimeError(f"Report request failed [{resp.status_code}]: {resp.text}")

    def _poll_and_download(self, report_id: str) -> Optional[list]:
        url = f"{self._settings.amazon_reports_url}/{report_id}"
        token_refreshed_at = datetime.utcnow()

        for attempt in range(self.MAX_POLL_ATTEMPTS):
            if (datetime.utcnow() - token_refreshed_at).total_seconds() > self.TOKEN_REFRESH_SECS:
                self._auth.get_access_token(force_refresh=True)
                token_refreshed_at = datetime.utcnow()

            try:
                resp = requests.get(url, headers=self._headers(), timeout=30)
            except requests.RequestException:
                time.sleep(self.POLL_INTERVAL)
                continue

            if resp.status_code != 200:
                time.sleep(self.POLL_INTERVAL)
                continue

            data = resp.json()
            status = data.get("status", "")

            if status in ("IN_PROGRESS", "PENDING", "PROCESSING"):
                time.sleep(self.POLL_INTERVAL)
                continue

            if status == "COMPLETED":
                download_url = data.get("url")
                if not download_url:
                    raise RuntimeError(f"Report {report_id} COMPLETED but no download URL")
                return self._download_and_parse(download_url)

            if status == "FAILED":
                raise RuntimeError(f"Report {report_id} FAILED: {data}")

            time.sleep(self.POLL_INTERVAL)

        raise RuntimeError(f"Report {report_id} timed out after {self.MAX_POLL_ATTEMPTS} attempts")

    def _download_and_parse(self, download_url: str) -> Optional[list]:
        try:
            resp = requests.get(download_url, stream=True, timeout=120)
        except requests.RequestException as exc:
            raise RuntimeError(f"Download failed: {exc}") from exc

        if resp.status_code != 200:
            raise RuntimeError(f"Download failed [{resp.status_code}]")

        raw = gzip.decompress(resp.content)
        data = json.loads(raw.decode("utf-8"))

        if isinstance(data, dict):
            return [data] if data else None
        if isinstance(data, list):
            return data if data else None
        return None

    # ── DB helpers ────────────────────────────────────────────────────────────

    def _update_fetch(self, db: Session, fetch_id: int, **kwargs) -> None:
        fetch = db.query(ReportFetch).filter(ReportFetch.id == fetch_id).first()
        if fetch:
            for k, v in kwargs.items():
                setattr(fetch, k, v)
            db.commit()
