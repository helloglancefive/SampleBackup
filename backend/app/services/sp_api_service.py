"""Amazon Selling Partner API (SP-API) service.

Handles LWA token exchange and GET_SALES_AND_TRAFFIC_REPORT lifecycle:
  create → poll → download document → return raw bytes.

Auth model used:
  - LWA (Login with Amazon) only — no SigV4 required for Reports API v2021-06-30
    when the application is registered with Amazon and the seller has granted
    selling partner access via the OAuth consent flow.
  - Token endpoint: https://api.amazon.com/auth/o2/token
  - API header:    x-amz-access-token: <access_token>
"""
import gzip
import logging
import time
from datetime import datetime, timedelta
from typing import Optional

import requests

from config import Settings

logger = logging.getLogger(__name__)

# SP-API base URLs per region — production
_SP_BASE_URLS = {
    "NA": "https://sellingpartnerapi-na.amazon.com",
    "EU": "https://sellingpartnerapi-eu.amazon.com",
    "FE": "https://sellingpartnerapi-fe.amazon.com",
}

# SP-API sandbox endpoints (same region keys)
_SP_SANDBOX_URLS = {
    "NA": "https://sandbox.sellingpartnerapi-na.amazon.com",
    "EU": "https://sandbox.sellingpartnerapi-eu.amazon.com",
    "FE": "https://sandbox.sellingpartnerapi-fe.amazon.com",
}

_REPORTS_PATH = "/reports/2021-06-30/reports"
_DOCUMENTS_PATH = "/reports/2021-06-30/documents"


class SpApiService:
    """SP-API client for one seller (one refresh token + marketplace)."""

    MAX_POLL_ATTEMPTS = 60
    POLL_INTERVAL = 15      # seconds
    TOKEN_TTL_SECONDS = 3000  # refresh access token every 50 min

    def __init__(
        self,
        amazon_client_id: str,
        amazon_client_secret: str,
        sp_refresh_token: str,
        sp_marketplace_id: str,
        amazon_region: str,
        settings: Settings,
        sandbox: bool = False,
    ):
        self._client_id = amazon_client_id
        self._client_secret = amazon_client_secret
        self._refresh_token = sp_refresh_token
        self._marketplace_id = sp_marketplace_id
        self._region = amazon_region.upper() if amazon_region else "EU"
        self._settings = settings
        self._sandbox = sandbox
        url_map = _SP_SANDBOX_URLS if sandbox else _SP_BASE_URLS
        self._base_url = url_map.get(self._region, url_map["EU"])
        self._access_token: Optional[str] = None
        self._token_expiry: Optional[datetime] = None

    # ── Token management ──────────────────────────────────────────────────────

    def get_access_token(self, force_refresh: bool = False) -> str:
        if (
            not force_refresh
            and self._access_token
            and self._token_expiry
            and datetime.utcnow() < self._token_expiry
        ):
            return self._access_token

        payload = {
            "grant_type": "refresh_token",
            "refresh_token": self._refresh_token,
            "client_id": self._client_id,
            "client_secret": self._client_secret,
        }
        try:
            resp = requests.post(self._settings.amazon_token_url, data=payload, timeout=15)
        except requests.RequestException as exc:
            raise RuntimeError(f"SP-API token request failed: {exc}") from exc

        if resp.status_code != 200:
            raise RuntimeError(f"SP-API token exchange failed [{resp.status_code}]: {resp.text}")

        data = resp.json()
        self._access_token = data["access_token"]
        expires_in = int(data.get("expires_in", 3600))
        # Refresh 10 minutes before actual expiry
        self._token_expiry = datetime.utcnow() + timedelta(seconds=expires_in - 600)
        logger.debug("SP-API access token refreshed (expires in %ds)", expires_in)
        return self._access_token

    # ── Report lifecycle ──────────────────────────────────────────────────────

    def request_business_report(
        self,
        start_date: str,   # ISO date "2025-06-13"
        end_date: str,
    ) -> str:
        """Create a GET_SALES_AND_TRAFFIC_REPORT and return the reportId."""
        token = self.get_access_token()
        url = f"{self._base_url}{_REPORTS_PATH}"
        body = {
            "reportType": "GET_SALES_AND_TRAFFIC_REPORT",
            "dataStartTime": f"{start_date}T00:00:00Z",
            "dataEndTime": f"{end_date}T23:59:59Z",
            "reportOptions": {
                "dateGranularity": "DAY",
                "asinGranularity": "CHILD",
            },
            "marketplaceIds": [self._marketplace_id],
        }
        headers = {
            "x-amz-access-token": token,
            "Content-Type": "application/json",
        }
        try:
            resp = requests.post(url, headers=headers, json=body, timeout=30)
        except requests.RequestException as exc:
            raise RuntimeError(f"SP-API report request failed: {exc}") from exc

        if resp.status_code not in (200, 202):
            raise RuntimeError(f"SP-API report request [{resp.status_code}]: {resp.text}")

        report_id = resp.json().get("reportId")
        if not report_id:
            raise RuntimeError(f"SP-API returned no reportId: {resp.json()}")
        logger.info("SP-API business report created: %s", report_id)
        return report_id

    def poll_report(self, report_id: str) -> dict:
        """Poll until the report is DONE and return the final status dict."""
        url = f"{self._base_url}{_REPORTS_PATH}/{report_id}"
        token_refreshed_at = datetime.utcnow()

        for attempt in range(self.MAX_POLL_ATTEMPTS):
            if (datetime.utcnow() - token_refreshed_at).total_seconds() > self.TOKEN_TTL_SECONDS:
                self.get_access_token(force_refresh=True)
                token_refreshed_at = datetime.utcnow()

            try:
                resp = requests.get(
                    url,
                    headers={"x-amz-access-token": self.get_access_token()},
                    timeout=30,
                )
            except requests.RequestException:
                time.sleep(self.POLL_INTERVAL)
                continue

            if resp.status_code != 200:
                time.sleep(self.POLL_INTERVAL)
                continue

            data = resp.json()
            processing_status = data.get("processingStatus", "")

            if processing_status in ("IN_QUEUE", "IN_PROGRESS"):
                time.sleep(self.POLL_INTERVAL)
                continue

            if processing_status == "DONE":
                logger.info("SP-API report %s DONE", report_id)
                return data

            if processing_status in ("CANCELLED", "FATAL"):
                raise RuntimeError(f"SP-API report {report_id} {processing_status}: {data}")

            time.sleep(self.POLL_INTERVAL)

        raise RuntimeError(f"SP-API report {report_id} timed out after {self.MAX_POLL_ATTEMPTS} polls")

    def get_document_url(self, report_document_id: str) -> str:
        """Fetch the pre-signed download URL for a report document."""
        url = f"{self._base_url}{_DOCUMENTS_PATH}/{report_document_id}"
        try:
            resp = requests.get(
                url,
                headers={"x-amz-access-token": self.get_access_token()},
                timeout=30,
            )
        except requests.RequestException as exc:
            raise RuntimeError(f"SP-API get document failed: {exc}") from exc

        if resp.status_code != 200:
            raise RuntimeError(f"SP-API get document [{resp.status_code}]: {resp.text}")

        data = resp.json()
        download_url = data.get("url")
        if not download_url:
            raise RuntimeError(f"SP-API document has no URL: {data}")
        return download_url, data.get("compressionAlgorithm", "GZIP")

    def download_report(self, download_url: str, compression: str = "GZIP") -> bytes:
        """Download and decompress the report file. Returns raw bytes."""
        try:
            resp = requests.get(download_url, stream=True, timeout=120)
        except requests.RequestException as exc:
            raise RuntimeError(f"SP-API download failed: {exc}") from exc

        if resp.status_code != 200:
            raise RuntimeError(f"SP-API download [{resp.status_code}]")

        if compression == "GZIP":
            return gzip.decompress(resp.content)
        return resp.content

    def fetch_business_report_bytes(self, start_date: str, end_date: str) -> bytes:
        """Full pipeline: create → poll → download. Returns decompressed report bytes."""
        report_id = self.request_business_report(start_date, end_date)
        status = self.poll_report(report_id)

        report_doc_id = status.get("reportDocumentId")
        if not report_doc_id:
            raise RuntimeError(f"SP-API report {report_id} DONE but no reportDocumentId")

        download_url, compression = self.get_document_url(report_doc_id)
        return self.download_report(download_url, compression)
