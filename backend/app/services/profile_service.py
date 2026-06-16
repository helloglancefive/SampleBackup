"""Amazon Advertising profile discovery."""
from typing import Optional

import requests

from config import Settings
from app.services.amazon_auth_service import AmazonAuthService


class ProfileService:
    def __init__(self, auth: AmazonAuthService, settings: Settings):
        self._auth = auth
        self._settings = settings

    def get_profiles(self) -> list:
        token = self._auth.get_access_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Amazon-Advertising-API-ClientId": self._auth._amazon_client_id,
            "Content-Type": "application/json",
        }
        try:
            resp = requests.get(self._settings.amazon_profiles_url, headers=headers, timeout=30)
        except requests.RequestException as exc:
            raise RuntimeError(f"Network error fetching profiles: {exc}") from exc

        if resp.status_code != 200:
            raise RuntimeError(f"Failed to fetch profiles [{resp.status_code}]: {resp.text}")

        return resp.json()

    def get_primary_profile_id(self) -> Optional[str]:
        profiles = self.get_profiles()
        if profiles:
            return str(profiles[0].get("profileId"))
        return None
