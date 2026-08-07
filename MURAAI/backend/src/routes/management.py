import os
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import or_, text
from sqlalchemy.exc import IntegrityError
from werkzeug.utils import secure_filename

from src.models.contract import (
    ActivityLog,
    ContactPerson,
    Contract,
    ContractApproval,
    ContractDocument,
    ContractLineItem,
    ContractRenewal,
    ContractType,
    Customer,
    Invoice,
    Notification,
    Product,
    PurchaseOrder,
    PurchaseOrderContract,
    SkuCounter,
    db,
)
from src.models.customer_auth import CustomerPortalUser
from src.routes.activity import log_activity
from src.services.auth import token_required, require_resource
from src.services.logging_config import get_structured_logger
from src.services import contract_lifecycle
from src.services.contract_lifecycle import LifecycleError
from src.services.contract_totals import recalculate_contract_total, create_contract_line_item
from src.services.automation_engine import execute_triggers
from src.services.task_service import generate_task
from src.services.domain_event import dispatcher

management_bp = Blueprint("management", __name__)
logger = get_structured_logger(__name__)


def parse_date(value, fallback=None):
    if not value:
        return fallback
    return datetime.strptime(value, "%Y-%m-%d").date()


def parse_decimal(value, fallback="0"):
    try:
        return Decimal(str(value if value is not None else fallback))
    except (InvalidOperation, ValueError):
        raise ValueError("Invalid numeric value")


def get_owned_customer(customer_id, user_id):
    return Customer.query.filter_by(id=customer_id, user_id=user_id).first()


def get_owned_contact(contact_id, user_id):
    return ContactPerson.query.filter_by(id=contact_id, user_id=user_id).first()


def get_owned_contract(contract_id, user_id):
    return Contract.query.filter_by(id=contract_id, user_id=user_id).first()


def get_owned_product(product_id, user_id):
    return Product.query.filter_by(id=product_id, user_id=user_id).first()


def describe_customer_dependencies(customer_id, user_id):
    """Return a human-readable list of entity types still referencing a
    customer, or None if the customer is safe to delete."""
    dependencies = []
    if ContactPerson.query.filter_by(customer_id=customer_id, user_id=user_id).count():
        dependencies.append("contacts")
    if Contract.query.filter_by(customer_id=customer_id, user_id=user_id).count():
        dependencies.append("contracts")
    if PurchaseOrder.query.filter_by(customer_id=customer_id, user_id=user_id).count():
        dependencies.append("purchase orders")
    if Invoice.query.filter_by(customer_id=customer_id, user_id=user_id).count():
        dependencies.append("invoices")
    if not dependencies:
        return None
    if len(dependencies) == 1:
        return dependencies[0]
    return ", ".join(dependencies[:-1]) + " and " + dependencies[-1]


def describe_contact_dependencies(contact_id, user_id):
    if Contract.query.filter_by(contact_person_id=contact_id, user_id=user_id).count():
        return "contracts"
    return None


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


def generate_sku(category, user_id=None):
    """Generate a globally unique SKU: SKU-{CATEGORY}-{COMPANY}-{YEAR}-{SEQUENCE}

    Product.sku has a global UNIQUE constraint, so the sequence suffix must
    also be allocated globally (not per-user) — otherwise two different
    users creating their first product in the same category/year would both
    compute sequence 000001 and collide.

    The sequence is allocated with a single atomic INSERT … ON CONFLICT …
    statement against `sku_counter`, followed by a SELECT within the same
    transaction.  This is safe under concurrent requests (the write-lock on
    the sku_counter row serialises callers) and works on both PostgreSQL and
    SQLite (3.24+) without relying on dialect-specific RETURNING support.
    """
    year = date.today().year
    company_code = "MUR"  # TODO: Make this configurable per company
    category_code = category[:3].upper() if category else "GEN"
    prefix = f"SKU-{category_code}-{company_code}-{year}"

    db.session.execute(
        text("""
            INSERT INTO sku_counter (prefix, next_value)
            VALUES (:prefix, 1)
            ON CONFLICT (prefix)
            DO UPDATE SET next_value = sku_counter.next_value + 1
        """),
        {"prefix": prefix},
    )
    db.session.flush()

    sequence = db.session.execute(
        text("SELECT next_value FROM sku_counter WHERE prefix = :prefix"),
        {"prefix": prefix},
    ).scalar()

    return f"{prefix}-{sequence:06d}"








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


@management_bp.route("/contract-types", methods=["GET", "POST"])
@token_required
@require_resource("contracts")
def contract_types(current_user):
    if request.method == "GET":
        contract_types = ContractType.query.filter_by(status="active").order_by(ContractType.name.asc()).all()
        return jsonify([ct.to_dict() for ct in contract_types]), 200

    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    
    # Check if contract type already exists
    existing = ContractType.query.filter_by(name=name).first()
    if existing:
        return jsonify({"error": "Contract type with this name already exists"}), 400

    contract_type = ContractType(
        name=name,
        description=data.get("description"),
        status=data.get("status", "active"),
    )
    db.session.add(contract_type)
    db.session.commit()
    return jsonify(contract_type.to_dict()), 201


@management_bp.route("/contract-types/<int:contract_type_id>", methods=["GET", "PUT", "DELETE"])
@token_required
@require_resource("contracts")
def contract_type_detail(current_user, contract_type_id):
    contract_type = ContractType.query.filter_by(id=contract_type_id).first()
    if not contract_type:
        return jsonify({"error": "Contract type not found"}), 404
    if request.method == "GET":
        return jsonify(contract_type.to_dict()), 200
    if request.method == "PUT":
        data = request.get_json() or {}
        if "name" in data:
            # Check if name conflicts with existing
            existing = ContractType.query.filter(
                ContractType.name == data["name"],
                ContractType.id != contract_type_id
            ).first()
            if existing:
                return jsonify({"error": "Contract type with this name already exists"}), 400
            contract_type.name = data["name"].strip()
        if "description" in data:
            contract_type.description = data["description"]
        if "status" in data:
            contract_type.status = data["status"]
        contract_type.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify(contract_type.to_dict()), 200
    if request.method == "DELETE":
        db.session.delete(contract_type)
        db.session.commit()
        return jsonify({"message": "Contract type deleted"}), 200


@management_bp.route("/customers", methods=["GET"])
@token_required
@require_resource("customers")
def list_customers(current_user):
    customers = Customer.query.filter_by(user_id=current_user.id).order_by(Customer.name.asc()).all()
    return jsonify([customer.to_dict() for customer in customers]), 200


@management_bp.route("/customers", methods=["POST"])
@token_required
@require_resource("customers")
def create_customer(current_user):
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    customer = Customer(
        name=name,
        customer_code=data.get("customer_code"),
        phone=data.get("phone"),
        email=data.get("email"),
        address=data.get("address"),
        user_id=current_user.id,
    )
    db.session.add(customer)
    db.session.flush()
    log_activity(
        user_id=current_user.id,
        activity_type="customer_created",
        title=f"Customer created: {customer.name}",
        description=f"Customer {customer.name} was created.",
        entity_type="customer",
        entity_id=customer.id,
    )
    dispatcher.dispatch(
        event_type="CustomerCreated",
        aggregate_type="customer",
        aggregate_id=customer.id,
        user_id=current_user.id,
        payload={
            "name": customer.name,
            "email": customer.email,
        },
    )
    db.session.commit()
    return jsonify(customer.to_dict()), 201


@management_bp.route("/customers/<int:customer_id>", methods=["GET", "PUT", "DELETE"])
@token_required
@require_resource("customers")
def customer_detail(current_user, customer_id):
    customer = get_owned_customer(customer_id, current_user.id)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404
    if request.method == "GET":
        return jsonify(customer.to_dict()), 200

    if request.method == "PUT":
        data = request.get_json() or {}
        for field in ["name", "customer_code", "phone", "email", "address"]:
            if field in data:
                setattr(customer, field, data[field])
        customer.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify(customer.to_dict()), 200

    # DELETE: never cascade-delete business history. Block deletion while
    # the customer is still referenced by contacts, contracts, purchase
    # orders, or invoices.
    dependency = describe_customer_dependencies(customer.id, current_user.id)
    if dependency:
        return (
            jsonify(
                {"error": f"Customer cannot be deleted because it is referenced by existing {dependency}."}
            ),
            409,
        )
    db.session.delete(customer)
    db.session.commit()
    return jsonify({"message": "Customer deleted"}), 200


@management_bp.route("/customers/<int:customer_id>/contacts", methods=["GET", "POST"])
@token_required
@require_resource("customers")
def customer_contacts(current_user, customer_id):
    customer = get_owned_customer(customer_id, current_user.id)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404
    if request.method == "GET":
        contacts = ContactPerson.query.filter_by(
            customer_id=customer.id,
            user_id=current_user.id,
        ).order_by(ContactPerson.contact_name.asc()).all()
        return jsonify([contact.to_dict() for contact in contacts]), 200

    data = request.get_json() or {}
    contact_name = data.get("contact_name", "").strip()
    contact_number = data.get("contact_number", "").strip()
    if not contact_name or not contact_number:
        return jsonify({"error": "contact_name and contact_number are required"}), 400
    contact = ContactPerson(
        customer_id=customer.id,
        contact_name=contact_name,
        contact_number=contact_number,
        email=data.get("email"),
        designation=data.get("designation"),
        user_id=current_user.id,
    )
    db.session.add(contact)
    db.session.flush()
    log_activity(
        user_id=current_user.id,
        activity_type="contact_created",
        title=f"Contact created: {contact.contact_name}",
        description=f"Contact {contact.contact_name} was created for customer {customer.name}.",
        entity_type="contact",
        entity_id=contact.id,
    )
    db.session.commit()
    return jsonify(contact.to_dict()), 201


@management_bp.route("/contacts", methods=["GET"])
@token_required
@require_resource("contacts")
def list_contacts(current_user):
    query = ContactPerson.query.filter_by(user_id=current_user.id)
    customer_id = request.args.get("customer_id", type=int)
    if customer_id:
        query = query.filter(ContactPerson.customer_id == customer_id)
    contacts = query.order_by(ContactPerson.contact_name.asc()).all()
    return jsonify([contact.to_dict() for contact in contacts]), 200


@management_bp.route("/contacts/<int:contact_id>", methods=["GET", "PUT", "DELETE"])
@token_required
@require_resource("contacts")
def contact_detail(current_user, contact_id):
    contact = get_owned_contact(contact_id, current_user.id)
    if not contact:
        return jsonify({"error": "Contact not found"}), 404
    if request.method == "GET":
        return jsonify(contact.to_dict()), 200
    if request.method == "PUT":
        data = request.get_json() or {}
        for field in ["contact_name", "contact_number", "email", "designation"]:
            if field in data:
                setattr(contact, field, data[field])
        contact.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify(contact.to_dict()), 200
    if request.method == "DELETE":
        dependency = describe_contact_dependencies(contact.id, current_user.id)
        if dependency:
            return (
                jsonify(
                    {"error": f"Contact cannot be deleted because it is referenced by existing {dependency}."}
                ),
                409,
            )
        db.session.delete(contact)
        db.session.commit()
        return jsonify({"message": "Contact deleted"}), 200


@management_bp.route("/contracts/<int:contract_id>/line-items", methods=["GET", "POST"])
@token_required
@require_resource("contracts")
def contract_line_items(current_user, contract_id):
    contract = get_owned_contract(contract_id, current_user.id)
    if not contract:
        return jsonify({"error": "Contract not found"}), 404
    if request.method == "GET":
        items = ContractLineItem.query.filter_by(contract_id=contract.id).all()
        return jsonify([item.to_dict() for item in items]), 200

    try:
        line_item = create_contract_line_item(
            contract.id, request.get_json() or {}, user_id=current_user.id
        )
        db.session.add(line_item)
        db.session.flush()
        recalculate_contract_total(contract)
        contract.updated_at = datetime.utcnow()
        contract.last_modified_by_id = current_user.id

        log_activity(
            user_id=current_user.id,
            activity_type="product_added",
            title=f"Line item added to contract {contract.contract_name}",
            description=f"Product '{line_item.product_name}' (qty: {line_item.quantity}) added.",
            contract_id=contract.id,
            entity_type="contract",
            entity_id=contract.id,
        )

        db.session.commit()
    except ValueError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        db.session.rollback()
        logger.error(
            "Failed to add contract line item",
            context={"error": str(exc), "exception_type": type(exc).__name__},
        )
        return jsonify(
            {"error": "Unable to add the line item. Please verify the product and try again."}
        ), 500
    return jsonify(line_item.to_dict()), 201


@management_bp.route("/contracts/<int:contract_id>/documents", methods=["GET", "POST"])
@token_required
@require_resource("contracts")
def contract_documents(current_user, contract_id):
    from src.services.storage import get_storage_provider, generate_stored_filename

    contract = get_owned_contract(contract_id, current_user.id)
    if not contract:
        return jsonify({"error": "Contract not found"}), 404
    if request.method == "GET":
        documents = ContractDocument.query.filter_by(contract_id=contract.id).all()
        return jsonify([document.to_dict() for document in documents]), 200

    uploaded_file = request.files.get("file")
    if not uploaded_file or not uploaded_file.filename:
        return jsonify({"error": "file is required"}), 400

    stored_name = generate_stored_filename(uploaded_file.filename)
    provider = get_storage_provider()
    file_path, storage_ref = provider.save(uploaded_file, stored_name)

    ext = uploaded_file.filename.rsplit(".", 1)[-1].lower() if "." in uploaded_file.filename else ""
    uploaded_file.seek(0, os.SEEK_END)
    file_size = uploaded_file.tell()
    uploaded_file.seek(0)

    document = ContractDocument(
        contract_id=contract.id,
        file_name=uploaded_file.filename,
        stored_file_name=stored_name,
        file_path=file_path,
        content_type=uploaded_file.content_type,
        file_size=file_size,
        file_type=ext,
        storage_provider="onedrive" if storage_ref else "local",
        storage_reference=storage_ref,
        version_group_id=str(uuid.uuid4()),
        version=1,
        is_latest_version=True,
        uploaded_by_id=current_user.id,
    )
    db.session.add(document)
    db.session.flush()

    log_activity(
        user_id=current_user.id,
        activity_type="document_uploaded",
        title=f"Document uploaded: {uploaded_file.filename}",
        description=f"Document {uploaded_file.filename} was uploaded for contract {contract.contract_name}.",
        contract_id=contract.id,
        entity_type="contract",
        entity_id=contract.id,
    )

    db.session.commit()
    return jsonify(document.to_dict()), 201


@management_bp.route("/contracts/<int:contract_id>/renew", methods=["POST"])
@token_required
@require_resource("contracts")
def renew_contract(current_user, contract_id):
    """Create a new contract version from an eligible contract.
    Atomic: validates against lifecycle, marks the original contract as
    Renewed, creates the new contract with copied fields, line items,
    renewal history, activity log, and a pending notification — all in
    one transaction. Any failure rolls everything back.
    """
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

        # Copy line items from previous contract, or use overrides if provided
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

        # Copy documents from previous contract — reuse physical files (no duplication)
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


@management_bp.route("/contracts/<int:contract_id>/renewal-history", methods=["GET"])
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





@management_bp.route("/products", methods=["GET", "POST"])
@token_required
@require_resource("products")
def products(current_user):
    if request.method == "GET":
        products = Product.query.filter_by(user_id=current_user.id).order_by(Product.name.asc()).all()
        return jsonify([product.to_dict() for product in products]), 200

    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    try:
        rate = parse_decimal(data.get("rate"))
    except ValueError:
        return jsonify({"error": "Invalid rate value"}), 400

    # Generate SKU automatically
    category = data.get("category", "General")
    sku = data.get("sku") or generate_sku(category, current_user.id)
    
    # Check if SKU already exists
    existing_sku = Product.query.filter_by(sku=sku).first()
    if existing_sku:
        return jsonify({"error": f"SKU {sku} already exists"}), 400

    # Check if code already exists (code column is unique)
    code = data.get("code")
    if code:
        existing_code = Product.query.filter_by(code=code).first()
        if existing_code:
            return jsonify({"error": f"Product code {code} already exists"}), 400

    product = Product(
        name=name,
        code=code,
        sku=sku,
        category=category,
        rate=rate,
        price=parse_decimal(data.get("price")) if data.get("price") else None,
        description=data.get("description"),
        status=data.get("status", "active"),
        user_id=current_user.id,
    )
    db.session.add(product)
    try:
        db.session.flush()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Product could not be created. SKU or code may already be in use."}), 400
    log_activity(
        user_id=current_user.id,
        activity_type="product_created",
        title=f"Product created: {product.name}",
        description=f"Product {product.name} (SKU: {product.sku}) was created.",
        entity_type="product",
        entity_id=product.id,
    )
    db.session.commit()
    return jsonify(product.to_dict()), 201


@management_bp.route("/products/<int:product_id>", methods=["GET", "PUT", "DELETE"])
@token_required
@require_resource("products")
def product_detail(current_user, product_id):
    product = get_owned_product(product_id, current_user.id)
    if not product:
        return jsonify({"error": "Product not found"}), 404
    if request.method == "GET":
        return jsonify(product.to_dict()), 200
    if request.method == "PUT":
        data = request.get_json() or {}
        if "name" in data:
            product.name = data["name"].strip()
        if "code" in data:
            product.code = data["code"]
        if "category" in data:
            product.category = data["category"]
        if "rate" in data:
            try:
                product.rate = parse_decimal(data["rate"])
            except ValueError:
                return jsonify({"error": "Invalid rate value"}), 400
        if "price" in data:
            try:
                product.price = parse_decimal(data["price"])
            except ValueError:
                return jsonify({"error": "Invalid price value"}), 400
        if "description" in data:
            product.description = data["description"]
        if "status" in data:
            product.status = data["status"]
        # SKU can only be updated if it doesn't conflict
        if "sku" in data and data["sku"] != product.sku:
            existing_sku = Product.query.filter_by(sku=data["sku"]).first()
            if existing_sku:
                return jsonify({"error": f"SKU {data['sku']} already exists"}), 400
            product.sku = data["sku"]
        product.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify(product.to_dict()), 200
    if request.method == "DELETE":
        # Products referenced by historical ContractLineItem snapshots must
        # never be hard-deleted (that would not touch the snapshot rows
        # themselves, but it would break the product_id FK and destroy the
        # ability to trace a line item back to its catalog product). If the
        # product is still referenced anywhere, soft-deactivate it instead.
        is_referenced = (
            ContractLineItem.query.filter_by(product_id=product.id).count() > 0
        )
        if is_referenced:
            product.status = "inactive"
            product.updated_at = datetime.utcnow()
            db.session.commit()
            return (
                jsonify(
                    {
                        "message": "Product is referenced by existing contract line items and was deactivated instead of deleted.",
                        "deactivated": True,
                        "product": product.to_dict(),
                    }
                ),
                200,
            )
        db.session.delete(product)
        db.session.commit()
        return jsonify({"message": "Product deleted", "deactivated": False}), 200


# ── Customer Portal Management ─────────────────────────────────────────

@management_bp.route("/customers/<int:customer_id>/portal", methods=["GET"])
@token_required
@require_resource("customers")
def customer_portal_status(current_user, customer_id):
    customer = get_owned_customer(customer_id, current_user.id)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404

    portal_user = CustomerPortalUser.query.filter_by(customer_id=customer.id).first()
    return jsonify({
        "portal_enabled": portal_user is not None,
        "portal_email": portal_user.email if portal_user else None,
        "portal_user_id": portal_user.id if portal_user else None,
    }), 200


@management_bp.route("/customers/<int:customer_id>/portal/enable", methods=["POST"])
@token_required
@require_resource("customers")
def customer_portal_enable(current_user, customer_id):
    customer = get_owned_customer(customer_id, current_user.id)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404

    existing = CustomerPortalUser.query.filter_by(customer_id=customer.id).first()
    if existing:
        return jsonify({"error": "Portal access already enabled for this customer"}), 400

    data = request.get_json() or {}
    email = (data.get("email") or customer.email or "").strip().lower()
    password = data.get("password", "").strip()

    if not email:
        return jsonify({"error": "Email is required"}), 400
    if not password or len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    if CustomerPortalUser.query.filter_by(email=email).first():
        return jsonify({"error": "A portal account with this email already exists"}), 400

    portal_user = CustomerPortalUser(
        customer_id=customer.id,
        email=email,
    )
    portal_user.set_password(password)
    db.session.add(portal_user)
    db.session.commit()

    logger.info("Customer portal enabled", context={
        "customer_id": customer.id, "email": email, "user_id": current_user.id,
    })
    return jsonify(portal_user.to_dict()), 201


@management_bp.route("/customers/<int:customer_id>/portal/disable", methods=["POST"])
@token_required
@require_resource("customers")
def customer_portal_disable(current_user, customer_id):
    customer = get_owned_customer(customer_id, current_user.id)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404

    portal_user = CustomerPortalUser.query.filter_by(customer_id=customer.id).first()
    if not portal_user:
        return jsonify({"error": "Portal access not enabled for this customer"}), 400

    db.session.delete(portal_user)
    db.session.commit()

    logger.info("Customer portal disabled", context={
        "customer_id": customer.id, "user_id": current_user.id,
    })
    return jsonify({"success": True}), 200


@management_bp.route("/customers/<int:customer_id>/portal/reset-password", methods=["POST"])
@token_required
@require_resource("customers")
def customer_portal_reset_password(current_user, customer_id):
    customer = get_owned_customer(customer_id, current_user.id)
    if not customer:
        return jsonify({"error": "Customer not found"}), 404

    portal_user = CustomerPortalUser.query.filter_by(customer_id=customer.id).first()
    if not portal_user:
        return jsonify({"error": "Portal access not enabled for this customer"}), 400

    data = request.get_json() or {}
    password = data.get("password", "").strip()
    if not password or len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    portal_user.set_password(password)
    db.session.commit()

    logger.info("Customer portal password reset", context={
        "customer_id": customer.id, "user_id": current_user.id,
    })
    return jsonify({"success": True}), 200
