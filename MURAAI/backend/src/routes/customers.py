from datetime import datetime

from flask import Blueprint, jsonify, request

from src.models.contract import (
    ContactPerson,
    Contract,
    Customer,
    Invoice,
    PurchaseOrder,
    db,
)
from src.routes.activity import log_activity
from src.services.auth import require_resource, token_required
from src.services.domain_event import dispatcher
from src.services.logging_config import get_structured_logger

customers_bp = Blueprint("customers", __name__)
logger = get_structured_logger(__name__)


def get_owned_customer(customer_id, user_id):
    return Customer.query.filter_by(id=customer_id, user_id=user_id).first()


def get_owned_contact(contact_id, user_id):
    return ContactPerson.query.filter_by(id=contact_id, user_id=user_id).first()


def describe_customer_dependencies(customer_id, user_id):
    """Return a list of entity types still referencing a customer.
    Returns empty list if safe to delete."""
    dependencies = []
    if ContactPerson.query.filter_by(customer_id=customer_id, user_id=user_id).count():
        dependencies.append("contacts")
    if Contract.query.filter_by(customer_id=customer_id, user_id=user_id).count():
        dependencies.append("contracts")
    if PurchaseOrder.query.filter_by(customer_id=customer_id, user_id=user_id).count():
        dependencies.append("purchase_orders")
    if Invoice.query.filter_by(customer_id=customer_id, user_id=user_id).count():
        dependencies.append("invoices")
    return dependencies


def describe_contact_dependencies(contact_id, user_id):
    if Contract.query.filter_by(contact_person_id=contact_id, user_id=user_id).count():
        return "contracts"
    return None


@customers_bp.route("/customers", methods=["GET"])
@token_required
@require_resource("customers")
def list_customers(current_user):
    customers = Customer.query.filter_by(user_id=current_user.id, is_deleted=False).order_by(Customer.name.asc()).all()
    return jsonify([customer.to_dict() for customer in customers]), 200


@customers_bp.route("/customers", methods=["POST"])
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


@customers_bp.route("/customers/<int:customer_id>", methods=["GET", "PUT", "DELETE"])
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

    dependencies = describe_customer_dependencies(customer.id, current_user.id)
    if dependencies:
        return (
            jsonify(
                {
                    "success": False,
                    "error": {
                        "code": "CUSTOMER_HAS_DEPENDENCIES",
                        "message": "Customer cannot be archived because it is referenced by existing entities.",
                        "dependencies": dependencies,
                    },
                }
            ),
            409,
        )
    # Perform soft archive
    from datetime import datetime
    customer.is_deleted = True
    customer.deleted_at = datetime.utcnow()
    customer.deleted_by_id = current_user.id
    db.session.commit()
    # Log activity
    log_activity(
        user_id=current_user.id,
        activity_type="customer_archived",
        title=f"Customer archived: {customer.name}",
        description=f"Customer {customer.name} was archived.",
        entity_type="customer",
        entity_id=customer.id,
    )
    # Dispatch domain event
    dispatcher.dispatch(
        event_type="CustomerArchived",
        aggregate_type="customer",
        aggregate_id=customer.id,
        user_id=current_user.id,
        payload={"name": customer.name},
    )
    return jsonify({"message": "Customer archived"}), 200


@customers_bp.route("/customers/<int:customer_id>/contacts", methods=["GET", "POST"])
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


@customers_bp.route("/contacts", methods=["GET"])
@token_required
@require_resource("contacts")
def list_contacts(current_user):
    query = ContactPerson.query.filter_by(user_id=current_user.id)
    customer_id = request.args.get("customer_id", type=int)
    if customer_id:
        query = query.filter(ContactPerson.customer_id == customer_id)
    contacts = query.order_by(ContactPerson.contact_name.asc()).all()
    return jsonify([contact.to_dict() for contact in contacts]), 200


@customers_bp.route("/contacts/<int:contact_id>", methods=["GET", "PUT", "DELETE"])
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
