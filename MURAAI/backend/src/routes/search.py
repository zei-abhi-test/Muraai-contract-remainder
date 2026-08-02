from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from src.models.contract import (
    Contract, Customer, ContactPerson, Product, PurchaseOrder,
    Invoice, ContractDocument,
)
from src.services.auth import token_required

search_bp = Blueprint('search', __name__)


@search_bp.route('/search', methods=['GET'])
@token_required
def global_search(current_user):
    q = request.args.get('q', '').strip()
    if len(q) < 2:
        return jsonify([]), 200

    term = f'%{q}%'
    limit = int(request.args.get('limit', 20))
    results = []

    # ── 1. Contracts ──────────────────────────────────────────────
    contracts = Contract.query.filter(
        Contract.user_id == current_user.id,
        or_(
            Contract.contract_name.ilike(term),
            Contract.contract_number.ilike(term),
            Contract.company_name.ilike(term),
        )
    ).limit(limit).all()
    for c in contracts:
        results.append({
            'id': f'contract-{c.id}',
            'type': 'contract',
            'title': c.contract_name,
            'subtitle': f'{c.company_name} - {c.status}',
            'entity_id': c.id,
            'entity_type': 'contract',
        })

    # ── 2. Customers ──────────────────────────────────────────────
    remaining = limit - len(results)
    if remaining > 0:
        customers = Customer.query.filter(
            Customer.user_id == current_user.id,
            or_(
                Customer.name.ilike(term),
                Customer.customer_code.ilike(term),
                Customer.email.ilike(term),
            )
        ).limit(remaining).all()
        for c in customers:
            results.append({
                'id': f'customer-{c.id}',
                'type': 'customer',
                'title': c.name,
                'subtitle': c.customer_code or c.email or '',
                'entity_id': c.id,
                'entity_type': 'customer',
            })

    # ── 3. Contacts (ContactPerson) ───────────────────────────────
    remaining = limit - len(results)
    if remaining > 0:
        contacts = ContactPerson.query.filter(
            ContactPerson.user_id == current_user.id,
            or_(
                ContactPerson.contact_name.ilike(term),
                ContactPerson.email.ilike(term),
            )
        ).limit(remaining).all()
        for c in contacts:
            results.append({
                'id': f'contact-{c.id}',
                'type': 'contact',
                'title': c.contact_name,
                'subtitle': c.email or '',
                'entity_id': c.id,
                'entity_type': 'contact',
            })

    # ── 4. Products ───────────────────────────────────────────────
    remaining = limit - len(results)
    if remaining > 0:
        products = Product.query.filter(
            Product.user_id == current_user.id,
            or_(
                Product.name.ilike(term),
                Product.sku.ilike(term),
                Product.code.ilike(term),
            )
        ).limit(remaining).all()
        for p in products:
            results.append({
                'id': f'product-{p.id}',
                'type': 'product',
                'title': p.name,
                'subtitle': p.sku or '',
                'entity_id': p.id,
                'entity_type': 'product',
            })

    # ── 5. Invoices ───────────────────────────────────────────────
    remaining = limit - len(results)
    if remaining > 0:
        invoices = Invoice.query.filter(
            Invoice.user_id == current_user.id,
            Invoice.invoice_number.ilike(term),
        ).limit(remaining).all()
        for inv in invoices:
            results.append({
                'id': f'invoice-{inv.id}',
                'type': 'invoice',
                'title': inv.invoice_number,
                'subtitle': f'{inv.effective_status()} - ${float(inv.amount or 0):.2f}',
                'entity_id': inv.id,
                'entity_type': 'invoice',
            })

    # ── 6. Purchase Orders ────────────────────────────────────────
    remaining = limit - len(results)
    if remaining > 0:
        pos = PurchaseOrder.query.filter(
            PurchaseOrder.user_id == current_user.id,
            PurchaseOrder.po_number.ilike(term),
        ).limit(remaining).all()
        for po in pos:
            results.append({
                'id': f'po-{po.id}',
                'type': 'po',
                'title': po.po_number,
                'subtitle': f'{po.vendor or ""} - {po.status or ""}',
                'entity_id': po.id,
                'entity_type': 'purchase_order',
            })

    # ── 7. Documents (ContractDocument) ────────────────────────────
    remaining = limit - len(results)
    if remaining > 0:
        docs = ContractDocument.query.join(
            Contract, ContractDocument.contract_id == Contract.id
        ).filter(
            Contract.user_id == current_user.id,
            ContractDocument.file_name.ilike(term),
        ).limit(remaining).all()
        for d in docs:
            contract = Contract.query.get(d.contract_id)
            results.append({
                'id': f'document-{d.id}',
                'type': 'document',
                'title': d.file_name,
                'subtitle': f'Contract: {contract.contract_name if contract else "N/A"}',
                'entity_id': d.id,
                'entity_type': 'document',
            })

    return jsonify(results), 200
