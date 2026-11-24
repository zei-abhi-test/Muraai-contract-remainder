import os
from flask import g, request
from flask_caching import Cache

cache = Cache()


def init_cache(app):
    """Initialize Flask-Caching extension.

    Uses RedisCache if REDIS_URL is configured (e.g. Railway Redis addon),
    NullCache when running unit tests, and SimpleCache (in-memory) for local dev.
    """
    redis_url = os.getenv("REDIS_URL")
    is_testing = app.config.get("TESTING") or os.getenv("FLASK_ENV") == "testing"

    if is_testing:
        app.config["CACHE_TYPE"] = "NullCache"
    elif redis_url:
        app.config["CACHE_TYPE"] = "RedisCache"
        app.config["CACHE_REDIS_URL"] = redis_url
        app.config["CACHE_DEFAULT_TIMEOUT"] = 60
    else:
        app.config["CACHE_TYPE"] = "SimpleCache"
        app.config["CACHE_DEFAULT_TIMEOUT"] = 60


    cache.init_app(app)


def make_dashboard_cache_key(*args, **kwargs):
    """Generate cache key for dashboard endpoint scoped to current authenticated user."""
    user_id = getattr(g, "current_user_id", None)
    if not user_id and hasattr(g, "current_user") and hasattr(g.current_user, "id"):
        user_id = g.current_user.id
    if not user_id:
        user_id = request.headers.get("X-User-ID", "anonymous")
    return f"dashboard:full:user:{user_id}"


def invalidate_user_dashboard_cache(user_id):
    """Clear dashboard aggregation cache for a specific user ID."""
    key = f"dashboard:full:user:{user_id}"
    cache.delete(key)
