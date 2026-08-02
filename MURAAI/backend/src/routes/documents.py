"""Document management routes.

Provides a complete document lifecycle:
  - Upload (single / multi-file)
  - Download / Preview (inline)
  - Replace (new version)
  - Delete
  - Version history
  - List with search, filter, pagination
  - Scoped to contracts, invoices, purchase orders
"""

import io
import os
import uuid
from datetime import datetime

from flask import Blueprint, jsonify, request, send_file

from src.models.contract import ContractDocument, Notification, db
from src.routes.activity import log_activity
from src.services.auth import token_required, require_resource
from src.services.logging_config import get_structured_logger
from src.services.automation_engine import execute_triggers
from src.services.domain_event import dispatcher
from src.services.storage import (
    LocalStorageProvider,
    generate_stored_filename,
    get_storage_provider,
)

logger = get_structured_logger(__name__)

documents_bp = Blueprint("documents", __name__)

ALLOWED_EXTENSIONS = {
    "pdf", "docx", "doc", "png", "jpg", "jpeg", "xlsx", "csv",
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def _get_document(doc_id, user_id):
    """Get a document owned by the user (via contract, invoice, or PO)."""
    doc = db.session.get(ContractDocument, doc_id)
    if not doc:
        return None

    # Check ownership through the related entity
    from src.models.contract import Contract, Invoice, PurchaseOrder

    if doc.contract_id:
        contract = db.session.get(Contract, doc.contract_id)
        if contract and contract.user_id == user_id:
            return doc
    if doc.invoice_id:
        invoice = db.session.get(Invoice, doc.invoice_id)
        if invoice and invoice.user_id == user_id:
            return doc
    if doc.po_id:
        po = db.session.get(PurchaseOrder, doc.po_id)
        if po and po.user_id == user_id:
            return doc
    # Also check if doc has no entity links but user is admin
    return None


def _query_owned_docs(user_id):
    """Base query for documents the user can access."""
    from src.models.contract import Contract, Invoice, PurchaseOrder

    return ContractDocument.query.outerjoin(
        Contract, Contract.id == ContractDocument.contract_id
    ).outerjoin(
        Invoice, Invoice.id == ContractDocument.invoice_id
    ).outerjoin(
        PurchaseOrder, PurchaseOrder.id == ContractDocument.po_id
    ).filter(
        db.or_(
            Contract.user_id == user_id,
            Invoice.user_id == user_id,
            PurchaseOrder.user_id == user_id,
        )
    )


def _get_contract_entity(entity_type, entity_id, user_id):
    """Get a contract/invoice/PO by type, verifying ownership."""
    from src.models.contract import Contract, Invoice, PurchaseOrder

    model_map = {
        "contract": (Contract, "contract_id"),
        "invoice": (Invoice, "invoice_id"),
        "po": (PurchaseOrder, "po_id"),
    }
    model, _ = model_map.get(entity_type, (None, None))
    if not model:
        return None
    entity = db.session.get(model, entity_id)
    if not entity or entity.user_id != user_id:
        return None
    return entity


def _get_entity_name(entity_type, entity):
    from src.models.contract import Contract, Invoice, PurchaseOrder
    if isinstance(entity, Contract):
        return entity.contract_name
    if isinstance(entity, Invoice):
        return f"Invoice {entity.invoice_number}"
    if isinstance(entity, PurchaseOrder):
        return f"PO {entity.po_number}"
    return str(entity.id)


def _validate_file(uploaded_file):
    """Validate file type and size."""
    if not uploaded_file or not uploaded_file.filename:
        return "file is required"
    ext = uploaded_file.filename.rsplit(".", 1)[-1].lower() if "." in uploaded_file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return f"File type '.{ext}' is not supported. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
    uploaded_file.seek(0, os.SEEK_END)
    size = uploaded_file.tell()
    uploaded_file.seek(0)
    if size > MAX_FILE_SIZE:
        return f"File size exceeds the maximum limit of {MAX_FILE_SIZE // (1024*1024)} MB"
    return None


def _create_document_record(entity_type, entity_id, uploaded_file, stored_name, file_path, user_id,
                             storage_provider="local", storage_reference=None, version_group_id=None,
                             version=1):
    """Create a ContractDocument record."""
    ext = uploaded_file.filename.rsplit(".", 1)[-1].lower() if "." in uploaded_file.filename else ""
    size = 0
    uploaded_file.seek(0, os.SEEK_END)
    size = uploaded_file.tell()
    uploaded_file.seek(0)

    kwargs = {f"{entity_type}_id": entity_id}
    doc = ContractDocument(
        **kwargs,
        file_name=uploaded_file.filename,
        stored_file_name=stored_name,
        file_path=file_path,
        content_type=uploaded_file.content_type,
        file_size=size,
        file_type=ext,
        storage_provider=storage_provider,
        storage_reference=storage_reference,
        version_group_id=version_group_id or str(uuid.uuid4()),
        version=version,
        is_latest_version=True,
        uploaded_by_id=user_id,
    )
    return doc


def _log_doc_activity(user_id, activity_type, title, description, entity_type, entity_id):
    log_activity(
        user_id=user_id,
        activity_type=activity_type,
        title=title,
        description=description,
        entity_type=entity_type,
        entity_id=entity_id,
    )


def _notify_doc_action(entity_type, entity_id, file_name, action):
    """Create a notification for a document action."""
    notif = Notification(
        notification_type="email",
        status="sent",
        message=f"Document '{file_name}' {action}.",
    )
    if entity_type == "contract":
        notif.contract_id = entity_id
    db.session.add(notif)


# ── Generic document listing ──────────────────────────────────────────

@documents_bp.route("/documents", methods=["GET"])
@token_required
@require_resource("documents")
def list_documents(current_user):
    """List all documents accessible to the user with search, filter, pagination."""
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 20, type=int)
    per_page = min(per_page, 100)
    search = request.args.get("search", "").strip()
    file_type = request.args.get("file_type", "").strip()
    category = request.args.get("category", "").strip()
    entity_type = request.args.get("entity_type", "").strip()

    q = _query_owned_docs(current_user.id)

    if search:
        from src.models.contract import Contract, Invoice, PurchaseOrder
        q = q.filter(
            db.or_(
                ContractDocument.file_name.ilike(f"%{search}%"),
                Contract.contract_name.ilike(f"%{search}%"),
                Contract.company_name.ilike(f"%{search}%"),
                Invoice.invoice_number.ilike(f"%{search}%"),
                PurchaseOrder.vendor.ilike(f"%{search}%"),
            )
        )
    if file_type:
        q = q.filter(ContractDocument.file_type == file_type.lower())
    if category:
        q = q.filter(ContractDocument.category == category)
    if entity_type == "contract":
        q = q.filter(ContractDocument.contract_id.isnot(None))
    elif entity_type == "invoice":
        q = q.filter(ContractDocument.invoice_id.isnot(None))
    elif entity_type == "po":
        q = q.filter(ContractDocument.po_id.isnot(None))

    q = q.filter(ContractDocument.is_latest_version != False)

    total = q.count()
    docs = q.order_by(ContractDocument.uploaded_at.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    return jsonify({
        "documents": [d.to_dict() for d in docs],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
    }), 200


# ── Single document ──────────────────────────────────────────────────

@documents_bp.route("/documents/<int:doc_id>", methods=["GET"])
@token_required
@require_resource("documents")
def get_document(current_user, doc_id):
    doc = _get_document(doc_id, current_user.id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404
    return jsonify(doc.to_dict()), 200


# ── Upload ───────────────────────────────────────────────────────────

@documents_bp.route("/documents/upload", methods=["POST"])
@token_required
@require_resource("documents")
def upload_document(current_user):
    """Upload one or more files. Supports entity attachment via query params."""
    entity_type = request.args.get("entity_type", "contract")
    entity_id = request.args.get("entity_id", type=int)
    category = request.form.get("category", "").strip() or None

    if entity_id:
        entity = _get_contract_entity(entity_type, entity_id, current_user.id)
        if not entity:
            return jsonify({"error": f"{entity_type.title()} not found"}), 404

    files = request.files.getlist("file") or [request.files.get("file")]
    files = [f for f in files if f and f.filename]

    if not files:
        return jsonify({"error": "No files provided"}), 400

    results = []
    errors = []

    for uploaded_file in files:
        err = _validate_file(uploaded_file)
        if err:
            errors.append({"file": uploaded_file.filename, "error": err})
            continue

        stored_name = generate_stored_filename(uploaded_file.filename)
        provider = get_storage_provider()
        file_path, storage_ref = provider.save(uploaded_file, stored_name)

        vg_id = str(uuid.uuid4())
        doc = _create_document_record(
            entity_type=entity_type if entity_id else "contract",
            entity_id=entity_id or 0,
            uploaded_file=uploaded_file,
            stored_name=stored_name,
            file_path=file_path,
            user_id=current_user.id,
            storage_provider="onedrive" if storage_ref else "local",
            storage_reference=storage_ref,
            version_group_id=vg_id,
            version=1,
        )
        if entity_type == "contract" and entity_id:
            doc.contract_id = entity_id
        elif entity_type == "invoice" and entity_id:
            doc.invoice_id = entity_id
        elif entity_type == "po" and entity_id:
            doc.po_id = entity_id

        db.session.add(doc)
        db.session.flush()

        dispatcher.dispatch(
            event_type="DocumentUploaded",
            aggregate_type=entity_type,
            aggregate_id=doc.id,
            user_id=current_user.id,
            payload={
                "file_name": doc.file_name,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "content_type": doc.content_type,
            },
        )

        entity_name = _get_entity_name(entity_type, entity) if entity_id else "Unknown"
        _log_doc_activity(
            user_id=current_user.id,
            activity_type="document_uploaded",
            title=f"Document uploaded: {uploaded_file.filename}",
            description=f"Document {uploaded_file.filename} was uploaded for {entity_type} '{entity_name}'.",
            entity_type=entity_type,
            entity_id=entity_id or 0,
        )
        _notify_doc_action(entity_type, entity_id or 0, uploaded_file.filename, "uploaded")
        results.append(doc)

    db.session.commit()

    for doc in results:
        execute_triggers("document_uploaded", {
            "document_id": doc.id,
            "filename": doc.filename,
            "entity_type": doc.entity_type or "",
            "entity_id": doc.entity_id or 0,
            "contract_id": doc.entity_id if doc.entity_type == "contract" else None,
            "file_size": doc.file_size,
        }, current_user.id)

    response = {
        "documents": [d.to_dict() for d in results],
        "errors": errors,
    }
    status = 201 if results else 400
    return jsonify(response), status


# ── Download ─────────────────────────────────────────────────────────

@documents_bp.route("/documents/<int:doc_id>/download", methods=["GET"])
@token_required
@require_resource("documents")
def download_document(current_user, doc_id):
    doc = _get_document(doc_id, current_user.id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404

    provider = get_storage_provider()
    stream = provider.open(doc.file_path)
    if not stream:
        # Try local as fallback
        local = LocalStorageProvider()
        stream = local.open(doc.file_path)
    if not stream:
        return jsonify({"error": "File not found on storage"}), 404

    _log_doc_activity(
        user_id=current_user.id,
        activity_type="document_downloaded",
        title=f"Document downloaded: {doc.file_name}",
        description=f"Document {doc.file_name} was downloaded.",
        entity_type="contract",
        entity_id=doc.contract_id or 0,
    )

    return send_file(
        io.BytesIO(stream.read()) if hasattr(stream, 'read') else stream,
        as_attachment=True,
        download_name=doc.file_name,
        mimetype=doc.content_type or "application/octet-stream",
    )


# ── Preview (inline) ─────────────────────────────────────────────────

@documents_bp.route("/documents/<int:doc_id>/preview", methods=["GET"])
@token_required
@require_resource("documents")
def preview_document(current_user, doc_id):
    doc = _get_document(doc_id, current_user.id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404

    provider = get_storage_provider()
    stream = provider.open(doc.file_path)
    if not stream:
        local = LocalStorageProvider()
        stream = local.open(doc.file_path)
    if not stream:
        return jsonify({"error": "File not found on storage"}), 404

    data = stream.read()
    stream.close()

    _log_doc_activity(
        user_id=current_user.id,
        activity_type="document_viewed",
        title=f"Document viewed: {doc.file_name}",
        description=f"Document {doc.file_name} was previewed.",
        entity_type="contract",
        entity_id=doc.contract_id or 0,
    )

    return send_file(
        io.BytesIO(data),
        mimetype=doc.content_type or "application/octet-stream",
    )


# ── Replace (new version) ───────────────────────────────────────────

@documents_bp.route("/documents/<int:doc_id>/replace", methods=["POST"])
@token_required
@require_resource("documents")
def replace_document(current_user, doc_id):
    doc = _get_document(doc_id, current_user.id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404

    uploaded_file = request.files.get("file")
    err = _validate_file(uploaded_file)
    if err:
        return jsonify({"error": err}), 400

    # Mark current version as not latest
    doc.is_latest_version = False

    stored_name = generate_stored_filename(uploaded_file.filename)
    provider = get_storage_provider()
    file_path, storage_ref = provider.save(uploaded_file, stored_name)

    new_doc = ContractDocument(
        contract_id=doc.contract_id,
        invoice_id=doc.invoice_id,
        po_id=doc.po_id,
        file_name=uploaded_file.filename,
        stored_file_name=stored_name,
        file_path=file_path,
        content_type=uploaded_file.content_type,
        file_size=uploaded_file.content_length or 0,
        file_type=doc.file_type,
        category=doc.category,
        storage_provider="onedrive" if storage_ref else "local",
        storage_reference=storage_ref,
        version_group_id=doc.version_group_id,
        version=(doc.version or 1) + 1,
        is_latest_version=True,
        uploaded_by_id=current_user.id,
    )
    db.session.add(new_doc)
    db.session.flush()

    _log_doc_activity(
        user_id=current_user.id,
        activity_type="document_replaced",
        title=f"Document replaced: {doc.file_name}",
        description=f"Document {doc.file_name} was replaced with version {new_doc.version}.",
        entity_type="contract",
        entity_id=doc.contract_id or 0,
    )
    _notify_doc_action("contract", doc.contract_id or 0, doc.file_name, "replaced")
    dispatcher.dispatch(
        event_type="DocumentReplaced",
        aggregate_type="document",
        aggregate_id=doc_id,
        user_id=current_user.id,
        payload={
            "file_name": doc.file_name,
            "new_file_name": new_doc.file_name,
        },
    )
    db.session.commit()

    return jsonify(new_doc.to_dict()), 200


# ── Delete ───────────────────────────────────────────────────────────

@documents_bp.route("/documents/<int:doc_id>", methods=["DELETE"])
@token_required
@require_resource("documents")
def delete_document(current_user, doc_id):
    doc = _get_document(doc_id, current_user.id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404

    provider = get_storage_provider()
    provider.delete(doc.file_path, doc.storage_reference)

    file_name = doc.file_name
    entity_id = doc.contract_id or doc.invoice_id or doc.po_id
    db.session.delete(doc)

    _log_doc_activity(
        user_id=current_user.id,
        activity_type="document_deleted",
        title=f"Document deleted: {file_name}",
        description=f"Document {file_name} was deleted.",
        entity_type="contract",
        entity_id=entity_id or 0,
    )
    _notify_doc_action("contract", entity_id or 0, file_name, "deleted")
    dispatcher.dispatch(
        event_type="DocumentDeleted",
        aggregate_type="document",
        aggregate_id=doc_id,
        user_id=current_user.id,
        payload={
            "file_name": doc.file_name,
        },
    )
    db.session.commit()

    return jsonify({"message": "Document deleted"}), 200


# ── Version history ─────────────────────────────────────────────────

@documents_bp.route("/documents/<int:doc_id>/versions", methods=["GET"])
@token_required
@require_resource("documents")
def document_versions(current_user, doc_id):
    doc = _get_document(doc_id, current_user.id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404

    versions = ContractDocument.query.filter(
        ContractDocument.version_group_id == doc.version_group_id,
    ).order_by(ContractDocument.version.desc()).all()

    return jsonify([v.to_dict() for v in versions]), 200



