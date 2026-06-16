"""Amazon Advertising profile management."""
from typing import Optional
import requests
from .config import get_settings
from .auth import get_auth_service
from .logger import setup_logger

logger = setup_logger(__name__)


class ProfileService:
    """Manages Amazon Advertising profile information."""

    def __init__(self):
        self.settings = get_settings()
        self.auth_service = get_auth_service()

    def get_primary_profile_id(self) -> Optional[str]:
        """Get the primary (first) profile ID."""
        profiles = self.get_profiles()
        if profiles and len(profiles) > 0:
            profile_id = profiles[0].get('profileId')
            logger.info(f"Using profile ID: {profile_id}")
            return str(profile_id)
        logger.warning("No profile found")
        return None

    def get_profiles(self) -> list:
        """Get all advertising profiles from Amazon API."""
        access_token = self.auth_service.get_access_token()

        headers = {
            'Authorization': f'Bearer {access_token}',
            'Amazon-Advertising-API-ClientId': self.settings.amazon_client_id,
            'Content-Type': 'application/json'
        }

        try:
            response = requests.get(
                self.settings.amazon_profiles_url,
                headers=headers,
                timeout=30
            )

            if response.status_code == 200:
                profiles = response.json()
                logger.info(f"Retrieved {len(profiles)} profiles")
                return profiles
            else:
                raise Exception(f"Failed to get profiles [{response.status_code}]: {response.text}")

        except requests.RequestException as e:
            raise Exception(f"Network error fetching profiles: {str(e)}")


_profile_service: Optional[ProfileService] = None


def get_profile_service() -> ProfileService:
    """Get profile service singleton."""
    global _profile_service
    if _profile_service is None:
        _profile_service = ProfileService()
    return _profile_service
