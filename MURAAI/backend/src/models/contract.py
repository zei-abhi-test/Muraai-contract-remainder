import os
from datetime import date, datetime, timedelta
from decimal import Decimal
from src.models.user import db


REMINDER_DAYS = [30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2, 0]




def decimal_to_float(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return value


class ContractType(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), default="active")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    customer_code = db.Column(db.String(80), nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    address = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    # Soft delete fields
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    deleted_at = db.Column(db.DateTime, nullable=True)
    deleted_by_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "customer_code": self.customer_code,
            "phone": self.phone,
            "email": self.email,
            "address": self.address,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "user_id": self.user_id,
            "is_deleted": self.is_deleted,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None,
            "deleted_by_id": self.deleted_by_id,
        }


class ContactPerson(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customer.id"), nullable=False, index=True)
    contact_name = db.Column(db.String(200), nullable=False)
    contact_number = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(120), nullable=True)
    designation = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "customer_id": self.customer_id,
            "contact_name": self.contact_name,
            "contact_number": self.contact_number,
            "email": self.email,
            "designation": self.designation,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "user_id": self.user_id,
        }


class Contract(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(200), nullable=False)
    contract_name = db.Column(db.String(200), nullable=False)
    start_date = db.Column(db.Date, nullable=False, index=True)
    end_date = db.Column(db.Date, nullable=False, index=True)
    renewal_date = db.Column(db.Date, nullable=False, index=True)
    notification_enabled = db.Column(db.Boolean, default=True)
    notification_email = db.Column(db.String(120), nullable=True)
    notification_mobile = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text, nullable=True)
    contract_number = db.Column(db.String(80), unique=True, nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customer.id"), nullable=True, index=True)
    contact_person_id = db.Column(
        db.Integer,
        db.ForeignKey("contact_person.id"),
        nullable=True,
    )
    contract_type_id = db.Column(db.Integer, db.ForeignKey("contract_type.id"), nullable=True, index=True)
    contract_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(50), default="Active", index=True)
    currency = db.Column(db.String(10), default="INR")
    payment_terms = db.Column(db.Text, nullable=True)
    remarks = db.Column(db.Text, nullable=True)
    total_contract_value = db.Column(db.Numeric(14, 2), default=0)
    contract_version = db.Column(db.Integer, default=1)
    parent_contract_id = db.Column(db.Integer, db.ForeignKey("contract.id"), nullable=True, index=True)
    previous_contract_id = db.Column(db.Integer, db.ForeignKey("contract.id"), nullable=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    last_modified_by_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Soft delete columns
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    deleted_at = db.Column(db.DateTime, nullable=True)
    deleted_by_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    deletion_reason = db.Column(db.String(500), nullable=True)

    # Lifecycle metadata (v2 state machine)
    activated_at = db.Column(db.DateTime, nullable=True)
    activated_by_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    activated_notes = db.Column(db.String(500), nullable=True)
    terminated_at = db.Column(db.DateTime, nullable=True)
    terminated_by_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    termination_reason = db.Column(db.String(100), nullable=True)
    archived_at = db.Column(db.DateTime, nullable=True)
    archived_by_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    retention_until = db.Column(db.Date, nullable=True)

    # Foreign key to link contracts to users
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)

    def __repr__(self):
        return f"<Contract {self.contract_name} for {self.company_name}>"

    def days_until_end(self, today=None):
        today = today or date.today()
        return (self.end_date - today).days if self.end_date else None

    def health_status(self, today=None):
        days_until_end = self.days_until_end(today)
        if days_until_end is None:
            return None
        if days_until_end < 0:
            return "Expired"
        if days_until_end <= 7:
            return "Critical"
        if days_until_end <= 30:
            return "Warning"
        return "Healthy"

    def next_reminder_date(self, today=None):
        today = today or date.today()
        days_until_end = self.days_until_end(today)
        if days_until_end is None or days_until_end < 0:
            return None
        if days_until_end > 30:
            return (self.end_date - timedelta(days=30)).isoformat()

        next_reminder_day = next(
            (
                reminder_day
                for reminder_day in REMINDER_DAYS
                if reminder_day <= days_until_end
            ),
            None,
        )
        if next_reminder_day is None:
            return None
        return (self.end_date - timedelta(days=next_reminder_day)).isoformat()

    def to_dict(self):
        days_until_end = self.days_until_end()
        return {
            "id": self.id,
            "company_name": self.company_name,
            "contract_name": self.contract_name,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "renewal_date": (
                self.renewal_date.isoformat() if self.renewal_date else None
            ),
            "notification_enabled": self.notification_enabled,
            "notification_email": self.notification_email,
            "notification_mobile": self.notification_mobile,
            "notes": self.notes,
            "contract_number": self.contract_number,
            "customer_id": self.customer_id,
            "contact_person_id": self.contact_person_id,
            "contract_type_id": self.contract_type_id,
            "contract_date": self.contract_date.isoformat() if self.contract_date else None,
            "status": self.status,
            "currency": self.currency,
            "payment_terms": self.payment_terms,
            "remarks": self.remarks,
            "total_contract_value": decimal_to_float(self.total_contract_value),
            "contract_version": self.contract_version,
            "parent_contract_id": self.parent_contract_id,
            "previous_contract_id": self.previous_contract_id,
            "created_by_id": self.created_by_id,
            "last_modified_by_id": self.last_modified_by_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "user_id": self.user_id,
            "days_until_end": days_until_end,
            "health_status": self.health_status(),
            "next_reminder_date": self.next_reminder_date(),
            "is_deleted": self.is_deleted,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None,
            "deleted_by_id": self.deleted_by_id,
            "deletion_reason": self.deletion_reason,
            "activated_at": self.activated_at.isoformat() if self.activated_at else None,
            "activated_by_id": self.activated_by_id,
            "terminated_at": self.terminated_at.isoformat() if self.terminated_at else None,
            "terminated_by_id": self.terminated_by_id,
            "termination_reason": self.termination_reason,
            "archived_at": self.archived_at.isoformat() if self.archived_at else None,
            "archived_by_id": self.archived_by_id,
            "retention_until": self.retention_until.isoformat() if self.retention_until else None,
        }




class ContractLineItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    contract_id = db.Column(db.Integer, db.ForeignKey("contract.id"), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey("product.id"), nullable=True, index=True)
    sku = db.Column(db.String(100), nullable=True)
    product_name = db.Column(db.String(200), nullable=False)
    quantity = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    rate = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    discount = db.Column(db.Numeric(5, 2), nullable=False, default=0)
    tax = db.Column(db.Numeric(5, 2), nullable=False, default=0)
    amount = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    line_total = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    remarks = db.Column(db.Text, nullable=True)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    contract = db.relationship("Contract", backref="line_items")

    def calculate_amount(self):
        """
        Calculate line item totals with discount and tax.
        
        Formula:
        base_amount = quantity × rate
        discount_amount = base_amount × discount / 100
        taxable_amount = base_amount - discount_amount
        tax_amount = taxable_amount × tax / 100
        line_total = taxable_amount + tax_amount
        """
        base_amount = (self.quantity or Decimal("0")) * (self.rate or Decimal("0"))
        discount_amount = base_amount * (self.discount or Decimal("0")) / Decimal("100")
        taxable_amount = base_amount - discount_amount
        tax_amount = taxable_amount * (self.tax or Decimal("0")) / Decimal("100")
        
        self.amount = base_amount
        self.line_total = taxable_amount + tax_amount
        return self.line_total

    def to_dict(self):
        return {
            "id": self.id,
            "contract_id": self.contract_id,
            "product_id": self.product_id,
            "sku": self.sku,
            "product_name": self.product_name,
            "quantity": decimal_to_float(self.quantity),
            "rate": decimal_to_float(self.rate),
            "discount": decimal_to_float(self.discount),
            "tax": decimal_to_float(self.tax),
            "amount": decimal_to_float(self.amount),
            "line_total": decimal_to_float(self.line_total),
            "remarks": self.remarks,
            "is_deleted": self.is_deleted,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ContractDocument(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    contract_id = db.Column(db.Integer, db.ForeignKey("contract.id"), nullable=True, index=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey("invoice.id"), nullable=True)
    po_id = db.Column(db.Integer, db.ForeignKey("purchase_order.id"), nullable=True)
    file_name = db.Column(db.String(255), nullable=False)
    stored_file_name = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    content_type = db.Column(db.String(120), nullable=True)
    file_size = db.Column(db.BigInteger, nullable=True, default=0)
    file_type = db.Column(db.String(20), nullable=True)
    category = db.Column(db.String(100), nullable=True)
    storage_provider = db.Column(db.String(50), nullable=True, default="local")
    storage_reference = db.Column(db.String(500), nullable=True)
    version_group_id = db.Column(db.String(36), nullable=True)
    version = db.Column(db.Integer, nullable=True, default=1)
    is_latest_version = db.Column(db.Boolean, nullable=True, default=True)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    uploaded_by_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    contract = db.relationship("Contract", backref="documents", lazy="joined")
    uploader = db.relationship("User", foreign_keys=[uploaded_by_id], lazy="joined")

    def to_dict(self):
        size = self.file_size
        if size is None:
            try:
                if self.file_path and os.path.exists(self.file_path):
                    size = os.path.getsize(self.file_path)
            except Exception:
                pass
        return {
            "id": self.id,
            "contract_id": self.contract_id,
            "invoice_id": self.invoice_id,
            "po_id": self.po_id,
            "file_name": self.file_name,
            "stored_file_name": self.stored_file_name,
            "content_type": self.content_type,
            "file_size": size,
            "file_type": self.file_type or (self.file_name.rsplit(".", 1)[-1].lower() if "." in self.file_name else None),
            "category": self.category,
            "storage_provider": self.storage_provider,
            "storage_reference": self.storage_reference,
            "version_group_id": self.version_group_id,
            "version": self.version or 1,
            "is_latest_version": self.is_latest_version if self.is_latest_version is not None else True,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "uploaded_by_id": self.uploaded_by_id,
            "uploaded_by_name": self.uploader.name if self.uploader else None,
            "is_deleted": self.is_deleted,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ContractClause(db.Model):
    __tablename__ = "contract_clause"

    id = db.Column(db.Integer, primary_key=True)
    contract_id = db.Column(db.Integer, db.ForeignKey("contract.id"), nullable=False)
    clause_type = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    version = db.Column(db.Integer, nullable=False, default=1)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    contract = db.relationship("Contract", backref="clauses")

    def to_dict(self):
        return {
            "id": self.id,
            "contract_id": self.contract_id,
            "clause_type": self.clause_type,
            "title": self.title,
            "content": self.content,
            "version": self.version,
            "is_active": self.is_active,
            "is_deleted": self.is_deleted,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ContractVersionHistory(db.Model):
    __tablename__ = "contract_version_history"

    id = db.Column(db.Integer, primary_key=True)
    contract_id = db.Column(db.Integer, db.ForeignKey("contract.id"), nullable=False)
    version_number = db.Column(db.Integer, nullable=False)
    previous_version = db.Column(db.Integer, nullable=True)
    changed_by_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    change_reason = db.Column(db.String(500), nullable=True)
    changes_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    contract = db.relationship("Contract", backref="version_history")

    def to_dict(self):
        return {
            "id": self.id,
            "contract_id": self.contract_id,
            "version_number": self.version_number,
            "previous_version": self.previous_version,
            "changed_by_id": self.changed_by_id,
            "change_reason": self.change_reason,
            "changes_json": self.changes_json,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ContractEventLog(db.Model):
    __tablename__ = "contract_event_log"

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.String(36), unique=True, nullable=False)
    event_type = db.Column(db.String(100), nullable=False)
    aggregate_type = db.Column(db.String(50), nullable=False)
    aggregate_id = db.Column(db.Integer, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    correlation_id = db.Column(db.String(36), nullable=True)
    version = db.Column(db.Integer, nullable=False, default=1)
    payload_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", foreign_keys=[user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "event_id": self.event_id,
            "event_type": self.event_type,
            "aggregate_type": self.aggregate_type,
            "aggregate_id": self.aggregate_id,
            "user_id": self.user_id,
            "correlation_id": self.correlation_id,
            "version": self.version,
            "payload_json": self.payload_json,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ContractRenewal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    original_contract_id = db.Column(db.Integer, db.ForeignKey("contract.id"), nullable=False)
    parent_contract_id = db.Column(db.Integer, db.ForeignKey("contract.id"), nullable=False)
    previous_contract_id = db.Column(db.Integer, db.ForeignKey("contract.id"), nullable=False)
    new_contract_id = db.Column(db.Integer, db.ForeignKey("contract.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "original_contract_id": self.original_contract_id,
            "parent_contract_id": self.parent_contract_id,
            "previous_contract_id": self.previous_contract_id,
            "new_contract_id": self.new_contract_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "created_by_id": self.created_by_id,
        }

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    contract_id = db.Column(db.Integer, db.ForeignKey("contract.id"), nullable=False, index=True)
    notification_type = db.Column(db.String(50), nullable=False)  # 'email' or 'mobile'
    send_date = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    status = db.Column(db.String(50), default="pending", index=True)  # 'sent', 'failed', 'pending'
    message = db.Column(db.Text, nullable=True)

    def __repr__(self):
        return (
            f"<Notification {self.notification_type} for Contract {self.contract_id}>"
        )

    def to_dict(self):
        return {
            "id": self.id,
            "contract_id": self.contract_id,
            "notification_type": self.notification_type,
            "send_date": self.send_date.isoformat() if self.send_date else None,
            "status": self.status,
            "message": self.message,
        }


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    code = db.Column(db.String(80), nullable=True, unique=True)
    sku = db.Column(db.String(100), nullable=False, unique=True)
    category = db.Column(db.String(100), nullable=True)
    rate = db.Column(db.Numeric(10, 2), nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=True)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), default="active")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "sku": self.sku,
            "category": self.category,
            "rate": decimal_to_float(self.rate),
            "price": decimal_to_float(self.price),
            "description": self.description,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "user_id": self.user_id,
        }


class ContractApproval(db.Model):
    """Approval record for a contract submitted for approval.

    A contract can accumulate multiple approval records over time (e.g. one
    per submission attempt after a rejection + resubmission), but only the
    most recent one is "active" for the contract's current lifecycle state.
    """

    id = db.Column(db.Integer, primary_key=True)
    contract_id = db.Column(db.Integer, db.ForeignKey("contract.id"), nullable=False, index=True)
    approver_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True, index=True)
    requested_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True, index=True)
    status = db.Column(db.String(50), nullable=False, default="Pending", index=True)
    comments = db.Column(db.Text, nullable=True)
    approval_level = db.Column(db.Integer, nullable=True, default=1)
    workflow_assignment_id = db.Column(db.Integer, db.ForeignKey("workflow_assignment.id"), nullable=True)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    approved_at = db.Column(db.DateTime, nullable=True)
    rejected_at = db.Column(db.DateTime, nullable=True)
    cancelled_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    contract = db.relationship("Contract", backref="approvals", lazy="joined")
    requester = db.relationship("User", foreign_keys=[requested_by], lazy="joined")
    approver = db.relationship("User", foreign_keys=[approver_id], lazy="joined")

    def to_dict(self):
        return {
            "id": self.id,
            "contract_id": self.contract_id,
            "approver_id": self.approver_id,
            "approver_name": self.approver.name if self.approver else None,
            "requested_by": self.requested_by,
            "requester_name": self.requester.name if self.requester else None,
            "status": self.status,
            "comments": self.comments,
            "approval_level": self.approval_level,
            "workflow_assignment_id": self.workflow_assignment_id,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "rejected_at": self.rejected_at.isoformat() if self.rejected_at else None,
            "cancelled_at": self.cancelled_at.isoformat() if self.cancelled_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class PurchaseOrder(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    po_number = db.Column(db.String(80), nullable=False, unique=True)
    po_date = db.Column(db.Date, nullable=False, default=date.today, index=True)
    vendor = db.Column(db.String(200), nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey("customer.id"), nullable=True, index=True)
    amount = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    status = db.Column(db.String(50), nullable=False, default="Draft", index=True)
    issue_date = db.Column(db.Date, nullable=True)
    expected_delivery = db.Column(db.Date, nullable=True)
    currency = db.Column(db.String(10), nullable=True, default="INR")
    remarks = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)

    def to_dict(self, contract_ids=None):
        return {
            "id": self.id,
            "po_number": self.po_number,
            "po_date": self.po_date.isoformat() if self.po_date else None,
            "vendor": self.vendor,
            "customer_id": self.customer_id,
            "amount": decimal_to_float(self.amount),
            "status": self.status,
            "issue_date": self.issue_date.isoformat() if self.issue_date else None,
            "expected_delivery": self.expected_delivery.isoformat() if self.expected_delivery else None,
            "currency": self.currency,
            "remarks": self.remarks,
            "contract_ids": contract_ids or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "user_id": self.user_id,
        }


class PurchaseOrderContract(db.Model):
    """Association table: a PurchaseOrder may link to many Contracts."""

    __tablename__ = "purchase_order_contract"

    id = db.Column(db.Integer, primary_key=True)
    purchase_order_id = db.Column(db.Integer, db.ForeignKey("purchase_order.id"), nullable=False)
    contract_id = db.Column(db.Integer, db.ForeignKey("contract.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("purchase_order_id", "contract_id", name="uq_po_contract"),
    )


class Invoice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(80), nullable=False, unique=True)
    contract_id = db.Column(db.Integer, db.ForeignKey("contract.id"), nullable=True, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customer.id"), nullable=True, index=True)
    purchase_order_id = db.Column(db.Integer, db.ForeignKey("purchase_order.id"), nullable=True)
    amount = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    tax = db.Column(db.Numeric(14, 2), nullable=True, default=Decimal("0"))
    discount = db.Column(db.Numeric(14, 2), nullable=True, default=Decimal("0"))
    total = db.Column(db.Numeric(14, 2), nullable=True, default=Decimal("0"))
    currency = db.Column(db.String(10), nullable=True, default="INR")
    invoice_date = db.Column(db.Date, nullable=False, default=date.today)
    due_date = db.Column(db.Date, nullable=True, index=True)
    paid_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(50), nullable=False, default="DRAFT", index=True)
    remarks = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)

    def effective_status(self, today=None):
        """OVERDUE is derived from due_date, not stored as a separate fake value."""
        today = today or date.today()
        if self.status in ("PAID", "CANCELLED"):
            return self.status
        if self.due_date and self.due_date < today and self.status != "PAID":
            return "OVERDUE"
        return self.status

    def to_dict(self, line_items=None):
        return {
            "id": self.id,
            "invoice_number": self.invoice_number,
            "contract_id": self.contract_id,
            "customer_id": self.customer_id,
            "purchase_order_id": self.purchase_order_id,
            "amount": decimal_to_float(self.amount),
            "tax": decimal_to_float(self.tax),
            "discount": decimal_to_float(self.discount),
            "total": decimal_to_float(self.total),
            "currency": self.currency,
            "invoice_date": self.invoice_date.isoformat() if self.invoice_date else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "paid_date": self.paid_date.isoformat() if self.paid_date else None,
            "status": self.effective_status(),
            "remarks": self.remarks,
            "created_by": self.created_by,
            "line_items": line_items or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "user_id": self.user_id,
        }


class InvoiceLineItem(db.Model):
    __tablename__ = "invoice_line_item"

    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey("invoice.id"), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey("product.id"), nullable=True)
    product_name = db.Column(db.String(200), nullable=False)
    sku = db.Column(db.String(80), nullable=True)
    quantity = db.Column(db.Numeric(14, 2), nullable=False, default=1)
    rate = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    discount = db.Column(db.Numeric(14, 2), nullable=True, default=Decimal("0"))
    tax = db.Column(db.Numeric(14, 2), nullable=True, default=Decimal("0"))
    amount = db.Column(db.Numeric(14, 2), nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "invoice_id": self.invoice_id,
            "product_id": self.product_id,
            "product_name": self.product_name,
            "sku": self.sku,
            "quantity": decimal_to_float(self.quantity),
            "rate": decimal_to_float(self.rate),
            "discount": decimal_to_float(self.discount),
            "tax": decimal_to_float(self.tax),
            "amount": decimal_to_float(self.amount),
        }


class ActivityLog(db.Model):
    """In-app activity and notification feed.

    One record per event. Serves both the bell dropdown (unread in-app
    notifications) and the per-contract Activity tab.  No separate audit-log
    model is needed — every user-facing event is recorded here.
    """

    __tablename__ = "activity_log"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    contract_id = db.Column(db.Integer, db.ForeignKey("contract.id"), nullable=True, index=True)
    activity_type = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    entity_type = db.Column(db.String(50), nullable=True)  # contract, invoice, approval, purchase_order
    entity_id = db.Column(db.Integer, nullable=True)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "contract_id": self.contract_id,
            "activity_type": self.activity_type,
            "title": self.title,
            "description": self.description,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SkuCounter(db.Model):
    """Global, transaction-safe sequence counter per SKU prefix.

    Product.sku is globally unique, so the sequence suffix must also be
    generated globally (not per-user) to avoid collisions between different
    users' products that share the same category/company/year prefix.
    """

    __tablename__ = "sku_counter"

    prefix = db.Column(db.String(100), primary_key=True)
    next_value = db.Column(db.Integer, nullable=False, default=1)
