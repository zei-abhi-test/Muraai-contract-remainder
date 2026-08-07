import os
from datetime import datetime, date, timedelta
from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request
from pydantic import ValidationError
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError

from src.models.contract import (
    ActivityLog,
    ContactPerson,
    Contract,
    ContractApproval,
    ContractClause,
    ContractDocument,
    ContractLineItem,
    ContractRenewal,
    ContractType,
    ContractVersionHistory,
    Customer,
    Invoice,
    InvoiceLineItem,
    Notification,
    Product,
    PurchaseOrder,
    PurchaseOrderContract,
    db,
)
from src.routes.activity import log_activity
from src.services import contract_lifecycle
from src.services.auth import require_resource, token_required
from src.services.automation_engine import execute_triggers
from src.services.contract_totals import (
    create_contract_line_item,
    recalculate_contract_total,
)
from src.services.domain_event import dispatcher
from src.services.logging_config import get_structured_logger
from src.services.validators import ContractCreate, ContractUpdate

contract_crud_bp = Blueprint("contract_crud", __name__)
logger = get_structured_logger(__name__)


def handle_validation_error(error: ValidationError):
    """Convert Pydantic validation errors to JSON response."""
    errors = {}
    for err in error.errors():
        field = ".".join(str(x) for x in err["loc"])
        errors[field] = err["msg"]
    return jsonify({"error": "Validation error", "details": errors}), 400


def get_owned_contract(contract_id: int, user_id: int):
    """Return a contract only when it belongs to the authenticated user."""
    return Contract.query.filter_by(id=contract_id, user_id=user_id).first()


def contract_status_ranges(today=None):
    """Return date boundaries used to group contracts by end_date."""
    today = today or date.today()
    return today, today + timedelta(days=30)


def apply_contract_status_filter(query, status, today=None):
    """Apply active, ending-soon, or expired status filtering."""
    today, thirty_days_from_now = contract_status_ranges(today)
    if status == "active":
        return query.filter(Contract.end_date > thirty_days_from_now)
    if status == "ending-soon":
        return query.filter(
            Contract.end_date >= today,
            Contract.end_date <= thirty_days_from_now,
        )
    if status == "critical":
        return query.filter(
            Contract.end_date >= today,
            Contract.end_date <= today + timedelta(days=7),
        )
    if status == "expired":
        return query.filter(Contract.end_date < today)
    return query


def order_contracts_by_status(query, status):
    """Sort contracts by their status-specific end-date ordering."""
    if status == "expired":
        return query.order_by(Contract.end_date.desc())
    return query.order_by(Contract.end_date.asc())


def generate_contract_number(user_id):
    year = date.today().year
    prefix = f"MCR-{year}-{user_id:03d}-"
    max_seq = 0
    rows = db.session.query(Contract.contract_number).filter(
        Contract.user_id == user_id,
        Contract.contract_number.like(prefix + "%"),
    ).all()
    for (number,) in rows:
        try:
            max_seq = max(max_seq, int(number[len(prefix):]))
        except (TypeError, ValueError):
            continue
    return f"{prefix}{max_seq + 1:05d}"


def parse_optional_date(value):
    if not value:
        return None
    return datetime.strptime(value, "%Y-%m-%d").date()


def parse_decimal(value, fallback="0"):
    try:
        return Decimal(str(value if value is not None else fallback))
    except (InvalidOperation, ValueError):
        raise ValueError("Invalid numeric value")


def notification_stats_for_contracts(contract_ids):
    """Return reminder stats keyed by contract id using existing notifications."""
    stats = {
        contract_id: {
            "total_reminders_sent": 0,
            "last_reminder_sent_at": None,
            "last_reminder_type": None,
            "last_reminder_message": None,
        }
        for contract_id in contract_ids
    }
    if not contract_ids:
        return stats

    notifications = (
        Notification.query.filter(Notification.contract_id.in_(contract_ids))
        .order_by(Notification.contract_id.asc(), Notification.send_date.desc())
        .all()
    )
    for notification in notifications:
        contract_stats = stats[notification.contract_id]
        if notification.status == "sent":
            contract_stats["total_reminders_sent"] += 1
            if contract_stats["last_reminder_sent_at"] is None:
                contract_stats["last_reminder_sent_at"] = (
                    notification.send_date.isoformat()
                    if notification.send_date
                    else None
                )
                contract_stats["last_reminder_type"] = notification.notification_type
                contract_stats["last_reminder_message"] = notification.message
    return stats


def contract_to_dict(contract, stats_by_contract=None):
    """Serialize a contract with optional reminder tracking stats."""
    payload = contract.to_dict()
    stats = (stats_by_contract or {}).get(contract.id, {})
    payload.update(
        {
            "total_reminders_sent": stats.get("total_reminders_sent", 0),
            "last_reminder_sent_at": stats.get("last_reminder_sent_at"),
            "last_reminder_type": stats.get("last_reminder_type"),
            "last_reminder_message": stats.get("last_reminder_message"),
            "allowed_actions": contract_lifecycle.allowed_actions(contract.status or contract_lifecycle.DRAFT),
        }
    )
    return payload


def contracts_to_dict(contracts):
    """Serialize contracts with reminder stats in one notification query."""
    stats = notification_stats_for_contracts([contract.id for contract in contracts])
    return [contract_to_dict(contract, stats) for contract in contracts]


@contract_crud_bp.route("/contracts", methods=["GET"])
@token_required
@require_resource("contracts")
def get_contracts(current_user):
    """Get all contracts with optional filtering"""
    try:
        user_id = request.args.get("user_id", type=int)
        upcoming_only = request.args.get("upcoming_only", "false").lower() == "true"
        status = request.args.get("status")
        valid_statuses = {"active", "ending-soon", "critical", "expired"}

        if status and status not in valid_statuses:
            return jsonify({"error": "Invalid status filter"}), 400

        if user_id and user_id != current_user.id:
            logger.warning(
                "Cross-user contract query blocked",
                context={
                    "requested_user_id": user_id,
                    "authenticated_user_id": current_user.id,
                },
            )
            return jsonify({"error": "Forbidden"}), 403

        query = Contract.query.filter_by(user_id=current_user.id)

        if upcoming_only:
            status = "ending-soon"

        query = apply_contract_status_filter(query, status)

        search = request.args.get("search", "").strip()
        if search:
            pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Contract.contract_name.ilike(pattern),
                    Contract.company_name.ilike(pattern),
                    Contract.contract_number.ilike(pattern),
                )
            )

        sortable_fields = {
            "contract_name": Contract.contract_name,
            "company_name": Contract.company_name,
            "start_date": Contract.start_date,
            "end_date": Contract.end_date,
            "status": Contract.status,
            "created_at": Contract.created_at,
        }
        sort_by = request.args.get("sort_by")
        sort_column = sortable_fields.get(sort_by)
        if sort_column is not None:
            sort_dir = request.args.get("sort_dir", "desc").lower()
            query = query.order_by(
                sort_column.asc() if sort_dir == "asc" else sort_column.desc()
            )
        else:
            query = order_contracts_by_status(query, status)

        page = request.args.get("page", 1, type=int) or 1
        per_page = request.args.get("per_page", 25, type=int) or 25
        page = max(page, 1)
        per_page = max(1, min(per_page, 100))

        paginated = query.paginate(page=page, per_page=per_page, error_out=False)
        logger.info(
            "Contracts retrieved",
            context={
                "contract_count": paginated.total,
                "user_id": current_user.id,
                "upcoming_only": upcoming_only,
                "status": status,
                "search": search,
                "sort_by": sort_by,
            },
        )
        return (
            jsonify(
                {
                    "items": contracts_to_dict(paginated.items),
                    "page": paginated.page,
                    "per_page": paginated.per_page,
                    "total": paginated.total,
                    "total_pages": paginated.pages,
                }
            ),
            200,
        )
    except Exception as e:
        logger.error(
            "Failed to retrieve contracts",
            context={"error": str(e), "user_id": current_user.id},
        )
        return jsonify({"error": str(e)}), 500


@contract_crud_bp.route("/contracts", methods=["POST"])
@token_required
@require_resource("contracts")
def create_contract(current_user):
    """Create a new contract"""
    try:
        data = request.get_json() or {}

        validated_data = ContractCreate(**data)
        if validated_data.user_id and validated_data.user_id != current_user.id:
            return jsonify({"error": "Cannot create contracts for another user"}), 403

        customer_id = data.get("customer_id")
        contact_person_id = data.get("contact_person_id")
        if customer_id and not Customer.query.filter_by(
            id=customer_id,
            user_id=current_user.id,
        ).first():
            return jsonify({"error": "Customer not found"}), 404
        if contact_person_id and not ContactPerson.query.filter_by(
            id=contact_person_id,
            user_id=current_user.id,
        ).first():
            return jsonify({"error": "Contact person not found"}), 404

        contract_type_id = data.get("contract_type_id") or None
        if contract_type_id and not ContractType.query.filter_by(id=contract_type_id).first():
            return jsonify({"error": "Contract type not found"}), 404

        parent_contract_id = data.get("parent_contract_id") or None
        if parent_contract_id and not Contract.query.filter_by(
            id=parent_contract_id, user_id=current_user.id
        ).first():
            return jsonify({"error": "Parent contract not found"}), 404

        previous_contract_id = data.get("previous_contract_id") or None
        if previous_contract_id and not Contract.query.filter_by(
            id=previous_contract_id, user_id=current_user.id
        ).first():
            return jsonify({"error": "Previous contract not found"}), 404

        contract_number = data.get("contract_number") or generate_contract_number(current_user.id)
        if contract_number:
            existing_contract = Contract.query.filter_by(contract_number=contract_number).first()
            if existing_contract:
                return jsonify(
                    {"error": f"Contract number '{contract_number}' already exists. Please provide a unique contract number."}
                ), 400

        contract = Contract(
            company_name=validated_data.company_name,
            contract_name=validated_data.contract_name,
            start_date=validated_data.start_date,
            end_date=validated_data.end_date,
            renewal_date=validated_data.renewal_date,
            notification_enabled=validated_data.notification_enabled,
            notification_email=validated_data.notification_email,
            notification_mobile=validated_data.notification_mobile,
            notes=validated_data.notes,
            contract_number=contract_number,
            customer_id=customer_id,
            contact_person_id=contact_person_id,
            contract_type_id=contract_type_id,
            contract_date=parse_optional_date(data.get("contract_date")),
            status=data.get("status", "Draft"),
            currency=data.get("currency", "INR"),
            payment_terms=data.get("payment_terms"),
            remarks=data.get("remarks"),
            contract_version=data.get("contract_version", 1),
            parent_contract_id=parent_contract_id,
            previous_contract_id=previous_contract_id,
            created_by_id=current_user.id,
            last_modified_by_id=current_user.id,
            user_id=current_user.id,
        )

        db.session.add(contract)
        db.session.flush()
        try:
            for line_item_payload in data.get("line_items", []):
                db.session.add(
                    create_contract_line_item(
                        contract.id, line_item_payload, user_id=current_user.id
                    )
                )
        except ValueError as exc:
            db.session.rollback()
            return jsonify({"error": str(exc)}), 400
        db.session.flush()
        recalculate_contract_total(contract)

        dispatcher.dispatch(
            event_type="ContractCreated",
            aggregate_type="contract",
            aggregate_id=contract.id,
            user_id=current_user.id,
            payload={
                "contract_name": contract.contract_name,
                "company_name": contract.company_name,
                "status": contract.status,
                "total_value": float(contract.total_contract_value or 0),
                "currency": contract.currency,
                "start_date": str(contract.start_date),
                "end_date": str(contract.end_date),
                "renewal_date": str(contract.renewal_date),
                "contract_number": contract.contract_number,
                "customer_id": contract.customer_id,
            },
        )
        db.session.commit()

        log_activity(
            user_id=current_user.id,
            activity_type="contract_created",
            title=f"Contract created: {contract.contract_name}",
            description=f"Contract {contract.contract_name} with {contract.company_name} was created.",
            contract_id=contract.id,
            entity_type="contract",
            entity_id=contract.id,
        )
        db.session.commit()

        entity_data = {
            "contract_id": contract.id,
            "contract_name": contract.contract_name,
            "company_name": contract.company_name,
            "total_value": float(contract.total_contract_value or 0),
            "contract_type_id": contract.contract_type_id,
            "end_date": str(contract.end_date),
            "owner_email": current_user.email,
            "entity_type": "contract",
            "entity_id": contract.id,
        }
        try:
            execute_triggers("contract_created", entity_data, current_user.id)
        except Exception:
            pass

        logger.info(
            "Contract created successfully",
            context={
                "contract_id": contract.id,
                "contract_name": contract.contract_name,
                "company_name": contract.company_name,
                "user_id": contract.user_id,
                "end_date": str(contract.end_date),
                "renewal_date": str(contract.renewal_date),
            },
        )
        return jsonify(contract_to_dict(contract)), 201

    except ValidationError as e:
        logger.error("Contract creation validation error", context={"errors": str(e)})
        return handle_validation_error(e)
    except IntegrityError as e:
        db.session.rollback()
        logger.error(
            "Database integrity error during contract creation",
            context={"error": str(e)},
        )
        if "uq_contract_contract_number" in str(e) or "contract_number" in str(e):
            return jsonify(
                {"error": "Contract number already exists. Please provide a unique contract number."}
            ), 400
        return jsonify({"error": "Database integrity violation. Please check relation constraints."}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(
            "Failed to create contract",
            context={"error": str(e), "exception_type": type(e).__name__},
        )
        return jsonify(
            {"error": "Unable to create the contract. Please verify the line items and try again."}
        ), 500


@contract_crud_bp.route("/contracts/<int:contract_id>", methods=["GET"])
@token_required
@require_resource("contracts")
def get_contract(current_user, contract_id):
    """Get a specific contract by ID"""
    try:
        if contract_id <= 0:
            return jsonify({"error": "Invalid contract_id"}), 400

        contract = get_owned_contract(contract_id, current_user.id)
        if not contract:
            return jsonify({"error": "Contract not found"}), 404

        stats = notification_stats_for_contracts([contract.id])
        return jsonify(contract_to_dict(contract, stats)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@contract_crud_bp.route("/contracts/<int:contract_id>", methods=["PUT"])
@token_required
@require_resource("contracts")
def update_contract(current_user, contract_id):
    """Update a specific contract"""
    try:
        if contract_id <= 0:
            return jsonify({"error": "Invalid contract_id"}), 400

        contract = get_owned_contract(contract_id, current_user.id)
        if not contract:
            return jsonify({"error": "Contract not found"}), 404

        data = request.get_json() or {}

        validated_data = ContractUpdate(**data)
        candidate_start_date = validated_data.start_date or contract.start_date
        candidate_end_date = validated_data.end_date or contract.end_date
        if candidate_end_date <= candidate_start_date:
            return jsonify({"error": "end_date must be after start_date"}), 400

        if validated_data.company_name is not None:
            contract.company_name = validated_data.company_name
        if validated_data.contract_name is not None:
            contract.contract_name = validated_data.contract_name
        if validated_data.start_date is not None:
            contract.start_date = validated_data.start_date
        if validated_data.end_date is not None:
            contract.end_date = validated_data.end_date
        if validated_data.renewal_date is not None:
            contract.renewal_date = validated_data.renewal_date
        if validated_data.notification_enabled is not None:
            contract.notification_enabled = validated_data.notification_enabled
        if validated_data.notification_email is not None:
            contract.notification_email = validated_data.notification_email
        if validated_data.notification_mobile is not None:
            contract.notification_mobile = validated_data.notification_mobile
        if validated_data.notes is not None:
            contract.notes = validated_data.notes

        if "customer_id" in data:
            customer_id = data.get("customer_id")
            if customer_id and not Customer.query.filter_by(
                id=customer_id,
                user_id=current_user.id,
            ).first():
                return jsonify({"error": "Customer not found"}), 404
            contract.customer_id = customer_id

        if "contact_person_id" in data:
            contact_person_id = data.get("contact_person_id")
            if contact_person_id and not ContactPerson.query.filter_by(
                id=contact_person_id,
                user_id=current_user.id,
            ).first():
                return jsonify({"error": "Contact person not found"}), 404
            contract.contact_person_id = contact_person_id

        if "contract_number" in data:
            new_number = data.get("contract_number") or None
            if new_number and new_number != contract.contract_number:
                existing = Contract.query.filter_by(contract_number=new_number).first()
                if existing:
                    return jsonify(
                        {"error": f"Contract number '{new_number}' already exists. Please provide a unique contract number."}
                    ), 400
                contract.contract_number = new_number

        metadata_fields = [
            "status",
            "currency",
            "payment_terms",
            "remarks",
        ]
        for field in metadata_fields:
            if field in data:
                setattr(contract, field, data.get(field))

        for ref_field, ref_label in (
            ("parent_contract_id", "Parent contract"),
            ("previous_contract_id", "Previous contract"),
        ):
            if ref_field in data:
                ref_id = data.get(ref_field) or None
                if ref_id and not Contract.query.filter_by(
                    id=ref_id, user_id=current_user.id
                ).first():
                    return jsonify({"error": f"{ref_label} not found"}), 404
                setattr(contract, ref_field, ref_id)

        if "contract_date" in data:
            contract.contract_date = parse_optional_date(data.get("contract_date"))

        if "line_items" in data:
            ContractLineItem.query.filter_by(contract_id=contract.id).delete()
            db.session.flush()
            try:
                for line_item_payload in data.get("line_items") or []:
                    db.session.add(
                        create_contract_line_item(
                            contract.id, line_item_payload, user_id=current_user.id
                        )
                    )
            except ValueError as exc:
                db.session.rollback()
                return jsonify({"error": str(exc)}), 400
            db.session.flush()
            recalculate_contract_total(contract)

        contract.last_modified_by_id = current_user.id
        contract.updated_at = datetime.utcnow()

        log_activity(
            user_id=current_user.id,
            activity_type="contract_updated",
            title=f"Contract updated: {contract.contract_name}",
            description=f"Contract {contract.contract_name} details were updated.",
            contract_id=contract.id,
            entity_type="contract",
            entity_id=contract.id,
        )

        dispatcher.dispatch(
            event_type="ContractUpdated",
            aggregate_type="contract",
            aggregate_id=contract.id,
            user_id=current_user.id,
            payload={
                "contract_name": contract.contract_name,
                "company_name": contract.company_name,
                "status": contract.status,
            },
        )

        db.session.commit()
        return jsonify(contract_to_dict(contract)), 200

    except ValidationError as e:
        db.session.rollback()
        return handle_validation_error(e)
    except IntegrityError as e:
        db.session.rollback()
        logger.error(
            "Database integrity error during contract update",
            context={"error": str(e)},
        )
        if "uq_contract_contract_number" in str(e) or "contract_number" in str(e):
            return jsonify(
                {"error": "Contract number already exists. Please provide a unique contract number."}
            ), 400
        return jsonify({"error": "Database integrity violation. Please check relation constraints."}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(
            "Failed to update contract",
            context={"error": str(e), "exception_type": type(e).__name__},
        )
        return jsonify(
            {"error": "Unable to update the contract. Please verify the line items and try again."}
        ), 500


@contract_crud_bp.route("/contracts/<int:contract_id>", methods=["DELETE"])
@token_required
@require_resource("contracts")
def delete_contract(current_user, contract_id):
    """Delete a specific contract"""
    try:
        if contract_id <= 0:
            return jsonify({"error": "Invalid contract_id"}), 400

        contract = get_owned_contract(contract_id, current_user.id)
        if not contract:
            return jsonify({"error": "Contract not found"}), 404

        name = contract.contract_name
        company = contract.company_name

        Contract.query.filter_by(parent_contract_id=contract_id).update(
            {"parent_contract_id": None}, synchronize_session=False
        )
        Contract.query.filter_by(previous_contract_id=contract_id).update(
            {"previous_contract_id": None}, synchronize_session=False
        )

        ContractRenewal.query.filter(
            or_(
                ContractRenewal.original_contract_id == contract_id,
                ContractRenewal.parent_contract_id == contract_id,
                ContractRenewal.previous_contract_id == contract_id,
                ContractRenewal.new_contract_id == contract_id,
            )
        ).delete(synchronize_session=False)
        ContractVersionHistory.query.filter_by(contract_id=contract_id).delete(
            synchronize_session=False
        )
        ActivityLog.query.filter_by(contract_id=contract_id).delete(
            synchronize_session=False
        )
        ContractApproval.query.filter_by(contract_id=contract_id).delete(
            synchronize_session=False
        )
        ContractDocument.query.filter_by(contract_id=contract_id).delete(
            synchronize_session=False
        )
        invoice_ids = [
            row[0]
            for row in db.session.query(Invoice.id)
            .filter_by(contract_id=contract_id)
            .all()
        ]
        if invoice_ids:
            InvoiceLineItem.query.filter(InvoiceLineItem.invoice_id.in_(invoice_ids)).delete(
                synchronize_session=False
            )
        Invoice.query.filter_by(contract_id=contract_id).delete(synchronize_session=False)
        ContractClause.query.filter_by(contract_id=contract_id).delete(
            synchronize_session=False
        )
        ContractLineItem.query.filter_by(contract_id=contract_id).delete(
            synchronize_session=False
        )
        Notification.query.filter_by(contract_id=contract_id).delete(
            synchronize_session=False
        )
        PurchaseOrderContract.query.filter_by(contract_id=contract_id).delete(
            synchronize_session=False
        )

        dispatcher.dispatch(
            event_type="ContractDeleted",
            aggregate_type="contract",
            aggregate_id=contract_id,
            user_id=current_user.id,
            payload={
                "contract_name": name,
                "company_name": company,
            },
        )

        db.session.delete(contract)
        db.session.commit()
        return "", 204
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Failed to delete contract", "details": str(e)}), 400
