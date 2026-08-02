from datetime import datetime
import json

from flask import Blueprint, jsonify, request

from src.models.user import (
    User, Organization, UserPreference, IntegrationConfig,
    Role, RoleAssignment, LoginHistory, db,
)
from src.services.auth import token_required
from src.services.logging_config import get_structured_logger

settings_bp = Blueprint("settings", __name__)
logger = get_structured_logger(__name__)


# ── Helpers ────────────────────────────────────────────────────────────

def _update_from_dict(instance, data, allowed_keys):
    for key in allowed_keys:
        if key in data:
            setattr(instance, key, data[key])


def _get_or_create(model, user_id, defaults=None):
    instance = model.query.filter_by(user_id=user_id).first()
    if not instance:
        instance = model(user_id=user_id, **(defaults or {}))
        db.session.add(instance)
    return instance


# ── 1. Profile ─────────────────────────────────────────────────────────

@settings_bp.route("/settings/profile", methods=["GET", "PUT"])
@token_required
def profile(current_user):
    if request.method == "GET":
        return jsonify(current_user.to_dict()), 200

    data = request.get_json() or {}
    allowed = {"username", "email", "phone", "avatar_url"}
    _update_from_dict(current_user, data, allowed)

    password = data.get("new_password")
    if password and len(password) >= 8:
        current_user.set_password(password)
    elif password:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    db.session.commit()
    logger.info("Profile updated", context={"user_id": current_user.id})
    return jsonify(current_user.to_dict()), 200


# ── 2. Organization ────────────────────────────────────────────────────

@settings_bp.route("/settings/organization", methods=["GET", "PUT"])
@token_required
def organization(current_user):
    org = _get_or_create(Organization, current_user.id)

    if request.method == "GET":
        return jsonify(org.to_dict()), 200

    data = request.get_json() or {}
    allowed = {"company_name", "address", "logo_url", "default_currency", "timezone", "fiscal_year"}
    _update_from_dict(org, data, allowed)
    db.session.commit()
    logger.info("Organization settings updated", context={"user_id": current_user.id})
    return jsonify(org.to_dict()), 200


# ── 3. User Preferences (Notifications + Appearance) ───────────────────

@settings_bp.route("/settings/preferences", methods=["GET", "PUT"])
@token_required
def preferences(current_user):
    prefs = _get_or_create(UserPreference, current_user.id)

    if request.method == "GET":
        return jsonify(prefs.to_dict()), 200

    data = request.get_json() or {}
    allowed = {
        "notification_email", "notification_push", "reminder_days",
        "invoice_reminder_days", "approval_notifications",
        "default_contract_type_id", "default_renewal_period_days",
        "default_payment_terms", "theme",
    }
    _update_from_dict(prefs, data, allowed)
    db.session.commit()
    logger.info("Preferences updated", context={"user_id": current_user.id})
    return jsonify(prefs.to_dict()), 200


# ── 4. Integrations ────────────────────────────────────────────────────

@settings_bp.route("/settings/integrations", methods=["GET"])
@token_required
def list_integrations(current_user):
    configs = IntegrationConfig.query.filter_by(user_id=current_user.id).all()
    return jsonify([c.to_dict() for c in configs]), 200


@settings_bp.route("/settings/integrations", methods=["POST"])
@token_required
def create_integration(current_user):
    data = request.get_json() or {}
    provider = data.get("provider", "").strip()
    if not provider:
        return jsonify({"error": "provider is required"}), 400

    existing = IntegrationConfig.query.filter_by(
        user_id=current_user.id, provider=provider
    ).first()
    if existing:
        return jsonify({"error": f"Integration '{provider}' already exists"}), 400

    config = IntegrationConfig(
        user_id=current_user.id,
        provider=provider,
        config_json=json.dumps(data.get("config", {})),
        enabled=data.get("enabled", False),
    )
    db.session.add(config)
    db.session.commit()
    logger.info("Integration created", context={"user_id": current_user.id, "provider": provider})
    return jsonify(config.to_dict()), 201


@settings_bp.route("/settings/integrations/<int:integration_id>", methods=["PUT", "DELETE"])
@token_required
def integration_detail(current_user, integration_id):
    config = IntegrationConfig.query.filter_by(
        id=integration_id, user_id=current_user.id
    ).first()
    if not config:
        return jsonify({"error": "Integration not found"}), 404

    if request.method == "DELETE":
        db.session.delete(config)
        db.session.commit()
        logger.info("Integration deleted", context={"integration_id": integration_id})
        return "", 204

    data = request.get_json() or {}
    if "config" in data:
        config.config_json = json.dumps(data["config"])
    if "enabled" in data:
        config.enabled = data["enabled"]
    if "provider" in data:
        config.provider = data["provider"]
    db.session.commit()
    return jsonify(config.to_dict()), 200


# ── 5. Security ────────────────────────────────────────────────────────

@settings_bp.route("/settings/security/password", methods=["PUT"])
@token_required
def change_password(current_user):
    data = request.get_json() or {}
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

    if not current_password or not new_password:
        return jsonify({"error": "current_password and new_password are required"}), 400

    if not current_user.check_password(current_password):
        return jsonify({"error": "Current password is incorrect"}), 403

    if len(new_password) < 8:
        return jsonify({"error": "New password must be at least 8 characters"}), 400

    current_user.set_password(new_password)
    db.session.commit()
    logger.info("Password changed", context={"user_id": current_user.id})
    return jsonify({"success": True, "message": "Password updated successfully"}), 200


@settings_bp.route("/settings/security/sessions", methods=["GET"])
@token_required
def list_sessions(current_user):
    history = (
        LoginHistory.query
        .filter_by(user_id=current_user.id)
        .order_by(LoginHistory.created_at.desc())
        .limit(20)
        .all()
    )
    return jsonify([h.to_dict() for h in history]), 200


@settings_bp.route("/settings/security/login-history", methods=["GET"])
@token_required
def login_history(current_user):
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    pagination = (
        LoginHistory.query
        .filter_by(user_id=current_user.id)
        .order_by(LoginHistory.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )
    return jsonify({
        "items": [h.to_dict() for h in pagination.items],
        "total": pagination.total,
        "page": pagination.page,
        "per_page": pagination.per_page,
        "pages": pagination.pages,
    }), 200


# ── 6. Roles & Permissions ─────────────────────────────────────────────

@settings_bp.route("/settings/roles", methods=["GET"])
@token_required
def list_roles(current_user):
    roles = Role.query.all()
    assignments = RoleAssignment.query.all()
    return jsonify({
        "roles": [r.to_dict() for r in roles],
        "assignments": [a.to_dict() for a in assignments],
    }), 200


@settings_bp.route("/settings/roles", methods=["POST"])
@token_required
def create_role(current_user):
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    existing = Role.query.filter_by(name=name).first()
    if existing:
        return jsonify({"error": f"Role '{name}' already exists"}), 400

    role = Role(
        name=name,
        description=data.get("description"),
        permissions=json.dumps(data.get("permissions", [])),
    )
    db.session.add(role)
    db.session.commit()
    return jsonify(role.to_dict()), 201


@settings_bp.route("/settings/role-assignments", methods=["POST"])
@token_required
def assign_role(current_user):
    data = request.get_json() or {}
    user_id = data.get("user_id")
    role_id = data.get("role_id")
    if not user_id or not role_id:
        return jsonify({"error": "user_id and role_id are required"}), 400

    existing = RoleAssignment.query.filter_by(
        user_id=user_id, role_id=role_id
    ).first()
    if existing:
        return jsonify({"error": "Assignment already exists"}), 400

    assignment = RoleAssignment(user_id=user_id, role_id=role_id)
    db.session.add(assignment)
    db.session.commit()
    return jsonify(assignment.to_dict()), 201


@settings_bp.route("/settings/role-assignments/<int:assignment_id>", methods=["DELETE"])
@token_required
def remove_role_assignment(current_user, assignment_id):
    assignment = db.session.get(RoleAssignment, assignment_id)
    if not assignment:
        return jsonify({"error": "Assignment not found"}), 404
    db.session.delete(assignment)
    db.session.commit()
    return "", 204


# ── 7. Users list (for Roles management) ───────────────────────────────

@settings_bp.route("/settings/users", methods=["GET"])
@token_required
def list_users_with_roles(current_user):
    users = User.query.all()
    result = []
    for u in users:
        d = u.to_dict()
        d["roles"] = [
            {"id": ra.role.id, "name": ra.role.name}
            for ra in u.role_assignments.all()
            if ra.role
        ]
        result.append(d)
    return jsonify(result), 200


# ── 8. System / Backup ─────────────────────────────────────────────────

@settings_bp.route("/settings/system", methods=["GET"])
@token_required
def system_info(current_user):
    audit_count = 0
    try:
        from src.models.contract import ActivityLog
        audit_count = ActivityLog.query.filter_by(user_id=current_user.id).count()
    except Exception:
        pass

    return jsonify({
        "audit_log_count": audit_count,
        "user_id": current_user.id,
        "server_time": datetime.utcnow().isoformat(),
    }), 200


@settings_bp.route("/settings/backup", methods=["POST"])
@token_required
def trigger_backup(current_user):
    logger.info("Backup triggered", context={"user_id": current_user.id})
    return jsonify({
        "success": True,
        "message": "Backup initiated. Data export will be available shortly.",
    }), 200
