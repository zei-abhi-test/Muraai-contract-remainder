from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from src.models.contract import (
    Contract, ContractApproval, Invoice, PurchaseOrder, ContractDocument, db,
)
from src.models.calendar import CalendarEvent as CalendarEventModel, Task, ReminderConfig
from src.services.auth import token_required, require_resource
from src.services.logging_config import get_structured_logger

calendar_bp = Blueprint("calendar", __name__)
logger = get_structured_logger(__name__)

EVENT_TYPE_MAP = {
    "contract_start": {"color": "#22c55e", "label": "Contract Start"},
    "contract_end": {"color": "#ef4444", "label": "Contract End"},
    "renewal": {"color": "#3b82f6", "label": "Renewal"},
    "invoice_due": {"color": "#f59e0b", "label": "Invoice Due"},
    "invoice_paid": {"color": "#10b981", "label": "Invoice Paid"},
    "po_delivery": {"color": "#8b5cf6", "label": "PO Delivery"},
    "approval_deadline": {"color": "#ec4899", "label": "Approval"},
    "document_expiry": {"color": "#f97316", "label": "Document Expiry"},
    "reminder": {"color": "#14b8a6", "label": "Reminder"},
    "task": {"color": "#6366f1", "label": "Task"},
}


@calendar_bp.route("/calendar/events", methods=["GET"])
@token_required
@require_resource("calendar")
def calendar_events(current_user):
    start_str = request.args.get("start")
    end_str = request.args.get("end")
    types_param = request.args.get("types", "contract_end,renewal,approval_deadline,invoice_due")
    customer_id = request.args.get("customer_id", type=int)
    contract_id = request.args.get("contract_id", type=int)
    status_filter = request.args.get("status")

    today = date.today()
    start = date.fromisoformat(start_str) if start_str else today
    end = date.fromisoformat(end_str) if end_str else today + timedelta(days=30)
    selected_types = [t.strip() for t in types_param.split(",") if t.strip()]

    events = []

    if "contract_start" in selected_types:
        q = Contract.query.filter(
            Contract.user_id == current_user.id,
            Contract.start_date.isnot(None),
            Contract.start_date >= start,
            Contract.start_date <= end,
        )
        if customer_id:
            q = q.filter(Contract.customer_id == customer_id)
        if contract_id:
            q = q.filter(Contract.id == contract_id)
        if status_filter:
            q = q.filter(Contract.status == status_filter)
        for c in q.all():
            events.append({
                "id": f"contract-start-{c.id}",
                "title": f"Contract Start: {c.contract_name}",
                "start": c.start_date.isoformat(),
                "end": c.start_date.isoformat(),
                "type": "contract_start",
                "event_type": "contract_start",
                "entity_type": "contract",
                "entity_id": c.id,
                "status": c.status,
                "description": f"Contract \"{c.contract_name}\" with {c.company_name} starts",
                "company_name": c.company_name,
                "color": EVENT_TYPE_MAP["contract_start"]["color"],
                "amount": float(c.total_contract_value) if c.total_contract_value else 0,
            })

    if "contract_end" in selected_types:
        q = Contract.query.filter(
            Contract.user_id == current_user.id,
            Contract.end_date.isnot(None),
            Contract.end_date >= start,
            Contract.end_date <= end,
            Contract.status.in_(["Active", "On Hold", "Pending Approval", "Approved"]),
        )
        if customer_id:
            q = q.filter(Contract.customer_id == customer_id)
        if contract_id:
            q = q.filter(Contract.id == contract_id)
        if status_filter:
            q = q.filter(Contract.status == status_filter)
        for c in q.all():
            events.append({
                "id": f"contract-end-{c.id}",
                "title": f"Contract End: {c.contract_name}",
                "start": c.end_date.isoformat(),
                "end": c.end_date.isoformat(),
                "type": "contract_end",
                "event_type": "contract_end",
                "entity_type": "contract",
                "entity_id": c.id,
                "status": c.status,
                "description": f"Contract \"{c.contract_name}\" with {c.company_name} expires",
                "company_name": c.company_name,
                "color": EVENT_TYPE_MAP["contract_end"]["color"],
                "amount": float(c.total_contract_value) if c.total_contract_value else 0,
            })

    if "renewal" in selected_types:
        q = Contract.query.filter(
            Contract.user_id == current_user.id,
            Contract.renewal_date.isnot(None),
            Contract.renewal_date >= start,
            Contract.renewal_date <= end,
            Contract.status.in_(["Active", "On Hold"]),
        )
        if customer_id:
            q = q.filter(Contract.customer_id == customer_id)
        if contract_id:
            q = q.filter(Contract.id == contract_id)
        if status_filter:
            q = q.filter(Contract.status == status_filter)
        for c in q.all():
            events.append({
                "id": f"renewal-{c.id}",
                "title": f"Renewal: {c.contract_name}",
                "start": c.renewal_date.isoformat(),
                "end": c.renewal_date.isoformat(),
                "type": "renewal",
                "event_type": "renewal",
                "entity_type": "contract",
                "entity_id": c.id,
                "status": c.status,
                "description": f"Renewal due for contract \"{c.contract_name}\" with {c.company_name}",
                "company_name": c.company_name,
                "color": EVENT_TYPE_MAP["renewal"]["color"],
                "amount": float(c.total_contract_value) if c.total_contract_value else 0,
            })

    if "approval_deadline" in selected_types:
        q = ContractApproval.query.join(
            Contract, ContractApproval.contract_id == Contract.id
        ).filter(
            Contract.user_id == current_user.id,
            ContractApproval.status == "Pending",
        )
        if customer_id:
            q = q.filter(Contract.customer_id == customer_id)
        if contract_id:
            q = q.filter(Contract.id == contract_id)
        if status_filter:
            q = q.filter(Contract.status == status_filter)
        for a in q.all():
            contract = Contract.query.get(a.contract_id)
            sub_date = a.submitted_at.date() if a.submitted_at else today
            events.append({
                "id": f"approval-{a.id}",
                "title": f"Approval: {contract.contract_name if contract else 'N/A'}",
                "start": sub_date.isoformat(),
                "end": sub_date.isoformat(),
                "type": "approval_deadline",
                "event_type": "approval_deadline",
                "entity_type": "contract",
                "entity_id": a.contract_id,
                "status": a.status,
                "description": f"Contract \"{contract.contract_name if contract else 'N/A'}\" pending approval",
                "company_name": contract.company_name if contract else "",
                "color": EVENT_TYPE_MAP["approval_deadline"]["color"],
                "approval_id": a.id,
            })

    if "invoice_due" in selected_types:
        q = Invoice.query.filter(
            Invoice.user_id == current_user.id,
            Invoice.due_date.isnot(None),
            Invoice.due_date >= start,
            Invoice.due_date <= end,
            Invoice.status.in_(["DRAFT", "ISSUED"]),
        )
        if customer_id:
            q = q.filter(Invoice.customer_id == customer_id)
        if contract_id:
            q = q.filter(Invoice.contract_id == contract_id)
        if status_filter:
            q = q.filter(Invoice.status == status_filter)
        for inv in q.all():
            effective = inv.effective_status(today)
            events.append({
                "id": f"invoice-due-{inv.id}",
                "title": f"Invoice Due: {inv.invoice_number}",
                "start": inv.due_date.isoformat(),
                "end": inv.due_date.isoformat(),
                "type": "invoice_due",
                "event_type": "invoice_due",
                "entity_type": "invoice",
                "entity_id": inv.id,
                "status": effective,
                "description": (
                    f"Invoice {inv.invoice_number} of ${float(inv.amount or 0):.2f} is due"
                    if effective == "OVERDUE"
                    else f"Invoice {inv.invoice_number} of ${float(inv.amount or 0):.2f} due"
                ),
                "color": EVENT_TYPE_MAP["invoice_due"]["color"],
                "amount": float(inv.amount or 0),
            })

    if "invoice_paid" in selected_types:
        q = Invoice.query.filter(
            Invoice.user_id == current_user.id,
            Invoice.paid_date.isnot(None),
            Invoice.paid_date >= start,
            Invoice.paid_date <= end,
            Invoice.status == "PAID",
        )
        if customer_id:
            q = q.filter(Invoice.customer_id == customer_id)
        if contract_id:
            q = q.filter(Invoice.contract_id == contract_id)
        if status_filter:
            q = q.filter(Invoice.status == status_filter)
        for inv in q.all():
            events.append({
                "id": f"invoice-paid-{inv.id}",
                "title": f"Invoice Paid: {inv.invoice_number}",
                "start": inv.paid_date.isoformat(),
                "end": inv.paid_date.isoformat(),
                "type": "invoice_paid",
                "event_type": "invoice_paid",
                "entity_type": "invoice",
                "entity_id": inv.id,
                "status": "PAID",
                "description": f"Invoice {inv.invoice_number} of ${float(inv.amount or 0):.2f} was paid",
                "color": EVENT_TYPE_MAP["invoice_paid"]["color"],
                "amount": float(inv.amount or 0),
            })

    if "po_delivery" in selected_types:
        q = PurchaseOrder.query.filter(
            PurchaseOrder.user_id == current_user.id,
            PurchaseOrder.expected_delivery.isnot(None),
            PurchaseOrder.expected_delivery >= start,
            PurchaseOrder.expected_delivery <= end,
            PurchaseOrder.status.in_(["Submitted", "Approved", "Draft"]),
        )
        if customer_id:
            q = q.filter(PurchaseOrder.customer_id == customer_id)
        if status_filter:
            q = q.filter(PurchaseOrder.status == status_filter)
        for po in q.all():
            events.append({
                "id": f"po-delivery-{po.id}",
                "title": f"PO Delivery: {po.po_number}",
                "start": po.expected_delivery.isoformat(),
                "end": po.expected_delivery.isoformat(),
                "type": "po_delivery",
                "event_type": "po_delivery",
                "entity_type": "purchase_order",
                "entity_id": po.id,
                "status": po.status,
                "description": f"Purchase order {po.po_number} from {po.vendor} delivery expected",
                "company_name": po.vendor,
                "color": EVENT_TYPE_MAP["po_delivery"]["color"],
                "amount": float(po.amount or 0),
            })

    if "document_expiry" in selected_types:
        q = ContractDocument.query.filter(
            ContractDocument.content_type.isnot(None),
        )
        docs = q.all()
        for doc in docs:
            contract = Contract.query.get(doc.contract_id) if doc.contract_id else None
            if contract and contract.user_id != current_user.id:
                continue
            if doc.uploaded_at:
                exp_date = doc.uploaded_at.date() + timedelta(days=365)
                if start <= exp_date <= end:
                    events.append({
                        "id": f"document-expiry-{doc.id}",
                        "title": f"Doc Expiry: {doc.file_name}",
                        "start": exp_date.isoformat(),
                        "end": exp_date.isoformat(),
                        "type": "document_expiry",
                        "event_type": "document_expiry",
                        "entity_type": "document",
                        "entity_id": doc.id,
                        "status": "Active",
                        "description": f"Document \"{doc.file_name}\" expires (1 year from upload)",
                        "contract_name": contract.contract_name if contract else "",
                        "color": EVENT_TYPE_MAP["document_expiry"]["color"],
                    })

    if "reminder" in selected_types or "task" in selected_types:
        start_dt = datetime.combine(start, datetime.min.time())
        end_dt = datetime.combine(end, datetime.max.time())
        q = CalendarEventModel.query.filter(
            CalendarEventModel.user_id == current_user.id,
            CalendarEventModel.start >= start_dt,
            CalendarEventModel.start <= end_dt,
        )
        if "reminder" in selected_types and "task" not in selected_types:
            q = q.filter(CalendarEventModel.event_type == "reminder")
        elif "task" in selected_types and "reminder" not in selected_types:
            q = q.filter(CalendarEventModel.event_type == "task")
        if status_filter:
            q = q.filter(CalendarEventModel.status == status_filter)
        for ev in q.all():
            base_color = EVENT_TYPE_MAP.get(ev.event_type, {}).get("color", "#6366f1")
            events.append({
                "id": f"user-{ev.event_type}-{ev.id}",
                "title": ev.title,
                "start": ev.start.isoformat(),
                "end": (ev.end or ev.start).isoformat(),
                "type": ev.event_type,
                "event_type": ev.event_type,
                "entity_type": "calendar_event",
                "entity_id": ev.id,
                "status": ev.status,
                "description": ev.description or "",
                "color": ev.color or base_color,
                "priority": ev.priority,
            })

    events = [e for e in events if e is not None]
    return jsonify({"events": events, "total": len(events)}), 200


@calendar_bp.route("/calendar/events", methods=["POST"])
@token_required
@require_resource("calendar")
def create_event(current_user):
    data = request.get_json()
    if not data or not data.get("title") or not data.get("start"):
        return jsonify({"error": "title and start are required"}), 400
    event_type = data.get("event_type", "reminder")
    event = CalendarEventModel(
        user_id=current_user.id,
        title=data["title"],
        description=data.get("description", ""),
        event_type=event_type,
        start=datetime.fromisoformat(data["start"]),
        end=datetime.fromisoformat(data["end"]) if data.get("end") else None,
        all_day=data.get("all_day", False),
        color=data.get("color"),
        entity_type=data.get("entity_type"),
        entity_id=data.get("entity_id"),
        priority=data.get("priority", "medium"),
        status=data.get("status", "pending"),
    )
    db.session.add(event)
    db.session.commit()
    return jsonify(event.to_dict()), 201


@calendar_bp.route("/calendar/events/<int:event_id>", methods=["PUT"])
@token_required
@require_resource("calendar")
def update_event(current_user, event_id):
    event = CalendarEventModel.query.filter_by(id=event_id, user_id=current_user.id).first()
    if not event:
        return jsonify({"error": "Event not found"}), 404
    data = request.get_json()
    for field in ("title", "description", "event_type", "start", "end", "all_day", "color",
                  "entity_type", "entity_id", "priority", "status"):
        if field in data and field not in ("user_id",):
            if field in ("start", "end") and data[field]:
                setattr(event, field, datetime.fromisoformat(data[field]))
            else:
                setattr(event, field, data[field])
    db.session.commit()
    return jsonify(event.to_dict()), 200


@calendar_bp.route("/calendar/events/<int:event_id>", methods=["DELETE"])
@token_required
@require_resource("calendar")
def delete_event(current_user, event_id):
    event = CalendarEventModel.query.filter_by(id=event_id, user_id=current_user.id).first()
    if not event:
        return jsonify({"error": "Event not found"}), 404
    db.session.delete(event)
    db.session.commit()
    return jsonify({"message": "Event deleted"}), 200





@calendar_bp.route("/reminders/config", methods=["GET"])
@token_required
@require_resource("calendar")
def get_reminder_configs(current_user):
    configs = ReminderConfig.query.filter_by(user_id=current_user.id).all()
    return jsonify([c.to_dict() for c in configs]), 200


DEFAULT_REMINDER_CONFIGS = [
    {"event_type": "renewal", "days_before": 7, "enabled": True, "notification_method": "email"},
    {"event_type": "contract_end", "days_before": 30, "enabled": True, "notification_method": "email"},
    {"event_type": "contract_end", "days_before": 7, "enabled": True, "notification_method": "email"},
    {"event_type": "invoice_due", "days_before": 3, "enabled": True, "notification_method": "email"},
    {"event_type": "invoice_due", "days_before": 1, "enabled": True, "notification_method": "notification"},
    {"event_type": "approval_deadline", "days_before": 2, "enabled": True, "notification_method": "email"},
    {"event_type": "po_delivery", "days_before": 3, "enabled": True, "notification_method": "email"},
    {"event_type": "document_expiry", "days_before": 7, "enabled": True, "notification_method": "email"},
    {"event_type": "contract_start", "days_before": 1, "enabled": False, "notification_method": "notification"},
]


@calendar_bp.route("/reminders/config", methods=["POST"])
@token_required
@require_resource("calendar")
def save_reminder_configs(current_user):
    data = request.get_json()
    if not isinstance(data, list):
        return jsonify({"error": "Expected a list of reminder configs"}), 400

    ReminderConfig.query.filter_by(user_id=current_user.id).delete()
    for item in data:
        config = ReminderConfig(
            user_id=current_user.id,
            event_type=item.get("event_type", "contract_end"),
            days_before=item.get("days_before", 7),
            enabled=item.get("enabled", True),
            notification_method=item.get("notification_method", "email"),
        )
        db.session.add(config)
    db.session.commit()

    configs = ReminderConfig.query.filter_by(user_id=current_user.id).all()
    return jsonify([c.to_dict() for c in configs]), 200


@calendar_bp.route("/reminders/defaults", methods=["POST"])
@token_required
@require_resource("calendar")
def set_default_reminders(current_user):
    existing = ReminderConfig.query.filter_by(user_id=current_user.id).count()
    if existing > 0:
        return jsonify({"message": "Reminder configs already exist"}), 200
    for item in DEFAULT_REMINDER_CONFIGS:
        config = ReminderConfig(
            user_id=current_user.id,
            event_type=item["event_type"],
            days_before=item["days_before"],
            enabled=item["enabled"],
            notification_method=item["notification_method"],
        )
        db.session.add(config)
    db.session.commit()
    configs = ReminderConfig.query.filter_by(user_id=current_user.id).all()
    return jsonify([c.to_dict() for c in configs]), 201


@calendar_bp.route("/calendar/filters", methods=["GET"])
@token_required
@require_resource("calendar")
def get_calendar_filters(current_user):
    customers = db.session.query(
        Contract.customer_id,
    ).filter(
        Contract.user_id == current_user.id,
        Contract.customer_id.isnot(None),
    ).distinct().all()
    customer_ids = [c[0] for c in customers]
    from src.models.contract import Customer
    customer_list = Customer.query.filter(Customer.id.in_(customer_ids)).all() if customer_ids else []

    contracts = Contract.query.filter_by(user_id=current_user.id).order_by(Contract.contract_name).all()

    from src.models.contract import ContractType
    types = ContractType.query.all()

    return jsonify({
        "customers": [{"id": c.id, "name": c.name} for c in customer_list],
        "contracts": [{"id": c.id, "name": c.contract_name} for c in contracts],
        "event_types": [
            {"key": k, "label": v["label"], "color": v["color"]}
            for k, v in EVENT_TYPE_MAP.items()
        ],
        "contract_types": [{"id": t.id, "name": t.name} for t in types],
    }), 200
