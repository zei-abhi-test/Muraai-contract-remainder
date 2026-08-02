import os

from flask import Blueprint, jsonify, request
from datetime import datetime, date, timedelta
from decimal import Decimal, InvalidOperation
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
from src.services.auth import token_required, require_resource
from src.services.validators import ContractCreate, ContractUpdate, NotificationCreate
from src.services.logging_config import get_structured_logger
from src.services import contract_lifecycle
from src.services.contract_lifecycle import LifecycleError
from src.services.workflow_engine import evaluate_workflow, create_assignment
from src.services.automation_engine import execute_triggers
from src.services.task_service import generate_task
from src.services.domain_event import dispatcher
from pydantic import ValidationError

contract_bp = Blueprint("contract", __name__)
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
    # Allocate the sequence from the highest number already issued for this
    # user/year instead of a row count. contract_number is globally UNIQUE, so
    # a count-based number would be reused (and violate the constraint) after a
    # contract is deleted.
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


def create_contract_line_item(contract_id, payload, user_id=None):
    """Build a ContractLineItem from a create/update payload.

    Snapshots sku/product_name/rate at creation time so historical contracts
    never depend on the current Product record: sku/product_name always
    come from the resolved Product (never trusted from the client), while
    rate is always the contractual rate the caller supplied (never silently
    replaced by Product.rate/price).
    """
    product_id = payload.get("product_id") or None
    sku = None
    product_name = payload.get("product_name", "").strip()

    if product_id:
        from src.models.contract import Product

        product_query = Product.query.filter_by(id=product_id)
        if user_id is not None:
            product_query = product_query.filter_by(user_id=user_id)
        product = product_query.first()
        if not product:
            raise ValueError(f"Product {product_id} not found")
        sku = product.sku
        product_name = product_name or product.name

    if not product_name:
        raise ValueError("product_name is required")

    quantity = parse_decimal(payload.get("quantity"))
    rate = parse_decimal(payload.get("rate"))
    discount = parse_decimal(payload.get("discount", "0"))
    tax = parse_decimal(payload.get("tax", "0"))

    line_item = ContractLineItem(
        contract_id=contract_id,
        product_id=product_id,
        sku=sku,
        product_name=product_name,
        quantity=quantity,
        rate=rate,
        discount=discount,
        tax=tax,
        remarks=payload.get("remarks"),
    )
    # Single source of truth for the amount/line_total formula (see
    # ContractLineItem.calculate_amount): amount = quantity * rate;
    # discount/tax applied on top; both use Decimal, never floats.
    line_item.calculate_amount()

    return line_item


def recalculate_contract_total(contract):
    items = ContractLineItem.query.filter_by(contract_id=contract.id).all()
    contract.total_contract_value = sum((item.line_total or Decimal("0")) for item in items)
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
            # Backend is the sole authority for which actions are valid from
            # the contract's current lifecycle status.
            "allowed_actions": contract_lifecycle.allowed_actions(contract.status or contract_lifecycle.DRAFT),
        }
    )
    return payload


def contracts_to_dict(contracts):
    """Serialize contracts with reminder stats in one notification query."""
    stats = notification_stats_for_contracts([contract.id for contract in contracts])
    return [contract_to_dict(contract, stats) for contract in contracts]


@contract_bp.route("/contracts", methods=["GET"])
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
        contracts = order_contracts_by_status(query, status).all()
        logger.info(
            "Contracts retrieved",
            context={
                "contract_count": len(contracts),
                "user_id": current_user.id,
                "upcoming_only": upcoming_only,
                "status": status,
            },
        )
        return jsonify(contracts_to_dict(contracts)), 200
    except Exception as e:
        logger.error(
            "Failed to retrieve contracts",
            context={"error": str(e), "user_id": current_user.id},
        )
        return jsonify({"error": str(e)}), 500


@contract_bp.route("/contracts", methods=["POST"])
@token_required
@require_resource("contracts")
def create_contract(current_user):
    """Create a new contract"""
    try:
        data = request.get_json() or {}

        # Validate request data
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

        # FK fields are validated before flush so a stale/missing id (e.g. the
        # frontend sending 0 as "no selection") becomes a clean 404 instead of
        # a database IntegrityError surfaced as a 500.
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

        # contract_number is globally unique; check it before flushing so a
        # duplicate (e.g. a stale value re-submitted by the frontend) becomes a
        # clean 400 instead of a database IntegrityError surfaced as a 500.
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
        # Never leak raw SQL/database internals to the client; the full
        # exception is already in the server log above.
        return jsonify(
            {"error": "Unable to create the contract. Please verify the line items and try again."}
        ), 500


@contract_bp.route("/contracts/<int:contract_id>", methods=["GET"])
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


@contract_bp.route("/contracts/<int:contract_id>", methods=["PUT"])
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

        # Validate request data
        validated_data = ContractUpdate(**data)
        candidate_start_date = validated_data.start_date or contract.start_date
        candidate_end_date = validated_data.end_date or contract.end_date
        if candidate_end_date <= candidate_start_date:
            return jsonify({"error": "end_date must be after start_date"}), 400

        # Update fields if provided
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

        # contract_number is globally unique; validate before assignment so a
        # duplicate update becomes a clean 400 instead of an IntegrityError 500.
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

        # Validated separately so a stale id returns 404 instead of an
        # IntegrityError (500).
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


@contract_bp.route("/contracts/<int:contract_id>", methods=["DELETE"])
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

        # Detach other contracts that reference this one before it is removed.
        Contract.query.filter_by(parent_contract_id=contract_id).update(
            {"parent_contract_id": None}, synchronize_session=False
        )
        Contract.query.filter_by(previous_contract_id=contract_id).update(
            {"previous_contract_id": None}, synchronize_session=False
        )

        # Delete every row that holds a foreign key to this contract. The DB
        # constraints are NO ACTION (no cascade), so they must be cleared here
        # before db.session.delete() or PostgreSQL rejects the delete.
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
        # contract_document references invoice.id, so documents must go first.
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


@contract_bp.route("/contracts/<int:contract_id>/submit", methods=["POST"])
@token_required
@require_resource("contracts")
def submit_contract(current_user, contract_id):
    """Submit a Draft/Rejected contract for approval.

    DRAFT -> PENDING_APPROVAL, and a new ContractApproval record is created
    to back the Approvals workspace. If a matching workflow exists, it is
    evaluated and a multi-stage workflow assignment is created.
    """
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
        first_stage = next(
            (s for s in sorted(workflow.stages, key=lambda x: x.stage_order)
             if s.stage_order == 1),
            None,
        )
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


@contract_bp.route("/contracts/<int:contract_id>/activate", methods=["POST"])
@token_required
@require_resource("contracts")
def activate_contract(current_user, contract_id):
    """APPROVED -> ACTIVE. A contract can never reach ACTIVE without first
    passing through an approval (there is no transition from DRAFT/PENDING
    directly to ACTIVE in the lifecycle map)."""
    return _apply_lifecycle_action(current_user, contract_id, "activate")


@contract_bp.route("/contracts/<int:contract_id>/hold", methods=["POST"])
@token_required
@require_resource("contracts")
def hold_contract(current_user, contract_id):
    return _apply_lifecycle_action(current_user, contract_id, "hold")


@contract_bp.route("/contracts/<int:contract_id>/resume", methods=["POST"])
@token_required
@require_resource("contracts")
def resume_contract(current_user, contract_id):
    return _apply_lifecycle_action(current_user, contract_id, "resume")


@contract_bp.route("/contracts/<int:contract_id>/complete", methods=["POST"])
@token_required
@require_resource("contracts")
def complete_contract(current_user, contract_id):
    return _apply_lifecycle_action(current_user, contract_id, "complete")


@contract_bp.route("/contracts/<int:contract_id>/revert-to-draft", methods=["POST"])
@token_required
@require_resource("contracts")
def revert_contract_to_draft(current_user, contract_id):
    return _apply_lifecycle_action(current_user, contract_id, "revert_to_draft")


@contract_bp.route("/contracts/<int:contract_id>/mark-renewal-due", methods=["POST"])
@token_required
@require_resource("contracts")
def mark_renewal_due(current_user, contract_id):
    return _apply_lifecycle_action(current_user, contract_id, "mark_renewal_due")


@contract_bp.route("/contracts/<int:contract_id>/expire", methods=["POST"])
@token_required
@require_resource("contracts")
def expire_contract(current_user, contract_id):
    return _apply_lifecycle_action(current_user, contract_id, "expire")


@contract_bp.route("/contracts/dashboard", methods=["GET"])
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


@contract_bp.route("/dashboard/data", methods=["GET"])
@token_required
@require_resource("contracts")
def get_dashboard_full_data(current_user):
    try:
        uid = current_user.id
        today = date.today()

        # ── Contract counts ──
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

        # ── Pending approvals ──
        pending_approvals = ContractApproval.query.join(Contract).filter(
            Contract.user_id == uid, ContractApproval.status == "Pending"
        ).count()

        # ── Renewals ──
        renewals_due = Contract.query.filter(
            Contract.user_id == uid,
            Contract.renewal_date.isnot(None),
            Contract.renewal_date >= today,
            Contract.renewal_date <= today + timedelta(days=30),
        ).count()

        # ── Invoices ──
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

        # ── Purchase Orders ──
        total_pos = PurchaseOrder.query.filter_by(user_id=uid).count()
        po_pending = PurchaseOrder.query.filter_by(user_id=uid, status="Pending").count()
        po_completed = PurchaseOrder.query.filter_by(user_id=uid, status="Completed").count()
        po_cancelled = PurchaseOrder.query.filter_by(user_id=uid, status="Cancelled").count()

        # ── Documents ──
        total_docs = ContractDocument.query.filter(
            ContractDocument.contract_id.isnot(None) |
            ContractDocument.invoice_id.isnot(None) |
            ContractDocument.po_id.isnot(None)
        ).count()

        # ── Customers ──
        total_customers = Customer.query.filter_by(user_id=uid).count()

        # ── Products ──
        total_products = Product.query.filter_by(user_id=uid).count()

        # ── Notifications ──
        total_notifications = Notification.query.join(Contract).filter(
            Contract.user_id == uid
        ).count()
        unread_notifications = Notification.query.join(Contract).filter(
            Contract.user_id == uid, Notification.status == "pending"
        ).count()

        # ── Recent contracts (last 8) ──
        recent_contracts = Contract.query.filter_by(user_id=uid).order_by(
            Contract.created_at.desc()
        ).limit(8).all()

        # ── Invoices due today ──
        invoices_due_today = Invoice.query.filter(
            Invoice.user_id == uid,
            Invoice.due_date == today,
            Invoice.status.in_(["ISSUED", "DRAFT"]),
        ).count()

        # ── Expiring today ──
        contracts_expiring_today = Contract.query.filter(
            Contract.user_id == uid,
            Contract.end_date == today,
        ).count()

        # ── Top customers by contract value ──
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

        # ── Top products by usage ──
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

        # ── Recent activity (last 10) ──
        recent_activity = ActivityLog.query.filter_by(user_id=uid).order_by(
            ActivityLog.created_at.desc()
        ).limit(10).all()

        # ── Recent documents (last 8) ──
        recent_documents = ContractDocument.query.join(
            Contract, Contract.id == ContractDocument.contract_id
        ).filter(
            Contract.user_id == uid
        ).order_by(
            ContractDocument.uploaded_at.desc()
        ).limit(8).all()

        # ── Contract status distribution ──
        status_rows = (
            db.session.query(Contract.status, func.count(Contract.id))
            .filter(Contract.user_id == uid)
            .group_by(Contract.status)
            .all()
        )
        contracts_by_status = {s: c for s, c in status_rows}

        # ── Monthly contract trend ──
        all_contracts = Contract.query.filter_by(user_id=uid).order_by(Contract.start_date).all()
        months: dict[str, int] = {}
        for c in all_contracts:
            if c.start_date:
                mk = f"{c.start_date.year}-{c.start_date.month:02d}"
                months[mk] = months.get(mk, 0) + 1
        contracts_per_month = [{"month": k, "count": v} for k, v in sorted(months.items())]

        # ── Revenue trend ──
        items = ContractLineItem.query.join(Contract).filter(Contract.user_id == uid).all()
        rev_months: dict[str, float] = {}
        for it in items:
            if it.contract and it.contract.start_date:
                mk = f"{it.contract.start_date.year}-{it.contract.start_date.month:02d}"
                rev_months[mk] = rev_months.get(mk, 0) + float(it.line_total or 0)
        revenue_trend = [{"month": k, "revenue": round(v, 2)} for k, v in sorted(rev_months.items())]

        # ── Invoice status distribution ──
        inv_status_rows = (
            db.session.query(Invoice.status, func.count(Invoice.id))
            .filter(Invoice.user_id == uid)
            .group_by(Invoice.status)
            .all()
        )
        invoice_status = [{"status": s, "count": c} for s, c in inv_status_rows]

        # ── Renewal trend ──
        renewal_contracts = Contract.query.filter_by(user_id=uid).order_by(Contract.renewal_date).all()
        ren_months: dict[str, int] = {}
        for c in renewal_contracts:
            if c.renewal_date:
                mk = f"{c.renewal_date.year}-{c.renewal_date.month:02d}"
                ren_months[mk] = ren_months.get(mk, 0) + 1
        renewal_trend = [{"month": k, "count": v} for k, v in sorted(ren_months.items())]

        # ── PO trend ──
        po_all = PurchaseOrder.query.filter_by(user_id=uid).order_by(PurchaseOrder.po_date).all()
        po_months: dict[str, int] = {}
        for p in po_all:
            if p.po_date:
                mk = f"{p.po_date.year}-{p.po_date.month:02d}"
                po_months[mk] = po_months.get(mk, 0) + 1
        po_trend = [{"month": k, "count": v} for k, v in sorted(po_months.items())]

        # ── Approval trend ──
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

        # ── Missing documents (contracts with no documents) ──
        contracts_no_doc = Contract.query.filter(
            Contract.user_id == uid,
            ~Contract.id.in_(
                db.session.query(ContractDocument.contract_id).filter(
                    ContractDocument.contract_id.isnot(None)
                )
            )
        ).count()

        # ── Today's tasks summary ──
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

        # ── Calendar events (upcoming 30 days) ──
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

        # ── System health ──
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


@contract_bp.route("/notifications", methods=["GET"])
@token_required
@require_resource("contracts")
def get_notifications(current_user):
    """Get notification history"""
    try:
        contract_id = request.args.get("contract_id", type=int)
        limit = request.args.get("limit", default=100, type=int)

        if limit <= 0 or limit > 1000:
            limit = 100

        query = Notification.query.join(Contract).filter(
            Contract.user_id == current_user.id
        )
        if contract_id:
            if contract_id <= 0:
                return jsonify({"error": "Invalid contract_id"}), 400
            if not get_owned_contract(contract_id, current_user.id):
                return jsonify({"error": "Contract not found"}), 404
            query = query.filter(Notification.contract_id == contract_id)

        notifications = query.order_by(Notification.send_date.desc()).limit(limit).all()
        return jsonify([notification.to_dict() for notification in notifications]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@contract_bp.route("/notifications", methods=["POST"])
@token_required
@require_resource("contracts")
def create_notification(current_user):
    """Create a new notification record"""
    try:
        data = request.get_json() or {}

        # Validate request data
        validated_data = NotificationCreate(**data)

        # Check if contract exists
        contract = get_owned_contract(validated_data.contract_id, current_user.id)
        if not contract:
            return jsonify({"error": "Contract not found"}), 404

        notification = Notification(
            contract_id=validated_data.contract_id,
            notification_type=validated_data.notification_type.value,
            status=validated_data.status.value,
            message=validated_data.message,
        )

        db.session.add(notification)
        db.session.commit()
        return jsonify(notification.to_dict()), 201

    except ValidationError as e:
        return handle_validation_error(e)
    except Exception as e:
        db.session.rollback()
        return (
            jsonify({"error": "Failed to create notification", "details": str(e)}),
            400,
        )
