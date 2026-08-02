from datetime import datetime

from src.services.domain_event import dispatcher

from flask import Blueprint, jsonify, request

from src.models.contract import ActivityLog, Contract, ContractApproval, Notification, db
from src.routes.activity import log_activity
from src.services.auth import token_required, require_resource
from src.services.contract_lifecycle import LifecycleError, apply_transition
from src.services.logging_config import get_structured_logger
from src.services.workflow_engine import advance_workflow, reject_workflow, get_assignment_for_entity
from src.services.automation_engine import execute_triggers

approvals_bp = Blueprint("approvals", __name__)
logger = get_structured_logger(__name__)


def _owned_approval(approval_id, user_id):
    return (
        ContractApproval.query.join(Contract, Contract.id == ContractApproval.contract_id)
        .filter(ContractApproval.id == approval_id, Contract.user_id == user_id)
        .first()
    )


def _approval_to_dict(approval, contract):
    payload = approval.to_dict()
    payload.update(
        {
            "contract_number": contract.contract_number,
            "contract_name": contract.contract_name,
            "company_name": contract.company_name,
            "customer_id": contract.customer_id,
            "total_contract_value": float(contract.total_contract_value or 0),
            "contract_status": contract.status,
        }
    )
    if approval.workflow_assignment_id:
        assignment = get_assignment_for_entity("contract", contract.id)
        if assignment:
            payload["workflow"] = assignment.to_dict()
    return payload


@approvals_bp.route("/approvals", methods=["GET"])
@token_required
@require_resource("approvals")
def list_approvals(current_user):
    """List approvals with pagination, search, and status filter."""
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    per_page = min(per_page, 100)
    status_filter = request.args.get("status", "").lower()
    search = request.args.get("search", "").strip()
    contract_id = request.args.get("contract_id", type=int)

    query = ContractApproval.query.join(
        Contract, Contract.id == ContractApproval.contract_id
    ).filter(Contract.user_id == current_user.id)

    if status_filter and status_filter != "all":
        query = query.filter(ContractApproval.status.ilike(status_filter))
    if contract_id:
        query = query.filter(ContractApproval.contract_id == contract_id)
    if search:
        query = query.filter(
            Contract.contract_name.ilike(f"%{search}%") |
            Contract.company_name.ilike(f"%{search}%") |
            Contract.contract_number.ilike(f"%{search}%")
        )

    total = query.count()
    approvals = query.order_by(ContractApproval.submitted_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    contracts_by_id = {
        c.id: c
        for c in Contract.query.filter(
            Contract.id.in_([a.contract_id for a in approvals])
        ).all()
    }
    return (
        jsonify(
            {
                "approvals": [
                    _approval_to_dict(approval, contracts_by_id[approval.contract_id])
                    for approval in approvals
                    if approval.contract_id in contracts_by_id
                ],
                "total": total,
                "page": page,
                "per_page": per_page,
                "pages": (total + per_page - 1) // per_page if total else 0,
            }
        ),
        200,
    )


@approvals_bp.route("/approvals/<int:approval_id>", methods=["GET"])
@token_required
@require_resource("approvals")
def get_approval(current_user, approval_id):
    approval = _owned_approval(approval_id, current_user.id)
    if not approval:
        return jsonify({"error": "Approval not found"}), 404
    contract = Contract.query.get(approval.contract_id)
    if not contract:
        return jsonify({"error": "Associated contract not found"}), 404
    return jsonify(_approval_to_dict(approval, contract)), 200


@approvals_bp.route("/approvals/<int:approval_id>/approve", methods=["POST"])
@token_required
@require_resource("approvals")
def approve_approval(current_user, approval_id):
    approval = _owned_approval(approval_id, current_user.id)
    if not approval:
        return jsonify({"error": "Approval not found"}), 404
    if approval.status != "Pending":
        return jsonify({"error": f"Approval already {approval.status.lower()}."}), 409

    contract = Contract.query.get(approval.contract_id)
    data = request.get_json(silent=True) or {}

    approval.status = "Approved"
    approval.approver_id = current_user.id
    approval.comments = data.get("comments")
    approval.approved_at = datetime.utcnow()
    contract.last_modified_by_id = current_user.id
    contract.updated_at = datetime.utcnow()

    # Advance workflow if multi-stage
    completed = True
    if approval.workflow_assignment_id:
        from src.models.workflow import WorkflowAssignment
        assignment = WorkflowAssignment.query.get(approval.workflow_assignment_id)
        if assignment and assignment.status == "active":
            completed = advance_workflow(assignment)
            if not completed:
                # Create next stage approval
                next_stage = next(
                    (s for s in sorted(assignment.workflow.stages, key=lambda x: x.stage_order)
                     if s.stage_order == assignment.current_stage_order),
                    None,
                )
                if next_stage:
                    next_approval = ContractApproval(
                        contract_id=contract.id,
                        status="Pending",
                        requested_by=current_user.id,
                        submitted_at=datetime.utcnow(),
                        workflow_assignment_id=assignment.id,
                        approval_level=next_stage.stage_order,
                    )
                    db.session.add(next_approval)

    if completed:
        try:
            apply_transition(contract, "approve")
        except LifecycleError as exc:
            return jsonify({"error": exc.message}), exc.status_code

    notification = Notification(
        contract_id=contract.id,
        notification_type="email",
        status="sent",
        message=f"Contract {contract.contract_name} was approved by {current_user.username or current_user.id}.",
    )
    db.session.add(notification)

    log_activity(
        user_id=current_user.id,
        activity_type="contract_approved",
        title=f"Contract approved: {contract.contract_name}",
        description=f"Contract {contract.contract_name} was approved.",
        contract_id=contract.id,
        entity_type="contract",
        entity_id=contract.id,
    )

    dispatcher.dispatch(
        event_type="ApprovalGranted",
        aggregate_type="contract",
        aggregate_id=approval.contract_id,
        user_id=current_user.id,
        payload={
            "approval_id": approval.id,
            "contract_id": approval.contract_id,
            "approver": current_user.username,
            "approval_level": approval.approval_level or 1,
        },
    )

    db.session.commit()

    execute_triggers("contract_approved", {
        "contract_id": contract.id,
        "contract_name": contract.contract_name,
        "company_name": contract.company_name,
        "approval_id": approval.id,
        "approval_status": approval.status,
        "entity_type": "contract",
        "entity_id": contract.id,
    }, current_user.id)

    execute_triggers("approval_completed", {
        "contract_id": contract.id,
        "contract_name": contract.contract_name,
        "approval_id": approval.id,
        "approval_status": approval.status,
    }, current_user.id)

    logger.info(
        "Contract approval approved",
        context={"contract_id": contract.id, "approval_id": approval.id, "user_id": current_user.id},
    )
    return jsonify(_approval_to_dict(approval, contract)), 200


@approvals_bp.route("/approvals/<int:approval_id>/reject", methods=["POST"])
@token_required
@require_resource("approvals")
def reject_approval(current_user, approval_id):
    approval = _owned_approval(approval_id, current_user.id)
    if not approval:
        return jsonify({"error": "Approval not found"}), 404
    if approval.status != "Pending":
        return jsonify({"error": f"Approval already {approval.status.lower()}."}), 409

    data = request.get_json(silent=True) or {}
    comments = (data.get("comments") or "").strip()
    if not comments:
        return jsonify({"error": "comments is required when rejecting a contract"}), 400

    contract = Contract.query.get(approval.contract_id)

    try:
        apply_transition(contract, "reject")
    except LifecycleError as exc:
        return jsonify({"error": exc.message}), exc.status_code

    approval.status = "Rejected"
    approval.approver_id = current_user.id
    approval.comments = comments
    approval.rejected_at = datetime.utcnow()
    contract.last_modified_by_id = current_user.id
    contract.updated_at = datetime.utcnow()

    # Reject entire workflow if multi-stage
    if approval.workflow_assignment_id:
        from src.models.workflow import WorkflowAssignment
        assignment = WorkflowAssignment.query.get(approval.workflow_assignment_id)
        if assignment:
            reject_workflow(assignment, comments)

    notification = Notification(
        contract_id=contract.id,
        notification_type="email",
        status="sent",
        message=f"Contract {contract.contract_name} was rejected. Reason: {comments}",
    )
    db.session.add(notification)

    log_activity(
        user_id=current_user.id,
        activity_type="contract_rejected",
        title=f"Contract rejected: {contract.contract_name}",
        description=f"Contract {contract.contract_name} was rejected. Reason: {comments}",
        contract_id=contract.id,
        entity_type="contract",
        entity_id=contract.id,
    )

    dispatcher.dispatch(
        event_type="ApprovalRejected",
        aggregate_type="contract",
        aggregate_id=approval.contract_id,
        user_id=current_user.id,
        payload={
            "approval_id": approval.id,
            "contract_id": approval.contract_id,
            "approver": current_user.username,
            "approval_level": approval.approval_level or 1,
        },
    )

    db.session.commit()

    logger.info(
        "Contract approval rejected",
        context={"contract_id": contract.id, "approval_id": approval.id, "user_id": current_user.id},
    )
    return jsonify(_approval_to_dict(approval, contract)), 200


@approvals_bp.route("/approvals/<int:approval_id>/cancel", methods=["POST"])
@token_required
@require_resource("approvals")
def cancel_approval(current_user, approval_id):
    """Cancel a pending approval request (only the requester or contract owner can cancel)."""
    approval = _owned_approval(approval_id, current_user.id)
    if not approval:
        return jsonify({"error": "Approval not found"}), 404
    if approval.status != "Pending":
        return jsonify({"error": f"Approval already {approval.status.lower()}, cannot cancel."}), 409

    contract = Contract.query.get(approval.contract_id)

    try:
        apply_transition(contract, "cancel_approval")
    except LifecycleError as exc:
        return jsonify({"error": exc.message}), exc.status_code

    approval.status = "Cancelled"
    approval.cancelled_at = datetime.utcnow()
    contract.last_modified_by_id = current_user.id
    contract.updated_at = datetime.utcnow()

    notification = Notification(
        contract_id=contract.id,
        notification_type="email",
        status="sent",
        message=f"Approval for contract {contract.contract_name} was cancelled by {current_user.username or current_user.id}.",
    )
    db.session.add(notification)

    log_activity(
        user_id=current_user.id,
        activity_type="approval_cancelled",
        title=f"Approval cancelled: {contract.contract_name}",
        description=f"Approval for contract {contract.contract_name} was cancelled.",
        contract_id=contract.id,
        entity_type="contract",
        entity_id=contract.id,
    )

    dispatcher.dispatch(
        event_type="ApprovalCancelled",
        aggregate_type="contract",
        aggregate_id=approval.contract_id,
        user_id=current_user.id,
        payload={
            "approval_id": approval.id,
            "contract_id": approval.contract_id,
        },
    )

    db.session.commit()

    logger.info(
        "Contract approval cancelled",
        context={"contract_id": contract.id, "approval_id": approval.id, "user_id": current_user.id},
    )
    return jsonify(_approval_to_dict(approval, contract)), 200


@approvals_bp.route("/approvals/<int:approval_id>", methods=["DELETE"])
@token_required
@require_resource("approvals")
def delete_approval(current_user, approval_id):
    """Hard-delete an approval record (only for cancelled/rejected approvals)."""
    approval = _owned_approval(approval_id, current_user.id)
    if not approval:
        return jsonify({"error": "Approval not found"}), 404
    if approval.status == "Pending":
        return jsonify({"error": "Cannot delete a pending approval, cancel it first."}), 409

    db.session.delete(approval)
    db.session.commit()

    logger.info(
        "Contract approval deleted",
        context={"approval_id": approval.id, "user_id": current_user.id},
    )
    return jsonify({"message": "Approval deleted"}), 200
