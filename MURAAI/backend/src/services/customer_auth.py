from __future__ import annotations

import os
import time
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any, Callable, Dict, Optional

import jwt as pyjwt

from flask import request, jsonify, g

from src.models.customer_auth import CustomerPortalUser
from src.models.user import db
from src.services.logging_config import get_structured_logger

logger = get_structured_logger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY", "")
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", 24))


def generate_token(portal_user: CustomerPortalUser) -> str:
    payload = {
        "sub": str(portal_user.id),
        "customer_id": portal_user.customer_id,
        "email": portal_user.email,
        "type": "customer",
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRATION_HOURS * 3600,
    }
    return pyjwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") != "customer":
            logger.warning("Invalid token type", context={"type": payload.get("type")})
            return None
        return payload
    except pyjwt.ExpiredSignatureError:
        logger.warning("Customer token expired")
        return None
    except pyjwt.InvalidTokenError as exc:
        logger.warning("Invalid customer token", context={"error": str(exc)})
        return None


def customer_token_required(f: Callable) -> Callable:
    @wraps(f)
    def decorated(*args: Any, **kwargs: Any) -> Any:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authentication required"}), 401

        token = auth_header.split(" ", 1)[1]
        payload = decode_token(token)
        if payload is None:
            return jsonify({"error": "Invalid or expired token"}), 401

        portal_user = db.session.get(CustomerPortalUser, int(payload["sub"]))
        if portal_user is None or not portal_user.is_active:
            return jsonify({"error": "Customer account not found"}), 401

        g.current_customer = portal_user
        return f(*args, **kwargs)

    return decorated
