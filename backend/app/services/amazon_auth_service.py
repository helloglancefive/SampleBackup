"""Per-client Amazon OAuth2 token management."""
from datetime import datetime, timedelta
from typing import Optional

import requests

from config import Settings


class AmazonAuthService:
    """Manages access token for a single client's Amazon Advertising credentials."""

    def __init__(self, client_id: str, client_secret: str, refresh_token: str, settings: Settings):
        self._amazon_client_id = client_id
        self._amazon_client_secret = client_secret
        self._amazon_refresh_token = refresh_token
        self._settings = settings
        self._access_token: Optional[str] = None
        self._expires_at: Optional[datetime] = None

    def get_access_token(self, force_refresh: bool = False) -> str:
        if not force_refresh and self._access_token and self._is_valid():
            return self._access_token
        return self._refresh()

    def invalidate_cache(self) -> None:
        self._access_token = None
        self._expires_at = None

    def _is_valid(self) -> bool:
        return bool(self._access_token and self._expires_at and datetime.utcnow() < self._expires_at)

    def _refresh(self) -> str:
        payload = {
            "grant_type": "refresh_token",
            "refresh_token": self._amazon_refresh_token,
            "client_id": self._amazon_client_id,
            "client_secret": self._amazon_client_secret,
        }
        try:
            resp = requests.post(self._settings.amazon_token_url, data=payload, timeout=30)
        except requests.RequestException as exc:
            raise RuntimeError(f"Network error refreshing Amazon token: {exc}") from exc

        if resp.status_code != 200:
            raise RuntimeError(f"Amazon token refresh failed [{resp.status_code}]: {resp.text}")

        data = resp.json()
        self._access_token = data["access_token"]
        expires_in = data.get("expires_in", 3600)
        self._expires_at = datetime.utcnow() + timedelta(seconds=expires_in - 60)
        return self._access_token
