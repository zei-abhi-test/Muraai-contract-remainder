import os

os.environ["SECRET_KEY"] = "test-secret-key-12345678901234567890"
os.environ["EMAIL_USER"] = "test@example.com"
os.environ["EMAIL_PASSWORD"] = "test-password"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["FLASK_ENV"] = "testing"
os.environ["SCHEDULER_ENABLED"] = "false"

import pytest

from src.main import app
from src.models.user import User, db


@pytest.fixture(autouse=True)
def reset_database():
    with app.app_context():
        db.drop_all()
        db.create_all()
        yield
        db.session.remove()


@pytest.fixture
def client():
    return app.test_client()


def register_user(client, username="tester", email="tester@example.com", role="CONTRACT_MANAGER"):
    response = client.post(
        "/api/auth/register",
        json={
            "username": username,
            "email": email,
            "password": "securepassword123",
        },
    )
    payload = response.get_json()
    if role and role != "VIEWER":
        _set_role(payload["user"]["id"], role)
        # Re-fetch so the dict reflects the updated role
        fresh = client.get("/api/auth/me", headers={"Authorization": f"Bearer {payload['token']}"})
        return fresh.get_json(), payload["token"]
    return payload["user"], payload["token"]


@pytest.fixture
def auth_headers(client):
    _, token = register_user(client, role="ADMIN")
    return {"Authorization": f"Bearer {token}"}


def _set_role(user_id, role):
    """Set a user's role directly in the database."""
    with app.app_context():
        user = db.session.get(User, user_id)
        if user:
            user.role = role
            db.session.commit()


def register_admin(client, username="admin", email="admin@example.com"):
    """Register an ADMIN user. Returns (user, token)."""
    return register_user(client, username=username, email=email, role="ADMIN")


@pytest.fixture
def admin_headers(client):
    _, token = register_admin(client)
    return {"Authorization": f"Bearer {token}"}
