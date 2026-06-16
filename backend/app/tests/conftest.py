import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.user import User
from app.dependencies import get_db
from main import app


@pytest.fixture(autouse=True)
def disable_rate_limiting():
    """Disable slowapi enforcement so tests never trip rate limits.

    @limiter.limit decorators are applied at import time, so we must patch
    the internal hit() method on the storage backend, not the decorator factory.
    """
    from app.rate_limit import limiter
    storage = limiter._limiter  # limits.storage.MemoryStorage
    original_hit = storage.hit
    storage.hit = lambda *args, **kwargs: True  # always allow
    yield
    storage.hit = original_hit

TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    Base.metadata.create_all(bind=engine)
    # Seed a Free tier so data-isolation fixtures can create clients
    from app.models.subscription_tier import SubscriptionTier
    session = TestingSessionLocal()
    try:
        if not session.query(SubscriptionTier).first():
            session.add(SubscriptionTier(
                name="Free", price_monthly=0.0, max_clients=1,
                max_users_per_client=3, report_fetch_freq=1440,
                export_limit_monthly=10, api_access=False,
            ))
            session.commit()
    finally:
        session.close()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture()
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def admin_token(client, db):
    client.post("/api/v1/auth/signup", json={
        "email": "admin@test.com",
        "password": "AdminPass123!",
        "full_name": "Test Admin",
    })
    # Public signup defaults to Seller — elevate to Admin for tests
    user = db.query(User).filter(User.email == "admin@test.com").first()
    if user and user.role != "Admin":
        user.role = "Admin"
        db.commit()
    resp = client.post("/api/v1/auth/login", json={
        "email": "admin@test.com",
        "password": "AdminPass123!",
    })
    return resp.json()["access_token"]


@pytest.fixture()
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}
