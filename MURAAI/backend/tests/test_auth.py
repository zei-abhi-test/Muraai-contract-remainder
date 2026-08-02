from src.models.user import User
import jwt
from datetime import datetime, timedelta, timezone


def test_user_password_hashing():
    user = User(username="tester", email="tester@example.com")
    user.set_password("securepassword123")

    assert user.password_hash != "securepassword123"
    assert user.check_password("securepassword123") is True
    assert user.check_password("wrongpassword") is False
    assert "password_hash" not in user.to_dict()


def test_register_returns_user_and_token(client):
    response = client.post(
        "/api/auth/register",
        json={
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "securepassword123",
        },
    )

    payload = response.get_json()
    assert response.status_code == 201
    assert payload["user"]["email"] == "newuser@example.com"
    assert payload["token"]


def test_login_and_auth_me(client):
    client.post(
        "/api/auth/register",
        json={
            "username": "loginuser",
            "email": "loginuser@example.com",
            "password": "securepassword123",
        },
    )

    login_response = client.post(
        "/api/auth/login",
        json={
            "email": "loginuser@example.com",
            "password": "securepassword123",
        },
    )
    token = login_response.get_json()["token"]

    me_response = client.get(
        "/api/auth/me",
        headers={
            "Authorization": f"Bearer {token}",
        },
    )

    assert login_response.status_code == 200
    assert me_response.status_code == 200
    assert me_response.get_json()["email"] == "loginuser@example.com"


def test_login_rejects_bad_password(client):
    client.post(
        "/api/auth/register",
        json={
            "username": "badpassworduser",
            "email": "badpassword@example.com",
            "password": "securepassword123",
        },
    )

    response = client.post(
        "/api/auth/login",
        json={
            "email": "badpassword@example.com",
            "password": "wrongpassword",
        },
    )

    assert response.status_code == 401
    assert response.get_json()["error"] == "Invalid email or password"


def test_auth_me_requires_token(client):
    response = client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.get_json()["error"] == "Authorization token is required"


def test_auth_me_rejects_invalid_token(client):
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-token"})

    assert response.status_code == 401
    assert response.get_json()["error"] == "Invalid authorization token"


def test_auth_me_rejects_expired_token(client):
    payload = {
        "sub": "1",
        "email": "expired@example.com",
        "iat": datetime.now(timezone.utc) - timedelta(hours=2),
        "exp": datetime.now(timezone.utc) - timedelta(hours=1),
    }
    token = jwt.encode(payload, "test-secret-key-12345678901234567890", algorithm="HS256")

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.get_json()["error"] == "Authorization token has expired"


def test_auth_me_rejects_token_for_missing_user(client):
    payload = {
        "sub": "999",
        "email": "missing@example.com",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    token = jwt.encode(payload, "test-secret-key-12345678901234567890", algorithm="HS256")

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401
    assert response.get_json()["error"] == "Authenticated user not found"
