import pytest


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


def test_signup_success(client):
    resp = client.post("/api/v1/auth/signup", json={
        "email": "newuser@example.com",
        "password": "SecurePass123!",
        "full_name": "New User",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "newuser@example.com"
    assert data["full_name"] == "New User"
    assert "password_hash" not in data


def test_signup_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "Pass123!", "full_name": "Dup"}
    client.post("/api/v1/auth/signup", json=payload)
    resp = client.post("/api/v1/auth/signup", json=payload)
    assert resp.status_code == 409


def test_login_success(client):
    client.post("/api/v1/auth/signup", json={
        "email": "login@example.com",
        "password": "LoginPass123!",
        "full_name": "Login User",
    })
    resp = client.post("/api/v1/auth/login", json={
        "email": "login@example.com",
        "password": "LoginPass123!",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client):
    client.post("/api/v1/auth/signup", json={
        "email": "wrongpw@example.com",
        "password": "CorrectPass123!",
        "full_name": "User",
    })
    resp = client.post("/api/v1/auth/login", json={
        "email": "wrongpw@example.com",
        "password": "WrongPassword!",
    })
    assert resp.status_code == 401


def test_login_nonexistent_user(client):
    resp = client.post("/api/v1/auth/login", json={
        "email": "nobody@example.com",
        "password": "Pass123!",
    })
    assert resp.status_code == 401


def test_get_me_authenticated(client):
    client.post("/api/v1/auth/signup", json={
        "email": "getme@example.com",
        "password": "GetMePass123!",
        "full_name": "Get Me",
    })
    login = client.post("/api/v1/auth/login", json={
        "email": "getme@example.com",
        "password": "GetMePass123!",
    })
    token = login.json()["access_token"]
    resp = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "getme@example.com"


def test_get_me_unauthenticated(client):
    resp = client.get("/api/v1/users/me")
    assert resp.status_code == 401


def test_logout(client):
    client.post("/api/v1/auth/signup", json={
        "email": "logout@example.com",
        "password": "LogoutPass123!",
        "full_name": "Logout User",
    })
    login = client.post("/api/v1/auth/login", json={
        "email": "logout@example.com",
        "password": "LogoutPass123!",
    })
    refresh_token = login.json()["refresh_token"]
    resp = client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert resp.status_code == 204


def test_password_reset_request_always_202(client):
    resp = client.post("/api/v1/auth/password-reset", json={"email": "nobody@example.com"})
    assert resp.status_code == 202


def test_invalid_bearer_token(client):
    resp = client.get("/api/v1/users/me", headers={"Authorization": "Bearer invalid.token.here"})
    assert resp.status_code == 401
