"""
Platform auth service — handles user login, JWT issuance, token refresh/revocation.
Not to be confused with amazon_auth_service (Phase 2) which manages Amazon OAuth.
"""
import secrets
from datetime import datetime, timedelta, timezone
from hashlib import sha256

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import User, RefreshToken
from app.security.jwt import create_access_token
from app.security.password import hash_password, verify_password
from config import get_settings


def _hash_token(token: str) -> str:
    return sha256(token.encode()).hexdigest()


def login(email: str, password: str, db: Session) -> dict:
    settings = get_settings()
    user = db.query(User).filter(User.email == email, User.deleted_at.is_(None)).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account inactive")

    access_token = create_access_token(
        data={"sub": str(user.id), "client_id": user.client_id, "role": user.role},
        secret=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        expires_minutes=settings.access_token_expire_minutes,
    )
    raw_refresh = secrets.token_hex(64)
    refresh_token_obj = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(raw_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(refresh_token_obj)
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    return {"access_token": access_token, "refresh_token": raw_refresh, "user": user}


def signup(email: str, password: str, full_name: str, db: Session, role: str = "Seller", client_id: int | None = None) -> User:
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        role=role,
        client_id=client_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def refresh_tokens(raw_refresh_token: str, db: Session) -> dict:
    settings = get_settings()
    token_hash = _hash_token(raw_refresh_token)
    token_obj = db.query(RefreshToken).filter(
        RefreshToken.token_hash == token_hash,
        RefreshToken.revoked.is_(False),
    ).first()

    if not token_obj:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or revoked refresh token")

    now = datetime.now(timezone.utc)
    expires = token_obj.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    # Rotate: revoke old
    token_obj.revoked = True
    token_obj.revoked_at = now

    user = db.query(User).filter(User.id == token_obj.user_id).first()
    access_token = create_access_token(
        data={"sub": str(user.id), "client_id": user.client_id, "role": user.role},
        secret=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        expires_minutes=settings.access_token_expire_minutes,
    )
    new_raw = secrets.token_hex(64)
    new_token_obj = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(new_raw),
        expires_at=now + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(new_token_obj)
    db.commit()
    return {"access_token": access_token, "refresh_token": new_raw}


def logout(raw_refresh_token: str, db: Session) -> None:
    token_hash = _hash_token(raw_refresh_token)
    token_obj = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if token_obj and not token_obj.revoked:
        token_obj.revoked = True
        token_obj.revoked_at = datetime.now(timezone.utc)
        db.commit()
