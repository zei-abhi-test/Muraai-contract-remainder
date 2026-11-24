from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import bcrypt
import json

db = SQLAlchemy()


class User(db.Model):
    """User model for authentication and contract management."""

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(200), nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    department = db.Column(db.String(100), nullable=True)
    avatar_url = db.Column(db.String(500), nullable=True)
    role = db.Column(db.String(30), default="VIEWER")
    status = db.Column(db.String(20), default="active")
    last_login = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    two_factor_secret = db.Column(db.String(32), nullable=True)
    two_factor_enabled = db.Column(db.Boolean, default=False, nullable=False)

    def __repr__(self):
        return f"<User {self.username}>"

    def set_password(self, password: str) -> None:
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        self.password_hash = hashed.decode("utf-8")

    def check_password(self, password: str) -> bool:
        return bcrypt.checkpw(password.encode("utf-8"), self.password_hash.encode("utf-8"))

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "name": self.name or self.username,
            "phone": self.phone,
            "department": self.department,
            "avatar_url": self.avatar_url,
            "role": self.role,
            "status": self.status,
            "two_factor_enabled": self.two_factor_enabled,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }



class Organization(db.Model):
    """Organization/company settings for the user."""

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, unique=True)
    company_name = db.Column(db.String(200), nullable=True)
    address = db.Column(db.Text, nullable=True)
    logo_url = db.Column(db.String(500), nullable=True)
    default_currency = db.Column(db.String(10), default="USD")
    timezone = db.Column(db.String(50), default="UTC")
    fiscal_year = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("organization", uselist=False))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "company_name": self.company_name,
            "address": self.address,
            "logo_url": self.logo_url,
            "default_currency": self.default_currency,
            "timezone": self.timezone,
            "fiscal_year": self.fiscal_year,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class UserPreference(db.Model):
    """User-level application preferences and defaults."""

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, unique=True)

    # Notifications
    notification_email = db.Column(db.Boolean, default=True)
    notification_push = db.Column(db.Boolean, default=True)
    reminder_days = db.Column(db.Integer, default=7)
    invoice_reminder_days = db.Column(db.Integer, default=7)
    approval_notifications = db.Column(db.Boolean, default=True)

    # Contract defaults
    default_contract_type_id = db.Column(db.Integer, nullable=True)
    default_renewal_period_days = db.Column(db.Integer, default=365)
    default_payment_terms = db.Column(db.String(100), default="Net 30")

    # Appearance
    theme = db.Column(db.String(20), default="system")  # light, dark, system

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("preferences", uselist=False))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "notification_email": self.notification_email,
            "notification_push": self.notification_push,
            "reminder_days": self.reminder_days,
            "invoice_reminder_days": self.invoice_reminder_days,
            "approval_notifications": self.approval_notifications,
            "default_contract_type_id": self.default_contract_type_id,
            "default_renewal_period_days": self.default_renewal_period_days,
            "default_payment_terms": self.default_payment_terms,
            "theme": self.theme,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class IntegrationConfig(db.Model):
    """External service integration configuration."""

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    provider = db.Column(db.String(50), nullable=False)
    config_json = db.Column(db.Text, nullable=True)
    enabled = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("integrations", lazy="dynamic"))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "provider": self.provider,
            "config": json.loads(self.config_json) if self.config_json else {},
            "enabled": self.enabled,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Role(db.Model):
    """User role for access control."""

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    description = db.Column(db.String(255), nullable=True)
    permissions = db.Column(db.Text, nullable=True)  # JSON array of permission strings
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "permissions": json.loads(self.permissions) if self.permissions else [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class LoginHistory(db.Model):
    """Record of user login attempts for security audit."""

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    ip_address = db.Column(db.String(50), nullable=True)
    user_agent = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("login_history", lazy="dynamic"))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class RoleAssignment(db.Model):
    """Many-to-many relationship between users and roles."""

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey("role.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("role_assignments", lazy="dynamic"))
    role = db.relationship("Role", backref=db.backref("assignments", lazy="dynamic"))

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "role_id": self.role_id,
            "role_name": self.role.name if self.role else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
