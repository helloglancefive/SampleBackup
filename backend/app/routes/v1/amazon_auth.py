"""Amazon OAuth 2.0 routes for Ads API and SP-API authorization code flows.

Flow overview
-------------
1. GET  /ads/url   -- authenticated user fetches consent URL; browser redirects to Amazon
2. Amazon redirects to {FRONTEND_URL}/callback with ?code=...&state=...
3. POST /ads/exchange  -- frontend sends code + state; backend exchanges for tokens, stores them

Same pattern for SP-API (spapi_oauth_code instead of code, selling_partner_id extra param).

The `state` token is a short-lived JWT signed with JWT_SECRET.  It encodes the client_id so
the exchange endpoint knows whose credentials to update -- no separate auth required there.
"""
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models import User, ClientAmazonCredentials
from app.security.encryption import encrypt_credential
from config import get_settings

router = APIRouter(prefix="/api/v1/auth/amazon", tags=["amazon-oauth"])

_LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token"
_ADS_OAUTH_BASE = "https://www.amazon.com/ap/oa"
_SP_CONSENT_BASE = "https://sellercentral.amazon.com/apps/authorize/consent"

# Marketplace -> region mapping (EU = default for India A21TJRUUN4KGV)
_FE_MARKETPLACES = {"A1VC38T7YXB528", "A39IBJ37TRP1C6"}
_EU_MARKETPLACES = {
    "A13V1IB3VIYZZH", "A1AM78C64UM0Y8", "A1C3SOZRARQ6R3", "A1F83G8C2ARO7P",
    "A1PA6795UKMFR9", "A1RKKUPIHCS9HS", "A21TJRUUN4KGV", "A33AVAJ2PDY3EV",
    "A39IBJ37TRP1C6", "AMEN7PMS3EDWL", "APJ6JRA9NG5V4",
}


# ── Request bodies ────────────────────────────────────────────────────────────

class AdsExchangeBody(BaseModel):
    code: str
    state: str


class SpExchangeBody(BaseModel):
    spapi_oauth_code: str
    state: str
    selling_partner_id: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_state(client_id: int, flow: str, extra: dict | None = None) -> str:
    from jose import jwt
    s = get_settings()
    payload = {
        "sub": str(client_id),
        "type": flow,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
        **(extra or {}),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm=s.jwt_algorithm)


def _verify_state(token: str, expected_type: str) -> dict:
    from jose import jwt, JWTError
    s = get_settings()
    try:
        payload = jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid OAuth state token: {exc}")
    if payload.get("type") != expected_type:
        raise HTTPException(status_code=400, detail="OAuth flow type mismatch in state")
    return payload


def _lwa_exchange(code: str, redirect_uri: str, client_id: str, client_secret: str) -> dict:
    resp = requests.post(
        _LWA_TOKEN_URL,
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": client_id,
            "client_secret": client_secret,
        },
        timeout=15,
    )
    if not resp.ok:
        raise HTTPException(
            status_code=502,
            detail=f"LWA token exchange failed [{resp.status_code}]: {resp.text[:300]}",
        )
    return resp.json()


def _region_for(marketplace_id: str) -> str:
    if marketplace_id in _FE_MARKETPLACES:
        return "FE"
    if marketplace_id in _EU_MARKETPLACES:
        return "EU"
    return "NA"


# ── Ads API ───────────────────────────────────────────────────────────────────

@router.get("/ads/url")
def get_ads_auth_url(current_user: User = Depends(get_current_user)):
    """Return Amazon Advertising API OAuth consent URL for the current client."""
    s = get_settings()
    if not s.amazon_ads_client_id:
        raise HTTPException(503, "AMAZON_ADS_CLIENT_ID not configured in .env")
    if not current_user.client_id:
        raise HTTPException(400, "No client associated with this account")

    state = _make_state(current_user.client_id, "ads")
    params = {
        "client_id": s.amazon_ads_client_id,
        "scope": "advertising::campaign_management",
        "response_type": "code",
        "redirect_uri": f"{s.frontend_url}/callback",
        "state": state,
    }
    return {"url": f"{_ADS_OAUTH_BASE}?{urlencode(params)}"}


@router.post("/ads/exchange")
def exchange_ads_code(body: AdsExchangeBody, db: Session = Depends(get_db)):
    """Exchange an Ads API authorization code for tokens and store credentials.

    Called by the frontend /callback page after Amazon redirects back.
    No user authentication required -- the signed state JWT proves identity.
    """
    s = get_settings()
    key = s.encryption_key
    if not key:
        raise HTTPException(500, "Encryption not configured")
    if not s.amazon_ads_client_id or not s.amazon_ads_client_secret:
        raise HTTPException(503, "Platform Ads API credentials not configured")

    payload = _verify_state(body.state, "ads")
    client_id = int(payload["sub"])

    tokens = _lwa_exchange(
        code=body.code,
        redirect_uri=f"{s.frontend_url}/callback",
        client_id=s.amazon_ads_client_id,
        client_secret=s.amazon_ads_client_secret,
    )
    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        raise HTTPException(502, "LWA response did not include a refresh_token")

    creds = db.query(ClientAmazonCredentials).filter(
        ClientAmazonCredentials.client_id == client_id
    ).first()
    if not creds:
        creds = ClientAmazonCredentials(client_id=client_id)
        db.add(creds)

    # Store platform LWA creds in per-client columns for backwards-compat with fetch services
    creds.amazon_client_id = encrypt_credential(s.amazon_ads_client_id, key)
    creds.amazon_client_secret = encrypt_credential(s.amazon_ads_client_secret, key)
    creds.amazon_refresh_token = encrypt_credential(refresh_token, key)
    creds.last_token_refresh = datetime.now(timezone.utc)
    creds.is_active = True
    db.commit()

    return {"message": "Amazon Advertising API connected successfully"}


# ── SP-API ────────────────────────────────────────────────────────────────────

@router.get("/sp/url")
def get_sp_auth_url(
    marketplace_id: str = Query("A21TJRUUN4KGV", description="Amazon Marketplace ID"),
    current_user: User = Depends(get_current_user),
):
    """Return Amazon SP-API OAuth consent URL for the current client."""
    s = get_settings()
    if not s.sp_api_application_id:
        raise HTTPException(503, "SP_API_APPLICATION_ID not configured in .env")
    if not current_user.client_id:
        raise HTTPException(400, "No client associated with this account")

    state = _make_state(current_user.client_id, "sp", {"mkt": marketplace_id})
    params = {
        "application_id": s.sp_api_application_id,
        "state": state,
        "version": "beta",  # required while app is under Amazon review
    }
    return {"url": f"{_SP_CONSENT_BASE}?{urlencode(params)}"}


@router.post("/sp/exchange")
def exchange_sp_code(body: SpExchangeBody, db: Session = Depends(get_db)):
    """Exchange an SP-API authorization code for tokens and store credentials.

    Called by the frontend /callback page after Amazon redirects back.
    No user authentication required -- the signed state JWT proves identity.
    """
    s = get_settings()
    key = s.encryption_key
    if not key:
        raise HTTPException(500, "Encryption not configured")

    payload = _verify_state(body.state, "sp")
    client_id = int(payload["sub"])
    marketplace_id = payload.get("mkt", "A21TJRUUN4KGV")

    lwa_cid = s.sp_api_client_id or s.amazon_ads_client_id
    lwa_cs = s.sp_api_client_secret or s.amazon_ads_client_secret
    if not lwa_cid or not lwa_cs:
        raise HTTPException(503, "SP-API LWA credentials not configured")

    tokens = _lwa_exchange(
        code=body.spapi_oauth_code,
        redirect_uri=f"{s.frontend_url}/callback",
        client_id=lwa_cid,
        client_secret=lwa_cs,
    )
    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        raise HTTPException(502, "LWA response did not include a refresh_token")

    region = _region_for(marketplace_id)

    creds = db.query(ClientAmazonCredentials).filter(
        ClientAmazonCredentials.client_id == client_id
    ).first()
    if not creds:
        # SP-API connected before Ads API -- create a minimal row
        creds = ClientAmazonCredentials(
            client_id=client_id,
            amazon_client_id=encrypt_credential(lwa_cid, key),
            amazon_client_secret=encrypt_credential(lwa_cs, key),
            amazon_refresh_token=encrypt_credential("pending_ads_oauth", key),
            is_active=False,
        )
        db.add(creds)

    creds.sp_refresh_token = encrypt_credential(refresh_token, key)
    creds.sp_seller_id = body.selling_partner_id
    creds.sp_marketplace_id = marketplace_id
    creds.amazon_region = region
    creds.sp_last_token_refresh = datetime.now(timezone.utc)
    db.commit()

    return {
        "message": "Amazon SP-API connected successfully",
        "seller_id": body.selling_partner_id,
        "marketplace_id": marketplace_id,
        "region": region,
    }
