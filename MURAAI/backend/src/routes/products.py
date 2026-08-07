from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from src.models.contract import ContractLineItem, ContractType, Product, db
from src.routes.activity import log_activity
from src.services.auth import require_resource, token_required
from src.services.logging_config import get_structured_logger

products_bp = Blueprint("products", __name__)
logger = get_structured_logger(__name__)


def parse_decimal(value, fallback="0"):
    try:
        return Decimal(str(value if value is not None else fallback))
    except (InvalidOperation, ValueError):
        raise ValueError("Invalid numeric value")


def get_owned_product(product_id, user_id):
    return Product.query.filter_by(id=product_id, user_id=user_id).first()


def generate_sku(category, user_id=None):
    """Generate a globally unique SKU: SKU-{CATEGORY}-{COMPANY}-{YEAR}-{SEQUENCE}"""
    year = date.today().year
    company_code = "MUR"
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


@products_bp.route("/contract-types", methods=["GET", "POST"])
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


@products_bp.route("/contract-types/<int:contract_type_id>", methods=["GET", "PUT", "DELETE"])
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


@products_bp.route("/products", methods=["GET", "POST"])
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

    category = data.get("category", "General")
    sku = data.get("sku") or generate_sku(category, current_user.id)

    existing_sku = Product.query.filter_by(sku=sku).first()
    if existing_sku:
        return jsonify({"error": f"SKU {sku} already exists"}), 400

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


@products_bp.route("/products/<int:product_id>", methods=["GET", "PUT", "DELETE"])
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
        if "sku" in data and data["sku"] != product.sku:
            existing_sku = Product.query.filter_by(sku=data["sku"]).first()
            if existing_sku:
                return jsonify({"error": f"SKU {data['sku']} already exists"}), 400
            product.sku = data["sku"]
        product.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify(product.to_dict()), 200
    if request.method == "DELETE":
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
