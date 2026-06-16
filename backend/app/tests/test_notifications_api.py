"""Tests for /api/v1/notifications endpoints."""


def test_list_notifications_unauthenticated(client):
    resp = client.get("/api/v1/notifications")
    assert resp.status_code == 401


def test_list_notifications_empty(client, auth_headers):
    resp = client.get("/api/v1/notifications", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


def test_unread_count_zero(client, auth_headers):
    resp = client.get("/api/v1/notifications/unread-count", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["count"] == 0


def test_create_and_list_notification(client, auth_headers, db):
    from app.models.user import User
    from app.services.notification_service import create_notification

    user = db.query(User).filter(User.email == "admin@test.com").first()
    create_notification(db, notif_type="fetch_complete", message="spCampaigns fetch done", user_id=user.id)

    resp = client.get("/api/v1/notifications", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()["items"]
    assert len(data) >= 1
    assert data[0]["type"] == "fetch_complete"
    assert data[0]["is_read"] is False


def test_unread_count_after_create(client, auth_headers, db):
    from app.models.user import User
    from app.services.notification_service import create_notification

    user = db.query(User).filter(User.email == "admin@test.com").first()
    create_notification(db, notif_type="alert", message="Test alert", user_id=user.id)

    resp = client.get("/api/v1/notifications/unread-count", headers=auth_headers)
    assert resp.json()["count"] >= 1


def test_mark_read(client, auth_headers, db):
    from app.models.user import User
    from app.services.notification_service import create_notification

    user = db.query(User).filter(User.email == "admin@test.com").first()
    notif = create_notification(db, notif_type="info", message="Mark me read", user_id=user.id)

    resp = client.post(
        "/api/v1/notifications/mark-read",
        json={"notification_ids": [notif.id]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["marked_read"] == 1

    resp2 = client.get("/api/v1/notifications?unread_only=true", headers=auth_headers)
    ids = [n["id"] for n in resp2.json()["items"]]
    assert notif.id not in ids


def test_mark_all_read(client, auth_headers, db):
    from app.models.user import User
    from app.services.notification_service import create_notification

    user = db.query(User).filter(User.email == "admin@test.com").first()
    create_notification(db, notif_type="info", message="One", user_id=user.id)
    create_notification(db, notif_type="info", message="Two", user_id=user.id)

    resp = client.post("/api/v1/notifications/mark-all-read", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["marked_read"] >= 2

    count_resp = client.get("/api/v1/notifications/unread-count", headers=auth_headers)
    assert count_resp.json()["count"] == 0
