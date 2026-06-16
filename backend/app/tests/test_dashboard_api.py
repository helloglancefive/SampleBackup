"""Tests for /api/v1/dashboard endpoints."""
from datetime import date, timedelta


def test_metrics_unauthenticated(client):
    resp = client.get("/api/v1/dashboard/metrics?client_id=1")
    assert resp.status_code == 401


def test_metrics_empty_db(client, auth_headers):
    # No ad_metrics data — should return zeros, not error
    resp = client.get("/api/v1/dashboard/metrics?client_id=1", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_impressions"] == 0
    assert data["total_clicks"] == 0
    assert float(data["total_cost"]) == 0.0
    assert data["overall_ctr"] is None
    assert data["overall_cpc"] is None
    assert data["overall_acos"] is None
    assert data["overall_roas"] is None
    assert data["records_count"] == 0


def test_metrics_date_defaults(client, auth_headers):
    resp = client.get("/api/v1/dashboard/metrics?client_id=1", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "start_date" in data
    assert "end_date" in data
    # Default window is last 30 days
    start = date.fromisoformat(data["start_date"])
    end = date.fromisoformat(data["end_date"])
    assert (end - start).days == 29


def test_charts_empty_db(client, auth_headers):
    resp = client.get("/api/v1/dashboard/charts?client_id=1", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["series"] == []


def test_summary_empty_db(client, auth_headers):
    resp = client.get("/api/v1/dashboard/summary?client_id=1", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["top_campaigns_by_cost"] == []
    assert data["top_campaigns_by_sales"] == []
    assert data["last_fetch_at"] is None


def test_dashboard_access_denied_for_wrong_client(client, db):
    # Create a Seller user for client 99
    client.post("/api/v1/auth/signup", json={
        "email": "seller99@test.com",
        "password": "Pass123!",
        "full_name": "Seller 99",
    })
    from app.models.user import User
    user = db.query(User).filter(User.email == "seller99@test.com").first()
    user.role = "Seller"
    user.client_id = 99
    db.commit()

    login = client.post("/api/v1/auth/login", json={"email": "seller99@test.com", "password": "Pass123!"})
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    # Should be denied access to client 1's data
    resp = client.get("/api/v1/dashboard/metrics?client_id=1", headers=headers)
    assert resp.status_code == 403


def test_dashboard_metrics_with_data(client, auth_headers, db):
    """Insert campaign_daily_metrics rows and verify aggregation."""
    from app.models.reporting import CampaignDailyMetrics
    from datetime import date

    rows = [
        CampaignDailyMetrics(
            client_id=1, report_type="spCampaigns", date=date(2024, 1, 15),
            campaign_id=111111111111111, campaign_name="Test Campaign",
            impressions=1000, clicks=20, spend=10.00, sales=50.00, orders=2,
        ),
        CampaignDailyMetrics(
            client_id=1, report_type="spCampaigns", date=date(2024, 1, 16),
            campaign_id=111111111111111, campaign_name="Test Campaign",
            impressions=2000, clicks=40, spend=20.00, sales=100.00, orders=4,
        ),
    ]
    for r in rows:
        db.add(r)
    db.commit()

    resp = client.get(
        "/api/v1/dashboard/metrics?client_id=1&start_date=2024-01-01&end_date=2024-01-31",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_impressions"] == 3000
    assert data["total_clicks"] == 60
    assert abs(float(data["total_cost"]) - 30.0) < 0.01
    assert abs(float(data["total_sales_14d"]) - 150.0) < 0.01
    # ROAS = 150/30 = 5.0
    assert abs(float(data["overall_roas"]) - 5.0) < 0.01
    # ACOS = 30/150 = 0.2
    assert abs(float(data["overall_acos"]) - 0.2) < 0.01
    # CTR = 60/3000 = 0.02
    assert abs(float(data["overall_ctr"]) - 0.02) < 0.001
