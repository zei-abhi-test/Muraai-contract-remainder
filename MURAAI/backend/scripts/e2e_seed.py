"""Minimal deterministic seed for Playwright E2E tests.

Creates a single contract-manager user plus the bare reference data the
contract wizard requires (a contract type and one customer), against a
dedicated SQLite database so E2E runs are reproducible and fast.

The database file is deleted on every run, so the E2E flow always starts
from a clean slate: exactly 0 active contracts, 0 approvals.

Usage (called automatically by the Playwright webServer command):
  python scripts/e2e_seed.py

Credentials used by the E2E test:
  Email:    admin@acmetech.com
  Password: Acme@2026!
"""

import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BACKEND_DIR, "e2e_app.db")

if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH.replace(os.sep, '/')}"
os.environ["FLASK_ENV"] = "testing"
os.environ["AUTO_CREATE_TABLES"] = "false"
os.environ["RUN_SCHEDULER"] = "false"
os.environ["SECRET_KEY"] = "e2e-secret-key"
os.environ["EMAIL_USER"] = "e2e@example.com"
os.environ["EMAIL_PASSWORD"] = "e2e-password"

sys.path.insert(0, BACKEND_DIR)

from src.main import app  # noqa: E402
from src.models.user import db as _db, User, Organization, UserPreference  # noqa: E402
from src.models.contract import ContractType, Customer, SkuCounter  # noqa: E402

with app.app_context():
    user = User(
        username="e2e_admin",
        email="admin@acmetech.com",
        name="E2E Admin",
        phone="+1-555-0100",
        department="Contracts",
        role="CONTRACT_MANAGER",
        status="active",
    )
    user.set_password("Acme@2026!")
    _db.session.add(user)
    _db.session.flush()

    _db.session.add(
        Organization(
            user_id=user.id,
            company_name="E2E Corp",
            default_currency="USD",
        )
    )
    _db.session.add(
        UserPreference(
            user_id=user.id,
            reminder_days=30,
            approval_notifications=True,
        )
    )
    _db.session.add(SkuCounter(prefix="CTR", next_value=1))
    _db.session.flush()

    contract_type = ContractType(
        name="Annual Subscription",
        description="E2E test contract type",
        status="active",
    )
    _db.session.add(contract_type)
    _db.session.flush()

    customer = Customer(
        name="Global Retail Ltd",
        customer_code="GRL-001",
        phone="+1-555-0199",
        email="accounts@globalretail.com",
        address="200 Park Avenue, New York, NY 10017, USA",
        user_id=user.id,
    )
    _db.session.add(customer)
    _db.session.flush()

    _db.session.commit()

    print(f"Seeded admin user {user.email} (id={user.id}), "
          f"contract_type={contract_type.id}, customer={customer.id}")
    print(f"Database: {DB_PATH}")
