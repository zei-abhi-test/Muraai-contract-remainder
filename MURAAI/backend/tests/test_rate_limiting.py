import pytest
from src.main import app
from src.services.limiter import limiter


@pytest.fixture(autouse=True)
def enable_limiter():
    with app.app_context():
        limiter.enabled = True
        limiter.reset()
        yield
        limiter.enabled = False


def test_auth_login_rate_limiting(client):
    """Verify rate limit is enforced on /api/auth/login after 5 requests in a minute."""
    for _ in range(5):
        resp = client.post("/api/auth/login", json={"email": "test@example.com", "password": "wrongpassword"})
        assert resp.status_code == 401

    resp = client.post("/api/auth/login", json={"email": "test@example.com", "password": "wrongpassword"})
    assert resp.status_code == 429
    data = resp.get_json()
    assert "error" in data
    assert data["error"] == "Too many requests"


def test_portal_login_rate_limiting(client):
    """Verify rate limit is enforced on /api/portal/auth/login after 5 requests."""
    for _ in range(5):
        resp = client.post("/api/portal/auth/login", json={"email": "portal@example.com", "password": "wrongpassword"})
        assert resp.status_code == 401

    resp = client.post("/api/portal/auth/login", json={"email": "portal@example.com", "password": "wrongpassword"})
    assert resp.status_code == 429
    data = resp.get_json()
    assert "Rate limit exceeded" in data.get("message", "")
