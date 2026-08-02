"""JWT authentication helpers and role-based access control."""

import os
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, jsonify, request

from src.models.user import User, db

VALID_ROLES = {
    "SUPER_ADMIN", "ADMIN", "CONTRACT_MANAGER", "FINANCE",
    "APPROVER", "LEGAL", "SALES", "VIEWER",
}

RESOURCE_PERMISSIONS: dict[str, set[str]] = {
    "customers": {"ADMIN", "CONTRACT_MANAGER", "SALES", "SUPER_ADMIN"},
    "contacts": {"ADMIN", "CONTRACT_MANAGER", "SALES", "SUPER_ADMIN"},
    "products": {"ADMIN", "CONTRACT_MANAGER", "SALES", "SUPER_ADMIN"},
    "contracts": {"ADMIN", "CONTRACT_MANAGER", "APPROVER", "LEGAL", "SALES", "SUPER_ADMIN"},
    "documents": {"ADMIN", "CONTRACT_MANAGER", "LEGAL", "SALES", "SUPER_ADMIN"},
    "approvals": {"ADMIN", "APPROVER", "CONTRACT_MANAGER", "SUPER_ADMIN"},
    "invoices": {"ADMIN", "FINANCE", "CONTRACT_MANAGER", "SUPER_ADMIN"},
    "purchase_orders": {"ADMIN", "FINANCE", "CONTRACT_MANAGER", "SUPER_ADMIN"},
    "reports": {"ADMIN", "FINANCE", "CONTRACT_MANAGER", "SUPER_ADMIN"},
    "users": {"ADMIN", "SUPER_ADMIN"},
    "settings": {"ADMIN", "CONTRACT_MANAGER", "FINANCE", "APPROVER", "LEGAL", "SALES", "SUPER_ADMIN", "VIEWER"},
    "calendar": {"ADMIN", "CONTRACT_MANAGER", "FINANCE", "APPROVER", "LEGAL", "SALES", "SUPER_ADMIN", "VIEWER"},
    "activity": {"ADMIN", "CONTRACT_MANAGER", "FINANCE", "APPROVER", "LEGAL", "SALES", "SUPER_ADMIN", "VIEWER"},
    "renewals": {"ADMIN", "CONTRACT_MANAGER", "SUPER_ADMIN"},
    "workflows": {"ADMIN", "SUPER_ADMIN"},
    "automation": {"ADMIN", "SUPER_ADMIN"},
    "tasks": {"ADMIN", "CONTRACT_MANAGER", "FINANCE", "APPROVER", "LEGAL", "SALES", "SUPER_ADMIN", "VIEWER"},
}

ALL_ROUTES: dict[str, set[str]] = {
    resource: allowed | {"SUPER_ADMIN"}
    for resource, allowed in RESOURCE_PERMISSIONS.items()
}


def _jwt_secret() -> str:
    return current_app.config.get("SECRET_KEY") or os.getenv("SECRET_KEY")


def generate_token(user: User) -> str:
    """Create a signed JWT for an authenticated user."""
    expiration_hours = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role or "VIEWER",
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

        if user.status == "disabled":
            return jsonify({"error": "Account has been disabled"}), 403

        return route_handler(user, *args, **kwargs)

    return wrapped


def role_required(*allowed_roles: str):
    """Restrict access to specific roles. ADMIN and SUPER_ADMIN always pass."""

    def decorator(route_handler):
        @wraps(route_handler)
        def wrapped(current_user, *args, **kwargs):
            role = (current_user.role or "VIEWER").upper()
            if role in ("ADMIN", "SUPER_ADMIN"):
                return route_handler(current_user, *args, **kwargs)
            if role not in allowed_roles:
                return jsonify({"error": "Insufficient permissions"}), 403
            return route_handler(current_user, *args, **kwargs)

        return wrapped

    return decorator


def require_resource(resource: str):
    """Check caller role against RESOURCE_PERMISSIONS. ADMIN and SUPER_ADMIN always pass."""

    def decorator(route_handler):
        @wraps(route_handler)
        def wrapped(current_user, *args, **kwargs):
            role = (current_user.role or "VIEWER").upper()
            if role in ("ADMIN", "SUPER_ADMIN"):
                return route_handler(current_user, *args, **kwargs)
            allowed = RESOURCE_PERMISSIONS.get(resource, set())
            if role not in allowed:
                return jsonify({"error": "Insufficient permissions"}), 403
            return route_handler(current_user, *args, **kwargs)

        return wrapped

    return decorator
