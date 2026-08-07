import csv
import io
from datetime import date, datetime
from decimal import Decimal

from flask import Blueprint, Response, jsonify, request
from sqlalchemy import func, case

from src.models.contract import (
    ActivityLog, Contract, ContractApproval, ContractDocument,
    ContractLineItem, ContractRenewal, ContractType, Customer,
    Invoice, PurchaseOrder, PurchaseOrderContract, Product, db,
)
from src.models.user import User
from src.services.auth import token_required, require_resource
from src.services.logging_config import get_structured_logger

reports_bp = Blueprint("reports", __name__)
logger = get_structured_logger(__name__)


# ── Helpers ────────────────────────────────────────────────────────────

def _user_filter(query, user_id):
    """Scope queries to the current user."""
    return query.filter_by(user_id=user_id)


def _parse_date_filter(args):
    start = args.get("start_date")
    end = args.get("end_date")
    sd = date.fromisoformat(start) if start else None
    ed = date.fromisoformat(end) if end else None
    return sd, ed


def _filter_kwargs(args):
    kwargs = {}
    if args.get("customer_id"):
        kwargs["customer_id"] = int(args["customer_id"])
    if args.get("status"):
        kwargs["status"] = args["status"]
    if args.get("contract_type_id"):
        kwargs["contract_type_id"] = int(args["contract_type_id"])
    return kwargs


def _apply_date_range(query, model_col, start, end):
    if start:
        query = query.filter(model_col >= start)
    if end:
        query = query.filter(model_col <= end)
    return query


def _month_key(d):
    return f"{d.year}-{d.month:02d}"


def _generate_csv(headers, rows):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    return output.getvalue()


def _generate_csv_response(csv_content, filename):
    return Response(
        csv_content,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Aggregation helpers ────────────────────────────────────────────────

def _contracts_per_month(user_id, start=None, end=None):
    q = Contract.query.filter_by(user_id=user_id)
    q = _apply_date_range(q, Contract.start_date, start, end)
    contracts = q.all()
    months: dict[str, int] = {}
    for c in contracts:
        if c.start_date:
            mk = _month_key(c.start_date)
            months[mk] = months.get(mk, 0) + 1
    return [{"month": k, "count": v} for k, v in sorted(months.items())]


def _revenue_trend(user_id, start=None, end=None):
    q = ContractLineItem.query.join(Contract).filter(Contract.user_id == user_id)
    q = _apply_date_range(q, Contract.start_date, start, end)
    items = q.all()
    months: dict[str, float] = {}
    for item in items:
        if item.contract and item.contract.start_date:
            mk = _month_key(item.contract.start_date)
            months[mk] = months.get(mk, 0) + float(item.line_total or 0)
    return [{"month": k, "revenue": round(v, 2)} for k, v in sorted(months.items())]


def _invoice_status_distribution(user_id, start=None, end=None):
    q = Invoice.query.filter_by(user_id=user_id)
    q = _apply_date_range(q, Invoice.invoice_date, start, end)
    invoices = q.all()
    counts: dict[str, int] = {"DRAFT": 0, "SENT": 0, "PAID": 0, "OVERDUE": 0, "CANCELLED": 0}
    for inv in invoices:
        s = inv.effective_status()
        counts[s] = counts.get(s, 0) + 1
    return [{"status": k, "count": v} for k, v in counts.items() if v > 0]


def _renewal_trend(user_id, start=None, end=None):
    q = Contract.query.filter_by(user_id=user_id)
    q = _apply_date_range(q, Contract.end_date, start, end)
    contracts = q.all()
    months: dict[str, int] = {}
    for c in contracts:
        if c.end_date:
            mk = _month_key(c.end_date)
            months[mk] = months.get(mk, 0) + 1
    return [{"month": k, "count": v} for k, v in sorted(months.items())]


def _contract_type_distribution(user_id):
    types = ContractType.query.all()
    type_map = {t.id: t.name for t in types}
    rows = (
        db.session.query(Contract.contract_type_id, func.count(Contract.id))
        .filter(Contract.user_id == user_id, Contract.contract_type_id.isnot(None))
        .group_by(Contract.contract_type_id)
        .all()
    )
    return [{"name": type_map.get(tid, "Unknown"), "count": c} for tid, c in rows]


def _top_customers(user_id, start=None, end=None, limit=10):
    q = (
        db.session.query(
            Customer.id, Customer.name,
            func.count(Contract.id).label("contract_count"),
            func.coalesce(func.sum(Contract.total_contract_value), 0).label("total_value"),
        )
        .select_from(Customer)
        .outerjoin(Contract, Contract.customer_id == Customer.id)
        .filter(Customer.user_id == user_id)
    )
    if start:
        q = q.filter(Contract.start_date >= start)
    if end:
        q = q.filter(Contract.start_date <= end)
    q = q.group_by(Customer.id, Customer.name).order_by(func.count(Contract.id).desc()).limit(limit)
    rows = q.all()
    return [
        {
            "id": r.id, "name": r.name,
            "contract_count": r.contract_count,
            "total_value": round(float(r.total_value), 2),
        }
        for r in rows
    ]


# ── 1. Contracts Report ────────────────────────────────────────────────

@reports_bp.route("/reports/contracts", methods=["GET"])
@token_required
@require_resource("reports")
def contracts_report(current_user):
    sd, ed = _parse_date_filter(request.args)
    kwargs = _filter_kwargs(request.args)
    q = Contract.query.filter_by(user_id=current_user.id)
    q = _apply_date_range(q, Contract.start_date, sd, ed)
    if kwargs.get("customer_id"):
        q = q.filter_by(customer_id=kwargs["customer_id"])
    if kwargs.get("status"):
        q = q.filter_by(status=kwargs["status"])
    if kwargs.get("contract_type_id"):
        q = q.filter_by(contract_type_id=kwargs["contract_type_id"])
    search = request.args.get("search", "").strip()
    if search:
        q = q.filter(
            Contract.contract_name.ilike(f"%{search}%") |
            Contract.company_name.ilike(f"%{search}%")
        )
    contracts = q.order_by(Contract.created_at.desc()).all()
    return jsonify([c.to_dict() for c in contracts]), 200


# ── 2. Invoices Report ─────────────────────────────────────────────────

@reports_bp.route("/reports/invoices", methods=["GET"])
@token_required
@require_resource("reports")
def invoices_report(current_user):
    sd, ed = _parse_date_filter(request.args)
    status_filter = request.args.get("status")
    q = Invoice.query.filter_by(user_id=current_user.id)
    q = _apply_date_range(q, Invoice.invoice_date, sd, ed)
    if status_filter:
        q = q.filter(Invoice.status == status_filter)
    search = request.args.get("search", "").strip()
    if search:
        q = q.filter(Invoice.invoice_number.ilike(f"%{search}%"))
    invoices = q.order_by(Invoice.invoice_date.desc()).all()
    return jsonify([inv.to_dict() for inv in invoices]), 200


# ── 3. Line Items Report ────────────────────────────────────────────────

@reports_bp.route("/reports/line-items", methods=["GET"])
@token_required
@require_resource("reports")
def line_items_report(current_user):
    items = (
        ContractLineItem.query.join(Contract)
        .filter(Contract.user_id == current_user.id)
        .all()
    )
    return jsonify([item.to_dict() for item in items]), 200


# ── 3. Purchase Orders Report ──────────────────────────────────────────

@reports_bp.route("/reports/purchase-orders", methods=["GET"])
@token_required
@require_resource("reports")
def purchase_orders_report(current_user):
    sd, ed = _parse_date_filter(request.args)
    status_filter = request.args.get("status")
    q = PurchaseOrder.query.filter_by(user_id=current_user.id)
    q = _apply_date_range(q, PurchaseOrder.po_date, sd, ed)
    if status_filter:
        q = q.filter_by(status=status_filter)
    search = request.args.get("search", "").strip()
    if search:
        q = q.filter(PurchaseOrder.vendor.ilike(f"%{search}%"))
    pos = q.order_by(PurchaseOrder.po_date.desc()).all()
    return jsonify([po.to_dict() for po in pos]), 200


# ── 4. Renewals Report ─────────────────────────────────────────────────

@reports_bp.route("/reports/renewals", methods=["GET"])
@token_required
@require_resource("reports")
def renewals_report(current_user):
    sd, ed = _parse_date_filter(request.args)
    q = Contract.query.filter_by(user_id=current_user.id, status="Active")
    q = _apply_date_range(q, Contract.renewal_date, sd, ed)
    search = request.args.get("search", "").strip()
    if search:
        q = q.filter(
            Contract.contract_name.ilike(f"%{search}%") |
            Contract.company_name.ilike(f"%{search}%")
        )
    contracts = q.order_by(Contract.renewal_date.asc()).all()
    return jsonify([c.to_dict() for c in contracts]), 200


# ── 5. Customers Report ────────────────────────────────────────────────

@reports_bp.route("/reports/customers", methods=["GET"])
@token_required
@require_resource("reports")
def customers_report(current_user):
    sd, ed = _parse_date_filter(request.args)
    q = Customer.query.filter_by(user_id=current_user.id)
    # Filter customers by contract date range if provided
    if sd or ed:
        cids = (
            db.session.query(Contract.customer_id)
            .filter(Contract.user_id == current_user.id)
        )
        cids = _apply_date_range(cids, Contract.start_date, sd, ed)
        cids = cids.distinct().subquery()
        q = q.filter(Customer.id.in_(db.session.query(cids.c.customer_id)))

    search = request.args.get("search", "").strip()
    if search:
        q = q.filter(Customer.name.ilike(f"%{search}%"))
    customers = q.order_by(Customer.name).all()
    result = []
    for c in customers:
        d = c.to_dict()
        contracts = Contract.query.filter_by(user_id=current_user.id, customer_id=c.id).all()
        d["contracts"] = [ct.to_dict() for ct in contracts]
        d["total_contract_value"] = round(
            sum(float(ct.total_contract_value or 0) for ct in contracts), 2
        )
        result.append(d)
    return jsonify(result), 200


# ── 6. Products Report ─────────────────────────────────────────────────

@reports_bp.route("/reports/products", methods=["GET"])
@token_required
@require_resource("reports")
def products_report(current_user):
    q = Product.query.filter_by(user_id=current_user.id)
    search = request.args.get("search", "").strip()
    if search:
        q = q.filter(Product.name.ilike(f"%{search}%"))
    status_filter = request.args.get("status")
    if status_filter:
        q = q.filter_by(status=status_filter)
    products = q.order_by(Product.name).all()
    result = []
    for p in products:
        d = p.to_dict()
        # Count how many contracts reference this product
        usage = (
            db.session.query(func.count(ContractLineItem.id))
            .filter(ContractLineItem.product_id == p.id)
            .scalar()
        )
        d["contract_count"] = usage
        result.append(d)
    return jsonify(result), 200


# ── 7. Revenue Report ──────────────────────────────────────────────────

@reports_bp.route("/reports/revenue", methods=["GET"])
@token_required
@require_resource("reports")
def revenue_report(current_user):
    sd, ed = _parse_date_filter(request.args)
    q = ContractLineItem.query.join(Contract).filter(Contract.user_id == current_user.id)
    q = _apply_date_range(q, Contract.start_date, sd, ed)
    items = q.all()
    total_revenue = sum(float(i.line_total or 0) for i in items)
    return jsonify({
        "total_revenue": round(total_revenue, 2),
        "total_line_items": len(items),
    }), 200


# ── 8. Approvals Report ─────────────────────────────────────────────────

@reports_bp.route("/reports/approvals", methods=["GET"])
@token_required
@require_resource("reports")
def approvals_report(current_user):
    sd, ed = _parse_date_filter(request.args)
    q = ContractApproval.query.join(Contract).filter(Contract.user_id == current_user.id)
    q = _apply_date_range(q, ContractApproval.submitted_at, sd, ed)
    status_filter = request.args.get("status")
    if status_filter:
        q = q.filter(ContractApproval.status.ilike(status_filter))
    approvals = q.order_by(ContractApproval.submitted_at.desc()).all()
    return jsonify([a.to_dict() for a in approvals]), 200


# ── 9. Document Stats ───────────────────────────────────────────────────

@reports_bp.route("/reports/documents-stats", methods=["GET"])
@token_required
@require_resource("reports")
def documents_stats(current_user):
    uid = current_user.id

    # Count all documents across contracts, invoices, POs owned by user
    total_docs = (
        db.session.query(func.count(ContractDocument.id))
        .join(Contract, ContractDocument.contract_id == Contract.id, isouter=True)
        .join(Invoice, ContractDocument.invoice_id == Invoice.id, isouter=True)
        .join(PurchaseOrder, ContractDocument.po_id == PurchaseOrder.id, isouter=True)
        .filter(
            db.or_(
                Contract.user_id == uid,
                Invoice.user_id == uid,
                PurchaseOrder.user_id == uid,
            )
        )
        .scalar()
    ) or 0

    total_storage = (
        db.session.query(func.coalesce(func.sum(ContractDocument.file_size), 0))
        .join(Contract, ContractDocument.contract_id == Contract.id, isouter=True)
        .join(Invoice, ContractDocument.invoice_id == Invoice.id, isouter=True)
        .join(PurchaseOrder, ContractDocument.po_id == PurchaseOrder.id, isouter=True)
        .filter(
            db.or_(
                Contract.user_id == uid,
                Invoice.user_id == uid,
                PurchaseOrder.user_id == uid,
            )
        )
        .scalar()
    ) or 0

    categories = (
        db.session.query(
            db.func.coalesce(ContractDocument.category, "Uncategorized").label("category"),
            func.count(ContractDocument.id).label("count"),
        )
        .join(Contract, ContractDocument.contract_id == Contract.id, isouter=True)
        .join(Invoice, ContractDocument.invoice_id == Invoice.id, isouter=True)
        .join(PurchaseOrder, ContractDocument.po_id == PurchaseOrder.id, isouter=True)
        .filter(
            db.or_(
                Contract.user_id == uid,
                Invoice.user_id == uid,
                PurchaseOrder.user_id == uid,
            )
        )
        .group_by("category")
        .order_by(func.count(ContractDocument.id).desc())
        .all()
    )

    # Latest 10 uploads
    latest_docs = (
        ContractDocument.query
        .join(Contract, ContractDocument.contract_id == Contract.id, isouter=True)
        .join(Invoice, ContractDocument.invoice_id == Invoice.id, isouter=True)
        .join(PurchaseOrder, ContractDocument.po_id == PurchaseOrder.id, isouter=True)
        .filter(
            db.or_(
                Contract.user_id == uid,
                Invoice.user_id == uid,
                PurchaseOrder.user_id == uid,
            )
        )
        .order_by(ContractDocument.uploaded_at.desc())
        .limit(10)
        .all()
    )

    return jsonify({
        "total_documents": total_docs,
        "total_storage_bytes": total_storage,
        "categories": [{"category": r.category, "count": r.count} for r in categories],
        "latest_uploads": [d.to_dict() for d in latest_docs],
    }), 200


# ── 10. Activity Stats ──────────────────────────────────────────────────

@reports_bp.route("/reports/activity-stats", methods=["GET"])
@token_required
@require_resource("reports")
def activity_stats(current_user):
    uid = current_user.id
    sd, ed = _parse_date_filter(request.args)

    # Breakdown by activity_type
    q = (
        db.session.query(ActivityLog.activity_type, func.count(ActivityLog.id))
        .filter(ActivityLog.user_id == uid)
    )
    q = _apply_date_range(q, ActivityLog.created_at, sd, ed)
    q = q.group_by(ActivityLog.activity_type).order_by(func.count(ActivityLog.id).desc())
    by_type = [{"type": t, "count": c} for t, c in q.all()]

    # Trend by month
    q2 = ActivityLog.query.filter_by(user_id=uid)
    q2 = _apply_date_range(q2, ActivityLog.created_at, sd, ed)
    months: dict[str, int] = {}
    for log in q2.all():
        if log.created_at:
            mk = _month_key(log.created_at)
            months[mk] = months.get(mk, 0) + 1
    trend = [{"month": k, "count": v} for k, v in sorted(months.items())]

    return jsonify({
        "by_type": by_type,
        "trend": trend,
    }), 200


# ── 11. Renewal Stats ───────────────────────────────────────────────────

@reports_bp.route("/reports/renewal-stats", methods=["GET"])
@token_required
@require_resource("reports")
def renewal_stats(current_user):
    uid = current_user.id

    total_renewed = ContractRenewal.query.join(
        Contract, ContractRenewal.original_contract_id == Contract.id
    ).filter(Contract.user_id == uid).count()

    active_contracts = Contract.query.filter_by(user_id=uid, status="Active").count()

    today = date.today()
    from datetime import timedelta
    upcoming = Contract.query.filter(
        Contract.user_id == uid,
        Contract.renewal_date.isnot(None),
        Contract.renewal_date >= today,
        Contract.renewal_date <= today + timedelta(days=30),
    ).count()

    missed = Contract.query.filter(
        Contract.user_id == uid,
        Contract.renewal_date.isnot(None),
        Contract.renewal_date < today,
        Contract.status.in_(["Active", "Expired"]),
    ).count()

    # Average approval time
    avg_time_row = db.session.query(
        db.func.avg(
            db.func.extract('epoch', ContractApproval.approved_at) -
            db.func.extract('epoch', ContractApproval.submitted_at)
        )
    ).join(Contract).filter(
        Contract.user_id == uid,
        ContractApproval.status == "Approved",
        ContractApproval.approved_at.isnot(None),
        ContractApproval.submitted_at.isnot(None),
    ).scalar()
    avg_approval_time_hours = round(float(avg_time_row or 0) / 3600, 1)

    return jsonify({
        "total_renewed": total_renewed,
        "upcoming_renewals": upcoming,
        "missed_renewals": missed,
        "active_contracts": active_contracts,
        "success_rate": round((total_renewed / (total_renewed + missed) * 100), 1) if (total_renewed + missed) > 0 else 0,
        "avg_approval_time_hours": avg_approval_time_hours,
    }), 200


# ── Chart Data (all in one call for performance) ────────────────────────

@reports_bp.route("/reports/charts", methods=["GET"])
@token_required
@require_resource("reports")
def charts_data(current_user):
    sd, ed = _parse_date_filter(request.args)
    return jsonify({
        "contracts_per_month": _contracts_per_month(current_user.id, sd, ed),
        "revenue_trend": _revenue_trend(current_user.id, sd, ed),
        "invoice_status": _invoice_status_distribution(current_user.id, sd, ed),
        "renewal_trend": _renewal_trend(current_user.id, sd, ed),
        "contract_types": _contract_type_distribution(current_user.id),
        "top_customers": _top_customers(current_user.id, sd, ed),
    }), 200


# ── Dashboard summary ──────────────────────────────────────────────────

@reports_bp.route("/reports/summary", methods=["GET"])
@token_required
@require_resource("reports")
def summary(current_user):
    uid = current_user.id
    total_contracts = Contract.query.filter_by(user_id=uid).count()
    active_contracts = Contract.query.filter_by(user_id=uid, status="Active").count()
    expiring_soon = Contract.query.filter(
        Contract.user_id == uid, Contract.end_date.isnot(None),
        Contract.end_date <= date.today(),
        Contract.end_date > date.today(),
    ).count()
    # Actually, expiring soon = end_date within 30 days
    from datetime import timedelta
    expiring_soon = Contract.query.filter(
        Contract.user_id == uid,
        Contract.end_date.isnot(None),
        Contract.end_date <= date.today() + timedelta(days=30),
        Contract.end_date >= date.today(),
    ).count()
    total_customers = Customer.query.filter_by(user_id=uid).count()
    total_invoices = Invoice.query.filter_by(user_id=uid).count()
    total_revenue_row = (
        db.session.query(func.sum(ContractLineItem.line_total))
        .join(Contract)
        .filter(Contract.user_id == uid)
        .scalar()
    )
    total_revenue = round(float(total_revenue_row or 0), 2)
    return jsonify({
        "total_contracts": total_contracts,
        "active_contracts": active_contracts,
        "expiring_soon": expiring_soon,
        "total_customers": total_customers,
        "total_invoices": total_invoices,
        "total_revenue": total_revenue,
    }), 200


# ── Statistics (for ReportsPage stats cards) ───────────────────────────

@reports_bp.route("/reports/statistics", methods=["GET"])
@token_required
@require_resource("reports")
def statistics(current_user):
    uid = current_user.id

    # Contracts by status
    status_rows = (
        db.session.query(Contract.status, func.count(Contract.id))
        .filter(Contract.user_id == uid)
        .group_by(Contract.status)
        .all()
    )
    contracts_by_status = {s: c for s, c in status_rows}

    # Overdue invoices
    from datetime import timedelta
    overdue_count = Invoice.query.filter(
        Invoice.user_id == uid,
        Invoice.due_date.isnot(None),
        Invoice.due_date < date.today(),
        Invoice.status != "PAID",
        Invoice.status != "CANCELLED",
    ).count()

    # Upcoming renewals (within 30 days)
    upcoming_renewals = Contract.query.filter(
        Contract.user_id == uid,
        Contract.renewal_date.isnot(None),
        Contract.renewal_date >= date.today(),
        Contract.renewal_date <= date.today() + timedelta(days=30),
    ).count()

    # Month-over-month revenue
    monthly_revenue = _revenue_trend(uid)
    current_month_revenue = monthly_revenue[-1]["revenue"] if monthly_revenue else 0
    prev_month_revenue = monthly_revenue[-2]["revenue"] if len(monthly_revenue) >= 2 else 0

    # Approval metrics
    pending_approvals = ContractApproval.query.join(Contract).filter(
        Contract.user_id == uid, ContractApproval.status == "Pending"
    ).count()
    approved_total = ContractApproval.query.join(Contract).filter(
        Contract.user_id == uid, ContractApproval.status == "Approved"
    ).count()
    rejected_total = ContractApproval.query.join(Contract).filter(
        Contract.user_id == uid, ContractApproval.status == "Rejected"
    ).count()
    cancelled_total = ContractApproval.query.join(Contract).filter(
        Contract.user_id == uid, ContractApproval.status == "Cancelled"
    ).count()
    avg_approval_time_row = db.session.query(
        db.func.avg(
            db.func.extract('epoch', ContractApproval.approved_at) -
            db.func.extract('epoch', ContractApproval.submitted_at)
        )
    ).join(Contract).filter(
        Contract.user_id == uid,
        ContractApproval.status == "Approved",
        ContractApproval.approved_at.isnot(None),
        ContractApproval.submitted_at.isnot(None),
    ).scalar()
    avg_approval_time_hours = round(float(avg_approval_time_row or 0) / 3600, 1)

    return jsonify({
        "contracts_by_status": contracts_by_status,
        "overdue_invoices": overdue_count,
        "upcoming_renewals": upcoming_renewals,
        "monthly_revenue": monthly_revenue,
        "current_month_revenue": current_month_revenue,
        "prev_month_revenue": prev_month_revenue,
        "approvals": {
            "pending": pending_approvals,
            "approved": approved_total,
            "rejected": rejected_total,
            "cancelled": cancelled_total,
            "avg_approval_time_hours": avg_approval_time_hours,
        },
    }), 200


# ── Export ──────────────────────────────────────────────────────────────

@reports_bp.route("/reports/export", methods=["GET"])
@token_required
@require_resource("reports")
def export_report(current_user):
    report_type = request.args.get("type", "contracts")
    fmt = request.args.get("format", "csv")
    sd, ed = _parse_date_filter(request.args)

    if fmt == "csv":
        return _export_csv(current_user.id, report_type, sd, ed)
    return jsonify({"error": f"Format '{fmt}' not supported"}), 400


def _export_csv(user_id, report_type, start, end):
    if report_type == "contracts":
        q = Contract.query.filter_by(user_id=user_id)
        q = _apply_date_range(q, Contract.start_date, start, end)
        rows = q.order_by(Contract.created_at.desc()).all()
        headers = ["ID", "Contract Name", "Company", "Status", "Start Date", "End Date",
                    "Renewal Date", "Value", "Currency", "Created At"]
        data = [[
            r.id, r.contract_name, r.company_name, r.status,
            r.start_date.isoformat() if r.start_date else "",
            r.end_date.isoformat() if r.end_date else "",
            r.renewal_date.isoformat() if r.renewal_date else "",
            float(r.total_contract_value or 0), r.currency,
            r.created_at.isoformat() if r.created_at else "",
        ] for r in rows]
        csv_content = _generate_csv(headers, data)
        return _generate_csv_response(csv_content, "contracts_report.csv")

    elif report_type == "invoices":
        q = Invoice.query.filter_by(user_id=user_id)
        q = _apply_date_range(q, Invoice.invoice_date, start, end)
        rows = q.order_by(Invoice.invoice_date.desc()).all()
        headers = ["ID", "Invoice Number", "Amount", "Invoice Date", "Due Date", "Status", "Created At"]
        data = [[
            r.id, r.invoice_number, float(r.amount or 0),
            r.invoice_date.isoformat() if r.invoice_date else "",
            r.due_date.isoformat() if r.due_date else "",
            r.effective_status(),
            r.created_at.isoformat() if r.created_at else "",
        ] for r in rows]
        csv_content = _generate_csv(headers, data)
        return _generate_csv_response(csv_content, "invoices_report.csv")

    elif report_type == "purchase_orders":
        q = PurchaseOrder.query.filter_by(user_id=user_id)
        q = _apply_date_range(q, PurchaseOrder.po_date, start, end)
        rows = q.order_by(PurchaseOrder.po_date.desc()).all()
        headers = ["ID", "PO Number", "Vendor", "PO Date", "Amount", "Status", "Created At"]
        data = [[
            r.id, r.po_number, r.vendor,
            r.po_date.isoformat() if r.po_date else "",
            float(r.amount or 0), r.status,
            r.created_at.isoformat() if r.created_at else "",
        ] for r in rows]
        csv_content = _generate_csv(headers, data)
        return _generate_csv_response(csv_content, "purchase_orders_report.csv")

    elif report_type == "renewals":
        from datetime import timedelta
        today = date.today()
        rows = Contract.query.filter(
            Contract.user_id == user_id,
            Contract.renewal_date.isnot(None),
            Contract.renewal_date >= today,
        ).order_by(Contract.renewal_date.asc()).all()
        headers = ["ID", "Contract Name", "Company", "Renewal Date", "Status", "Value"]
        data = [[
            r.id, r.contract_name, r.company_name,
            r.renewal_date.isoformat() if r.renewal_date else "",
            r.status, float(r.total_contract_value or 0),
        ] for r in rows]
        csv_content = _generate_csv(headers, data)
        return _generate_csv_response(csv_content, "renewals_report.csv")

    elif report_type == "customers":
        rows = Customer.query.filter_by(user_id=user_id).order_by(Customer.name).all()
        headers = ["ID", "Name", "Code", "Email", "Phone", "Address", "Created At"]
        data = [[
            r.id, r.name, r.customer_code or "", r.email or "",
            r.phone or "", r.address or "",
            r.created_at.isoformat() if r.created_at else "",
        ] for r in rows]
        csv_content = _generate_csv(headers, data)
        return _generate_csv_response(csv_content, "customers_report.csv")

    elif report_type == "products":
        rows = Product.query.filter_by(user_id=user_id).order_by(Product.name).all()
        headers = ["ID", "Name", "SKU", "Category", "Rate", "Status", "Created At"]
        data = [[
            r.id, r.name, r.sku, r.category or "", float(r.rate or 0),
            r.status, r.created_at.isoformat() if r.created_at else "",
        ] for r in rows]
        csv_content = _generate_csv(headers, data)
        return _generate_csv_response(csv_content, "products_report.csv")

    elif report_type == "approvals":
        rows = ContractApproval.query.join(Contract).filter(Contract.user_id == user_id).order_by(ContractApproval.submitted_at.desc()).all()
        headers = ["ID", "Contract ID", "Status", "Approver", "Comments", "Submitted At", "Approved At", "Rejected At", "Cancelled At"]
        data = [[
            r.id, r.contract_id, r.status, r.approver_id or "",
            r.comments or "",
            r.submitted_at.isoformat() if r.submitted_at else "",
            r.approved_at.isoformat() if r.approved_at else "",
            r.rejected_at.isoformat() if r.rejected_at else "",
            r.cancelled_at.isoformat() if r.cancelled_at else "",
        ] for r in rows]
        csv_content = _generate_csv(headers, data)
        return _generate_csv_response(csv_content, "approvals_report.csv")

    elif report_type == "revenue":
        items = ContractLineItem.query.join(Contract).filter(Contract.user_id == user_id).all()
        headers = ["ID", "Product", "Quantity", "Rate", "Discount", "Tax", "Line Total", "Contract ID"]
        data = [[
            r.id, r.product_name, float(r.quantity or 0), float(r.rate or 0),
            float(r.discount or 0), float(r.tax or 0), float(r.line_total or 0),
            r.contract_id,
        ] for r in items]
        csv_content = _generate_csv(headers, data)
        return _generate_csv_response(csv_content, "revenue_report.csv")

    elif report_type == "documents":
        docs = ContractDocument.query.filter_by().all()
        headers = ["ID", "File Name", "File Type", "Category", "Size", "Version", "Uploaded At", "Uploaded By"]
        data = [[
            d.id, d.file_name, d.file_type or "", d.category or "",
            d.file_size or 0, d.version or 1,
            d.uploaded_at.isoformat() if d.uploaded_at else "",
            d.uploader.name if d.uploader else "",
        ] for d in docs]
        csv_content = _generate_csv(headers, data)
        return _generate_csv_response(csv_content, "documents_report.csv")

    elif report_type == "activity":
        rows = ActivityLog.query.filter_by(user_id=user_id).order_by(ActivityLog.created_at.desc()).limit(500).all()
        headers = ["ID", "Type", "Title", "Description", "Entity Type", "Entity ID", "Created At"]
        data = [[
            r.id, r.activity_type, r.title, r.description or "",
            r.entity_type or "", r.entity_id or "",
            r.created_at.isoformat() if r.created_at else "",
        ] for r in rows]
        csv_content = _generate_csv(headers, data)
        return _generate_csv_response(csv_content, "activity_report.csv")

    return jsonify({"error": f"Unknown report type '{report_type}'"}), 400
