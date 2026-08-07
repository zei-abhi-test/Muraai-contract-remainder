from flask import Blueprint, jsonify, request

from src.models.contract import db
from src.models.customer_auth import CustomerPortalUser
from src.routes.customers import get_owned_customer
from src.services.auth import require_resource, token_required
from src.services.logging_config import get_structured_logger

customer_portal_admin_bp = Blueprint("customer_portal_admin", __name__)
logger = get_structured_logger(__name__)


@customer_portal_admin_bp.route("/customers/<int:customer_id>/portal", methods=["GET"])
@token_required
@require_resource("customers")
def customer_portal_status(current_user, customer_id):
    customer = get_owned_customer(customer_id, current_user.id)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404

    portal_user = CustomerPortalUser.query.filter_by(customer_id=customer.id).first()
    return jsonify({
        "portal_enabled": portal_user is not None and portal_user.is_active,
        "portal_email": portal_user.email if (portal_user and portal_user.is_active) else None,
        "portal_user_id": portal_user.id if portal_user else None,
    }), 200


@customer_portal_admin_bp.route("/customers/<int:customer_id>/portal/enable", methods=["POST"])
@token_required
@require_resource("customers")
def customer_portal_enable(current_user, customer_id):
    customer = get_owned_customer(customer_id, current_user.id)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404

    existing = CustomerPortalUser.query.filter_by(customer_id=customer.id).first()
    data = request.get_json() or {}

    if existing:
        if existing.is_active:
            return jsonify({"error": "Portal access already enabled for this customer"}), 400

        # Reactivate account preserving history
        email = (data.get("email") or existing.email or customer.email or "").strip().lower()
        password = data.get("password", "").strip()

        if not email:
            return jsonify({"error": "Email is required"}), 400
        if not password or len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400

        if email != existing.email:
            conflict = CustomerPortalUser.query.filter(
                CustomerPortalUser.email == email,
                CustomerPortalUser.id != existing.id,
            ).first()
            if conflict:
                return jsonify({"error": "A portal account with this email already exists"}), 400
            existing.email = email

        existing.set_password(password)
        existing.is_active = True
        db.session.commit()

        logger.info("Customer portal reactivated", context={
            "customer_id": customer.id, "email": existing.email, "user_id": current_user.id,
        })
        return jsonify(existing.to_dict()), 200

    # Create new portal user
    email = (data.get("email") or customer.email or "").strip().lower()
    password = data.get("password", "").strip()

    if not email:
        return jsonify({"error": "Email is required"}), 400
    if not password or len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    if CustomerPortalUser.query.filter_by(email=email).first():
        return jsonify({"error": "A portal account with this email already exists"}), 400

    portal_user = CustomerPortalUser(
        customer_id=customer.id,
        email=email,
        is_active=True,
    )
    portal_user.set_password(password)
    db.session.add(portal_user)
    db.session.commit()

    logger.info("Customer portal enabled", context={
        "customer_id": customer.id, "email": email, "user_id": current_user.id,
    })
    return jsonify(portal_user.to_dict()), 201


@customer_portal_admin_bp.route("/customers/<int:customer_id>/portal/disable", methods=["POST"])
@token_required
@require_resource("customers")
def customer_portal_disable(current_user, customer_id):
    customer = get_owned_customer(customer_id, current_user.id)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404

    portal_user = CustomerPortalUser.query.filter_by(customer_id=customer.id).first()
    if not portal_user or not portal_user.is_active:
        return jsonify({"error": "Portal access not enabled for this customer"}), 400

    portal_user.is_active = False
    db.session.commit()

    logger.info("Customer portal disabled", context={
        "customer_id": customer.id, "user_id": current_user.id,
    })
    return jsonify({"success": True}), 200


@customer_portal_admin_bp.route("/customers/<int:customer_id>/portal/reset-password", methods=["POST"])
@token_required
@require_resource("customers")
def customer_portal_reset_password(current_user, customer_id):
    customer = get_owned_customer(customer_id, current_user.id)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404

    portal_user = CustomerPortalUser.query.filter_by(customer_id=customer.id).first()
    if not portal_user or not portal_user.is_active:
        return jsonify({"error": "Portal access not enabled for this customer"}), 400

    data = request.get_json() or {}
    password = data.get("password", "").strip()
    if not password or len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    portal_user.set_password(password)
    db.session.commit()

    logger.info("Customer portal password reset", context={
        "customer_id": customer.id, "user_id": current_user.id,
    })
    return jsonify({"success": True}), 200
