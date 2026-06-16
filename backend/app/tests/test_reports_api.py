"""Tests for /api/v1/reports endpoints — Celery task queue mocked."""
from unittest.mock import MagicMock, patch


def test_fetch_unauthenticated(client):
    resp = client.post("/api/v1/reports/fetch", json={
        "client_id": 1,
        "report_types": ["spCampaigns"],
        "start_date": "2024-01-01",
        "end_date": "2024-01-07",
    })
    assert resp.status_code == 401


def test_fetch_invalid_report_type(client, auth_headers):
    resp = client.post("/api/v1/reports/fetch", json={
        "client_id": 1,
        "report_types": ["notARealType"],
        "start_date": "2024-01-01",
        "end_date": "2024-01-07",
    }, headers=auth_headers)
    assert resp.status_code == 422


def test_fetch_queued_successfully(client, auth_headers):
    mock_task = MagicMock()
    mock_task.id = "test-task-uuid-1234"

    with patch("app.utils.queue_health._broker_reachable", return_value=True), \
         patch("app.tasks.fetch_reports.fetch_reports_for_client.delay", return_value=mock_task):
        resp = client.post("/api/v1/reports/fetch", json={
            "client_id": 1,
            "report_types": ["spCampaigns"],
            "start_date": "2024-01-01",
            "end_date": "2024-01-07",
        }, headers=auth_headers)

    assert resp.status_code == 202
    data = resp.json()
    assert data["task_id"] == "test-task-uuid-1234"
    assert data["client_id"] == 1
    assert "spCampaigns" in data["report_types"]


def test_fetch_history_requires_auth(client):
    resp = client.get("/api/v1/reports/fetch-history?client_id=1")
    assert resp.status_code == 401


def test_fetch_history_empty_for_admin(client, auth_headers):
    resp = client.get("/api/v1/reports/fetch-history?client_id=9999", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


def test_task_status_requires_auth(client):
    resp = client.get("/api/v1/reports/fetch/some-task-id/status")
    assert resp.status_code == 401


def test_task_status_returns_state(client, auth_headers):
    # Without Redis running, the route either returns 200 (PENDING) or 503 (Redis down)
    resp = client.get("/api/v1/reports/fetch/nonexistent-task-id/status", headers=auth_headers)
    assert resp.status_code in (200, 503)
    if resp.status_code == 200:
        data = resp.json()
        assert "task_id" in data
        assert "state" in data
