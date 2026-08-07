import uuid
from datetime import date, datetime, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from src.models.contract import (
    Contract,
    ContractDocument,
    ContractLineItem,
    ContractRenewal,
    Notification,
    db,
)
from src.routes.activity import log_activity
from src.routes.contracts.crud import generate_contract_number, get_owned_contract
from src.services import contract_lifecycle
from src.services.auth import require_resource, token_required
from src.services.automation_engine import execute_triggers
from src.services.contract_lifecycle import LifecycleError
from src.services.contract_totals import recalculate_contract_total
from src.services.domain_event import dispatcher
from src.services.logging_config import get_structured_logger
from src.services.task_service import generate_task

contract_renewals_bp = Blueprint("contract_renewals", __name__)
logger = get_structured_logger(__name__)


def parse_date(value, fallback=None):
    if not value:
        return fallback
    return datetime.strptime(value, "%Y-%m-%d").date()


def contract_with_children(contract):
    payload = contract.to_dict()
    payload["line_items"] = [
        line_item.to_dict()
        for line_item in ContractLineItem.query.filter_by(contract_id=contract.id).all()
    ]
    payload["documents"] = [
        document.to_dict()
        for document in ContractDocument.query.filter_by(contract_id=contract.id).all()
    ]
    return payload


@contract_renewals_bp.route("/contracts/<int:contract_id>/renew", methods=["POST"])
@token_required
@require_resource("contracts")
def renew_contract(current_user, contract_id):
    """Create a new contract version from an eligible contract."""
    previous = get_owned_contract(contract_id, current_user.id)
    if not previous:
        return jsonify({"error": "Contract not found"}), 404

    if not contract_lifecycle.can_perform(previous.status or contract_lifecycle.DRAFT, "renew"):
        return (
            jsonify(
                {"error": f"Cannot renew a contract in '{previous.status}' status."}
            ),
            409,
        )

    try:
        contract_lifecycle.apply_transition(previous, "renew")
        data = request.get_json() or {}
        start_date = parse_date(data.get("start_date"), previous.end_date + timedelta(days=1))
        end_date = parse_date(data.get("end_date"), start_date + timedelta(days=365))
        parent_id = previous.parent_contract_id or previous.id

        renewed = Contract(
            company_name=data.get("company_name", previous.company_name),
            contract_name=data.get("contract_name", previous.contract_name),
            start_date=start_date,
            end_date=end_date,
            renewal_date=parse_date(data.get("renewal_date"), end_date),
            notification_enabled=data.get("notification_enabled", previous.notification_enabled),
            notification_email=data.get("notification_email", previous.notification_email),
            notification_mobile=data.get("notification_mobile", previous.notification_mobile),
            notes=data.get("notes", previous.notes),
            contract_number=data.get("contract_number") or generate_contract_number(current_user.id),
            customer_id=data.get("customer_id", previous.customer_id),
            contact_person_id=data.get("contact_person_id", previous.contact_person_id),
            contract_type_id=data.get("contract_type_id", previous.contract_type_id),
            contract_date=parse_date(data.get("contract_date"), date.today()),
            status=contract_lifecycle.ACTIVE,
            currency=data.get("currency", previous.currency),
            payment_terms=data.get("payment_terms", previous.payment_terms),
            remarks=data.get("remarks", previous.remarks),
            contract_version=(previous.contract_version or 1) + 1,
            parent_contract_id=parent_id,
            previous_contract_id=previous.id,
            created_by_id=current_user.id,
            last_modified_by_id=current_user.id,
            user_id=current_user.id,
        )
        db.session.add(renewed)
        db.session.flush()

        line_items_override = data.get("line_items")
        if line_items_override is not None:
            for item_data in line_items_override:
                li = ContractLineItem(
                    contract_id=renewed.id,
                    product_id=item_data.get("product_id"),
                    sku=item_data.get("sku"),
                    product_name=item_data.get("product_name", ""),
                    quantity=item_data.get("quantity", 1),
                    rate=item_data.get("rate", 0),
                    discount=item_data.get("discount", 0),
                    tax=item_data.get("tax", 0),
                    remarks=item_data.get("remarks"),
                )
                li.calculate_amount()
                db.session.add(li)
        else:
            source_items = ContractLineItem.query.filter_by(contract_id=previous.id).all()
            for source in source_items:
                copied = ContractLineItem(
                    contract_id=renewed.id,
                    product_id=source.product_id,
                    sku=source.sku,
                    product_name=source.product_name,
                    quantity=source.quantity,
                    rate=source.rate,
                    discount=source.discount,
                    tax=source.tax,
                    remarks=source.remarks,
                )
                copied.calculate_amount()
                db.session.add(copied)

        db.session.flush()
        recalculate_contract_total(renewed)

        for source in ContractDocument.query.filter_by(contract_id=previous.id).all():
            db.session.add(ContractDocument(
                contract_id=renewed.id,
                file_name=source.file_name,
                stored_file_name=source.stored_file_name,
                file_path=source.file_path,
                content_type=source.content_type,
                file_size=source.file_size,
                file_type=source.file_type,
                category=source.category,
                storage_provider=source.storage_provider,
                storage_reference=source.storage_reference,
                version_group_id=str(uuid.uuid4()),
                version=1,
                is_latest_version=True,
                uploaded_by_id=current_user.id,
            ))

        renewal = ContractRenewal(
            original_contract_id=parent_id,
            parent_contract_id=parent_id,
            previous_contract_id=previous.id,
            new_contract_id=renewed.id,
            created_by_id=current_user.id,
        )
        db.session.add(renewal)

        log_activity(
            user_id=current_user.id,
            activity_type="contract_renewed",
            title=f"Contract renewed: {previous.contract_name}",
            description=f"Contract {previous.contract_name} was renewed (v{previous.contract_version} → v{renewed.contract_version}).",
            contract_id=renewed.id,
            entity_type="contract",
            entity_id=renewed.id,
        )

        db.session.add(Notification(
            contract_id=renewed.id,
            notification_type="email",
            status="pending",
            message=f"Contract '{previous.contract_name}' has been renewed (v{previous.contract_version} → v{renewed.contract_version}).",
        ))

        dispatcher.dispatch(
            event_type="RenewalCreated",
            aggregate_type="contract",
            aggregate_id=renewed.id,
            user_id=current_user.id,
            payload={
                "contract_name": renewed.contract_name,
                "company_name": renewed.company_name,
                "previous_contract_id": previous.id,
                "previous_version": previous.contract_version,
                "new_version": renewed.contract_version,
                "total_value": float(renewed.total_contract_value or 0),
            },
        )
        dispatcher.dispatch(
            event_type="RenewalCompleted",
            aggregate_type="contract",
            aggregate_id=renewed.id,
            user_id=current_user.id,
            payload={
                "contract_name": renewed.contract_name,
                "previous_contract_id": previous.id,
            },
        )

        db.session.commit()

        execute_triggers("contract_renewed", {
            "contract_id": renewed.id,
            "contract_name": renewed.contract_name,
            "company_name": renewed.company_name,
            "previous_version": previous.contract_version,
            "new_version": renewed.contract_version,
            "total_value": float(renewed.total_contract_value or 0),
            "entity_type": "contract",
            "entity_id": renewed.id,
        }, current_user.id)

        generate_task(
            title=f"Renewal completed: {renewed.contract_name}",
            description=f"Contract {renewed.contract_name} has been renewed (v{previous.contract_version} → v{renewed.contract_version}). Review the renewed contract.",
            priority="MEDIUM",
            due_days=14,
            related_module="contract",
            related_record_id=renewed.id,
            assigned_by=current_user.id,
            user_id=current_user.id,
        )
    except LifecycleError as exc:
        db.session.rollback()
        return jsonify({"error": exc.message}), exc.status_code
    except Exception as exc:
        db.session.rollback()
        logger.error(
            "Failed to renew contract",
            context={"error": str(exc), "exception_type": type(exc).__name__, "contract_id": contract_id},
        )
        return jsonify({"error": f"Unable to renew the contract: {str(exc)}"}), 500

    return jsonify(contract_with_children(renewed)), 201


@contract_renewals_bp.route("/contracts/<int:contract_id>/renewal-history", methods=["GET"])
@token_required
@require_resource("contracts")
def renewal_history(current_user, contract_id):
    contract = get_owned_contract(contract_id, current_user.id)
    if not contract:
        return jsonify({"error": "Contract not found"}), 404
    parent_id = contract.parent_contract_id or contract.id
    contracts = Contract.query.filter(
        Contract.user_id == current_user.id,
        or_(Contract.id == parent_id, Contract.parent_contract_id == parent_id),
    ).order_by(Contract.contract_version.asc(), Contract.id.asc()).all()
    return jsonify([contract_with_children(item) for item in contracts]), 200
