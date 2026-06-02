import os

os.environ["SECRET_KEY"] = "test-secret-key-12345678901234567890"
os.environ["EMAIL_USER"] = "test@example.com"
os.environ["EMAIL_PASSWORD"] = "test-password"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["FLASK_ENV"] = "testing"
os.environ["SCHEDULER_ENABLED"] = "false"

import pytest

from src.main import app
from src.models.user import db


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


def register_user(client, username="tester", email="tester@example.com"):
    response = client.post(
        "/api/auth/register",
        json={
            "username": username,
            "email": email,
            "password": "securepassword123",
        },
    )
    payload = response.get_json()
    return payload["user"], payload["token"]


@pytest.fixture
def auth_headers(client):
    _, token = register_user(client)
    return {"Authorization": f"Bearer {token}"}
