from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user, require_role
from app.models import User, Client, ClientAmazonCredentials
from app.schemas.client import ClientResponse, ClientCreate, ClientUpdate
from app.schemas.credentials import CredentialsCreate, SpApiCredentialsUpdate, CredentialsStatus

router = APIRouter(prefix="/api/v1/clients", tags=["clients"])


# ── Helpers ─────────────────────────────────────────────────────────────────

def _get_settings_and_key():
    from config import get_settings
    from app.security.encryption import encrypt_credential
    settings = get_settings()
    if not settings.encryption_key:
        raise HTTPException(status_code=500, detail="Encryption not configured")
    return settings, encrypt_credential


def _build_status(creds: ClientAmazonCredentials | None) -> CredentialsStatus:
    if not creds:
        return CredentialsStatus(
            has_ads_credentials=False, has_sp_credentials=False, is_active=False,
            amazon_profile_id=None, sp_seller_id=None, sp_marketplace_id=None,
            amazon_region="EU", last_token_refresh=None, sp_last_token_refresh=None,
        )
    return CredentialsStatus(
        has_ads_credentials=bool(creds.amazon_refresh_token),
        has_sp_credentials=bool(creds.sp_refresh_token),
        is_active=creds.is_active,
        amazon_profile_id=creds.amazon_profile_id,
        sp_seller_id=creds.sp_seller_id,
        sp_marketplace_id=creds.sp_marketplace_id,
        amazon_region=creds.amazon_region or "EU",
        last_token_refresh=creds.last_token_refresh.isoformat() if creds.last_token_refresh else None,
        sp_last_token_refresh=creds.sp_last_token_refresh.isoformat() if creds.sp_last_token_refresh else None,
    )


def _apply_creds(creds: ClientAmazonCredentials, body: CredentialsCreate, encrypt) -> None:
    key = None
    from config import get_settings
    settings = get_settings()
    key = settings.encryption_key

    creds.amazon_client_id = encrypt(body.amazon_client_id, key)
    creds.amazon_client_secret = encrypt(body.amazon_client_secret, key)
    creds.amazon_refresh_token = encrypt(body.amazon_refresh_token, key)
    creds.amazon_profile_id = body.amazon_profile_id or None
    creds.amazon_region = body.amazon_region

    if body.sp_refresh_token:
        creds.sp_refresh_token = encrypt(body.sp_refresh_token, key)
    if body.sp_seller_id:
        creds.sp_seller_id = body.sp_seller_id
    if body.sp_marketplace_id:
        creds.sp_marketplace_id = body.sp_marketplace_id

    creds.is_active = True


# ── Client CRUD ──────────────────────────────────────────────────────────────

@router.get("/me", response_model=ClientResponse)
def get_my_client(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.client_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No client associated with this user")
    client = db.query(Client).filter(Client.id == current_user.client_id).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


@router.get("", response_model=list[ClientResponse])
def list_clients(
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("Admin")),
):
    offset = (page - 1) * per_page
    return db.query(Client).offset(offset).limit(per_page).all()


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    body: ClientCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("Admin")),
):
    client = Client(**body.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "Admin" and current_user.client_id != client_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: int,
    body: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("Admin", "Seller"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    if current_user.role == "Seller" and current_user.client_id != client_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(client, field, value)
    db.commit()
    db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("Admin")),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    db.delete(client)
    db.commit()


# ── Credentials (own client) ─────────────────────────────────────────────────

@router.get("/me/credentials/status", response_model=CredentialsStatus)
def my_credentials_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.client_id:
        return _build_status(None)
    creds = db.query(ClientAmazonCredentials).filter(
        ClientAmazonCredentials.client_id == current_user.client_id
    ).first()
    return _build_status(creds)


@router.put("/me/credentials", status_code=status.HTTP_200_OK)
def update_my_credentials(
    body: CredentialsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("Admin", "Seller"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    if not current_user.client_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No client associated with this account")
    settings, encrypt = _get_settings_and_key()
    creds = db.query(ClientAmazonCredentials).filter(
        ClientAmazonCredentials.client_id == current_user.client_id
    ).first()
    if not creds:
        creds = ClientAmazonCredentials(client_id=current_user.client_id)
        db.add(creds)
    _apply_creds(creds, body, encrypt)
    db.commit()
    return {"message": "Credentials updated"}


@router.put("/me/credentials/sp-api", status_code=status.HTTP_200_OK)
def update_my_sp_credentials(
    body: SpApiCredentialsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update SP-API credentials only (Ads API tokens are unchanged)."""
    if current_user.role not in ("Admin", "Seller"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    if not current_user.client_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No client associated with this account")
    settings, encrypt = _get_settings_and_key()
    key = settings.encryption_key
    creds = db.query(ClientAmazonCredentials).filter(
        ClientAmazonCredentials.client_id == current_user.client_id
    ).first()
    if not creds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connect Ads API credentials first")
    creds.sp_refresh_token = encrypt(body.sp_refresh_token, key)
    creds.sp_seller_id = body.sp_seller_id
    creds.sp_marketplace_id = body.sp_marketplace_id
    creds.amazon_region = body.amazon_region
    db.commit()
    return {"message": "SP-API credentials updated"}


# ── Credentials (by client_id, Admin or own Seller) ─────────────────────────

@router.get("/{client_id}/credentials/status", response_model=CredentialsStatus)
def credentials_status(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "Admin" and current_user.client_id != client_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    creds = db.query(ClientAmazonCredentials).filter(
        ClientAmazonCredentials.client_id == client_id
    ).first()
    return _build_status(creds)


@router.put("/{client_id}/credentials", status_code=status.HTTP_200_OK)
def update_credentials(
    client_id: int,
    body: CredentialsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in ("Admin", "Seller") or (
        current_user.role == "Seller" and current_user.client_id != client_id
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    settings, encrypt = _get_settings_and_key()
    creds = db.query(ClientAmazonCredentials).filter(
        ClientAmazonCredentials.client_id == client_id
    ).first()
    if not creds:
        creds = ClientAmazonCredentials(client_id=client_id)
        db.add(creds)
    _apply_creds(creds, body, encrypt)
    db.commit()
    return {"message": "Credentials updated"}


@router.put("/{client_id}/credentials/sp-api", status_code=status.HTTP_200_OK)
def update_sp_credentials(
    client_id: int,
    body: SpApiCredentialsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update SP-API credentials for a specific client."""
    if current_user.role not in ("Admin", "Seller") or (
        current_user.role == "Seller" and current_user.client_id != client_id
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    settings, encrypt = _get_settings_and_key()
    key = settings.encryption_key
    creds = db.query(ClientAmazonCredentials).filter(
        ClientAmazonCredentials.client_id == client_id
    ).first()
    if not creds:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connect Ads API credentials first")
    creds.sp_refresh_token = encrypt(body.sp_refresh_token, key)
    creds.sp_seller_id = body.sp_seller_id
    creds.sp_marketplace_id = body.sp_marketplace_id
    creds.amazon_region = body.amazon_region
    db.commit()
    return {"message": "SP-API credentials updated"}
