"""JWT authentication helpers."""

import os
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, jsonify, request

from src.models.user import User, db


def _jwt_secret() -> str:
    return current_app.config.get("SECRET_KEY") or os.getenv("SECRET_KEY")


def generate_token(user: User) -> str:
    """Create a signed JWT for an authenticated user."""
    expiration_hours = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "iat": now,
        "exp": now + timedelta(hours=expiration_hours),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")


def decode_token(token: str) -> dict:
    """Decode and validate a JWT."""
    return jwt.decode(token, _jwt_secret(), algorithms=["HS256"])


def _bearer_token() -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    return auth_header.split(" ", 1)[1].strip()


def token_required(route_handler):
    """Require a valid Bearer token and pass current_user to the route."""

    @wraps(route_handler)
    def wrapped(*args, **kwargs):
        token = _bearer_token()
        if not token:
            return jsonify({"error": "Authorization token is required"}), 401

        try:
            payload = decode_token(token)
            user = db.session.get(User, int(payload["sub"]))
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Authorization token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid authorization token"}), 401
        except (KeyError, TypeError, ValueError):
            return jsonify({"error": "Invalid authorization token"}), 401

        if not user:
            return jsonify({"error": "Authenticated user not found"}), 401

        return route_handler(user, *args, **kwargs)

    return wrapped
