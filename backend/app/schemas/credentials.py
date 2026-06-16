from typing import Literal
from pydantic import BaseModel


class CredentialsCreate(BaseModel):
    # Ads API (required)
    amazon_client_id: str
    amazon_client_secret: str
    amazon_refresh_token: str
    amazon_profile_id: str = ""

    # SP-API (optional — stored only when seller connects SP access)
    sp_refresh_token: str = ""
    sp_seller_id: str = ""
    sp_marketplace_id: str = ""

    # Region governs both Ads and SP-API endpoint selection
    amazon_region: Literal["NA", "EU", "FE"] = "EU"


class SpApiCredentialsUpdate(BaseModel):
    """Lightweight update for SP-API fields only — does not touch Ads API tokens."""
    sp_refresh_token: str
    sp_seller_id: str
    sp_marketplace_id: str
    amazon_region: Literal["NA", "EU", "FE"] = "EU"


class CredentialsStatus(BaseModel):
    has_ads_credentials: bool
    has_sp_credentials: bool
    is_active: bool
    amazon_profile_id: str | None
    sp_seller_id: str | None
    sp_marketplace_id: str | None
    amazon_region: str
    last_token_refresh: str | None
    sp_last_token_refresh: str | None
