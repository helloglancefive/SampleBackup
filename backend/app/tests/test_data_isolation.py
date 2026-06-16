"""Cross-client data isolation — verifies a user cannot access another client's data."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Client, User, SubscriptionTier
from app.security.password import hash_password
from app.security.jwt import create_access_token
from config import get_settings


def _make_client_and_user(db: Session, suffix: str, tier_id: int) -> tuple[int, str]:
    """Create a client + seller user, return (client_id, access_token)."""
    settings = get_settings()
    client = Client(name=f"TestCo {suffix}", subscription_tier_id=tier_id, is_active=True)
    db.add(client)
    db.flush()

    user = User(
        email=f"seller_{suffix}@example.com",
        password_hash=hash_password("password123"),
        full_name=f"Seller {suffix}",
        role="Seller",
        client_id=client.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        {"sub": str(user.id), "client_id": user.client_id, "role": user.role},
        secret=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        expires_minutes=15,
    )
    return client.id, token


def test_dashboard_isolation(client: TestClient, db: Session):
    """User A cannot read User B's dashboard by passing client_id."""
    tier = db.query(SubscriptionTier).first()
    if not tier:
        pytest.skip("No subscription tier in DB")

    _cid_a, token_a = _make_client_and_user(db, "A", tier.id)
    cid_b, _token_b = _make_client_and_user(db, "B", tier.id)

    # User A tries to read client B's dashboard
    resp = client.get(
        f"/api/v1/dashboard/metrics?client_id={cid_b}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"


def test_fetch_history_isolation(client: TestClient, db: Session):
    """User A cannot read User B's fetch history."""
    tier = db.query(SubscriptionTier).first()
    if not tier:
        pytest.skip("No subscription tier in DB")

    _cid_a, token_a = _make_client_and_user(db, "C", tier.id)
    cid_b, _token_b = _make_client_and_user(db, "D", tier.id)

    resp = client.get(
        f"/api/v1/reports/fetch-history?client_id={cid_b}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"


def test_credentials_isolation(client: TestClient, db: Session):
    """User A cannot read User B's credentials status via /{client_id} endpoint."""
    tier = db.query(SubscriptionTier).first()
    if not tier:
        pytest.skip("No subscription tier in DB")

    _cid_a, token_a = _make_client_and_user(db, "E", tier.id)
    cid_b, _token_b = _make_client_and_user(db, "F", tier.id)

    resp = client.get(
        f"/api/v1/clients/{cid_b}/credentials/status",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"


def test_admin_can_cross_client(client: TestClient, db: Session):
    """Admin role can access any client's data."""
    tier = db.query(SubscriptionTier).first()
    if not tier:
        pytest.skip("No subscription tier in DB")

    cid_b, _token_b = _make_client_and_user(db, "G", tier.id)

    # Create admin user (no client_id required)
    admin = User(
        email="isolation_admin@example.com",
        password_hash=hash_password("password123"),
        full_name="Isolation Admin",
        role="Admin",
        client_id=None,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    settings = get_settings()
    admin_token = create_access_token(
        {"sub": str(admin.id), "client_id": None, "role": "Admin"},
        secret=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        expires_minutes=15,
    )

    resp = client.get(
        f"/api/v1/dashboard/metrics?client_id={cid_b}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    # Admin should get 200 (even if no data — not a 403)
    assert resp.status_code == 200, f"Expected 200 for admin, got {resp.status_code}: {resp.text}"
