"""Amazon API authentication."""
from datetime import datetime, timedelta
from typing import Optional
import requests
from .config import get_settings
from .logger import setup_logger

logger = setup_logger(__name__)


class AuthService:
    """Manages Amazon API authentication and token caching."""

    def __init__(self):
        self.settings = get_settings()
        self._cached_token: Optional[str] = None
        self._token_expires_at: Optional[datetime] = None

    def get_access_token(self, force_refresh: bool = False) -> str:
        """Get valid access token, using cache if available."""
        if not force_refresh and self._cached_token and self._is_token_valid():
            logger.debug("Using cached access token")
            return self._cached_token

        logger.info("Refreshing access token from Amazon API")
        return self._refresh_token()

    def _refresh_token(self) -> str:
        """Refresh access token using refresh token."""
        payload = {
            'grant_type': 'refresh_token',
            'refresh_token': self.settings.amazon_refresh_token,
            'client_id': self.settings.amazon_client_id,
            'client_secret': self.settings.amazon_client_secret
        }

        try:
            response = requests.post(
                self.settings.amazon_token_url,
                data=payload,
                timeout=30
            )

            if response.status_code == 200:
                data = response.json()
                access_token = data['access_token']
                expires_in = data.get('expires_in', 3600)

                self._cached_token = access_token
                self._token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in - 60)

                logger.info(f"Access token refreshed (expires in {expires_in}s)")
                return access_token
            else:
                raise Exception(f"Token refresh failed [{response.status_code}]: {response.text}")

        except requests.RequestException as e:
            raise Exception(f"Network error during token refresh: {str(e)}")

    def _is_token_valid(self) -> bool:
        """Check if cached token is still valid."""
        if not self._cached_token or not self._token_expires_at:
            return False
        return datetime.utcnow() < self._token_expires_at

    def invalidate_cache(self):
        """Invalidate cached token."""
        self._cached_token = None
        self._token_expires_at = None
        logger.info("Token cache invalidated")


_auth_service: Optional[AuthService] = None


def get_auth_service() -> AuthService:
    """Get authentication service singleton."""
    global _auth_service
    if _auth_service is None:
        _auth_service = AuthService()
    return _auth_service
