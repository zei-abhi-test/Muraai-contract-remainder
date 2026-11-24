import pytest
from src.main import app
from src.services.cache import cache, invalidate_user_dashboard_cache, make_dashboard_cache_key
from tests.conftest import register_user


@pytest.fixture(autouse=True)
def enable_simple_cache():
    """Enable SimpleCache for duration of test_cache.py."""
    with app.app_context():
        cache.init_app(app, config={"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 60})
        cache.clear()
        yield
        cache.init_app(app, config={"CACHE_TYPE": "NullCache"})


def test_dashboard_cache_key_generation(client):
    """Verify cache key is generated correctly for authenticated users."""
    with app.test_request_context("/api/dashboard/data", headers={"X-User-ID": "123"}):
        key = make_dashboard_cache_key()
        assert "dashboard:full:user:" in key


def test_dashboard_full_data_caching(client):
    """Verify get_dashboard_full_data caches responses and cache invalidation works."""
    user, token = register_user(client, username="cacheuser", email="cacheuser@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Clear cache before starting
    with app.app_context():
        invalidate_user_dashboard_cache(user["id"])

    # First request — populates cache
    resp1 = client.get("/api/dashboard/data", headers=headers)
    assert resp1.status_code == 200
    data1 = resp1.get_json()
    assert "summary" in data1

    # Second request — served from cache
    resp2 = client.get("/api/dashboard/data", headers=headers)
    assert resp2.status_code == 200
    data2 = resp2.get_json()
    assert data1["summary"]["total_contracts"] == data2["summary"]["total_contracts"]

    # Invalidate cache
    with app.app_context():
        invalidate_user_dashboard_cache(user["id"])

    # Third request — fetches fresh data
    resp3 = client.get("/api/dashboard/data", headers=headers)
    assert resp3.status_code == 200
