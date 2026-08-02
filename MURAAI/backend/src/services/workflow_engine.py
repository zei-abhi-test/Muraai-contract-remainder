from datetime import datetime

from src.models.workflow import (
    Workflow,
    WorkflowAssignment,
    WorkflowAssignmentStage,
    db,
)


def _get_field_value(entity_type: str, entity_data: dict, field: str):
    """Extract a field value from entity data for rule matching."""
    field_map = {
        "contract_value": "total_contract_value",
        "department": "department",
        "contract_type": "contract_type",
        "currency": "currency",
        "customer": "customer_id",
        "region": "region",
        "product_category": "product_category",
    }
    mapped = field_map.get(field, field)
    return entity_data.get(mapped) or entity_data.get(field)


def _evaluate_rule(rule, entity_type: str, entity_data: dict) -> bool:
    """Evaluate a single rule against entity data."""
    field_value = _get_field_value(entity_type, entity_data, rule.field)
    if field_value is None:
        return False
    rule_value = rule.value

    try:
        fv = float(field_value)
        rv = float(rule_value)
    except (ValueError, TypeError):
        fv = str(field_value).lower()
        rv = str(rule_value).lower()

    if rule.operator == "eq":
        return fv == rv
    elif rule.operator == "neq":
        return fv != rv
    elif rule.operator == "gt":
        return isinstance(fv, (int, float)) and fv > rv
    elif rule.operator == "gte":
        return isinstance(fv, (int, float)) and fv >= rv
    elif rule.operator == "lt":
        return isinstance(fv, (int, float)) and fv < rv
    elif rule.operator == "lte":
        return isinstance(fv, (int, float)) and fv <= rv
    elif rule.operator == "in":
        return str(field_value) in [x.strip() for x in rule_value.split(",")]
    elif rule.operator == "contains":
        return rv in str(fv)
    return False


def evaluate_workflow(entity_type: str, entity_data: dict):
    """Find the best matching active workflow for an entity based on rules."""
    workflows = Workflow.query.filter_by(
        workflow_type=entity_type, is_active=True
    ).order_by(Workflow.id).all()

    if not workflows:
        return None

    matched = None
    highest_priority = -1

    for wf in workflows:
        if not wf.rules:
            # No rules = default/catch-all workflow
            if matched is None:
                matched = wf
            continue

        all_match = all(
            _evaluate_rule(rule, entity_type, entity_data) for rule in wf.rules
        )
        if all_match:
            max_priority = max(r.priority for r in wf.rules)
            if max_priority > highest_priority:
                highest_priority = max_priority
                matched = wf

    return matched


def create_assignment(workflow, entity_type: str, entity_id: int):
    """Create a workflow assignment with stage records."""
    assignment = WorkflowAssignment(
        workflow_id=workflow.id,
        entity_type=entity_type,
        entity_id=entity_id,
        current_stage_order=1,
        status="active",
    )
    db.session.add(assignment)
    db.session.flush()

    for stage in sorted(workflow.stages, key=lambda s: s.stage_order):
        rec = WorkflowAssignmentStage(
            assignment_id=assignment.id,
            stage_id=stage.id,
            stage_order=stage.stage_order,
            role_required=stage.role_required,
            status="active" if stage.stage_order == 1 else "pending",
        )
        db.session.add(rec)

    return assignment


def get_current_stage(assignment):
    """Get the current active stage record for an assignment."""
    for rec in assignment.stage_records:
        if rec.stage_order == assignment.current_stage_order:
            return rec
    return None


def advance_workflow(assignment):
    """Advance workflow to the next stage. Returns True if completed."""
    current = get_current_stage(assignment)
    if current:
        current.status = "approved"

    next_order = assignment.current_stage_order + 1
    next_stage = None
    for rec in assignment.stage_records:
        if rec.stage_order == next_order:
            next_stage = rec
            break

    if next_stage:
        next_stage.status = "active"
        assignment.current_stage_order = next_order
        assignment.updated_at = datetime.utcnow()
        db.session.commit()
        return False

    assignment.status = "completed"
    assignment.updated_at = datetime.utcnow()
    db.session.commit()
    return True


def reject_workflow(assignment, comments=None):
    """Reject the entire workflow."""
    current = get_current_stage(assignment)
    if current:
        current.status = "rejected"
        if comments:
            current.comments = comments

    assignment.status = "rejected"
    assignment.updated_at = datetime.utcnow()
    db.session.commit()


def get_assignment_for_entity(entity_type: str, entity_id: int):
    """Get the active workflow assignment for an entity."""
    return WorkflowAssignment.query.filter_by(
        entity_type=entity_type,
        entity_id=entity_id,
        status="active",
    ).first()


def get_all_assignments_for_entity(entity_type: str, entity_id: int):
    """Get all workflow assignments for an entity (for history)."""
    return WorkflowAssignment.query.filter_by(
        entity_type=entity_type,
        entity_id=entity_id,
    ).order_by(WorkflowAssignment.created_at.desc()).all()
