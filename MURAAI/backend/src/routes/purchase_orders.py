from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO

from flask import Blueprint, jsonify, request, send_file

from src.models.contract import ActivityLog, Contract, Customer, PurchaseOrder, PurchaseOrderContract, db
from src.routes.activity import log_activity
from src.services.auth import token_required, require_resource
from src.services.contract_lifecycle import po_allowed_actions, po_apply_transition, LifecycleError
from src.services.logging_config import get_structured_logger
from src.services.automation_engine import execute_triggers
from src.services.task_service import generate_task
from src.services.domain_event import dispatcher

purchase_orders_bp = Blueprint("purchase_orders", __name__)
logger = get_structured_logger(__name__)


def parse_decimal(value, fallback="0"):
    try:
        return Decimal(str(value if value is not None else fallback))
    except (InvalidOperation, ValueError):
        raise ValueError("Invalid numeric value")


def parse_date(value, fallback=None):
    if not value:
        return fallback
    return datetime.strptime(value, "%Y-%m-%d").date()


def generate_po_number():
    year = date.today().year
    prefix = f"PO-{year}-"
    last = (
        PurchaseOrder.query
        .filter(PurchaseOrder.po_number.like(f"{prefix}%"))
        .order_by(PurchaseOrder.id.desc())
        .first()
    )
    if last:
        seq = int(last.po_number.split("-")[-1]) + 1
    else:
        seq = 1
    return f"{prefix}{seq:06d}"


def _get_owned_po(po_id, user_id):
    return PurchaseOrder.query.filter_by(id=po_id, user_id=user_id).first()


def _linked_contract_ids(po_id):
    return [
        row.contract_id
        for row in PurchaseOrderContract.query.filter_by(purchase_order_id=po_id).all()
    ]


def _po_to_dict(po):
    result = po.to_dict(contract_ids=_linked_contract_ids(po.id))
    result["allowed_actions"] = po_allowed_actions(po.status)
    return result


def _link_contracts(po, contract_ids, user_id):
    """Replace a PO's linked contracts. Every contract_id must belong to the
    current user (and, if the PO has a customer, to that customer)."""
    PurchaseOrderContract.query.filter_by(purchase_order_id=po.id).delete()
    for contract_id in contract_ids or []:
        contract = Contract.query.filter_by(id=contract_id, user_id=user_id).first()
        if not contract:
            raise ValueError(f"Contract {contract_id} not found")
        if po.customer_id and contract.customer_id != po.customer_id:
            raise ValueError(
                f"Contract {contract_id} does not belong to the selected customer"
            )
        db.session.add(PurchaseOrderContract(purchase_order_id=po.id, contract_id=contract_id))


def _log_po_activity(activity_type, title, description, po, user_id, contract_id=None):
    log_activity(
        user_id=user_id,
        activity_type=activity_type,
        title=title,
        description=description,
        contract_id=contract_id,
        entity_type="purchase_order",
        entity_id=po.id,
    )


@purchase_orders_bp.route("/purchase-orders", methods=["GET"])
@token_required
@require_resource("purchase_orders")
def list_purchase_orders(current_user):
    search = (request.args.get("search") or "").strip().lower()
    contract_id = request.args.get("contract_id")
    query = PurchaseOrder.query.filter_by(user_id=current_user.id)
    orders = query.order_by(PurchaseOrder.created_at.desc()).all()
    if search:
        orders = [
            po
            for po in orders
            if search in (po.po_number or "").lower() or search in (po.vendor or "").lower()
        ]
    if contract_id:
        cid = int(contract_id)
        linked_ids = {
            row.purchase_order_id
            for row in PurchaseOrderContract.query.filter_by(contract_id=cid).all()
        }
        orders = [po for po in orders if po.id in linked_ids]
    return jsonify([_po_to_dict(po) for po in orders]), 200


@purchase_orders_bp.route("/purchase-orders", methods=["POST"])
@token_required
@require_resource("purchase_orders")
def create_purchase_order(current_user):
    data = request.get_json() or {}
    vendor = (data.get("vendor") or "").strip()
    if not vendor:
        return jsonify({"error": "vendor is required"}), 400

    customer_id = data.get("customer_id")
    if customer_id and not Customer.query.filter_by(id=customer_id, user_id=current_user.id).first():
        return jsonify({"error": "Customer not found"}), 404

    try:
        amount = parse_decimal(data.get("amount", "0"))
    except ValueError:
        return jsonify({"error": "Invalid amount value"}), 400

    po_number = (data.get("po_number") or "").strip() or generate_po_number()
    if PurchaseOrder.query.filter_by(po_number=po_number).first():
        return jsonify({"error": f"PO number {po_number} already exists"}), 400

    po = PurchaseOrder(
        po_number=po_number,
        po_date=parse_date(data.get("po_date"), date.today()),
        vendor=vendor,
        customer_id=customer_id,
        amount=amount,
        status=data.get("status", "Draft"),
        issue_date=parse_date(data.get("issue_date")),
        expected_delivery=parse_date(data.get("expected_delivery")),
        currency=data.get("currency", "INR"),
        remarks=data.get("remarks"),
        user_id=current_user.id,
    )
    db.session.add(po)
    db.session.flush()

    try:
        _link_contracts(po, data.get("contract_ids"), current_user.id)
    except ValueError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400

    _log_po_activity(
        "po_created",
        f"Purchase order created: {po.po_number}",
        f"PO {po.po_number} for {amount} from {vendor} was created.",
        po,
        current_user.id,
        contract_id=data.get("contract_ids", [None])[0] if data.get("contract_ids") else None,
    )

    dispatcher.dispatch(
        event_type="PurchaseOrderCreated",
        aggregate_type="purchase_order",
        aggregate_id=po.id,
        user_id=current_user.id,
        payload={
            "po_number": po.po_number,
            "vendor": po.vendor,
            "amount": float(po.amount or 0),
            "status": po.status,
        },
    )

    db.session.commit()

    execute_triggers("purchase_order_created", {
        "po_id": po.id,
        "po_number": po.po_number,
        "amount": float(po.amount or 0),
        "vendor": po.vendor,
        "contract_id": _linked_contract_ids(po.id)[0] if _linked_contract_ids(po.id) else None,
        "status": po.status,
        "entity_type": "purchase_order",
        "entity_id": po.id,
    }, current_user.id)

    generate_task(
        title=f"Purchase Order pending: {po.po_number}",
        description=f"Purchase Order {po.po_number} for {vendor} ({po.amount}) has been created and needs processing.",
        priority="MEDIUM",
        due_days=14,
        related_module="purchase_order",
        related_record_id=po.id,
        assigned_by=current_user.id,
        user_id=current_user.id,
    )

    return jsonify(_po_to_dict(po)), 201


@purchase_orders_bp.route("/purchase-orders/<int:po_id>", methods=["GET", "PUT", "DELETE"])
@token_required
@require_resource("purchase_orders")
def purchase_order_detail(current_user, po_id):
    po = _get_owned_po(po_id, current_user.id)
    if not po:
        return jsonify({"error": "Purchase order not found"}), 404

    if request.method == "GET":
        return jsonify(_po_to_dict(po)), 200

    if request.method == "DELETE":
        po_number = po.po_number
        PurchaseOrderContract.query.filter_by(purchase_order_id=po.id).delete()
        db.session.delete(po)
        _log_po_activity(
            "po_deleted",
            f"Purchase order deleted: {po_number}",
            f"PO {po_number} was deleted.",
            po,
            current_user.id,
        )

        dispatcher.dispatch(
            event_type="PurchaseOrderDeleted",
            aggregate_type="purchase_order",
            aggregate_id=po.id,
            user_id=current_user.id,
            payload={
                "po_number": po.po_number,
                "vendor": po.vendor,
            },
        )

        db.session.commit()
        return jsonify({"message": "Purchase order deleted"}), 200

    # PUT
    data = request.get_json() or {}
    try:
        if "vendor" in data:
            vendor = (data.get("vendor") or "").strip()
            if not vendor:
                return jsonify({"error": "vendor is required"}), 400
            po.vendor = vendor
        if "customer_id" in data:
            customer_id = data.get("customer_id")
            if customer_id and not Customer.query.filter_by(id=customer_id, user_id=current_user.id).first():
                return jsonify({"error": "Customer not found"}), 404
            po.customer_id = customer_id
        if "po_date" in data:
            po.po_date = parse_date(data.get("po_date"), po.po_date)
        if "amount" in data:
            po.amount = parse_decimal(data.get("amount"))
        if "status" in data:
            po.status = data.get("status")
        if "issue_date" in data:
            po.issue_date = parse_date(data.get("issue_date"))
        if "expected_delivery" in data:
            po.expected_delivery = parse_date(data.get("expected_delivery"))
        if "currency" in data:
            po.currency = data.get("currency")
        if "remarks" in data:
            po.remarks = data.get("remarks")
        if "contract_ids" in data:
            _link_contracts(po, data.get("contract_ids"), current_user.id)
    except ValueError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400

    po.updated_at = datetime.utcnow()

    _log_po_activity(
        "po_updated",
        f"Purchase order updated: {po.po_number}",
        f"PO {po.po_number} was updated.",
        po,
        current_user.id,
    )

    dispatcher.dispatch(
        event_type="PurchaseOrderUpdated",
        aggregate_type="purchase_order",
        aggregate_id=po.id,
        user_id=current_user.id,
        payload={
            "po_number": po.po_number,
            "vendor": po.vendor,
            "status": po.status,
        },
    )

    db.session.commit()
    return jsonify(_po_to_dict(po)), 200


# --- Status lifecycle endpoints ---


@purchase_orders_bp.route("/purchase-orders/<int:po_id>/submit", methods=["POST"])
@token_required
@require_resource("purchase_orders")
def submit_purchase_order(current_user, po_id):
    po = _get_owned_po(po_id, current_user.id)
    if not po:
        return jsonify({"error": "Purchase order not found"}), 404
    try:
        po_apply_transition(po, "po_submit")
    except LifecycleError as e:
        return jsonify({"error": e.message}), e.status_code

    _log_po_activity(
        "po_submitted",
        f"Purchase order submitted: {po.po_number}",
        f"PO {po.po_number} was submitted.",
        po,
        current_user.id,
    )

    dispatcher.dispatch(
        event_type="PurchaseOrderSubmitted",
        aggregate_type="purchase_order",
        aggregate_id=po.id,
        user_id=current_user.id,
        payload={
            "po_number": po.po_number,
            "status": po.status,
        },
    )

    po.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(_po_to_dict(po)), 200


@purchase_orders_bp.route("/purchase-orders/<int:po_id>/approve", methods=["POST"])
@token_required
@require_resource("purchase_orders")
def approve_purchase_order(current_user, po_id):
    po = _get_owned_po(po_id, current_user.id)
    if not po:
        return jsonify({"error": "Purchase order not found"}), 404
    try:
        po_apply_transition(po, "po_approve")
    except LifecycleError as e:
        return jsonify({"error": e.message}), e.status_code

    _log_po_activity(
        "po_approved",
        f"Purchase order approved: {po.po_number}",
        f"PO {po.po_number} was approved.",
        po,
        current_user.id,
    )

    dispatcher.dispatch(
        event_type="PurchaseOrderApproved",
        aggregate_type="purchase_order",
        aggregate_id=po.id,
        user_id=current_user.id,
        payload={
            "po_number": po.po_number,
            "status": po.status,
        },
    )

    generate_task(
        title=f"Purchase Order received pending: {po.po_number}",
        description=f"Purchase Order {po.po_number} has been approved and needs to be marked as received.",
        priority="MEDIUM",
        due_days=30,
        related_module="purchase_order",
        related_record_id=po.id,
        assigned_by=current_user.id,
        user_id=current_user.id,
    )

    po.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(_po_to_dict(po)), 200


@purchase_orders_bp.route("/purchase-orders/<int:po_id>/cancel", methods=["POST"])
@token_required
@require_resource("purchase_orders")
def cancel_purchase_order(current_user, po_id):
    po = _get_owned_po(po_id, current_user.id)
    if not po:
        return jsonify({"error": "Purchase order not found"}), 404
    try:
        po_apply_transition(po, "po_cancel")
    except LifecycleError as e:
        return jsonify({"error": e.message}), e.status_code

    _log_po_activity(
        "po_cancelled",
        f"Purchase order cancelled: {po.po_number}",
        f"PO {po.po_number} was cancelled.",
        po,
        current_user.id,
    )

    dispatcher.dispatch(
        event_type="PurchaseOrderCancelled",
        aggregate_type="purchase_order",
        aggregate_id=po.id,
        user_id=current_user.id,
        payload={
            "po_number": po.po_number,
        },
    )

    po.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(_po_to_dict(po)), 200


@purchase_orders_bp.route("/purchase-orders/<int:po_id>/mark-received", methods=["POST"])
@token_required
@require_resource("purchase_orders")
def mark_received_purchase_order(current_user, po_id):
    po = _get_owned_po(po_id, current_user.id)
    if not po:
        return jsonify({"error": "Purchase order not found"}), 404
    try:
        po_apply_transition(po, "po_mark_received")
    except LifecycleError as e:
        return jsonify({"error": e.message}), e.status_code

    _log_po_activity(
        "po_mark_received",
        f"Purchase order received: {po.po_number}",
        f"PO {po.po_number} was marked as received.",
        po,
        current_user.id,
    )

    dispatcher.dispatch(
        event_type="PurchaseOrderReceived",
        aggregate_type="purchase_order",
        aggregate_id=po.id,
        user_id=current_user.id,
        payload={
            "po_number": po.po_number,
            "status": po.status,
        },
    )

    po.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(_po_to_dict(po)), 200


# --- Duplicate endpoint ---


@purchase_orders_bp.route("/purchase-orders/<int:po_id>/duplicate", methods=["POST"])
@token_required
@require_resource("purchase_orders")
def duplicate_purchase_order(current_user, po_id):
    original = _get_owned_po(po_id, current_user.id)
    if not original:
        return jsonify({"error": "Purchase order not found"}), 404

    new_po = PurchaseOrder(
        po_number=generate_po_number(),
        po_date=date.today(),
        vendor=original.vendor,
        customer_id=original.customer_id,
        amount=original.amount,
        status="Draft",
        issue_date=original.issue_date,
        expected_delivery=original.expected_delivery,
        currency=original.currency,
        remarks=original.remarks,
        user_id=current_user.id,
    )
    db.session.add(new_po)
    db.session.flush()

    # Duplicate contract links
    linked = _linked_contract_ids(original.id)
    for cid in linked:
        db.session.add(PurchaseOrderContract(purchase_order_id=new_po.id, contract_id=cid))

    _log_po_activity(
        "po_created",
        f"Purchase order duplicated: {new_po.po_number}",
        f"PO {new_po.po_number} was duplicated from {original.po_number}.",
        new_po,
        current_user.id,
    )

    dispatcher.dispatch(
        event_type="PurchaseOrderDuplicated",
        aggregate_type="purchase_order",
        aggregate_id=new_po.id,
        user_id=current_user.id,
        payload={
            "po_number": new_po.po_number,
            "source_po_id": original.id,
        },
    )

    db.session.commit()
    return jsonify(_po_to_dict(new_po)), 201


# --- PDF download endpoint ---


@purchase_orders_bp.route("/purchase-orders/<int:po_id>/pdf", methods=["GET"])
@token_required
@require_resource("purchase_orders")
def download_purchase_order_pdf(current_user, po_id):
    po = _get_owned_po(po_id, current_user.id)
    if not po:
        return jsonify({"error": "Purchase order not found"}), 404

    customer_name = ""
    if po.customer_id:
        customer = Customer.query.get(po.customer_id)
        if customer:
            customer_name = customer.name

    # Basic text-based PDF generation (no external library required)
    lines = []
    lines.append("=" * 60)
    lines.append(f"{'PURCHASE ORDER':^60}")
    lines.append("=" * 60)
    lines.append("")
    lines.append(f"PO Number:      {po.po_number}")
    lines.append(f"PO Date:        {po.po_date.isoformat() if po.po_date else ''}")
    lines.append(f"Issue Date:     {po.issue_date.isoformat() if po.issue_date else ''}")
    lines.append(f"Expected Del:   {po.expected_delivery.isoformat() if po.expected_delivery else ''}")
    lines.append(f"Vendor:         {po.vendor}")
    lines.append(f"Customer:       {customer_name or 'N/A'}")
    lines.append(f"Amount:         {po.currency or 'INR'} {po.amount}")
    lines.append(f"Status:         {po.status}")
    if po.remarks:
        lines.append(f"Remarks:        {po.remarks}")
    lines.append("")
    lines.append("-" * 60)

    content = "\n".join(lines)
    buf = BytesIO(content.encode("utf-8"))
    buf.seek(0)

    filename = f"{po.po_number}.txt"
    return send_file(
        buf,
        mimetype="text/plain",
        as_attachment=True,
        download_name=filename,
    )
