from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO

from flask import Blueprint, jsonify, request, send_file

from src.models.contract import (
    ActivityLog, Contract, Customer, Invoice, InvoiceLineItem,
    PurchaseOrder, db,
)
from src.routes.activity import log_activity
from src.services.auth import token_required, require_resource
from src.services.logging_config import get_structured_logger
from src.services.automation_engine import execute_triggers
from src.services.domain_event import dispatcher

invoices_bp = Blueprint("invoices", __name__)
logger = get_structured_logger(__name__)

VALID_STATUSES = {"DRAFT", "ISSUED", "PAID", "CANCELLED"}


def parse_decimal(value, fallback="0"):
    try:
        return Decimal(str(value if value is not None else fallback))
    except (InvalidOperation, ValueError):
        raise ValueError("Invalid numeric value")


def parse_date(value, fallback=None):
    if not value:
        return fallback
    return datetime.strptime(value, "%Y-%m-%d").date()


def generate_invoice_number():
    year = date.today().year
    prefix = f"INV-{year}-"
    last = (
        Invoice.query
        .filter(Invoice.invoice_number.like(f"{prefix}%"))
        .order_by(Invoice.id.desc())
        .first()
    )
    if last:
        seq = int(last.invoice_number.split("-")[-1]) + 1
    else:
        seq = 1
    return f"{prefix}{seq:06d}"


def _get_owned_invoice(invoice_id, user_id):
    return Invoice.query.filter_by(id=invoice_id, user_id=user_id).first()


def _invoice_line_items(invoice_id):
    return [
        li.to_dict()
        for li in InvoiceLineItem.query.filter_by(invoice_id=invoice_id).all()
    ]


def _invoice_to_dict(invoice):
    return invoice.to_dict(line_items=_invoice_line_items(invoice.id))


def _upsert_line_items(invoice, line_items, user_id):
    """Replace invoice line items. Accepts list of dicts with product_name,
    quantity, rate, discount, tax, product_id, sku."""
    InvoiceLineItem.query.filter_by(invoice_id=invoice.id).delete()
    for item in line_items or []:
        li = InvoiceLineItem(
            invoice_id=invoice.id,
            product_id=item.get("product_id"),
            product_name=item.get("product_name", ""),
            sku=item.get("sku"),
            quantity=parse_decimal(item.get("quantity", "1")),
            rate=parse_decimal(item.get("rate", "0")),
            discount=parse_decimal(item.get("discount", "0")),
            tax=parse_decimal(item.get("tax", "0")),
            amount=parse_decimal(item.get("amount", "0")),
        )
        db.session.add(li)


def _log_invoice_activity(activity_type, title, description, invoice, user_id):
    log_activity(
        user_id=user_id,
        activity_type=activity_type,
        title=title,
        description=description,
        contract_id=invoice.contract_id,
        entity_type="invoice",
        entity_id=invoice.id,
    )


def _build_pdf_text(invoice, customer_name, contract_name, line_items):
    lines = []
    lines.append("=" * 60)
    lines.append(f"{'INVOICE':^60}")
    lines.append("=" * 60)
    lines.append("")
    lines.append(f"Invoice #:      {invoice.invoice_number}")
    lines.append(f"Date:           {invoice.invoice_date.isoformat() if invoice.invoice_date else ''}")
    lines.append(f"Due Date:       {invoice.due_date.isoformat() if invoice.due_date else ''}")
    lines.append(f"Customer:       {customer_name or 'N/A'}")
    lines.append(f"Contract:       {contract_name or 'N/A'}")
    lines.append(f"Currency:       {invoice.currency or 'INR'}")
    lines.append(f"Status:         {invoice.effective_status()}")
    lines.append("")
    if line_items:
        lines.append("-" * 60)
        lines.append(f"{'Item':<30} {'Qty':>6} {'Rate':>10} {'Amount':>10}")
        lines.append("-" * 60)
        for li in line_items:
            lines.append(
                f"{li['product_name'][:28]:<30} {li['quantity']:>6} {li['rate']:>10.2f} {li['amount']:>10.2f}"
            )
        lines.append("-" * 60)
    lines.append(f"{'Subtotal:':>50} {invoice.amount:>10.2f}")
    if invoice.discount and invoice.discount > 0:
        lines.append(f"{'Discount:':>50} -{invoice.discount:>10.2f}")
    if invoice.tax and invoice.tax > 0:
        lines.append(f"{'Tax:':>50} {invoice.tax:>10.2f}")
    lines.append(f"{'Grand Total:':>50} {invoice.total or invoice.amount:>10.2f}")
    lines.append("")
    if invoice.remarks:
        lines.append(f"Remarks: {invoice.remarks}")
    lines.append("=" * 60)
    return "\n".join(lines)


@invoices_bp.route("/invoices", methods=["GET"])
@token_required
@require_resource("invoices")
def list_invoices(current_user):
    search = (request.args.get("search") or "").strip().lower()
    contract_id = request.args.get("contract_id")
    invoices = (
        Invoice.query.filter_by(user_id=current_user.id)
        .order_by(Invoice.created_at.desc())
        .all()
    )
    if search:
        invoices = [inv for inv in invoices if search in (inv.invoice_number or "").lower()]
    if contract_id:
        invoices = [inv for inv in invoices if inv.contract_id == int(contract_id)]
    return jsonify([_invoice_to_dict(inv) for inv in invoices]), 200


@invoices_bp.route("/invoices", methods=["POST"])
@token_required
@require_resource("invoices")
def create_invoice(current_user):
    data = request.get_json() or {}
    contract_id = data.get("contract_id")
    purchase_order_id = data.get("purchase_order_id")

    contract = None
    if contract_id:
        contract = Contract.query.filter_by(id=contract_id, user_id=current_user.id).first()
        if not contract:
            return jsonify({"error": "Contract not found"}), 404

    # When a contract is selected, always use its customer_id
    if contract:
        customer_id = contract.customer_id
    else:
        customer_id = data.get("customer_id")

    if customer_id and not Customer.query.filter_by(id=customer_id, user_id=current_user.id).first():
        return jsonify({"error": "Customer not found"}), 404

    # Verify purchase order if provided
    po = None
    if purchase_order_id:
        po = PurchaseOrder.query.filter_by(id=purchase_order_id, user_id=current_user.id).first()
        if not po:
            return jsonify({"error": "Purchase order not found"}), 404

    try:
        default_amount = contract.total_contract_value if contract else Decimal("0")
        amount = parse_decimal(data.get("amount"), str(default_amount or "0"))
        tax = parse_decimal(data.get("tax"), "0")
        discount = parse_decimal(data.get("discount"), "0")
        total = parse_decimal(data.get("total"), str(amount or "0"))
    except ValueError:
        return jsonify({"error": "Invalid numeric value"}), 400

    status = (data.get("status") or "DRAFT").upper()
    if status not in VALID_STATUSES:
        return jsonify({"error": f"Invalid status. Must be one of {sorted(VALID_STATUSES)}"}), 400

    invoice_number = (data.get("invoice_number") or "").strip() or generate_invoice_number()
    if Invoice.query.filter_by(invoice_number=invoice_number).first():
        return jsonify({"error": f"Invoice number {invoice_number} already exists"}), 400

    invoice = Invoice(
        invoice_number=invoice_number,
        contract_id=contract.id if contract else None,
        customer_id=customer_id,
        purchase_order_id=purchase_order_id,
        amount=amount,
        tax=tax,
        discount=discount,
        total=total,
        currency=data.get("currency", "INR"),
        invoice_date=parse_date(data.get("invoice_date"), date.today()),
        due_date=parse_date(data.get("due_date")),
        status=status,
        remarks=data.get("remarks"),
        created_by=current_user.id,
        user_id=current_user.id,
    )
    db.session.add(invoice)
    db.session.flush()

    try:
        _upsert_line_items(invoice, data.get("line_items"), current_user.id)
    except ValueError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400

    _log_invoice_activity(
        "invoice_created",
        f"Invoice created: {invoice.invoice_number}",
        f"Invoice {invoice.invoice_number} for {amount} was created.",
        invoice,
        current_user.id,
    )

    dispatcher.dispatch(
        event_type="InvoiceCreated",
        aggregate_type="invoice",
        aggregate_id=invoice.id,
        user_id=current_user.id,
        payload={
            "invoice_number": invoice.invoice_number,
            "contract_id": invoice.contract_id,
            "amount": float(invoice.total or invoice.amount or 0),
            "status": invoice.status,
        },
    )

    db.session.commit()

    execute_triggers("invoice_created", {
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "amount": float(invoice.amount or 0),
        "contract_id": invoice.contract_id,
        "status": invoice.status,
        "entity_type": "invoice",
        "entity_id": invoice.id,
    }, current_user.id)

    return jsonify(_invoice_to_dict(invoice)), 201


@invoices_bp.route("/invoices/<int:invoice_id>", methods=["GET", "PUT", "DELETE"])
@token_required
@require_resource("invoices")
def invoice_detail(current_user, invoice_id):
    invoice = _get_owned_invoice(invoice_id, current_user.id)
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404

    if request.method == "GET":
        return jsonify(_invoice_to_dict(invoice)), 200

    if request.method == "DELETE":
        if invoice.status != "DRAFT":
            return (
                jsonify({"error": "Only DRAFT invoices can be deleted. Cancel issued invoices instead."}),
                409,
            )
        inv_number = invoice.invoice_number
        InvoiceLineItem.query.filter_by(invoice_id=invoice.id).delete()
        db.session.delete(invoice)
        _log_invoice_activity(
            "invoice_deleted",
            f"Invoice deleted: {inv_number}",
            f"Invoice {inv_number} was deleted.",
            invoice,
            current_user.id,
        )

        dispatcher.dispatch(
            event_type="InvoiceDeleted",
            aggregate_type="invoice",
            aggregate_id=invoice.id,
            user_id=current_user.id,
            payload={
                "invoice_number": invoice.invoice_number,
            },
        )

        db.session.commit()
        return jsonify({"message": "Invoice deleted"}), 200

    # PUT
    if invoice.status != "DRAFT":
        return jsonify({"error": "Only DRAFT invoices can be edited."}), 409

    data = request.get_json() or {}
    try:
        if "amount" in data:
            invoice.amount = parse_decimal(data.get("amount"))
        if "tax" in data:
            invoice.tax = parse_decimal(data.get("tax"))
        if "discount" in data:
            invoice.discount = parse_decimal(data.get("discount"))
        if "total" in data:
            invoice.total = parse_decimal(data.get("total"))
        if "currency" in data:
            invoice.currency = data.get("currency")
        if "invoice_date" in data:
            invoice.invoice_date = parse_date(data.get("invoice_date"), invoice.invoice_date)
        if "due_date" in data:
            invoice.due_date = parse_date(data.get("due_date"))
        if "paid_date" in data:
            invoice.paid_date = parse_date(data.get("paid_date"))
        if "remarks" in data:
            invoice.remarks = data.get("remarks")
        if "status" in data:
            status = (data.get("status") or "").upper()
            if status not in VALID_STATUSES:
                return jsonify({"error": f"Invalid status. Must be one of {sorted(VALID_STATUSES)}"}), 400
            invoice.status = status
        if "line_items" in data:
            _upsert_line_items(invoice, data.get("line_items"), current_user.id)
    except ValueError:
        return jsonify({"error": "Invalid numeric value"}), 400

    invoice.updated_at = datetime.utcnow()

    _log_invoice_activity(
        "invoice_updated",
        f"Invoice updated: {invoice.invoice_number}",
        f"Invoice {invoice.invoice_number} was updated.",
        invoice,
        current_user.id,
    )

    dispatcher.dispatch(
        event_type="InvoiceUpdated",
        aggregate_type="invoice",
        aggregate_id=invoice.id,
        user_id=current_user.id,
        payload={
            "invoice_number": invoice.invoice_number,
            "status": invoice.status,
        },
    )

    db.session.commit()
    return jsonify(_invoice_to_dict(invoice)), 200


# --- Status lifecycle ---


@invoices_bp.route("/invoices/<int:invoice_id>/issue", methods=["POST"])
@token_required
@require_resource("invoices")
def issue_invoice(current_user, invoice_id):
    invoice = _get_owned_invoice(invoice_id, current_user.id)
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404
    if invoice.status != "DRAFT":
        return jsonify({"error": "Only DRAFT invoices can be issued."}), 409
    invoice.status = "ISSUED"
    invoice.updated_at = datetime.utcnow()

    _log_invoice_activity(
        "invoice_issued",
        f"Invoice issued: {invoice.invoice_number}",
        f"Invoice {invoice.invoice_number} has been issued.",
        invoice,
        current_user.id,
    )

    dispatcher.dispatch(
        event_type="InvoiceIssued",
        aggregate_type="invoice",
        aggregate_id=invoice.id,
        user_id=current_user.id,
        payload={
            "invoice_number": invoice.invoice_number,
            "amount": float(invoice.total or invoice.amount or 0),
        },
    )

    db.session.commit()
    return jsonify(_invoice_to_dict(invoice)), 200


@invoices_bp.route("/invoices/<int:invoice_id>/mark-paid", methods=["POST"])
@token_required
@require_resource("invoices")
def mark_invoice_paid(current_user, invoice_id):
    invoice = _get_owned_invoice(invoice_id, current_user.id)
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404
    if invoice.status not in ("ISSUED",):
        return jsonify({"error": "Only ISSUED invoices can be marked as paid."}), 409
    invoice.status = "PAID"
    invoice.paid_date = date.today()
    invoice.updated_at = datetime.utcnow()

    _log_invoice_activity(
        "invoice_paid",
        f"Invoice paid: {invoice.invoice_number}",
        f"Invoice {invoice.invoice_number} for {invoice.amount} has been marked as paid.",
        invoice,
        current_user.id,
    )

    dispatcher.dispatch(
        event_type="InvoicePaid",
        aggregate_type="invoice",
        aggregate_id=invoice.id,
        user_id=current_user.id,
        payload={
            "invoice_number": invoice.invoice_number,
            "paid_date": str(invoice.paid_date) if invoice.paid_date else None,
        },
    )

    db.session.commit()

    execute_triggers("invoice_paid", {
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "amount": float(invoice.amount or 0),
        "contract_id": invoice.contract_id,
        "paid_date": str(invoice.paid_date),
        "entity_type": "invoice",
        "entity_id": invoice.id,
    }, current_user.id)

    return jsonify(_invoice_to_dict(invoice)), 200


@invoices_bp.route("/invoices/<int:invoice_id>/cancel", methods=["POST"])
@token_required
@require_resource("invoices")
def cancel_invoice(current_user, invoice_id):
    invoice = _get_owned_invoice(invoice_id, current_user.id)
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404
    if invoice.status in ("PAID", "CANCELLED"):
        return jsonify({"error": "Cannot cancel a PAID or already CANCELLED invoice."}), 409
    invoice.status = "CANCELLED"
    invoice.updated_at = datetime.utcnow()

    _log_invoice_activity(
        "invoice_cancelled",
        f"Invoice cancelled: {invoice.invoice_number}",
        f"Invoice {invoice.invoice_number} was cancelled.",
        invoice,
        current_user.id,
    )

    dispatcher.dispatch(
        event_type="InvoiceCancelled",
        aggregate_type="invoice",
        aggregate_id=invoice.id,
        user_id=current_user.id,
        payload={
            "invoice_number": invoice.invoice_number,
        },
    )

    db.session.commit()
    return jsonify(_invoice_to_dict(invoice)), 200


# --- Duplicate ---


@invoices_bp.route("/invoices/<int:invoice_id>/duplicate", methods=["POST"])
@token_required
@require_resource("invoices")
def duplicate_invoice(current_user, invoice_id):
    original = _get_owned_invoice(invoice_id, current_user.id)
    if not original:
        return jsonify({"error": "Invoice not found"}), 404

    new_inv = Invoice(
        invoice_number=generate_invoice_number(),
        contract_id=original.contract_id,
        customer_id=original.customer_id,
        purchase_order_id=original.purchase_order_id,
        amount=original.amount,
        tax=original.tax,
        discount=original.discount,
        total=original.total,
        currency=original.currency,
        invoice_date=date.today(),
        due_date=original.due_date,
        status="DRAFT",
        remarks=original.remarks,
        created_by=current_user.id,
        user_id=current_user.id,
    )
    db.session.add(new_inv)
    db.session.flush()

    # Duplicate line items
    for li in InvoiceLineItem.query.filter_by(invoice_id=original.id).all():
        db.session.add(InvoiceLineItem(
            invoice_id=new_inv.id,
            product_id=li.product_id,
            product_name=li.product_name,
            sku=li.sku,
            quantity=li.quantity,
            rate=li.rate,
            discount=li.discount,
            tax=li.tax,
            amount=li.amount,
        ))

    _log_invoice_activity(
        "invoice_created",
        f"Invoice duplicated: {new_inv.invoice_number}",
        f"Invoice {new_inv.invoice_number} was duplicated from {original.invoice_number}.",
        new_inv,
        current_user.id,
    )

    dispatcher.dispatch(
        event_type="InvoiceDuplicated",
        aggregate_type="invoice",
        aggregate_id=new_inv.id,
        user_id=current_user.id,
        payload={
            "invoice_number": new_inv.invoice_number,
            "source_invoice_id": original.id,
        },
    )

    db.session.commit()
    return jsonify(_invoice_to_dict(new_inv)), 201


# --- PDF download ---


@invoices_bp.route("/invoices/<int:invoice_id>/pdf", methods=["GET"])
@token_required
@require_resource("invoices")
def download_invoice_pdf(current_user, invoice_id):
    invoice = _get_owned_invoice(invoice_id, current_user.id)
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404

    customer_name = ""
    if invoice.customer_id:
        customer = Customer.query.get(invoice.customer_id)
        if customer:
            customer_name = customer.name

    contract_name = ""
    if invoice.contract_id:
        contract = Contract.query.get(invoice.contract_id)
        if contract:
            contract_name = contract.contract_name

    line_items = _invoice_line_items(invoice.id)
    content = _build_pdf_text(invoice, customer_name, contract_name, line_items)

    buf = BytesIO(content.encode("utf-8"))
    buf.seek(0)

    filename = f"{invoice.invoice_number}.txt"
    return send_file(
        buf,
        mimetype="text/plain",
        as_attachment=True,
        download_name=filename,
    )


# --- Send Email ---


@invoices_bp.route("/invoices/<int:invoice_id>/send-email", methods=["POST"])
@token_required
@require_resource("invoices")
def send_invoice_email(current_user, invoice_id):
    invoice = _get_owned_invoice(invoice_id, current_user.id)
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404

    data = request.get_json() or {}
    to_email = data.get("to_email")
    if not to_email:
        return jsonify({"error": "to_email is required"}), 400

    # Build PDF attachment content
    customer_name = ""
    if invoice.customer_id:
        customer = Customer.query.get(invoice.customer_id)
        if customer:
            customer_name = customer.name

    contract_name = ""
    if invoice.contract_id:
        contract = Contract.query.get(invoice.contract_id)
        if contract:
            contract_name = contract.contract_name

    line_items = _invoice_line_items(invoice.id)
    pdf_content = _build_pdf_text(invoice, customer_name, contract_name, line_items)

    try:
        from src.services.notification_service import NotificationService
        ns = NotificationService()
        ns.send_email_notification(
            to_email=to_email,
            subject=f"Invoice {invoice.invoice_number}",
            body=f"Please find attached invoice {invoice.invoice_number}.\n\n{pdf_content}",
            contract_id=invoice.contract_id,
            log_message=f"Invoice {invoice.invoice_number} sent to {to_email}",
        )
    except Exception as e:
        return jsonify({"error": f"Failed to send email: {str(e)}"}), 500

    _log_invoice_activity(
        "invoice_sent",
        f"Invoice sent: {invoice.invoice_number}",
        f"Invoice {invoice.invoice_number} sent to {to_email}.",
        invoice,
        current_user.id,
    )

    db.session.commit()
    return jsonify({"message": "Invoice email sent", "to_email": to_email}), 200
