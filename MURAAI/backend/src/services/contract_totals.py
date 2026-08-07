from decimal import Decimal, InvalidOperation
from src.models.contract import ContractLineItem, Product


def parse_decimal(value, fallback="0"):
    try:
        return Decimal(str(value if value is not None else fallback))
    except (InvalidOperation, ValueError):
        raise ValueError("Invalid numeric value")


def recalculate_contract_total(contract):
    """Calculate and set total_contract_value on contract from line items.

    Returns the computed total Decimal value.
    """
    total = sum(
        (line_item.line_total or Decimal("0"))
        for line_item in ContractLineItem.query.filter_by(contract_id=contract.id).all()
    )
    contract.total_contract_value = total
    return total


def create_contract_line_item(contract_id, payload, user_id=None):
    """Build a ContractLineItem from a payload.

    Snapshots sku/product_name/rate at creation time so historical contracts
    never depend on current Product record. Validates product_name before
    constructing the ContractLineItem object.
    """
    product_id = payload.get("product_id") or None
    sku = None
    product_name = (payload.get("product_name") or "").strip()

    if product_id:
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
    line_item.calculate_amount()
    return line_item
