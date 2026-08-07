import os
from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from src.models.contract import (
    ActivityLog,
    Contract,
    ContractApproval,
    ContractDocument,
    ContractLineItem,
    Customer,
    Invoice,
    Notification,
    Product,
    PurchaseOrder,
    db,
)
from src.routes.contracts.crud import (
    apply_contract_status_filter,
    contract_to_dict,
)
from src.routes.contracts.notifications import notification_stats_for_contracts
from src.services.auth import require_resource, token_required

contract_dashboard_bp = Blueprint("contract_dashboard", __name__)


@contract_dashboard_bp.route("/contracts/dashboard", methods=["GET"])
@token_required
@require_resource("contracts")
def get_dashboard_data(current_user):
    """Get dashboard data including upcoming end dates and statistics."""
    try:
        user_id = request.args.get("user_id", type=int)

        if user_id and user_id != current_user.id:
            return jsonify({"error": "Forbidden"}), 403

        today = date.today()
        base_query = Contract.query.filter_by(user_id=current_user.id)

        active_contracts = (
            apply_contract_status_filter(base_query, "active", today)
            .order_by(Contract.end_date.asc())
            .all()
        )

        ending_soon_contracts = (
            apply_contract_status_filter(base_query, "ending-soon", today)
            .order_by(Contract.end_date.asc())
            .all()
        )

        critical_contracts = (
            apply_contract_status_filter(base_query, "critical", today)
            .order_by(Contract.end_date.asc())
            .all()
        )

        expired_contracts = (
            apply_contract_status_filter(base_query, "expired", today)
            .order_by(Contract.end_date.desc())
            .all()
        )

        total_contracts = base_query.count()
        all_grouped_contracts = list(
            {contract.id: contract for contract in (
                active_contracts
                + ending_soon_contracts
                + critical_contracts
                + expired_contracts
            )}.values()
        )
        stats = notification_stats_for_contracts(
            [contract.id for contract in all_grouped_contracts]
        )
        total_reminders_sent = sum(
            contract_stats["total_reminders_sent"]
            for contract_stats in stats.values()
        )

        pending_approvals = ContractApproval.query.filter(
            ContractApproval.status == "pending",
            Contract.user_id == current_user.id,
        ).join(Contract, Contract.id == ContractApproval.contract_id).count()

        approved_today = ContractApproval.query.filter(
            ContractApproval.status == "Approved",
            ContractApproval.approved_at >= datetime.combine(today, datetime.min.time()),
            Contract.user_id == current_user.id,
        ).join(Contract, Contract.id == ContractApproval.contract_id).count()

        rejected_today = ContractApproval.query.filter(
            ContractApproval.status == "Rejected",
            ContractApproval.rejected_at >= datetime.combine(today, datetime.min.time()),
            Contract.user_id == current_user.id,
        ).join(Contract, Contract.id == ContractApproval.contract_id).count()

        avg_approval_time_row = db.session.query(
            db.func.avg(
                db.func.extract('epoch', ContractApproval.approved_at) -
                db.func.extract('epoch', ContractApproval.submitted_at)
            )
        ).join(
            Contract, Contract.id == ContractApproval.contract_id
        ).filter(
            Contract.user_id == current_user.id,
            ContractApproval.status == "Approved",
            ContractApproval.approved_at.isnot(None),
            ContractApproval.submitted_at.isnot(None),
        ).scalar()
        avg_approval_time_hours = round(float(avg_approval_time_row or 0) / 3600, 1)

        renewals_due = base_query.filter(
            Contract.renewal_date.isnot(None),
            Contract.renewal_date <= today + timedelta(days=30),
            Contract.renewal_date >= today,
        ).count()

        outstanding_invoice_amount = db.session.query(
            db.func.coalesce(db.func.sum(Invoice.amount), 0)
        ).filter(
            Invoice.user_id == current_user.id,
            Invoice.status.in_(["ISSUED", "DRAFT"]),
        ).scalar()

        overdue_invoices = Invoice.query.filter(
            Invoice.user_id == current_user.id,
            Invoice.status.in_(["ISSUED", "DRAFT"]),
            Invoice.due_date.isnot(None),
            Invoice.due_date < today,
        ).count()

        return (
            jsonify(
                {
                    "active_contracts": [
                        contract_to_dict(contract, stats)
                        for contract in active_contracts
                    ],
                    "ending_soon_contracts": [
                        contract_to_dict(contract, stats)
                        for contract in ending_soon_contracts
                    ],
                    "critical_contracts": [
                        contract_to_dict(contract, stats)
                        for contract in critical_contracts
                    ],
                    "expired_contracts": [
                        contract_to_dict(contract, stats)
                        for contract in expired_contracts
                    ],
                    "upcoming_renewals": [
                        contract_to_dict(contract, stats)
                        for contract in ending_soon_contracts
                    ],
                    "upcoming_expiries": [
                        contract_to_dict(contract, stats)
                        for contract in ending_soon_contracts
                    ],
                    "overdue_contracts": [
                        contract_to_dict(contract, stats)
                        for contract in expired_contracts
                    ],
                    "total_contracts": total_contracts,
                    "active_count": len(active_contracts),
                    "ending_soon_count": len(ending_soon_contracts),
                    "critical_count": len(critical_contracts),
                    "expired_count": len(expired_contracts),
                    "total_reminders_sent": total_reminders_sent,
                    "upcoming_count": len(ending_soon_contracts),
                    "overdue_count": len(expired_contracts),
                    "pending_approvals": pending_approvals,
                    "approved_today": approved_today,
                    "rejected_today": rejected_today,
                    "avg_approval_time_hours": avg_approval_time_hours,
                    "renewals_due": renewals_due,
                    "outstanding_invoice_amount": float(outstanding_invoice_amount),
                    "overdue_invoices": overdue_invoices,
                }
            ),
            200,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@contract_dashboard_bp.route("/dashboard/data", methods=["GET"])
@token_required
@require_resource("contracts")
def get_dashboard_full_data(current_user):
    try:
        uid = current_user.id
        today = date.today()

        total_contracts = Contract.query.filter_by(user_id=uid).count()
        active_contracts = Contract.query.filter_by(user_id=uid, status="Active").count()
        expiring_month = Contract.query.filter(
            Contract.user_id == uid,
            Contract.end_date.isnot(None),
            Contract.end_date >= today,
            Contract.end_date <= today + timedelta(days=30),
        ).count()
        draft_contracts = Contract.query.filter_by(user_id=uid, status="Draft").count()
        expired_contracts = Contract.query.filter_by(user_id=uid, status="Expired").count()

        pending_approvals = ContractApproval.query.join(Contract).filter(
            Contract.user_id == uid, ContractApproval.status == "Pending"
        ).count()

        renewals_due = Contract.query.filter(
            Contract.user_id == uid,
            Contract.renewal_date.isnot(None),
            Contract.renewal_date >= today,
            Contract.renewal_date <= today + timedelta(days=30),
        ).count()

        total_invoices = Invoice.query.filter_by(user_id=uid).count()
        invoices_due = Invoice.query.filter(
            Invoice.user_id == uid,
            Invoice.due_date.isnot(None),
            Invoice.due_date >= today,
            Invoice.due_date <= today + timedelta(days=7),
            Invoice.status.in_(["ISSUED", "DRAFT"]),
        ).count()
        overdue_invoices_count = Invoice.query.filter(
            Invoice.user_id == uid,
            Invoice.due_date.isnot(None),
            Invoice.due_date < today,
            Invoice.status.in_(["ISSUED", "DRAFT"]),
        ).count()
        outstanding_revenue = db.session.query(
            db.func.coalesce(db.func.sum(Invoice.amount), 0)
        ).filter(
            Invoice.user_id == uid,
            Invoice.status.in_(["ISSUED", "DRAFT"]),
        ).scalar()

        total_pos = PurchaseOrder.query.filter_by(user_id=uid).count()
        po_pending = PurchaseOrder.query.filter_by(user_id=uid, status="Pending").count()
        po_completed = PurchaseOrder.query.filter_by(user_id=uid, status="Completed").count()
        po_cancelled = PurchaseOrder.query.filter_by(user_id=uid, status="Cancelled").count()

        total_docs = ContractDocument.query.filter(
            ContractDocument.contract_id.isnot(None) |
            ContractDocument.invoice_id.isnot(None) |
            ContractDocument.po_id.isnot(None)
        ).count()

        total_customers = Customer.query.filter_by(user_id=uid).count()
        total_products = Product.query.filter_by(user_id=uid).count()

        total_notifications = Notification.query.join(Contract).filter(
            Contract.user_id == uid
        ).count()
        unread_notifications = Notification.query.join(Contract).filter(
            Contract.user_id == uid, Notification.status == "pending"
        ).count()

        recent_contracts = Contract.query.filter_by(user_id=uid).order_by(
            Contract.created_at.desc()
        ).limit(8).all()

        invoices_due_today = Invoice.query.filter(
            Invoice.user_id == uid,
            Invoice.due_date == today,
            Invoice.status.in_(["ISSUED", "DRAFT"]),
        ).count()

        contracts_expiring_today = Contract.query.filter(
            Contract.user_id == uid,
            Contract.end_date == today,
        ).count()

        top_customers = (
            db.session.query(
                Customer.id, Customer.name,
                func.count(Contract.id).label("contract_count"),
                func.coalesce(func.sum(Contract.total_contract_value), 0).label("total_value"),
            )
            .select_from(Customer)
            .outerjoin(Contract, Contract.customer_id == Customer.id)
            .filter(Customer.user_id == uid)
            .group_by(Customer.id, Customer.name)
            .order_by(func.coalesce(func.sum(Contract.total_contract_value), 0).desc())
            .limit(5)
            .all()
        )

        top_products = (
            db.session.query(
                Product.id, Product.name, Product.category,
                func.count(ContractLineItem.id).label("usage_count"),
                func.coalesce(func.sum(ContractLineItem.line_total), 0).label("total_revenue"),
            )
            .select_from(Product)
            .outerjoin(ContractLineItem, ContractLineItem.product_id == Product.id)
            .filter(Product.user_id == uid)
            .group_by(Product.id, Product.name, Product.category)
            .order_by(func.count(ContractLineItem.id).desc())
            .limit(5)
            .all()
        )

        recent_activity = ActivityLog.query.filter_by(user_id=uid).order_by(
            ActivityLog.created_at.desc()
        ).limit(10).all()

        recent_documents = ContractDocument.query.join(
            Contract, Contract.id == ContractDocument.contract_id
        ).filter(
            Contract.user_id == uid
        ).order_by(
            ContractDocument.uploaded_at.desc()
        ).limit(8).all()

        status_rows = (
            db.session.query(Contract.status, func.count(Contract.id))
            .filter(Contract.user_id == uid)
            .group_by(Contract.status)
            .all()
        )
        contracts_by_status = {s: c for s, c in status_rows}

        all_contracts = Contract.query.filter_by(user_id=uid).order_by(Contract.start_date).all()
        months: dict[str, int] = {}
        for c in all_contracts:
            if c.start_date:
                mk = f"{c.start_date.year}-{c.start_date.month:02d}"
                months[mk] = months.get(mk, 0) + 1
        contracts_per_month = [{"month": k, "count": v} for k, v in sorted(months.items())]

        items = ContractLineItem.query.join(Contract).filter(Contract.user_id == uid).all()
        rev_months: dict[str, float] = {}
        for it in items:
            if it.contract and it.contract.start_date:
                mk = f"{it.contract.start_date.year}-{it.contract.start_date.month:02d}"
                rev_months[mk] = rev_months.get(mk, 0) + float(it.line_total or 0)
        revenue_trend = [{"month": k, "revenue": round(v, 2)} for k, v in sorted(rev_months.items())]

        inv_status_rows = (
            db.session.query(Invoice.status, func.count(Invoice.id))
            .filter(Invoice.user_id == uid)
            .group_by(Invoice.status)
            .all()
        )
        invoice_status = [{"status": s, "count": c} for s, c in inv_status_rows]

        renewal_contracts = Contract.query.filter_by(user_id=uid).order_by(Contract.renewal_date).all()
        ren_months: dict[str, int] = {}
        for c in renewal_contracts:
            if c.renewal_date:
                mk = f"{c.renewal_date.year}-{c.renewal_date.month:02d}"
                ren_months[mk] = ren_months.get(mk, 0) + 1
        renewal_trend = [{"month": k, "count": v} for k, v in sorted(ren_months.items())]

        po_all = PurchaseOrder.query.filter_by(user_id=uid).order_by(PurchaseOrder.po_date).all()
        po_months: dict[str, int] = {}
        for p in po_all:
            if p.po_date:
                mk = f"{p.po_date.year}-{p.po_date.month:02d}"
                po_months[mk] = po_months.get(mk, 0) + 1
        po_trend = [{"month": k, "count": v} for k, v in sorted(po_months.items())]

        apps = ContractApproval.query.join(Contract).filter(Contract.user_id == uid).order_by(
            ContractApproval.submitted_at
        ).all()
        app_months: dict[str, dict] = {}
        for a in apps:
            if a.submitted_at:
                mk = f"{a.submitted_at.year}-{a.submitted_at.month:02d}"
                if mk not in app_months:
                    app_months[mk] = {"month": mk, "approved": 0, "rejected": 0, "pending": 0, "cancelled": 0}
                s = a.status.lower()
                if s in app_months[mk]:
                    app_months[mk][s] += 1
        approval_trend = sorted(app_months.values(), key=lambda x: x["month"])

        contracts_no_doc = Contract.query.filter(
            Contract.user_id == uid,
            ~Contract.id.in_(
                db.session.query(ContractDocument.contract_id).filter(
                    ContractDocument.contract_id.isnot(None)
                )
            )
        ).count()

        tasks = {
            "contracts_expiring_today": contracts_expiring_today,
            "invoices_due_today": invoices_due_today,
            "pending_approvals": pending_approvals,
            "missing_documents": contracts_no_doc,
            "renewals_due_today": Contract.query.filter(
                Contract.user_id == uid,
                Contract.renewal_date == today,
            ).count(),
        }

        calendar_events = []
        upcoming_range_end = today + timedelta(days=30)

        renewal_events = Contract.query.filter(
            Contract.user_id == uid,
            Contract.renewal_date.isnot(None),
            Contract.renewal_date >= today,
            Contract.renewal_date <= upcoming_range_end,
        ).all()
        for c in renewal_events:
            calendar_events.append({
                "id": c.id, "type": "renewal", "title": c.contract_name,
                "date": c.renewal_date.isoformat() if c.renewal_date else "",
            })

        expiry_events = Contract.query.filter(
            Contract.user_id == uid,
            Contract.end_date.isnot(None),
            Contract.end_date >= today,
            Contract.end_date <= upcoming_range_end,
        ).all()
        for c in expiry_events:
            calendar_events.append({
                "id": c.id, "type": "expiry", "title": c.contract_name,
                "date": c.end_date.isoformat() if c.end_date else "",
            })

        db_ok = True
        try:
            db.session.execute(db.text("SELECT 1"))
        except Exception:
            db_ok = False
        scheduler_enabled = os.environ.get("RUN_SCHEDULER", "false").lower() == "true"

        return jsonify({
            "summary": {
                "total_contracts": total_contracts,
                "active_contracts": active_contracts,
                "draft_contracts": draft_contracts,
                "expired_contracts": expired_contracts,
                "expiring_this_month": expiring_month,
                "pending_approvals": pending_approvals,
                "renewals_due": renewals_due,
                "total_invoices": total_invoices,
                "invoices_due": invoices_due,
                "overdue_invoices": overdue_invoices_count,
                "outstanding_revenue": float(outstanding_revenue),
                "total_purchase_orders": total_pos,
                "po_pending": po_pending,
                "po_completed": po_completed,
                "po_cancelled": po_cancelled,
                "total_documents": total_docs,
                "total_customers": total_customers,
                "total_products": total_products,
                "total_notifications": total_notifications,
                "unread_notifications": unread_notifications,
            },
            "tasks": tasks,
            "calendar_events": calendar_events,
            "recent_contracts": [c.to_dict() for c in recent_contracts],
            "recent_activity": [{
                "id": a.id, "activity_type": a.activity_type, "title": a.title,
                "description": a.description, "entity_type": a.entity_type,
                "entity_id": a.entity_id, "created_at": a.created_at.isoformat() if a.created_at else None,
            } for a in recent_activity],
            "recent_documents": [d.to_dict() for d in recent_documents],
            "contracts_by_status": contracts_by_status,
            "charts": {
                "contracts_per_month": contracts_per_month,
                "revenue_trend": revenue_trend,
                "invoice_status": invoice_status,
                "renewal_trend": renewal_trend,
                "contract_types": [],
                "top_customers": [{
                    "id": r.id, "name": r.name,
                    "contract_count": r.contract_count,
                    "total_value": round(float(r.total_value), 2),
                } for r in top_customers],
                "po_trend": po_trend,
                "approval_trend": approval_trend,
            },
            "top_customers": [{
                "id": r.id, "name": r.name,
                "contract_count": r.contract_count,
                "total_value": round(float(r.total_value), 2),
            } for r in top_customers],
            "top_products": [{
                "id": r.id, "name": r.name, "category": r.category,
                "usage_count": r.usage_count,
                "total_revenue": round(float(r.total_revenue), 2),
            } for r in top_products],
            "health": {
                "database": db_ok,
                "scheduler": scheduler_enabled,
                "timestamp": datetime.utcnow().isoformat(),
            },
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
