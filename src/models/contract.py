from datetime import datetime
from src.models.user import db


class Contract(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_name = db.Column(db.String(200), nullable=False)
    contract_name = db.Column(db.String(200), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    renewal_date = db.Column(db.Date, nullable=False)
    notification_enabled = db.Column(db.Boolean, default=True)
    notification_email = db.Column(db.String(120), nullable=True)
    notification_mobile = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Foreign key to link contracts to users
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

    def __repr__(self):
        return f"<Contract {self.contract_name} for {self.company_name}>"

    def to_dict(self):
        return {
            "id": self.id,
            "company_name": self.company_name,
            "contract_name": self.contract_name,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "renewal_date": self.renewal_date.isoformat() if self.renewal_date else None,
            "notification_enabled": self.notification_enabled,
            "notification_email": self.notification_email,
            "notification_mobile": self.notification_mobile,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "user_id": self.user_id,
        }


class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    contract_id = db.Column(db.Integer, db.ForeignKey("contract.id"), nullable=False)
    notification_type = db.Column(db.String(50), nullable=False)  # 'email' or 'mobile'
    send_date = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(50), default="pending")  # 'sent', 'failed', 'pending'
    message = db.Column(db.Text, nullable=True)

    def __repr__(self):
        return f"<Notification {self.notification_type} for Contract {self.contract_id}>"

    def to_dict(self):
        return {
            "id": self.id,
            "contract_id": self.contract_id,
            "notification_type": self.notification_type,
            "send_date": self.send_date.isoformat() if self.send_date else None,
            "status": self.status,
            "message": self.message,
        }
