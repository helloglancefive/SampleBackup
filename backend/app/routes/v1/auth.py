import secrets
from datetime import datetime, timedelta, timezone
from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models import User, PasswordResetToken, RefreshToken
from app.models.client import Client
from app.rate_limit import limiter
from app.schemas.auth import (
    LoginRequest, SignupRequest, TokenResponse,
    RefreshRequest, PasswordResetRequest, PasswordResetConfirm,
    ClientSignupRequest, ClientSignupResponse,
)
from app.schemas.user import UserResponse
from app.services import auth_service
from app.security.password import hash_password
from app.security.jwt import create_access_token
from config import get_settings

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/signup", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
@limiter.limit("10/minute")
def signup(request: Request, body: SignupRequest, db: Session = Depends(get_db)):
    user = auth_service.signup(body.email, body.password, body.full_name, db)
    return user


@router.post("/client-signup", status_code=status.HTTP_201_CREATED, response_model=ClientSignupResponse)
@limiter.limit("5/minute")
def client_signup(request: Request, body: ClientSignupRequest, db: Session = Depends(get_db)):
    """Public endpoint: register a new business + owner account in one step, returns JWT tokens."""
    settings = get_settings()

    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    # Create client (business) record
    client = Client(
        name=body.business_name,
        amazon_region=body.amazon_region,
        subscription_status="Trial",
    )
    db.add(client)
    db.flush()  # populate client.id without full commit

    # Create owner user linked to client
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role="Seller",
        client_id=client.id,
    )
    db.add(user)
    db.flush()  # populate user.id

    # Issue JWT tokens (auto-login after signup)
    access_token = create_access_token(
        data={"sub": str(user.id), "client_id": user.client_id, "role": user.role},
        secret=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        expires_minutes=settings.access_token_expire_minutes,
    )
    raw_refresh = secrets.token_hex(64)
    token_hash = sha256(raw_refresh.encode()).hexdigest()
    refresh_obj = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(refresh_obj)
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    return ClientSignupResponse(access_token=access_token, refresh_token=raw_refresh)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    result = auth_service.login(body.email, body.password, db)
    return TokenResponse(access_token=result["access_token"], refresh_token=result["refresh_token"])


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    result = auth_service.refresh_tokens(body.refresh_token, db)
    return TokenResponse(access_token=result["access_token"], refresh_token=result["refresh_token"])


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: RefreshRequest, db: Session = Depends(get_db)):
    auth_service.logout(body.refresh_token, db)


@router.post("/password-reset", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
def request_password_reset(request: Request, body: PasswordResetRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email, User.deleted_at.is_(None)).first()
    if user:
        raw_token = secrets.token_hex(32)
        token_hash = sha256(raw_token.encode()).hexdigest()
        reset_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        db.add(reset_token)
        db.commit()
        from app.services.email_service import send_password_reset_email
        send_password_reset_email(user.email, raw_token)
    return {"message": "If the email exists, a reset link was sent"}


@router.put("/password-reset", status_code=status.HTTP_200_OK)
def confirm_password_reset(body: PasswordResetConfirm, db: Session = Depends(get_db)):
    token_hash = sha256(body.token.encode()).hexdigest()
    reset_obj = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.used.is_(False),
    ).first()
    if not reset_obj:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    now = datetime.now(timezone.utc)
    expires = reset_obj.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reset token expired")
    user = db.query(User).filter(User.id == reset_obj.user_id).first()
    user.password_hash = hash_password(body.new_password)
    reset_obj.used = True
    db.commit()
    return {"message": "Password updated"}
