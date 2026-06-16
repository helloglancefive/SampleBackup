"""Amazon report download functionality."""
import time
import gzip
import shutil
import json
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import requests
from .config import get_settings
from .auth import get_auth_service
from .profile import get_profile_service
from .logger import setup_logger

logger = setup_logger(__name__)

# All 8 Amazon report types
REPORT_TYPES = [
    "spTargeting",      # Sponsored Products Targeting
    "spSearchTerm",     # Sponsored Products Search Term
    "spCampaigns",      # Sponsored Products Campaigns
    "spProductAds",     # Sponsored Products Product Ads
    "sbSearchTerm",     # Sponsored Brands Search Term
    "sbTargeting",      # Sponsored Brands Targeting
    "sdAdvertising",    # Sponsored Display Advertising
    "sdTargeting",      # Sponsored Display Targeting
]

# Report configuration
REPORT_CONFIG = {
    "spTargeting": {"name": "Sponsored Products - Targeting", "ad_product": "SPONSORED_PRODUCTS"},
    "spSearchTerm": {"name": "Sponsored Products - Search Term", "ad_product": "SPONSORED_PRODUCTS"},
    "spCampaigns": {"name": "Sponsored Products - Campaigns", "ad_product": "SPONSORED_PRODUCTS"},
    "spProductAds": {"name": "Sponsored Products - Product Ads", "ad_product": "SPONSORED_PRODUCTS"},
    "sbSearchTerm": {"name": "Sponsored Brands - Search Term", "ad_product": "SPONSORED_BRANDS"},
    "sbTargeting": {"name": "Sponsored Brands - Targeting", "ad_product": "SPONSORED_BRANDS"},
    "sdAdvertising": {"name": "Sponsored Display - Advertising", "ad_product": "SPONSORED_DISPLAY"},
    "sdTargeting": {"name": "Sponsored Display - Targeting", "ad_product": "SPONSORED_DISPLAY"},
}


class ReportDownloader:
    """Downloads Amazon Advertising reports."""

    def __init__(self):
        self.settings = get_settings()
        self.auth_service = get_auth_service()
        self.profile_service = get_profile_service()
        self.max_poll_attempts = 120
        self.poll_interval = 10

    def download_all(
        self,
        start_date: str = None,
        end_date: str = None,
        report_types: list = None
    ) -> Dict[str, Any]:
        """Download all or selected report types."""
        if not start_date:
            end_date_obj = datetime.now().date()
            start_date_obj = end_date_obj - timedelta(days=7)
            start_date = start_date_obj.strftime("%Y-%m-%d")
            end_date = end_date_obj.strftime("%Y-%m-%d")

        if not report_types:
            report_types = REPORT_TYPES

        logger.info(f"Starting downloads for {len(report_types)} report types")
        logger.info(f"Date range: {start_date} to {end_date}")

        results = {
            "successful": [],
            "failed": [],
            "empty": [],
            "start_date": start_date,
            "end_date": end_date,
        }

        profile_id = self.profile_service.get_primary_profile_id()
        if not profile_id:
            raise Exception("No profile ID available")

        for i, report_type in enumerate(report_types, 1):
            logger.info(f"[{i}/{len(report_types)}] Downloading {report_type}")
            try:
                # Fresh token for each report
                self.auth_service.invalidate_cache()
                self.auth_service.get_access_token(force_refresh=True)

                # Request report
                report_id = self._request_report(report_type, profile_id, start_date, end_date)
                logger.debug(f"Report ID: {report_id}")

                # Download report
                file_path = self._download_report(report_id, report_type, profile_id)

                # Verify and count records
                record_count = self._verify_file(file_path)

                if record_count == 0:
                    logger.info(f"{report_type}: No data from Amazon")
                    results["empty"].append({
                        "type": report_type,
                        "report_id": report_id,
                        "file_path": str(file_path)
                    })
                else:
                    logger.info(f"{report_type}: Downloaded {record_count} records")
                    results["successful"].append({
                        "type": report_type,
                        "report_id": report_id,
                        "file_path": str(file_path),
                        "records": record_count,
                        "size_mb": file_path.stat().st_size / (1024 * 1024)
                    })

            except Exception as e:
                logger.error(f"{report_type}: {str(e)}")
                results["failed"].append({
                    "type": report_type,
                    "error": str(e)
                })

            # Delay between reports
            if i < len(report_types):
                time.sleep(5)

        return results

    def _request_report(
        self,
        report_type: str,
        profile_id: str,
        start_date: str,
        end_date: str
    ) -> str:
        """Request a report from Amazon API."""
        access_token = self.auth_service.get_access_token()

        headers = {
            'Authorization': f'Bearer {access_token}',
            'Amazon-Advertising-API-ClientId': self.settings.amazon_client_id,
            'Amazon-Advertising-API-Scope': profile_id,
            'Content-Type': 'application/json'
        }

        # Report type configurations with required fields and columns
        configs = {
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
                    "unitsSoldClicks1d", "unitsSoldClicks7d", "unitsSoldClicks30d", "sales1d", "sales7d", "sales30d",
                    "attributedSalesSameSku1d", "attributedSalesSameSku7d", "attributedSalesSameSku14d",
                    "attributedSalesSameSku30d", "unitsSoldSameSku1d", "unitsSoldSameSku7d", "unitsSoldSameSku14d",
                    "unitsSoldSameSku30d", "kindleEditionNormalizedPagesRead14d", "kindleEditionNormalizedPagesRoyalties14d",
                    "qualifiedBorrows", "royaltyQualifiedBorrows", "addToList", "salesOtherSku7d",
                    "unitsSoldOtherSku7d", "acosClicks7d", "acosClicks14d", "roasClicks7d", "roasClicks14d",
                    "keywordId", "keyword", "campaignBudgetCurrencyCode", "campaignId", "campaignBudgetType",
                    "adGroupId", "keywordType", "topOfSearchImpressionShare", "retailer"
                ]
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
                    "unitsSoldClicks1d", "unitsSoldClicks7d", "unitsSoldClicks30d", "sales1d", "sales7d", "sales30d",
                    "attributedSalesSameSku1d", "attributedSalesSameSku7d", "attributedSalesSameSku14d",
                    "attributedSalesSameSku30d", "unitsSoldSameSku1d", "unitsSoldSameSku7d", "unitsSoldSameSku14d",
                    "unitsSoldSameSku30d", "kindleEditionNormalizedPagesRead14d", "kindleEditionNormalizedPagesRoyalties14d",
                    "qualifiedBorrows", "royaltyQualifiedBorrows", "addToList", "salesOtherSku7d",
                    "salesOtherSku14d", "unitsSoldOtherSku7d", "unitsSoldOtherSku14d", "purchaseClickRate14d",
                    "acosClicks7d", "acosClicks14d", "roasClicks7d", "roasClicks14d", "keywordId", "keyword",
                    "campaignBudgetCurrencyCode", "campaignId", "campaignBudgetType", "adGroupId", "keywordType", "retailer"
                ]
            },
            "spCampaigns": {
                "name": "sp-campaigns-report",
                "adProduct": "SPONSORED_PRODUCTS",
                "reportTypeId": "spCampaigns",
                "groupBy": ["campaign"],
                "columns": [
                    "date", "campaignId", "campaignName", "campaignStatus", "campaignBudgetAmount",
                    "campaignBudgetType", "campaignBudgetCurrencyCode", "impressions", "clicks",
                    "cost", "sales14d", "purchases14d", "unitsSoldClicks14d", "costPerClick", "clickThroughRate",
                    "spend", "sales1d", "sales7d", "sales30d", "purchases1d", "purchases7d", "purchases30d",
                    "unitsSoldClicks1d", "unitsSoldClicks7d", "unitsSoldClicks30d", "acosClicks14d",
                    "roasClicks14d", "retailer", "topOfSearchImpressionShare", "attributedSalesSameSku1d",
                    "attributedSalesSameSku7d", "attributedSalesSameSku14d", "attributedSalesSameSku30d",
                    "purchasesSameSku1d", "purchasesSameSku7d", "purchasesSameSku14d", "purchasesSameSku30d",
                    "unitsSoldSameSku1d", "unitsSoldSameSku7d", "unitsSoldSameSku14d", "unitsSoldSameSku30d",
                    "kindleEditionNormalizedPagesRead14d", "kindleEditionNormalizedPagesRoyalties14d",
                    "qualifiedBorrows", "royaltyQualifiedBorrows", "addToList"
                ]
            },
            "spProductAds": {
                "name": "sp-productads-report",
                "adProduct": "SPONSORED_PRODUCTS",
                "reportTypeId": "spAdvertisedProduct",
                "groupBy": ["advertiser"],
                "columns": [
                    "date", "portfolioId", "campaignName", "campaignStatus", "campaignBudgetAmount", "adGroupName",
                    "advertisedAsin", "advertisedSku", "impressions", "clicks", "cost", "sales14d", "purchases14d",
                    "unitsSoldClicks14d", "campaignId", "adGroupId", "adId", "costPerClick", "clickThroughRate", "spend",
                    "campaignBudgetCurrencyCode", "campaignBudgetType", "purchases1d", "purchases7d", "purchases30d",
                    "purchasesSameSku1d", "purchasesSameSku7d", "purchasesSameSku30d", "unitsSoldClicks1d",
                    "unitsSoldClicks7d", "unitsSoldClicks30d", "sales1d", "sales7d", "sales30d",
                    "attributedSalesSameSku1d", "attributedSalesSameSku7d", "attributedSalesSameSku14d",
                    "attributedSalesSameSku30d", "salesOtherSku7d", "unitsSoldSameSku1d", "unitsSoldSameSku7d",
                    "unitsSoldSameSku14d", "unitsSoldSameSku30d", "unitsSoldOtherSku7d",
                    "kindleEditionNormalizedPagesRead14d", "kindleEditionNormalizedPagesRoyalties14d",
                    "qualifiedBorrows", "royaltyQualifiedBorrows", "addToList", "acosClicks7d", "acosClicks14d",
                    "roasClicks7d", "roasClicks14d", "retailer"
                ]
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
                    "royaltyQualifiedBorrows", "royaltyQualifiedBorrowsFromClicks", "addToList", "addToListFromClicks"
                ]
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
                    "addToList", "addToListFromClicks"
                ]
            },
            "sdAdvertising": {
                "name": "sd-advertising-report",
                "adProduct": "SPONSORED_DISPLAY",
                "reportTypeId": "sdAdvertisedProduct",
                "groupBy": ["advertiser"],
                "columns": [
                    "date", "campaignName", "adGroupName", "bidOptimization", "promotedSku", "promotedAsin",
                    "impressions", "clicks", "cost", "sales", "purchases", "unitsSold",
                    "newToBrandSalesClicks", "viewabilityRate", "purchasesClicks", "addToListFromViews",
                    "detailPageViews", "addToCartViews", "qualifiedBorrowsFromClicks", "qualifiedBorrowsFromViews",
                    "newToBrandDetailPageViewClicks", "addToListFromClicks", "viewClickThroughRate", "landingPageURL",
                    "royaltyQualifiedBorrowsFromClicks", "royaltyQualifiedBorrowsFromViews", "newToBrandDetailPageViewRate",
                    "newToBrandDetailPageViewViews", "campaignId", "leadFormOpens", "qualifiedBorrows", "adId",
                    "campaignBudgetCurrencyCode", "leads", "videoCompleteViews", "impressionsViews", "salesClicks",
                    "videoFirstQuartileViews", "unitsSoldClicks", "brandedSearches", "royaltyQualifiedBorrows",
                    "newToBrandECPDetailPageView", "newToBrandPurchases", "cumulativeReach", "brandedSearchesClicks",
                    "adGroupId", "newToBrandSales", "brandedSearchRate", "addToList", "impressionsFrequencyAverage",
                    "linkOuts", "newToBrandPurchasesClicks", "brandedSearchesViews", "addToCartClicks", "videoUnmutes",
                    "addToCart", "videoThirdQuartileViews", "addToCartRate", "adName", "salesPromotedClicks",
                    "eCPBrandSearch", "newToBrandUnitsSold", "detailPageViewsClicks", "purchasesPromotedClicks",
                    "eCPAddToCart", "newToBrandDetailPageViews", "videoMidpointViews", "newToBrandUnitsSoldClicks"
                ]
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
                    "campaignBudgetCurrencyCode", "leads", "videoCompleteViews", "impressionsViews", "salesClicks",
                    "videoFirstQuartileViews", "unitsSoldClicks", "brandedSearches", "royaltyQualifiedBorrows",
                    "newToBrandPurchases", "brandedSearchesClicks", "adGroupId", "newToBrandSales",
                    "brandedSearchRate", "addToList", "linkOuts", "newToBrandPurchasesClicks",
                    "brandedSearchesViews", "addToCartClicks", "videoUnmutes", "addToCart", "videoThirdQuartileViews",
                    "addToCartRate", "salesPromotedClicks", "targetingId", "eCPBrandSearch", "targetingExpression",
                    "detailPageViewsClicks", "purchasesPromotedClicks", "eCPAddToCart", "videoMidpointViews",
                    "newToBrandUnitsSold", "newToBrandUnitsSoldClicks", "newToBrandDetailPageViewRate",
                    "newToBrandDetailPageViewViews", "newToBrandDetailPageViewClicks", "newToBrandDetailPageViews",
                    "newToBrandECPDetailPageView"
                ]
            }
        }

        cfg = configs.get(report_type, {})

        body = {
            "name": cfg.get("name", report_type),
            "startDate": start_date,
            "endDate": end_date,
            "configuration": {
                "adProduct": cfg.get("adProduct"),
                "reportTypeId": cfg.get("reportTypeId"),
                "groupBy": cfg.get("groupBy", ["campaign"]),
                "columns": cfg.get("columns", []),
                "filters": [],
                "timeUnit": "DAILY",
                "format": "GZIP_JSON"
            }
        }

        try:
            response = requests.post(
                self.settings.amazon_reports_url,
                headers=headers,
                json=body,
                timeout=30
            )

            if response.status_code in [200, 201]:
                return response.json()['reportId']
            elif response.status_code == 425:
                # Duplicate request — Amazon returns the existing report ID in the detail message
                import re
                detail = response.json().get('detail', '')
                match = re.search(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', detail)
                if match:
                    existing_id = match.group(0)
                    logger.info(f"{report_type}: Reusing existing report {existing_id}")
                    return existing_id
                raise Exception(f"Report request failed [425]: {response.text}")
            else:
                raise Exception(f"Report request failed [{response.status_code}]: {response.text}")

        except requests.RequestException as e:
            raise Exception(f"Network error requesting report: {str(e)}")

    def _download_report(self, report_id: str, report_type: str, profile_id: str) -> Path:
        """Download and extract a report."""
        logger.debug(f"Downloading report {report_id}")

        access_token = self.auth_service.get_access_token()

        headers = {
            'Authorization': f'Bearer {access_token}',
            'Amazon-Advertising-API-ClientId': self.settings.amazon_client_id,
            'Amazon-Advertising-API-Scope': profile_id,
            'Content-Type': 'application/json'
        }

        url = f"{self.settings.amazon_reports_url}/{report_id}"

        token_refreshed_at = datetime.utcnow()

        # Poll for report status
        for attempt in range(self.max_poll_attempts):
            # Refresh token if it's been >50 minutes
            if (datetime.utcnow() - token_refreshed_at).total_seconds() > 3000:
                access_token = self.auth_service.get_access_token(force_refresh=True)
                headers['Authorization'] = f'Bearer {access_token}'
                token_refreshed_at = datetime.utcnow()

            try:
                response = requests.get(url, headers=headers, timeout=30)

                if response.status_code == 200:
                    data = response.json()
                    status = data.get('status')
                    logger.debug(f"Report {report_id} status: {status}")

                    if status in ("IN_PROGRESS", "PENDING", "PROCESSING"):
                        time.sleep(self.poll_interval)
                        continue
                    elif status == "COMPLETED":
                        download_url = data.get('url')
                        if not download_url:
                            logger.error(f"No download URL in response: {data}")
                            raise Exception(f"Report completed but no download URL provided")
                        return self._download_file(download_url, report_type)
                    elif status == "FAILED":
                        raise Exception(f"Report generation failed: {data}")
                    else:
                        logger.warning(f"Unknown status '{status}', retrying...")
                        time.sleep(self.poll_interval)
                else:
                    logger.warning(f"Status check failed [{response.status_code}]: {response.text}")
                    time.sleep(self.poll_interval)

            except requests.RequestException as e:
                logger.warning(f"Error checking status: {str(e)}")
                time.sleep(self.poll_interval)

        raise Exception(f"Report {report_id} timed out after {self.max_poll_attempts} attempts")

    def _download_file(self, download_url: str, report_type: str) -> Path:
        """Download and extract gzipped report file."""
        response = requests.get(download_url, stream=True, timeout=60)

        if response.status_code != 200:
            raise Exception(f"Download failed [{response.status_code}]")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_dir = self.settings.reports_output_dir
        report_dir.mkdir(parents=True, exist_ok=True)

        # Save gzipped file
        gz_path = report_dir / f"{report_type}_{timestamp}.json.gz"
        with open(gz_path, 'wb') as f:
            f.write(response.content)

        # Extract JSON
        json_path = report_dir / f"{report_type}_{timestamp}.json"
        with gzip.open(gz_path, 'rb') as f_in:
            with open(json_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)

        gz_path.unlink(missing_ok=True)
        logger.debug(f"Downloaded to {json_path}")
        return json_path

    def _verify_file(self, file_path: Path) -> int:
        """Verify JSON file and return record count."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if isinstance(data, dict):
                return 1
            elif isinstance(data, list):
                return len(data)
            else:
                return 0

        except Exception as e:
            logger.error(f"File verification failed: {str(e)}")
            return 0


_downloader: Optional[ReportDownloader] = None


def get_downloader() -> ReportDownloader:
    """Get report downloader singleton."""
    global _downloader
    if _downloader is None:
        _downloader = ReportDownloader()
    return _downloader
