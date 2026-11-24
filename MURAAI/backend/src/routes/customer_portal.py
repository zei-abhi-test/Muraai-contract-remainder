import os
import uuid
from datetime import datetime

from flask import Blueprint, current_app, g, jsonify, request, send_file
from werkzeug.utils import secure_filename

from src.models.contract import (
    Contract, ContractDocument, ContractLineItem, ContractRenewal,
    Customer, Invoice, PurchaseOrder, PurchaseOrderContract, db,
)
from src.models.customer_auth import CustomerPortalUser
from src.services.customer_auth import (
    customer_token_required, decode_token, generate_token,
)
from src.services.logging_config import get_structured_logger
from src.services.limiter import limiter

customer_portal_bp = Blueprint("customer_portal", __name__)
logger = get_structured_logger(__name__)


# ── Auth ────────────────────────────────────────────────────────────────

@customer_portal_bp.route("/portal/auth/login", methods=["POST"])
@limiter.limit("5 per minute")
def portal_login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    portal_user = CustomerPortalUser.query.filter_by(email=email).first()
    if portal_user is None or not portal_user.is_active or not portal_user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    portal_user.last_login = datetime.utcnow()
    db.session.commit()

    token = generate_token(portal_user)
    customer = db.session.get(Customer, portal_user.customer_id)

    return jsonify({
        "token": token,
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "email": customer.email,
            "phone": customer.phone,
            "portal_email": portal_user.email,
        },
    }), 200


@customer_portal_bp.route("/portal/auth/me", methods=["GET"])
@limiter.limit("60 per minute")
@customer_token_required
def portal_me():
    pu = g.current_customer
    customer = db.session.get(Customer, pu.customer_id)
    return jsonify({
        "id": customer.id,
        "name": customer.name,
        "email": customer.email,
        "phone": customer.phone,
        "portal_email": pu.email,
    }), 200


# ── Dashboard ──────────────────────────────────────────────────────────

def _customer_contracts(customer_id):
    return Contract.query.filter_by(customer_id=customer_id).order_by(Contract.end_date.asc()).all()


@customer_portal_bp.route("/portal/dashboard", methods=["GET"])
@limiter.limit("60 per minute")
@customer_token_required
def portal_dashboard():
    pu = g.current_customer
    contracts = _customer_contracts(pu.customer_id)

    total_contracts = len(contracts)
    active = sum(1 for c in contracts if c.status == "Active")
    expiring_soon = sum(
        1 for c in contracts
        if c.end_date and 0 <= (c.end_date - datetime.utcnow().date()).days <= 30
    )
    expired = sum(1 for c in contracts if c.status == "Expired")

    return jsonify({
        "total_contracts": total_contracts,
        "active_contracts": active,
        "expiring_soon": expiring_soon,
        "expired_contracts": expired,
        "recent_contracts": [
            {"id": c.id, "contract_name": c.contract_name, "status": c.status,
             "end_date": c.end_date.isoformat() if c.end_date else None}
            for c in sorted(contracts, key=lambda x: x.created_at or datetime.min, reverse=True)[:5]
        ],
    }), 200


# ── Contracts ──────────────────────────────────────────────────────────

@customer_portal_bp.route("/portal/contracts", methods=["GET"])
@limiter.limit("60 per minute")
@customer_token_required
def portal_contracts():
    pu = g.current_customer
    contracts = _customer_contracts(pu.customer_id)
    return jsonify([{
        "id": c.id,
        "contract_name": c.contract_name,
        "company_name": c.company_name,
        "contract_number": c.contract_number,
        "status": c.status,
        "start_date": c.start_date.isoformat() if c.start_date else None,
        "end_date": c.end_date.isoformat() if c.end_date else None,
        "renewal_date": c.renewal_date.isoformat() if c.renewal_date else None,
        "total_contract_value": float(c.total_contract_value) if c.total_contract_value else 0,
        "currency": c.currency,
        "days_until_end": c.days_until_end() if hasattr(c, "days_until_end") else None,
    } for c in contracts]), 200


@customer_portal_bp.route("/portal/contracts/<int:contract_id>", methods=["GET"])
@limiter.limit("60 per minute")
@customer_token_required
def portal_contract_detail(contract_id):
    pu = g.current_customer
    contract = Contract.query.filter_by(id=contract_id, customer_id=pu.customer_id).first()
    if not contract:
        return jsonify({"error": "Contract not found"}), 404

    line_items = ContractLineItem.query.filter_by(contract_id=contract.id).all()
    documents = ContractDocument.query.filter_by(contract_id=contract.id).all()

    renewal = ContractRenewal.query.filter_by(new_contract_id=contract.id).first()
    renewal_info = None
    if renewal:
        renewal_info = {
            "original_contract_id": renewal.original_contract_id,
            "previous_contract_id": renewal.previous_contract_id,
            "renewed_at": renewal.renewed_at.isoformat() if renewal.renewed_at else None,
        }

    return jsonify({
        "id": contract.id,
        "contract_name": contract.contract_name,
        "company_name": contract.company_name,
        "contract_number": contract.contract_number,
        "status": contract.status,
        "start_date": contract.start_date.isoformat() if contract.start_date else None,
        "end_date": contract.end_date.isoformat() if contract.end_date else None,
        "renewal_date": contract.renewal_date.isoformat() if contract.renewal_date else None,
        "total_contract_value": float(contract.total_contract_value) if contract.total_contract_value else 0,
        "currency": contract.currency,
        "notes": contract.notes,
        "line_items": [li.to_dict() for li in line_items],
        "documents": [d.to_dict() for d in documents],
        "renewal_info": renewal_info,
    }), 200


# ── Invoices ───────────────────────────────────────────────────────────

@customer_portal_bp.route("/portal/invoices", methods=["GET"])
@limiter.limit("60 per minute")
@customer_token_required
def portal_invoices():
    pu = g.current_customer
    invoices = Invoice.query.filter_by(customer_id=pu.customer_id).order_by(Invoice.invoice_date.desc()).all()
    return jsonify([{
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "amount": float(inv.amount) if inv.amount else 0,
        "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
        "status": inv.status,
        "contract_id": inv.contract_id,
    } for inv in invoices]), 200


@customer_portal_bp.route("/portal/invoices/<int:invoice_id>/download", methods=["GET"])
@limiter.limit("60 per minute")
@customer_token_required
def portal_invoice_download(invoice_id):
    pu = g.current_customer
    inv = Invoice.query.filter_by(id=invoice_id, customer_id=pu.customer_id).first()
    if not inv:
        return jsonify({"error": "Invoice not found"}), 404

    contract = db.session.get(Contract, inv.contract_id) if inv.contract_id else None
    lines = ""
    if contract:
        items = ContractLineItem.query.filter_by(contract_id=contract.id).all()
        for li in items:
            lines += f"{li.product_name},{li.quantity},{float(li.rate):.2f},{float(li.line_total or 0):.2f}\n"

    csv = (
        f"Invoice Number,{inv.invoice_number}\n"
        f"Date,{inv.invoice_date}\n"
        f"Due Date,{inv.due_date or ''}\n"
        f"Status,{inv.status}\n"
        f"Amount,{float(inv.amount or 0):.2f}\n"
        f"\n"
        f"Contract,{contract.contract_name if contract else ''}\n"
        f"\n"
        f"Line Items\n"
        f"Product,Quantity,Rate,Total\n"
        f"{lines}"
    )

    import tempfile
    tmp = tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".csv", newline="")
    tmp.write(csv)
    tmp.close()

    return send_file(
        tmp.name,
        mimetype="text/csv",
        as_attachment=True,
        download_name=f"invoice_{inv.invoice_number}.csv",
    )


# ── Purchase Orders ───────────────────────────────────────────────────

@customer_portal_bp.route("/portal/purchase-orders", methods=["GET"])
@limiter.limit("60 per minute")
@customer_token_required
def portal_purchase_orders():
    pu = g.current_customer
    pos = PurchaseOrder.query.filter_by(customer_id=pu.customer_id).order_by(PurchaseOrder.id.desc()).all()
    return jsonify([{
        "id": po.id,
        "po_number": po.po_number,
        "vendor": po.vendor,
        "amount": float(po.amount) if po.amount else 0,
        "status": po.status,
        "created_at": po.created_at.isoformat() if po.created_at else None,
    } for po in pos]), 200


# ── Documents (Signed Document Upload) ─────────────────────────────────

@customer_portal_bp.route("/portal/contracts/<int:contract_id>/documents", methods=["GET"])
@limiter.limit("60 per minute")
@customer_token_required
def portal_list_documents(contract_id):
    pu = g.current_customer
    contract = Contract.query.filter_by(id=contract_id, customer_id=pu.customer_id).first()
    if not contract:
        return jsonify({"error": "Contract not found"}), 404

    documents = ContractDocument.query.filter_by(contract_id=contract.id).all()
    return jsonify([d.to_dict() for d in documents]), 200


@customer_portal_bp.route("/portal/contracts/<int:contract_id>/documents", methods=["POST"])
@limiter.limit("60 per minute")
@customer_token_required
def portal_upload_document(contract_id):
    pu = g.current_customer
    contract = Contract.query.filter_by(id=contract_id, customer_id=pu.customer_id).first()
    if not contract:
        return jsonify({"error": "Contract not found"}), 404

    uploaded_file = request.files.get("file")
    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"error": "file is required"}), 400

    default_root = (
        os.path.join("C:\\tmp", "muraai-contract-uploads")
        if os.getenv("FLASK_ENV") == "testing" or current_app.config.get("TESTING")
        else os.path.join(current_app.instance_path, "uploads")
    )
    upload_root = current_app.config.get("UPLOAD_FOLDER", default_root)
    os.makedirs(upload_root, exist_ok=True)

    original_name = secure_filename(uploaded_file.filename)
    stored_name = f"{uuid.uuid4().hex}_{original_name}"
    file_path = os.path.join(upload_root, stored_name)
    uploaded_file.save(file_path)

    document = ContractDocument(
        contract_id=contract.id,
        file_name=original_name,
        stored_file_name=stored_name,
        file_path=file_path,
        content_type=uploaded_file.content_type,
    )
    db.session.add(document)
    db.session.commit()

    logger.info("Customer uploaded document", context={
        "contract_id": contract.id, "file_name": original_name, "customer_id": pu.customer_id,
    })
    return jsonify(document.to_dict()), 201
