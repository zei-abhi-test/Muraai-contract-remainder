"""Request and data validation utilities using Pydantic."""

from pydantic import BaseModel, Field, EmailStr, model_validator
from typing import Optional
from datetime import date
from enum import Enum


class NotificationType(str, Enum):
    EMAIL = "email"
    MOBILE = "mobile"


class NotificationStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


# User Validators
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=80)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    class Config:
        example = {
            "username": "john_doe",
            "email": "john@example.com",
            "password": "securepassword123",
        }


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=80)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, max_length=128)

    class Config:
        example = {
            "username": "john_doe",
            "email": "john@example.com",
            "password": "newsecurepassword123",
        }


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)

    class Config:
        example = {"email": "john@example.com", "password": "securepassword123"}


_ROLE_PATTERN = r"^(SUPER_ADMIN|ADMIN|CONTRACT_MANAGER|FINANCE|APPROVER|LEGAL|SALES|VIEWER)$"


class AdminUserCreate(BaseModel):
    """Admin-only user creation with role/status assignment."""

    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=100)
    role: str = Field(default="VIEWER", pattern=_ROLE_PATTERN)
    status: str = Field(default="active", pattern=r"^(active|disabled)$")
    password: str = Field(..., min_length=8, max_length=128)

    class Config:
        example = {
            "name": "Jane Smith",
            "email": "jane@example.com",
            "phone": "+1234567890",
            "department": "Engineering",
            "role": "CONTRACT_MANAGER",
            "status": "active",
            "password": "temporaryPass123",
        }


class AdminUserUpdate(BaseModel):
    """Admin-only user update. All fields optional."""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=100)
    avatar_url: Optional[str] = Field(None, max_length=500)
    role: Optional[str] = Field(None, pattern=_ROLE_PATTERN)
    status: Optional[str] = Field(None, pattern=r"^(active|disabled)$")


class UserInvite(BaseModel):
    """Admin-only user invitation with temporary password."""

    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    department: Optional[str] = Field(None, max_length=100)
    role: str = Field(default="VIEWER", pattern=_ROLE_PATTERN)

    class Config:
        example = {
            "name": "Jane Updated",
            "phone": "+0987654321",
            "role": "FINANCE",
            "status": "disabled",
        }


# Contract Validators
class ContractCreate(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=200)
    contract_name: str = Field(..., min_length=1, max_length=200)
    start_date: date
    end_date: date
    renewal_date: date
    notification_enabled: bool = True
    notification_email: Optional[EmailStr] = None
    notification_mobile: bool = False
    notes: Optional[str] = None
    user_id: Optional[int] = Field(None, gt=0)

    @model_validator(mode="after")
    def validate_dates_and_notifications(self):
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        if self.notification_enabled and not self.notification_email:
            raise ValueError("notification_email is required when notifications are enabled")
        return self

    class Config:
        example = {
            "company_name": "Acme Corp",
            "contract_name": "Software License",
            "start_date": "2023-01-01",
            "end_date": "2025-12-31",
            "renewal_date": "2025-12-01",
            "notification_enabled": True,
            "notification_email": "user@example.com",
            "notification_mobile": False,
            "notes": "Annual renewal required",
            "user_id": 1,
        }


class ContractUpdate(BaseModel):
    company_name: Optional[str] = Field(None, min_length=1, max_length=200)
    contract_name: Optional[str] = Field(None, min_length=1, max_length=200)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    renewal_date: Optional[date] = None
    notification_enabled: Optional[bool] = None
    notification_email: Optional[EmailStr] = None
    notification_mobile: Optional[bool] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_partial_dates(self):
        if self.start_date and self.end_date and self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self

    class Config:
        example = {"company_name": "Updated Corp Name", "renewal_date": "2025-12-01"}


# Notification Validators
class NotificationCreate(BaseModel):
    contract_id: int = Field(..., gt=0)
    notification_type: NotificationType
    status: NotificationStatus = NotificationStatus.PENDING
    message: Optional[str] = None

    class Config:
        example = {
            "contract_id": 1,
            "notification_type": "email",
            "status": "sent",
            "message": "Email sent successfully to user@example.com",
        }
