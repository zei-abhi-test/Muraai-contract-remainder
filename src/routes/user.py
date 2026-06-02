from flask import Blueprint, jsonify, request
from src.models.user import User, db
from src.services.auth import generate_token, token_required
from src.services.validators import UserCreate, UserLogin, UserUpdate
from src.services.logging_config import get_structured_logger
from pydantic import ValidationError

user_bp = Blueprint("user", __name__)
logger = get_structured_logger(__name__)


def handle_validation_error(error: ValidationError):
    """Convert Pydantic validation errors to JSON response."""
    errors = {}
    for err in error.errors():
        field = ".".join(str(x) for x in err["loc"])
        errors[field] = err["msg"]
    return jsonify({"error": "Validation error", "details": errors}), 400


@user_bp.route("/auth/register", methods=["POST"])
def register():
    """Register a user and return a JWT."""
    try:
        data = request.get_json() or {}
        validated_data = UserCreate(**data)

        existing_user = User.query.filter(
            (User.username == validated_data.username) | (User.email == validated_data.email)
        ).first()

        if existing_user:
            return jsonify({"error": "Username or email already exists"}), 400

        user = User(username=validated_data.username, email=validated_data.email)
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
def login():
    """Authenticate a user and return a JWT."""
    try:
        data = request.get_json() or {}
        validated_data = UserLogin(**data)
        user = User.query.filter_by(email=validated_data.email).first()

        if not user or not user.check_password(validated_data.password):
            logger.warning("Failed login attempt", context={"email": validated_data.email})
            return jsonify({"error": "Invalid email or password"}), 401

        logger.info("User logged in successfully", context={"user_id": user.id})
        return jsonify({"user": user.to_dict(), "token": generate_token(user)}), 200
    except ValidationError as e:
        return handle_validation_error(e)
    except Exception as e:
        logger.error(
            "Failed to login user", context={"error": str(e), "exception_type": type(e).__name__}
        )
        return jsonify({"error": "Failed to login user"}), 500


@user_bp.route("/auth/me", methods=["GET"])
@token_required
def get_current_user(current_user):
    """Return the current authenticated user."""
    return jsonify(current_user.to_dict()), 200


@user_bp.route("/users", methods=["GET"])
def get_users():
    """Get all users"""
    try:
        users = User.query.all()
        logger.info(
            "Retrieved all users",
            context={"endpoint": "/users", "method": "GET", "user_count": len(users)},
        )
        return jsonify([user.to_dict() for user in users]), 200
    except Exception as e:
        logger.error("Failed to retrieve users", context={"endpoint": "/users", "error": str(e)})
        return jsonify({"error": str(e)}), 500


@user_bp.route("/users", methods=["POST"])
def create_user():
    """Create a new user"""
    try:
        data = request.get_json() or {}

        # Validate request data
        validated_data = UserCreate(**data)

        # Check if user already exists
        existing_user = User.query.filter(
            (User.username == validated_data.username) | (User.email == validated_data.email)
        ).first()

        if existing_user:
            logger.warning(
                "Attempted to create duplicate user",
                context={"username": validated_data.username, "email": validated_data.email},
            )
            return jsonify({"error": "Username or email already exists"}), 400

        user = User(username=validated_data.username, email=validated_data.email)
        user.set_password(validated_data.password)
        db.session.add(user)
        db.session.commit()

        logger.info(
            "User created successfully",
            context={"user_id": user.id, "username": user.username, "email": user.email},
        )
        return jsonify(user.to_dict()), 201
    except ValidationError as e:
        logger.error("User creation validation error", context={"errors": str(e)})
        return handle_validation_error(e)
    except Exception as e:
        db.session.rollback()
        logger.error(
            "Failed to create user", context={"error": str(e), "exception_type": type(e).__name__}
        )
        return jsonify({"error": "Failed to create user", "details": str(e)}), 400


@user_bp.route("/users/<int:user_id>", methods=["GET"])
def get_user(user_id):
    """Get a specific user by ID"""
    try:
        if user_id <= 0:
            logger.warning("Invalid user_id requested", context={"user_id": user_id})
            return jsonify({"error": "Invalid user_id"}), 400

        user = db.session.get(User, user_id)
        if not user:
            logger.warning("User not found", context={"user_id": user_id})
            return jsonify({"error": "User not found"}), 404

        logger.info("User retrieved", context={"user_id": user_id, "username": user.username})
        return jsonify(user.to_dict()), 200
    except Exception as e:
        logger.error("Failed to retrieve user", context={"user_id": user_id, "error": str(e)})
        return jsonify({"error": str(e)}), 500


@user_bp.route("/users/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    """Update a specific user"""
    try:
        if user_id <= 0:
            logger.warning("Invalid user_id for update", context={"user_id": user_id})
            return jsonify({"error": "Invalid user_id"}), 400

        user = db.session.get(User, user_id)
        if not user:
            logger.warning("User not found for update", context={"user_id": user_id})
            return jsonify({"error": "User not found"}), 404

        data = request.get_json() or {}

        # Validate request data
        validated_data = UserUpdate(**data)

        # Check if new username already exists
        if validated_data.username and validated_data.username != user.username:
            existing = User.query.filter_by(username=validated_data.username).first()
            if existing:
                logger.warning(
                    "Duplicate username on update attempt",
                    context={"user_id": user_id, "new_username": validated_data.username},
                )
                return jsonify({"error": "Username already exists"}), 400

        # Check if new email already exists
        if validated_data.email and validated_data.email != user.email:
            existing = User.query.filter_by(email=validated_data.email).first()
            if existing:
                logger.warning(
                    "Duplicate email on update attempt",
                    context={"user_id": user_id, "new_email": validated_data.email},
                )
                return jsonify({"error": "Email already exists"}), 400

        if validated_data.username:
            user.username = validated_data.username
        if validated_data.email:
            user.email = validated_data.email
        if validated_data.password:
            user.set_password(validated_data.password)

        db.session.commit()

        logger.info(
            "User updated successfully", context={"user_id": user_id, "username": user.username}
        )
        return jsonify(user.to_dict()), 200
    except ValidationError as e:
        db.session.rollback()
        logger.error("User update validation error", context={"user_id": user_id, "errors": str(e)})
        return handle_validation_error(e)
    except Exception as e:
        db.session.rollback()
        logger.error(
            "Failed to update user",
            context={"user_id": user_id, "error": str(e), "exception_type": type(e).__name__},
        )
        return jsonify({"error": "Failed to update user", "details": str(e)}), 400


@user_bp.route("/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    """Delete a specific user"""
    try:
        if user_id <= 0:
            logger.warning("Invalid user_id for deletion", context={"user_id": user_id})
            return jsonify({"error": "Invalid user_id"}), 400

        user = db.session.get(User, user_id)
        if not user:
            logger.warning("User not found for deletion", context={"user_id": user_id})
            return jsonify({"error": "User not found"}), 404

        # Note: Consider whether to cascade delete contracts or prevent deletion
        # Current implementation: delete user (contracts remain as orphans)
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
