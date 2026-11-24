import base64
import io
from datetime import datetime, timedelta
import secrets
import string
import jwt
import pyotp
import qrcode

from flask import Blueprint, current_app, jsonify, request
from pydantic import ValidationError

from src.models.user import User, LoginHistory, db
from src.services.auth import generate_token, token_required, role_required
from src.services.validators import UserCreate, UserLogin, UserUpdate, AdminUserCreate, AdminUserUpdate, UserInvite
from src.services.logging_config import get_structured_logger
from src.services.limiter import limiter

user_bp = Blueprint("user", __name__)
logger = get_structured_logger(__name__)


def handle_validation_error(error: ValidationError):
    errors = {}
    for err in error.errors():
        field = ".".join(str(x) for x in err["loc"])
        errors[field] = err["msg"]
    return jsonify({"error": "Validation error", "details": errors}), 400


def _record_login_history(user_id, ip_address, user_agent):
    record = LoginHistory(
        user_id=user_id,
        ip_address=ip_address,
        user_agent=(user_agent or "")[:500],
    )
    db.session.add(record)
    db.session.commit()


# ── Public auth routes ─────────────────────────────────────────────────


@user_bp.route("/auth/register", methods=["POST"])
@limiter.limit("5 per minute")
def register():
    """Register a new user and return JWT authentication token."""
    try:
        data = request.get_json() or {}
        validated_data = UserCreate(**data)

        existing_user = User.query.filter(
            (User.username == validated_data.username) | (User.email == validated_data.email)
        ).first()

        if existing_user:
            return jsonify({"error": "Username or email already exists"}), 400

        user = User(
            username=validated_data.username,
            name=validated_data.username,
            email=validated_data.email,
            role="VIEWER",
            status="active",
        )
        user.set_password(validated_data.password)
        db.session.add(user)
        db.session.commit()

        logger.info(
            "User registered successfully", context={"user_id": user.id, "username": user.username}
        )
        return jsonify({"user": user.to_dict(), "token": generate_token(user)}), 201
    except ValidationError as e:
        return handle_validation_error(e)
    except Exception as e:
        db.session.rollback()
        logger.error(
            "Failed to register user", context={"error": str(e), "exception_type": type(e).__name__}
        )
        return jsonify({"error": "Failed to register user"}), 500


@user_bp.route("/auth/login", methods=["POST"])
@limiter.limit("5 per minute")
def login():
    """Authenticate a user and return a JWT or 2FA challenge token."""
    try:
        data = request.get_json() or {}
        validated_data = UserLogin(**data)
        user = User.query.filter_by(email=validated_data.email).first()

        if not user or not user.check_password(validated_data.password):
            logger.warning("Failed login attempt", context={"email": validated_data.email})
            if user:
                _record_login_history(user.id, request.remote_addr, request.headers.get("User-Agent"))
            return jsonify({"error": "Invalid email or password"}), 401

        if user.status == "disabled":
            logger.warning("Disabled user login attempt", context={"user_id": user.id, "email": user.email})
            _record_login_history(user.id, request.remote_addr, request.headers.get("User-Agent"))
            return jsonify({"error": "Account has been disabled"}), 403

        # Check if 2FA is enabled for user
        if user.two_factor_enabled:
            pre_auth_token = jwt.encode(
                {
                    "user_id": user.id,
                    "pre_auth": True,
                    "exp": datetime.utcnow() + timedelta(minutes=5),
                },
                current_app.config["SECRET_KEY"],
                algorithm="HS256",
            )
            return jsonify({
                "requires_2fa": True,
                "pre_auth_token": pre_auth_token,
            }), 200

        user.last_login = datetime.utcnow()
        _record_login_history(user.id, request.remote_addr, request.headers.get("User-Agent"))

        logger.info("User logged in successfully", context={"user_id": user.id})
        return jsonify({"user": user.to_dict(), "token": generate_token(user)}), 200
    except ValidationError as e:
        return handle_validation_error(e)
    except Exception as e:
        logger.error(
            "Failed to login user", context={"error": str(e), "exception_type": type(e).__name__}
        )
        return jsonify({"error": "Failed to login user"}), 500



@user_bp.route("/auth/logout", methods=["POST"])
@token_required
def logout(current_user):
    """Log out the current user (records logout in login history)."""
    _record_login_history(current_user.id, request.remote_addr, request.headers.get("User-Agent"))
    logger.info("User logged out", context={"user_id": current_user.id})
    return jsonify({"message": "Logged out successfully"}), 200


@user_bp.route("/auth/me", methods=["GET"])
@token_required
def get_current_user(current_user):
    """Return the current authenticated user."""
    return jsonify(current_user.to_dict()), 200


# ── 2FA Routes ─────────────────────────────────────────────────────────


@user_bp.route("/auth/2fa/setup", methods=["POST"])
@token_required
def setup_2fa(current_user):
    """Generate a TOTP secret and QR code PNG data URI for authenticator setup."""
    secret = pyotp.random_base32()
    current_user.two_factor_secret = secret
    db.session.commit()

    otpauth_url = pyotp.totp.TOTP(secret).provisioning_uri(
        name=current_user.email,
        issuer_name="Muraai Contract Reminder",
    )

    img = qrcode.make(otpauth_url)
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    qr_code_base64 = "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode("utf-8")

    return jsonify({
        "secret": secret,
        "otpauth_url": otpauth_url,
        "qr_code": qr_code_base64,
    }), 200


@user_bp.route("/auth/2fa/verify", methods=["POST"])
@token_required
def verify_2fa(current_user):
    """Verify 6-digit TOTP code and activate 2FA for the user account."""
    data = request.get_json() or {}
    code = (data.get("code") or "").strip()

    if not current_user.two_factor_secret:
        return jsonify({"error": "2FA setup has not been initiated. Call /auth/2fa/setup first."}), 400

    totp = pyotp.TOTP(current_user.two_factor_secret)
    if not totp.verify(code, valid_window=1):
        return jsonify({"error": "Invalid verification code"}), 400

    current_user.two_factor_enabled = True
    db.session.commit()

    logger.info("2FA enabled for user", context={"user_id": current_user.id})
    return jsonify({"message": "Two-factor authentication enabled successfully"}), 200


@user_bp.route("/auth/2fa/authenticate", methods=["POST"])
@limiter.limit("5 per minute")
def authenticate_2fa():
    """Complete 2FA login by exchanging pre_auth_token and 6-digit code for a full JWT."""
    data = request.get_json() or {}
    pre_auth_token = data.get("pre_auth_token") or ""
    code = (data.get("code") or "").strip()

    if not pre_auth_token or not code:
        return jsonify({"error": "pre_auth_token and code are required"}), 400

    try:
        payload = jwt.decode(
            pre_auth_token,
            current_app.config["SECRET_KEY"],
            algorithms=["HS256"],
        )
        if not payload.get("pre_auth"):
            return jsonify({"error": "Invalid pre-authentication token"}), 401
        user_id = payload.get("user_id")
    except Exception:
        return jsonify({"error": "Expired or invalid pre-authentication token"}), 401

    user = db.session.get(User, user_id)
    if not user or not user.two_factor_enabled or not user.two_factor_secret:
        return jsonify({"error": "2FA is not enabled for this user"}), 400

    totp = pyotp.TOTP(user.two_factor_secret)
    if not totp.verify(code, valid_window=1):
        return jsonify({"error": "Invalid 2FA code"}), 401

    user.last_login = datetime.utcnow()
    db.session.commit()

    logger.info("User completed 2FA login successfully", context={"user_id": user.id})
    return jsonify({"user": user.to_dict(), "token": generate_token(user)}), 200


@user_bp.route("/auth/2fa/disable", methods=["POST"])
@token_required
def disable_2fa(current_user):
    """Disable 2FA for current user after validating password and code."""
    data = request.get_json() or {}
    password = data.get("password") or ""
    code = (data.get("code") or "").strip()

    if not current_user.check_password(password):
        return jsonify({"error": "Invalid password"}), 401

    if current_user.two_factor_secret:
        totp = pyotp.TOTP(current_user.two_factor_secret)
        if code and not totp.verify(code, valid_window=1):
            return jsonify({"error": "Invalid 2FA code"}), 401

    current_user.two_factor_enabled = False
    current_user.two_factor_secret = None
    db.session.commit()

    logger.info("2FA disabled for user", context={"user_id": current_user.id})
    return jsonify({"message": "Two-factor authentication disabled successfully"}), 200



# ── Admin user management routes ────────────────────────────────────────



def _admin_list_users(current_user):
    users = User.query.all()
    logger.info(
        "Retrieved all users",
        context={"endpoint": "/users", "method": "GET", "user_count": len(users)},
    )
    return jsonify([user.to_dict() for user in users]), 200


@user_bp.route("/users", methods=["GET"])
@token_required
@role_required("ADMIN", "SUPER_ADMIN")
def get_users(current_user):
    return _admin_list_users(current_user)


@user_bp.route("/users", methods=["POST"])
@token_required
@role_required("ADMIN", "SUPER_ADMIN")
def create_user(current_user):
    """Create a new user (admin only)."""
    try:
        data = request.get_json() or {}
        validated_data = AdminUserCreate(**data)

        existing = User.query.filter_by(email=validated_data.email).first()
        if existing:
            return jsonify({"error": "Email already exists"}), 400

        user = User(
            username=validated_data.email.split("@")[0],
            name=validated_data.name,
            email=validated_data.email,
            phone=validated_data.phone,
            department=validated_data.department,
            role=validated_data.role,
            status=validated_data.status,
        )
        user.set_password(validated_data.password)
        db.session.add(user)
        db.session.commit()

        logger.info(
            "User created successfully",
            context={"user_id": user.id, "email": user.email, "role": user.role},
        )
        return jsonify(user.to_dict()), 201
    except ValidationError as e:
        return handle_validation_error(e)
    except Exception as e:
        db.session.rollback()
        logger.error(
            "Failed to create user", context={"error": str(e), "exception_type": type(e).__name__}
        )
        return jsonify({"error": "Failed to create user", "details": str(e)}), 400


@user_bp.route("/users/invite", methods=["POST"])
@token_required
@role_required("ADMIN", "SUPER_ADMIN")
def invite_user(current_user):
    """Invite a user by email with a temporary password."""
    try:
        data = request.get_json() or {}
        validated_data = UserInvite(**data)

        existing = User.query.filter_by(email=validated_data.email).first()
        if existing:
            return jsonify({"error": "Email already exists"}), 400

        temp_password = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))

        user = User(
            username=validated_data.email.split("@")[0],
            name=validated_data.name,
            email=validated_data.email,
            department=validated_data.department,
            role=validated_data.role,
            status="active",
        )
        user.set_password(temp_password)
        db.session.add(user)
        db.session.commit()

        logger.info(
            "User invited successfully",
            context={"user_id": user.id, "email": user.email, "role": user.role},
        )

        result = user.to_dict()
        result["temp_password"] = temp_password

        return jsonify(result), 201
    except ValidationError as e:
        return handle_validation_error(e)
    except Exception as e:
        db.session.rollback()
        logger.error(
            "Failed to invite user", context={"error": str(e), "exception_type": type(e).__name__}
        )
        return jsonify({"error": "Failed to invite user", "details": str(e)}), 400


@user_bp.route("/users/<int:user_id>", methods=["GET"])
@token_required
@role_required("ADMIN", "SUPER_ADMIN")
def get_user(current_user, user_id):
    """Get a specific user by ID."""
    try:
        if user_id <= 0:
            return jsonify({"error": "Invalid user_id"}), 400

        user = db.session.get(User, user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify(user.to_dict()), 200
    except Exception as e:
        logger.error("Failed to retrieve user", context={"user_id": user_id, "error": str(e)})
        return jsonify({"error": str(e)}), 500


@user_bp.route("/users/<int:user_id>", methods=["PUT"])
@token_required
@role_required("ADMIN", "SUPER_ADMIN")
def update_user(current_user, user_id):
    """Update a specific user (admin only — name, phone, department, role, status, avatar)."""
    try:
        if user_id <= 0:
            return jsonify({"error": "Invalid user_id"}), 400

        user = db.session.get(User, user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        data = request.get_json() or {}
        validated_data = AdminUserUpdate(**data)

        if validated_data.name is not None:
            user.name = validated_data.name
        if validated_data.phone is not None:
            user.phone = validated_data.phone
        if validated_data.department is not None:
            user.department = validated_data.department
        if validated_data.avatar_url is not None:
            user.avatar_url = validated_data.avatar_url
        if validated_data.role is not None:
            user.role = validated_data.role
        if validated_data.status is not None:
            user.status = validated_data.status

        db.session.commit()

        logger.info(
            "User updated successfully", context={"user_id": user_id, "username": user.username}
        )
        return jsonify(user.to_dict()), 200
    except ValidationError as e:
        db.session.rollback()
        return handle_validation_error(e)
    except Exception as e:
        db.session.rollback()
        logger.error(
            "Failed to update user",
            context={"user_id": user_id, "error": str(e), "exception_type": type(e).__name__},
        )
        return jsonify({"error": "Failed to update user", "details": str(e)}), 400


@user_bp.route("/users/<int:user_id>/disable", methods=["POST"])
@token_required
@role_required("ADMIN", "SUPER_ADMIN")
def disable_user(current_user, user_id):
    """Disable a user account. Cannot disable yourself."""
    try:
        if user_id <= 0:
            return jsonify({"error": "Invalid user_id"}), 400
        if user_id == current_user.id:
            return jsonify({"error": "Cannot disable your own account"}), 400

        user = db.session.get(User, user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        if user.status == "disabled":
            return jsonify({"error": "User is already disabled"}), 400

        user.status = "disabled"
        db.session.commit()
        logger.info("User disabled", context={"user_id": user_id, "disabled_by": current_user.id})
        return jsonify(user.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@user_bp.route("/users/<int:user_id>/enable", methods=["POST"])
@token_required
@role_required("ADMIN", "SUPER_ADMIN")
def enable_user(current_user, user_id):
    """Re-enable a disabled user account."""
    try:
        if user_id <= 0:
            return jsonify({"error": "Invalid user_id"}), 400

        user = db.session.get(User, user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
        if user.status == "active":
            return jsonify({"error": "User is already active"}), 400

        user.status = "active"
        db.session.commit()
        logger.info("User enabled", context={"user_id": user_id, "enabled_by": current_user.id})
        return jsonify(user.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@user_bp.route("/users/<int:user_id>", methods=["DELETE"])
@token_required
@role_required("ADMIN", "SUPER_ADMIN")
def delete_user(current_user, user_id):
    """Delete a user (safe delete). Rules: cannot delete self, cannot delete last ADMIN."""
    try:
        if user_id <= 0:
            return jsonify({"error": "Invalid user_id"}), 400
        if user_id == current_user.id:
            return jsonify({"error": "Cannot delete your own account"}), 400

        user = db.session.get(User, user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        if user.role in ("ADMIN", "SUPER_ADMIN"):
            admin_count = User.query.filter(
                User.role.in_(["ADMIN", "SUPER_ADMIN"]), User.status == "active"
            ).count()
            if admin_count <= 1:
                return jsonify({"error": "Cannot delete the last active ADMIN"}), 400

        db.session.delete(user)
        db.session.commit()

        logger.info(
            "User deleted successfully", context={"user_id": user_id, "username": user.username}
        )
        return "", 204
    except Exception as e:
        db.session.rollback()
        logger.error(
            "Failed to delete user",
            context={"user_id": user_id, "error": str(e), "exception_type": type(e).__name__},
        )
        return jsonify({"error": "Failed to delete user", "details": str(e)}), 400


@user_bp.route("/users/logout-all", methods=["POST"])
@token_required
@role_required("ADMIN", "SUPER_ADMIN")
def logout_all_sessions(current_user):
    """Invalidate all sessions (JWT tokens cannot be invalidated server-side
    without a blocklist. This records a security event and logs out all sessions
    by clearing last_login for all users except the caller."""
    count = User.query.filter(User.id != current_user.id, User.last_login.isnot(None)).update(
        {User.last_login: None}, synchronize_session=False
    )
    db.session.commit()
    logger.info("All sessions cleared", context={"affected_users": count, "by_user": current_user.id})
    return jsonify({"message": f"Logged out {count} user(s) from all devices"}), 200
