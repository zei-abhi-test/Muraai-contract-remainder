from datetime import datetime

from flask import Blueprint, jsonify, request
from pydantic import BaseModel, Field, ValidationError

from src.models.workflow import (
    Workflow,
    WorkflowStage,
    WorkflowRule,
    WorkflowAssignment,
    db,
)
from src.services.auth import token_required, require_resource
from src.services.logging_config import get_structured_logger
from src.services.workflow_engine import (
    evaluate_workflow,
    create_assignment,
    get_assignment_for_entity,
    get_all_assignments_for_entity,
)

workflow_bp = Blueprint("workflow", __name__)
logger = get_structured_logger(__name__)

WORKFLOW_TYPES = [
    "contract_approval",
    "invoice_approval",
    "purchase_order_approval",
    "renewal_approval",
    "document_approval",
]

RULE_OPERATORS = ["eq", "neq", "gt", "gte", "lt", "lte", "in", "contains"]
RULE_FIELDS = [
    "contract_value", "department", "contract_type", "currency",
    "customer", "region", "product_category",
]


# ── Validation schemas ────────────────────────────────────────────────

class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None
    workflow_type: str = "contract_approval"


class WorkflowUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    description: str | None = None
    workflow_type: str | None = None
    is_active: bool | None = None


class StageCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    stage_order: int = Field(..., ge=1)
    role_required: str = Field(..., min_length=1, max_length=30)


class RuleCreate(BaseModel):
    field: str = Field(..., min_length=1, max_length=50)
    operator: str = Field(..., min_length=1, max_length=20)
    value: str = Field(..., min_length=1, max_length=200)
    priority: int = 0


# ── Helper ─────────────────────────────────────────────────────────────

def _handle_validation_error(error: ValidationError):
    errors = {}
    for err in error.errors():
        field = ".".join(str(x) for x in err["loc"])
        errors[field] = err["msg"]
    return jsonify({"error": "Validation error", "details": errors}), 400


# ── Workflow CRUD ──────────────────────────────────────────────────────

@workflow_bp.route("/workflows", methods=["GET"])
@token_required
@require_resource("workflows")
def list_workflows(current_user):
    workflow_type = request.args.get("type")
    active_only = request.args.get("active_only", "").lower() == "true"

    q = Workflow.query
    if workflow_type:
        q = q.filter_by(workflow_type=workflow_type)
    if active_only:
        q = q.filter_by(is_active=True)
    workflows = q.order_by(Workflow.workflow_type, Workflow.name).all()
    return jsonify([w.to_dict() for w in workflows]), 200


@workflow_bp.route("/workflows", methods=["POST"])
@token_required
@require_resource("workflows")
def create_workflow(current_user):
    try:
        data = WorkflowCreate(**request.get_json() or {})
    except ValidationError as e:
        return _handle_validation_error(e)

    if data.workflow_type not in WORKFLOW_TYPES:
        return jsonify({"error": f"Invalid workflow_type. Must be one of {WORKFLOW_TYPES}"}), 400

    wf = Workflow(
        name=data.name,
        description=data.description,
        workflow_type=data.workflow_type,
    )
    db.session.add(wf)
    db.session.commit()

    logger.info("Workflow created", context={"workflow_id": wf.id, "name": wf.name})
    return jsonify(wf.to_dict()), 201


@workflow_bp.route("/workflows/<int:workflow_id>", methods=["GET"])
@token_required
@require_resource("workflows")
def get_workflow(current_user, workflow_id):
    wf = Workflow.query.get(workflow_id)
    if not wf:
        return jsonify({"error": "Workflow not found"}), 404
    return jsonify(wf.to_dict()), 200


@workflow_bp.route("/workflows/<int:workflow_id>", methods=["PUT"])
@token_required
@require_resource("workflows")
def update_workflow(current_user, workflow_id):
    wf = Workflow.query.get(workflow_id)
    if not wf:
        return jsonify({"error": "Workflow not found"}), 404

    try:
        data = WorkflowUpdate(**request.get_json() or {})
    except ValidationError as e:
        return _handle_validation_error(e)

    if data.name is not None:
        wf.name = data.name
    if data.description is not None:
        wf.description = data.description
    if data.workflow_type is not None:
        if data.workflow_type not in WORKFLOW_TYPES:
            return jsonify({"error": f"Invalid workflow_type"}), 400
        wf.workflow_type = data.workflow_type
    if data.is_active is not None:
        wf.is_active = data.is_active
    wf.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(wf.to_dict()), 200


@workflow_bp.route("/workflows/<int:workflow_id>", methods=["DELETE"])
@token_required
@require_resource("workflows")
def delete_workflow(current_user, workflow_id):
    wf = Workflow.query.get(workflow_id)
    if not wf:
        return jsonify({"error": "Workflow not found"}), 404
    db.session.delete(wf)
    db.session.commit()
    return jsonify({"message": "Workflow deleted"}), 200


@workflow_bp.route("/workflows/<int:workflow_id>/duplicate", methods=["POST"])
@token_required
@require_resource("workflows")
def duplicate_workflow(current_user, workflow_id):
    original = Workflow.query.get(workflow_id)
    if not original:
        return jsonify({"error": "Workflow not found"}), 404

    copy = Workflow(
        name=f"{original.name} (Copy)",
        description=original.description,
        workflow_type=original.workflow_type,
    )
    db.session.add(copy)
    db.session.flush()

    for stage in sorted(original.stages, key=lambda s: s.stage_order):
        s = WorkflowStage(
            workflow_id=copy.id,
            name=stage.name,
            stage_order=stage.stage_order,
            role_required=stage.role_required,
        )
        db.session.add(s)

    for rule in original.rules:
        r = WorkflowRule(
            workflow_id=copy.id,
            field=rule.field,
            operator=rule.operator,
            value=rule.value,
            priority=rule.priority,
        )
        db.session.add(r)

    db.session.commit()
    return jsonify(copy.to_dict()), 201


# ── Stage CRUD ─────────────────────────────────────────────────────────

@workflow_bp.route("/workflows/<int:workflow_id>/stages", methods=["POST"])
@token_required
@require_resource("workflows")
def add_stage(current_user, workflow_id):
    wf = Workflow.query.get(workflow_id)
    if not wf:
        return jsonify({"error": "Workflow not found"}), 404

    try:
        data = StageCreate(**request.get_json() or {})
    except ValidationError as e:
        return _handle_validation_error(e)

    stage = WorkflowStage(
        workflow_id=wf.id,
        name=data.name,
        stage_order=data.stage_order,
        role_required=data.role_required,
    )
    db.session.add(stage)
    # Re-index stage orders
    _reindex_stages(wf.id)
    db.session.commit()
    return jsonify(stage.to_dict()), 201


@workflow_bp.route("/workflows/stages/<int:stage_id>", methods=["PUT"])
@token_required
@require_resource("workflows")
def update_stage(current_user, stage_id):
    stage = WorkflowStage.query.get(stage_id)
    if not stage:
        return jsonify({"error": "Stage not found"}), 404

    data = request.get_json() or {}
    if "name" in data:
        stage.name = data["name"]
    if "stage_order" in data:
        stage.stage_order = int(data["stage_order"])
        _reindex_stages(stage.workflow_id)
    if "role_required" in data:
        stage.role_required = data["role_required"]

    db.session.commit()
    return jsonify(stage.to_dict()), 200


@workflow_bp.route("/workflows/stages/<int:stage_id>", methods=["DELETE"])
@token_required
@require_resource("workflows")
def delete_stage(current_user, stage_id):
    stage = WorkflowStage.query.get(stage_id)
    if not stage:
        return jsonify({"error": "Stage not found"}), 404
    wid = stage.workflow_id
    db.session.delete(stage)
    _reindex_stages(wid)
    db.session.commit()
    return jsonify({"message": "Stage deleted"}), 200


def _reindex_stages(workflow_id):
    """Re-index stage_order to be sequential (1, 2, 3...)"""
    stages = WorkflowStage.query.filter_by(workflow_id=workflow_id)\
        .order_by(WorkflowStage.stage_order, WorkflowStage.id).all()
    for i, s in enumerate(stages, 1):
        s.stage_order = i


# ── Rule CRUD ──────────────────────────────────────────────────────────

@workflow_bp.route("/workflows/<int:workflow_id>/rules", methods=["POST"])
@token_required
@require_resource("workflows")
def add_rule(current_user, workflow_id):
    wf = Workflow.query.get(workflow_id)
    if not wf:
        return jsonify({"error": "Workflow not found"}), 404

    try:
        data = RuleCreate(**request.get_json() or {})
    except ValidationError as e:
        return _handle_validation_error(e)

    if data.field not in RULE_FIELDS:
        return jsonify({"error": f"Invalid field. Must be one of {RULE_FIELDS}"}), 400
    if data.operator not in RULE_OPERATORS:
        return jsonify({"error": f"Invalid operator. Must be one of {RULE_OPERATORS}"}), 400

    rule = WorkflowRule(
        workflow_id=wf.id,
        field=data.field,
        operator=data.operator,
        value=data.value,
        priority=data.priority,
    )
    db.session.add(rule)
    db.session.commit()
    return jsonify(rule.to_dict()), 201


@workflow_bp.route("/workflows/rules/<int:rule_id>", methods=["PUT"])
@token_required
@require_resource("workflows")
def update_rule(current_user, rule_id):
    rule = WorkflowRule.query.get(rule_id)
    if not rule:
        return jsonify({"error": "Rule not found"}), 404

    data = request.get_json() or {}
    if "field" in data:
        if data["field"] not in RULE_FIELDS:
            return jsonify({"error": f"Invalid field"}), 400
        rule.field = data["field"]
    if "operator" in data:
        if data["operator"] not in RULE_OPERATORS:
            return jsonify({"error": f"Invalid operator"}), 400
        rule.operator = data["operator"]
    if "value" in data:
        rule.value = str(data["value"])
    if "priority" in data:
        rule.priority = int(data["priority"])

    db.session.commit()
    return jsonify(rule.to_dict()), 200


@workflow_bp.route("/workflows/rules/<int:rule_id>", methods=["DELETE"])
@token_required
@require_resource("workflows")
def delete_rule(current_user, rule_id):
    rule = WorkflowRule.query.get(rule_id)
    if not rule:
        return jsonify({"error": "Rule not found"}), 404
    db.session.delete(rule)
    db.session.commit()
    return jsonify({"message": "Rule deleted"}), 200


# ── Evaluate endpoint ────────────────────────────────────────────────

@workflow_bp.route("/workflows/evaluate", methods=["POST"])
@token_required
@require_resource("workflows")
def evaluate(current_user):
    """Evaluate which workflow applies to given entity data."""
    data = request.get_json() or {}
    entity_type = data.get("entity_type")
    entity_data = data.get("entity_data", {})

    if entity_type not in WORKFLOW_TYPES:
        return jsonify({"error": f"Invalid entity_type. Must be one of {WORKFLOW_TYPES}"}), 400

    wf = evaluate_workflow(entity_type, entity_data)
    if wf:
        return jsonify({"workflow": wf.to_dict()}), 200
    return jsonify({"workflow": None, "message": "No matching workflow found"}), 200


# ── Assignment endpoints ──────────────────────────────────────────────

@workflow_bp.route("/workflows/assignments", methods=["GET"])
@token_required
@require_resource("workflows")
def list_assignments(current_user):
    entity_type = request.args.get("entity_type")
    entity_id = request.args.get("entity_id", type=int)
    q = WorkflowAssignment.query

    if entity_type:
        q = q.filter_by(entity_type=entity_type)
    if entity_id:
        q = q.filter_by(entity_id=entity_id)

    assignments = q.order_by(WorkflowAssignment.created_at.desc()).all()
    return jsonify([a.to_dict() for a in assignments]), 200


@workflow_bp.route("/workflows/assignments/<int:assignment_id>", methods=["GET"])
@token_required
@require_resource("workflows")
def get_assignment(current_user, assignment_id):
    a = WorkflowAssignment.query.get(assignment_id)
    if not a:
        return jsonify({"error": "Assignment not found"}), 404
    return jsonify(a.to_dict()), 200


# ── Metadata ──────────────────────────────────────────────────────────

@workflow_bp.route("/workflows/meta", methods=["GET"])
@token_required
@require_resource("workflows")
def workflow_meta(current_user):
    return jsonify({
        "types": WORKFLOW_TYPES,
        "operators": RULE_OPERATORS,
        "fields": RULE_FIELDS,
    }), 200
