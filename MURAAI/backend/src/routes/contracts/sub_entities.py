import os
import uuid
from datetime import datetime

from flask import Blueprint, jsonify, request

from src.models.contract import ContractDocument, ContractLineItem, db
from src.routes.activity import log_activity
from src.routes.contracts.crud import get_owned_contract
from src.services.auth import require_resource, token_required
from src.services.contract_totals import (
    create_contract_line_item,
    recalculate_contract_total,
)
from src.services.logging_config import get_structured_logger

contract_sub_entities_bp = Blueprint("contract_sub_entities", __name__)
logger = get_structured_logger(__name__)


@contract_sub_entities_bp.route("/contracts/<int:contract_id>/line-items", methods=["GET", "POST"])
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


@contract_sub_entities_bp.route("/contracts/<int:contract_id>/documents", methods=["GET", "POST"])
@token_required
@require_resource("contracts")
def contract_documents(current_user, contract_id):
    from src.services.storage import generate_stored_filename, get_storage_provider

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
