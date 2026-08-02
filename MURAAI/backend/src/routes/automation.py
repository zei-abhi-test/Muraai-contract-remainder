import json
from datetime import datetime

from flask import Blueprint, jsonify, request
from pydantic import BaseModel, Field

from src.models.automation import AutomationRule, TRIGGER_TYPES, ACTION_TYPES
from src.models.user import db
from src.services.auth import token_required, require_resource
from src.services.logging_config import get_structured_logger
from src.services.automation_engine import execute_triggers

automation_bp = Blueprint("automation", __name__)
logger = get_structured_logger(__name__)


class CreateRuleSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    trigger_type: str = Field(..., pattern=r"^[a-z_]+$")
    trigger_config: dict = {}
    conditions: list = []
    actions: list = []
    is_enabled: bool = True


class UpdateRuleSchema(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    trigger_type: str | None = Field(None, pattern=r"^[a-z_]+$")
    trigger_config: dict | None = None
    conditions: list | None = None
    actions: list | None = None
    is_enabled: bool | None = None


def _handle_validation_error(error):
    errors = {}
    for err in error.errors():
        field = ".".join(str(x) for x in err["loc"])
        errors[field] = err["msg"]
    return jsonify({"error": "Validation error", "details": errors}), 400


def _rule_to_dict(rule):
    return rule.to_dict()


@automation_bp.route("/automation/rules", methods=["GET"])
@token_required
@require_resource("automation")
def list_rules(current_user):
    rules = AutomationRule.query.order_by(AutomationRule.created_at.desc()).all()
    return jsonify([_rule_to_dict(r) for r in rules])


@automation_bp.route("/automation/rules/<int:rule_id>", methods=["GET"])
@token_required
@require_resource("automation")
def get_rule(current_user, rule_id):
    rule = db.session.get(AutomationRule, rule_id)
    if not rule:
        return jsonify({"error": "Automation rule not found"}), 404
    return jsonify(_rule_to_dict(rule))


@automation_bp.route("/automation/rules", methods=["POST"])
@token_required
@require_resource("automation")
def create_rule(current_user):
    data = request.get_json(silent=True) or {}
    try:
        schema = CreateRuleSchema(**data)
    except Exception as e:
        from pydantic import ValidationError
        if isinstance(e, ValidationError):
            return _handle_validation_error(e)
        return jsonify({"error": str(e)}), 400

    rule = AutomationRule(
        name=schema.name,
        description=schema.description,
        trigger_type=schema.trigger_type,
        trigger_config=json.dumps(schema.trigger_config) if schema.trigger_config else None,
        conditions=json.dumps(schema.conditions) if schema.conditions else None,
        actions=json.dumps(schema.actions) if schema.actions else "[]",
        is_enabled=schema.is_enabled,
        created_by=current_user.id,
    )
    db.session.add(rule)
    db.session.commit()

    logger.info("Automation rule created", context={
        "rule_id": rule.id, "name": rule.name, "trigger_type": rule.trigger_type,
    })
    return jsonify(_rule_to_dict(rule)), 201


@automation_bp.route("/automation/rules/<int:rule_id>", methods=["PUT"])
@token_required
@require_resource("automation")
def update_rule(current_user, rule_id):
    rule = db.session.get(AutomationRule, rule_id)
    if not rule:
        return jsonify({"error": "Automation rule not found"}), 404

    data = request.get_json(silent=True) or {}
    try:
        schema = UpdateRuleSchema(**data)
    except Exception as e:
        from pydantic import ValidationError
        if isinstance(e, ValidationError):
            return _handle_validation_error(e)
        return jsonify({"error": str(e)}), 400

    update_data = data
    if "name" in update_data:
        rule.name = update_data["name"]
    if "description" in update_data:
        rule.description = update_data.get("description")
    if "trigger_type" in update_data:
        rule.trigger_type = update_data["trigger_type"]
    if "trigger_config" in update_data:
        rule.trigger_config = json.dumps(update_data["trigger_config"]) if update_data["trigger_config"] else None
    if "conditions" in update_data:
        rule.conditions = json.dumps(update_data["conditions"]) if update_data["conditions"] else None
    if "actions" in update_data:
        rule.actions = json.dumps(update_data["actions"]) if update_data["actions"] else "[]"
    if "is_enabled" in update_data:
        rule.is_enabled = update_data["is_enabled"]
    rule.updated_at = datetime.utcnow()
    db.session.commit()

    logger.info("Automation rule updated", context={"rule_id": rule.id})
    return jsonify(_rule_to_dict(rule))


@automation_bp.route("/automation/rules/<int:rule_id>", methods=["DELETE"])
@token_required
@require_resource("automation")
def delete_rule(current_user, rule_id):
    rule = db.session.get(AutomationRule, rule_id)
    if not rule:
        return jsonify({"error": "Automation rule not found"}), 404
    db.session.delete(rule)
    db.session.commit()
    logger.info("Automation rule deleted", context={"rule_id": rule_id})
    return jsonify({"message": "Rule deleted"}), 200


@automation_bp.route("/automation/rules/<int:rule_id>/duplicate", methods=["POST"])
@token_required
@require_resource("automation")
def duplicate_rule(current_user, rule_id):
    rule = db.session.get(AutomationRule, rule_id)
    if not rule:
        return jsonify({"error": "Automation rule not found"}), 404

    new_rule = AutomationRule(
        name=f"{rule.name} (Copy)",
        description=rule.description,
        trigger_type=rule.trigger_type,
        trigger_config=rule.trigger_config,
        conditions=rule.conditions,
        actions=rule.actions,
        is_enabled=False,
        created_by=current_user.id,
    )
    db.session.add(new_rule)
    db.session.commit()
    return jsonify(_rule_to_dict(new_rule)), 201


@automation_bp.route("/automation/rules/<int:rule_id>/toggle", methods=["POST"])
@token_required
@require_resource("automation")
def toggle_rule(current_user, rule_id):
    rule = db.session.get(AutomationRule, rule_id)
    if not rule:
        return jsonify({"error": "Automation rule not found"}), 404
    rule.is_enabled = not rule.is_enabled
    rule.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(_rule_to_dict(rule))


@automation_bp.route("/automation/rules/<int:rule_id>/test", methods=["POST"])
@token_required
@require_resource("automation")
def test_rule(current_user, rule_id):
    rule = db.session.get(AutomationRule, rule_id)
    if not rule:
        return jsonify({"error": "Automation rule not found"}), 404

    data = request.get_json(silent=True) or {}
    entity_data = data.get("entity_data", {})
    try:
        from src.services.automation_engine import _execute_rule
        _execute_rule(rule, entity_data, current_user.id)
        return jsonify({"message": "Rule executed successfully", "triggered": True}), 200
    except Exception as e:
        return jsonify({"error": str(e), "triggered": False}), 400


@automation_bp.route("/automation/meta", methods=["GET"])
@token_required
@require_resource("automation")
def get_meta(current_user):
    return jsonify({
        "trigger_types": TRIGGER_TYPES,
        "action_types": ACTION_TYPES,
    })
