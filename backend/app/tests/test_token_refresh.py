import pytest


def _signup_and_login(client, email, password="TestPass123!"):
    client.post("/api/v1/auth/signup", json={
        "email": email,
        "password": password,
        "full_name": "Test User",
    })
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    return resp.json()


def test_refresh_returns_new_token_pair(client):
    tokens = _signup_and_login(client, "refresh1@example.com")
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["refresh_token"] != tokens["refresh_token"]


def test_refresh_rotates_token(client):
    tokens = _signup_and_login(client, "refresh2@example.com")
    old_refresh = tokens["refresh_token"]

    client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})

    # Old token should be revoked and no longer usable
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert resp.status_code == 401


def test_new_access_token_is_valid(client):
    tokens = _signup_and_login(client, "refresh3@example.com")
    new_tokens = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).json()

    resp = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {new_tokens['access_token']}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "refresh3@example.com"


def test_refresh_with_invalid_token(client):
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": "not-a-real-token"})
    assert resp.status_code == 401


def test_refresh_after_logout_fails(client):
    tokens = _signup_and_login(client, "refresh4@example.com")
    refresh_token = tokens["refresh_token"]

    client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})

    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 401


def test_old_access_token_still_valid_after_refresh(client):
    """Access tokens are stateless JWTs — they remain valid until expiry even after rotation."""
    tokens = _signup_and_login(client, "refresh5@example.com")
    old_access = tokens["access_token"]

    client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})

    # Old access token still works (no revocation list for access tokens)
    resp = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {old_access}"})
    assert resp.status_code == 200
