from datetime import date, datetime, timedelta
from decimal import Decimal

from flask import Blueprint, jsonify
from sqlalchemy import func

from src.models.contract import (
    Contract, ContractLineItem, ContractDocument, ContractApproval,
    Invoice, db,
)
from src.services.auth import token_required
from src.services.logging_config import get_structured_logger

assistance_bp = Blueprint("assistance", __name__)
logger = get_structured_logger(__name__)


def _to_dict(items):
    return [i.to_dict() for i in items]


def _contract_or_404(contract_id, user_id):
    c = Contract.query.filter_by(id=contract_id, user_id=user_id).first()
    return c


# ── Health Score Factors (deterministic, 0-100) ───────────────────────

def _expiry_score(contract, today):
    days = contract.days_until_end(today)
    if days is None:
        return {"label": "Contract Expiry", "score": 0, "max": 25, "status": "missing", "detail": "No end date set"}
    if days > 90:
        return {"label": "Contract Expiry", "score": 25, "max": 25, "status": "healthy", "detail": f"{days} days until expiry"}
    if days > 30:
        return {"label": "Contract Expiry", "score": 20, "max": 25, "status": "good", "detail": f"{days} days until expiry"}
    if days > 14:
        return {"label": "Contract Expiry", "score": 10, "max": 25, "status": "warning", "detail": f"{days} days until expiry"}
    if days > 0:
        return {"label": "Contract Expiry", "score": 5, "max": 25, "status": "critical", "detail": f"{days} days until expiry"}
    return {"label": "Contract Expiry", "score": 0, "max": 25, "status": "critical", "detail": "Contract expired"}


def _documents_score(contract_id):
    count = ContractDocument.query.filter_by(contract_id=contract_id).count()
    if count > 0:
        return {"label": "Documents Uploaded", "score": 25, "max": 25, "status": "healthy", "detail": f"{count} document(s) uploaded"}
    return {"label": "Documents Uploaded", "score": 0, "max": 25, "status": "missing", "detail": "No documents uploaded"}


def _approval_score(contract_id):
    last = ContractApproval.query.filter_by(contract_id=contract_id).order_by(ContractApproval.id.desc()).first()
    if last is None:
        return {"label": "Approval Status", "score": 25, "max": 25, "status": "healthy", "detail": "No approval required"}
    if last.status == "Approved":
        return {"label": "Approval Status", "score": 25, "max": 25, "status": "healthy", "detail": "Approved"}
    if last.status == "Pending":
        return {"label": "Approval Status", "score": 10, "max": 25, "status": "warning", "detail": "Pending approval"}
    return {"label": "Approval Status", "score": 0, "max": 25, "status": "critical", "detail": f"Rejected: {last.comments or 'No comments'}"}


def _renewal_score(contract, today):
    if not contract.renewal_date:
        return {"label": "Renewal Status", "score": 15, "max": 15, "status": "healthy", "detail": "No renewal date set"}
    days = (contract.renewal_date - today).days
    if days > 30:
        return {"label": "Renewal Status", "score": 15, "max": 15, "status": "healthy", "detail": f"Renewal in {days} days"}
    if days > 0:
        return {"label": "Renewal Status", "score": 8, "max": 15, "status": "warning", "detail": f"Renewal in {days} days"}
    return {"label": "Renewal Status", "score": 0, "max": 15, "status": "critical", "detail": "Renewal date passed"}


def _invoice_score(contract_id, today):
    overdue = Invoice.query.filter(
        Invoice.contract_id == contract_id,
        Invoice.due_date.isnot(None),
        Invoice.due_date < today,
        Invoice.status != "PAID",
        Invoice.status != "CANCELLED",
    ).count()
    total = Invoice.query.filter_by(contract_id=contract_id).count()
    if total == 0:
        return {"label": "Invoice Status", "score": 10, "max": 10, "status": "healthy", "detail": "No invoices"}
    if overdue == 0:
        return {"label": "Invoice Status", "score": 10, "max": 10, "status": "healthy", "detail": "All invoices paid/current"}
    return {"label": "Invoice Status", "score": 3, "max": 10, "status": "critical", "detail": f"{overdue} overdue invoice(s)"}


def _compute_health_score(contract, today):
    factors = [
        _expiry_score(contract, today),
        _documents_score(contract.id),
        _approval_score(contract.id),
        _renewal_score(contract, today),
        _invoice_score(contract.id, today),
    ]
    total = sum(f["score"] for f in factors)
    max_total = sum(f["max"] for f in factors)
    pct = round((total / max_total) * 100) if max_total > 0 else 0

    if pct >= 81:
        level = "excellent"
    elif pct >= 61:
        level = "good"
    elif pct >= 41:
        level = "fair"
    elif pct >= 21:
        level = "poor"
    else:
        level = "critical"

    return {"score": pct, "level": level, "factors": factors}


# ── Readiness Checklist ────────────────────────────────────────────────

def _readiness_checks(contract):
    checks = [
        {
            "label": "Customer Assigned",
            "field": "customer_id",
            "passed": contract.customer_id is not None,
            "detail": f"Customer ID: {contract.customer_id}" if contract.customer_id else "No customer assigned",
        },
        {
            "label": "Contact Person",
            "field": "contact_person_id",
            "passed": contract.contact_person_id is not None,
            "detail": f"Contact ID: {contract.contact_person_id}" if contract.contact_person_id else "No contact person",
        },
        {
            "label": "Products / Line Items",
            "field": "has_line_items",
            "passed": ContractLineItem.query.filter_by(contract_id=contract.id).count() > 0,
            "detail": "Line items added" if ContractLineItem.query.filter_by(contract_id=contract.id).count() > 0 else "No products added",
        },
        {
            "label": "Dates Complete",
            "field": "dates",
            "passed": all([contract.start_date, contract.end_date, contract.renewal_date]),
            "detail": (
                "All dates set" if all([contract.start_date, contract.end_date, contract.renewal_date])
                else "Missing start, end, or renewal date"
            ),
        },
        {
            "label": "Notification Email",
            "field": "notification_email",
            "passed": bool(contract.notification_email) and contract.notification_enabled,
            "detail": contract.notification_email if contract.notification_email and contract.notification_enabled else "No notification email configured",
        },
        {
            "label": "Required Documents",
            "field": "has_documents",
            "passed": ContractDocument.query.filter_by(contract_id=contract.id).count() > 0,
            "detail": "Documents uploaded" if ContractDocument.query.filter_by(contract_id=contract.id).count() > 0 else "No documents uploaded",
        },
    ]
    passed = sum(1 for c in checks if c["passed"])
    total = len(checks)
    return {"checks": checks, "passed": passed, "total": total, "ready": passed == total}


# ── Risk Indicators ────────────────────────────────────────────────────

def _compute_risks(contract, today):
    risks = []
    days = contract.days_until_end(today)
    if days is not None and days <= 30:
        if days <= 0:
            risks.append({"type": "expired", "severity": "critical", "message": "Contract has expired", "days": days})
        elif days <= 7:
            risks.append({"type": "expiring_soon", "severity": "high", "message": f"Contract expires in {days} day(s)", "days": days})
        else:
            risks.append({"type": "expiring_soon", "severity": "medium", "message": f"Contract expires in {days} day(s)", "days": days})

    doc_count = ContractDocument.query.filter_by(contract_id=contract.id).count()
    if doc_count == 0:
        risks.append({"type": "missing_documents", "severity": "medium", "message": "No documents uploaded"})

    last_approval = ContractApproval.query.filter_by(contract_id=contract.id).order_by(ContractApproval.id.desc()).first()
    if last_approval and last_approval.status == "Pending":
        risks.append({"type": "pending_approval", "severity": "low", "message": "Contract pending approval"})
    if last_approval and last_approval.status == "Rejected":
        risks.append({"type": "approval_rejected", "severity": "high", "message": "Contract approval was rejected"})

    if contract.renewal_date:
        rd = (contract.renewal_date - today).days
        if rd < 0:
            risks.append({"type": "renewal_overdue", "severity": "high", "message": f"Renewal was due {abs(rd)} day(s) ago"})
        elif rd <= 30:
            risks.append({"type": "renewal_approaching", "severity": "low", "message": f"Renewal due in {rd} day(s)"})

    overdue_count = Invoice.query.filter(
        Invoice.contract_id == contract.id,
        Invoice.due_date.isnot(None),
        Invoice.due_date < today,
        Invoice.status != "PAID",
        Invoice.status != "CANCELLED",
    ).count()
    if overdue_count > 0:
        risks.append({"type": "overdue_invoices", "severity": "high", "message": f"{overdue_count} overdue invoice(s)"})

    if contract.customer_id is None:
        risks.append({"type": "missing_customer", "severity": "medium", "message": "No customer assigned"})

    ci_count = ContractLineItem.query.filter_by(contract_id=contract.id).count()
    if ci_count == 0:
        risks.append({"type": "no_line_items", "severity": "medium", "message": "No products/services added"})

    return risks


# ── Version Comparison ─────────────────────────────────────────────────

def _get_previous_contract(contract):
    if contract.previous_contract_id:
        return Contract.query.get(contract.previous_contract_id)
    if contract.parent_contract_id and contract.contract_version > 1:
        siblings = Contract.query.filter(
            Contract.parent_contract_id == contract.parent_contract_id,
            Contract.contract_version == contract.contract_version - 1,
        ).first()
        return siblings
    return None


def _compare_line_items(prev_items, curr_items):
    prev_map = {i.product_name: i for i in prev_items}
    curr_map = {i.product_name: i for i in curr_items}
    added = [i.to_dict() for i in curr_items if i.product_name not in prev_map]
    removed = [i.to_dict() for i in prev_items if i.product_name not in curr_map]
    changed = []
    for name, cur in curr_map.items():
        prv = prev_map.get(name)
        if prv and (float(cur.rate or 0) != float(prv.rate or 0) or
                     float(cur.quantity or 0) != float(prv.quantity or 0) or
                     float(cur.discount or 0) != float(prv.discount or 0) or
                     float(cur.tax or 0) != float(prv.tax or 0)):
            changed.append({
                "product_name": name,
                "previous": prv.to_dict(),
                "current": cur.to_dict(),
            })
    return {"added": added, "removed": removed, "changed": changed}


def _compare_dates(prev, curr):
    changes = []
    for field in ["start_date", "end_date", "renewal_date"]:
        pv = getattr(prev, field)
        cv = getattr(curr, field)
        if pv != cv:
            changes.append({
                "field": field.replace("_", " ").title(),
                "previous": pv.isoformat() if pv else None,
                "current": cv.isoformat() if cv else None,
            })
    return changes


def _compute_version_comparison(contract):
    prev = _get_previous_contract(contract)
    if prev is None:
        return None

    prev_items = ContractLineItem.query.filter_by(contract_id=prev.id).all() or []
    curr_items = ContractLineItem.query.filter_by(contract_id=contract.id).all() or []

    line_items = _compare_line_items(prev_items, curr_items)
    dates = _compare_dates(prev, contract)
    prices = []
    if float(prev.total_contract_value or 0) != float(contract.total_contract_value or 0):
        prices.append({
            "field": "Total Contract Value",
            "previous": float(prev.total_contract_value or 0),
            "current": float(contract.total_contract_value or 0),
        })
    payment_terms = []
    if (prev.payment_terms or "") != (contract.payment_terms or ""):
        payment_terms.append({
            "field": "Payment Terms",
            "previous": prev.payment_terms,
            "current": contract.payment_terms,
        })

    return {
        "current_version": contract.contract_version,
        "previous_version": prev.contract_version,
        "line_items": line_items if (line_items["added"] or line_items["removed"] or line_items["changed"]) else None,
        "dates": dates if dates else None,
        "prices": prices if prices else None,
        "payment_terms": payment_terms if payment_terms else None,
    }


# ── Endpoint ───────────────────────────────────────────────────────────

@assistance_bp.route("/contracts/<int:contract_id>/assistance", methods=["GET"])
@token_required
def contract_assistance(current_user, contract_id):
    contract = _contract_or_404(contract_id, current_user.id)
    if not contract:
        return jsonify({"error": "Contract not found"}), 404

    today = date.today()

    health_score = _compute_health_score(contract, today)
    readiness = _readiness_checks(contract)
    risks = _compute_risks(contract, today)
    version_comparison = _compute_version_comparison(contract)

    return jsonify({
        "contract_id": contract.id,
        "contract_name": contract.contract_name,
        "health_score": health_score,
        "readiness": readiness,
        "risks": risks,
        "version_comparison": version_comparison,
    }), 200
