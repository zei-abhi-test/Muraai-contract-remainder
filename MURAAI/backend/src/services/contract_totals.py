from decimal import Decimal
from src.models.contract import ContractLineItem


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
