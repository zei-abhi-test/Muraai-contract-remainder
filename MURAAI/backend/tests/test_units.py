from datetime import date
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from src.services.notification_service import notification_service
from src.services.validators import ContractCreate, UserCreate


def test_user_create_requires_valid_email():
    with pytest.raises(ValidationError):
        UserCreate(username="tester", email="not-an-email", password="securepassword123")


def test_contract_create_validates_date_order():
    with pytest.raises(ValidationError):
        ContractCreate(
            company_name="Acme",
            contract_name="Bad Dates",
            start_date="2026-12-31",
            end_date="2026-01-01",
            renewal_date="2026-01-01",
            notification_enabled=False,
        )


def test_contract_create_requires_email_when_notifications_enabled():
    with pytest.raises(ValidationError):
        ContractCreate(
            company_name="Acme",
            contract_name="Missing Email",
            start_date="2026-01-01",
            end_date="2026-12-31",
            renewal_date="2026-12-31",
            notification_enabled=True,
        )


def test_contract_create_allows_renewal_date_before_end_date():
    contract = ContractCreate(
        company_name="Acme",
        contract_name="Reference Renewal",
        start_date="2026-01-01",
        end_date="2026-12-31",
        renewal_date="2026-06-30",
        notification_enabled=False,
    )

    assert contract.renewal_date.isoformat() == "2026-06-30"


def test_email_template_contains_contract_details():
    contract = SimpleNamespace(
        company_name="Acme Corp",
        contract_name="Software License",
        renewal_date=date(2026, 12, 31),
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        notes="Review pricing",
    )

    html = notification_service.create_email_template(contract, 7)

    assert "Software License" in html
    assert "Acme Corp" in html
    assert "URGENT EXPIRY NOTICE" in html
    assert "December 31, 2026" in html
    assert "Review pricing" in html
