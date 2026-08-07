from datetime import datetime

from flask import Blueprint, jsonify, request

from src.models.contract import ContractApproval, Notification, db
from src.routes.activity import log_activity
from src.routes.contracts.crud import contract_to_dict, get_owned_contract
from src.services import contract_lifecycle
from src.services.auth import require_resource, token_required
from src.services.automation_engine import execute_triggers
from src.services.contract_lifecycle import LifecycleError
from src.services.domain_event import dispatcher
from src.services.logging_config import get_structured_logger
from src.services.task_service import generate_task
from src.services.workflow_engine import create_assignment, evaluate_workflow

contract_lifecycle_routes_bp = Blueprint("contract_lifecycle_routes", __name__)
logger = get_structured_logger(__name__)


def _apply_lifecycle_action(current_user, contract_id, action):
    """Shared handler for simple one-step lifecycle actions."""
    contract = get_owned_contract(contract_id, current_user.id)
    if not contract:
        return jsonify({"error": "Contract not found"}), 404
    try:
        contract_lifecycle.apply_transition(contract, action)
    except LifecycleError as exc:
        return jsonify({"error": exc.message}), exc.status_code
    contract.last_modified_by_id = current_user.id
    contract.updated_at = datetime.utcnow()

    action_labels = {
        "activate": ("contract_activated", "Contract activated"),
        "hold": ("contract_updated", "Contract put on hold"),
        "resume": ("contract_updated", "Contract resumed"),
        "complete": ("contract_completed", "Contract completed"),
        "revert_to_draft": ("contract_updated", "Contract reverted to draft"),
        "mark_renewal_due": ("renewal_due", "Renewal marked as due"),
        "expire": ("contract_updated", "Contract expired"),
    }
    atype, atitle = action_labels.get(action, ("contract_updated", f"Contract {action}d"))
    log_activity(
        user_id=current_user.id,
        activity_type=atype,
        title=f"{atitle}: {contract.contract_name}",
        description=f"Contract {contract.contract_name} status changed to {contract.status}.",
        contract_id=contract.id,
        entity_type="contract",
        entity_id=contract.id,
    )

    event_map = {
        "activate": "ContractActivated",
        "hold": "ContractHeld",
        "resume": "ContractResumed",
        "complete": "ContractCompleted",
        "revert_to_draft": "ContractRevertedToDraft",
        "mark_renewal_due": "ContractRenewalMarkedDue",
        "expire": "ContractExpired",
    }
    event_type = event_map.get(action)
    if event_type:
        dispatcher.dispatch(
            event_type=event_type,
            aggregate_type="contract",
            aggregate_id=contract.id,
            user_id=current_user.id,
            payload={
                "contract_name": contract.contract_name,
                "status": contract.status,
                "previous_status": contract_lifecycle.target_status(
                    contract_lifecycle.reverse_actions[action]
                ) if hasattr(contract_lifecycle, "reverse_actions") else None,
            },
        )

    db.session.commit()

    if action == "expire":
        execute_triggers("contract_expired", {
            "contract_id": contract.id,
            "contract_name": contract.contract_name,
            "company_name": contract.company_name,
            "end_date": str(contract.end_date),
            "entity_type": "contract",
            "entity_id": contract.id,
        }, current_user.id)

    return jsonify(contract_to_dict(contract)), 200


@contract_lifecycle_routes_bp.route("/contracts/<int:contract_id>/submit", methods=["POST"])
@token_required
@require_resource("contracts")
def submit_contract(current_user, contract_id):
    """Submit a Draft/Rejected contract for approval."""
    contract = get_owned_contract(contract_id, current_user.id)
    if not contract:
        return jsonify({"error": "Contract not found"}), 404
    try:
        contract_lifecycle.apply_transition(contract, "submit")
    except LifecycleError as exc:
        return jsonify({"error": exc.message}), exc.status_code

    workflow = evaluate_workflow("contract_approval", contract.to_dict())
    workflow_assignment_id = None

    if workflow and workflow.stages:
        assignment = create_assignment(workflow, "contract", contract.id)
        workflow_assignment_id = assignment.id
        status = "Pending"
        approval_level = 1
    else:
        status = "Pending"
        approval_level = 1

    approval = ContractApproval(
        contract_id=contract.id,
        status=status,
        requested_by=current_user.id,
        submitted_at=datetime.utcnow(),
        workflow_assignment_id=workflow_assignment_id,
        approval_level=approval_level,
    )
    db.session.add(approval)

    notification = Notification(
        contract_id=contract.id,
        notification_type="email",
        status="sent",
        message=f"Contract {contract.contract_name} has been submitted for approval.",
    )
    db.session.add(notification)

    log_activity(
        user_id=current_user.id,
        activity_type="approval_requested",
        title=f"Approval requested: {contract.contract_name}",
        description=f"Contract {contract.contract_name} has been submitted for approval.",
        contract_id=contract.id,
        entity_type="contract",
        entity_id=contract.id,
    )

    dispatcher.dispatch(
        event_type="ContractSubmitted",
        aggregate_type="contract",
        aggregate_id=contract.id,
        user_id=current_user.id,
        payload={
            "contract_name": contract.contract_name,
            "company_name": contract.company_name,
            "status": contract.status,
        },
    )
    dispatcher.dispatch(
        event_type="ApprovalRequested",
        aggregate_type="contract",
        aggregate_id=contract.id,
        user_id=current_user.id,
        payload={
            "contract_name": contract.contract_name,
            "approval_id": approval.id,
            "approval_level": approval_level,
        },
    )

    contract.last_modified_by_id = current_user.id
    contract.updated_at = datetime.utcnow()
    db.session.commit()

    generate_task(
        title=f"Approval needed: {contract.contract_name}",
        description=f"Contract {contract.contract_name} with {contract.company_name} has been submitted and requires approval.",
        priority="HIGH",
        due_days=7,
        related_module="contract",
        related_record_id=contract.id,
        assigned_by=current_user.id,
        user_id=current_user.id,
    )

    payload = contract_to_dict(contract)
    payload["approval"] = approval.to_dict()
    if workflow:
        payload["workflow"] = workflow.to_dict()
    return jsonify(payload), 200


@contract_lifecycle_routes_bp.route("/contracts/<int:contract_id>/activate", methods=["POST"])
@token_required
@require_resource("contracts")
def activate_contract(current_user, contract_id):
    return _apply_lifecycle_action(current_user, contract_id, "activate")


@contract_lifecycle_routes_bp.route("/contracts/<int:contract_id>/hold", methods=["POST"])
@token_required
@require_resource("contracts")
def hold_contract(current_user, contract_id):
    return _apply_lifecycle_action(current_user, contract_id, "hold")


@contract_lifecycle_routes_bp.route("/contracts/<int:contract_id>/resume", methods=["POST"])
@token_required
@require_resource("contracts")
def resume_contract(current_user, contract_id):
    return _apply_lifecycle_action(current_user, contract_id, "resume")


@contract_lifecycle_routes_bp.route("/contracts/<int:contract_id>/complete", methods=["POST"])
@token_required
@require_resource("contracts")
def complete_contract(current_user, contract_id):
    return _apply_lifecycle_action(current_user, contract_id, "complete")


@contract_lifecycle_routes_bp.route("/contracts/<int:contract_id>/revert-to-draft", methods=["POST"])
@token_required
@require_resource("contracts")
def revert_contract_to_draft(current_user, contract_id):
    return _apply_lifecycle_action(current_user, contract_id, "revert_to_draft")


@contract_lifecycle_routes_bp.route("/contracts/<int:contract_id>/mark-renewal-due", methods=["POST"])
@token_required
@require_resource("contracts")
def mark_renewal_due(current_user, contract_id):
    return _apply_lifecycle_action(current_user, contract_id, "mark_renewal_due")


@contract_lifecycle_routes_bp.route("/contracts/<int:contract_id>/expire", methods=["POST"])
@token_required
@require_resource("contracts")
def expire_contract(current_user, contract_id):
    return _apply_lifecycle_action(current_user, contract_id, "expire")
