import json
from datetime import datetime
from src.models.user import db


TRIGGER_TYPES = {
    "contract_created": "Contract Created",
    "contract_approved": "Contract Approved",
    "contract_renewed": "Contract Renewed",
    "contract_expired": "Contract Expired",
    "invoice_created": "Invoice Created",
    "invoice_paid": "Invoice Paid",
    "invoice_overdue": "Invoice Overdue",
    "purchase_order_created": "Purchase Order Created",
    "document_uploaded": "Document Uploaded",
    "approval_completed": "Approval Completed",
    "reminder_due": "Reminder Due",
}

ACTION_TYPES = {
    "send_email": "Send Email",
    "create_notification": "Create Notification",
    "create_calendar_event": "Create Calendar Event",
    "assign_task": "Assign Task",
    "generate_renewal": "Generate Renewal",
    "generate_invoice": "Generate Invoice",
    "generate_purchase_order": "Generate Purchase Order",
    "call_webhook": "Call Webhook",
    "log_activity": "Log Activity",
}


class AutomationRule(db.Model):
    __tablename__ = "automation_rule"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    trigger_type = db.Column(db.String(50), nullable=False)
    trigger_config = db.Column(db.Text, nullable=True)
    conditions = db.Column(db.Text, nullable=True)
    actions = db.Column(db.Text, nullable=False)
    is_enabled = db.Column(db.Boolean, default=True)
    last_run_at = db.Column(db.DateTime, nullable=True)
    last_error = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "trigger_type": self.trigger_type,
            "trigger_type_label": TRIGGER_TYPES.get(self.trigger_type, self.trigger_type),
            "trigger_config": json.loads(self.trigger_config) if self.trigger_config else {},
            "conditions": json.loads(self.conditions) if self.conditions else [],
            "actions": json.loads(self.actions) if self.actions else [],
            "is_enabled": self.is_enabled,
            "last_run_at": self.last_run_at.isoformat() if self.last_run_at else None,
            "last_error": self.last_error,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
