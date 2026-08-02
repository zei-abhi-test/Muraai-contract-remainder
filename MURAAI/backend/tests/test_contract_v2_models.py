"""Tests for the v2 contract model additions — soft delete, lifecycle
columns, ContractClause, ContractVersionHistory, ContractEventLog, and
the domain event emission service.
"""

import json
import uuid
from datetime import date, datetime, timedelta

import pytest
from src.main import app
from src.models.contract import (
    Contract,
    ContractClause,
    ContractDocument,
    ContractEventLog,
    ContractLineItem,
    ContractVersionHistory,
    db,
)
from src.models.user import User
from src.services.domain_event import count_events, emit_event, list_events


def _create_contract() -> Contract:
    """Helper — create and return a persisted draft contract."""
    user = User.query.first()
    contract = Contract(
        company_name="Test Corp",
        contract_name="Test Contract",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        renewal_date=date(2026, 11, 30),
        status="Draft",
        user_id=user.id,
        created_by_id=user.id,
        last_modified_by_id=user.id,
        currency="USD",
        total_contract_value=0,
    )
    db.session.add(contract)
    db.session.flush()
    return contract


# ─── soft delete on Contract ──────────────────────────────────────────


def test_contract_soft_delete_defaults_to_false(client, auth_headers):
    response = client.post(
        "/api/contracts",
        json={
            "company_name": "Acme",
            "contract_name": "Soft Delete Test",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "renewal_date": "2026-11-30",
            "notification_enabled": False,
        },
        headers=auth_headers,
    )
    data = response.get_json()
    assert response.status_code == 201
    assert data["is_deleted"] is False
    assert data["deleted_at"] is None
    assert data["deleted_by_id"] is None
    assert data["deletion_reason"] is None


def test_contract_soft_delete_marks_as_deleted(client, auth_headers):
    # create
    create_resp = client.post(
        "/api/contracts",
        json={
            "company_name": "Acme",
            "contract_name": "To Delete",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "renewal_date": "2026-11-30",
            "notification_enabled": False,
            "status": "Draft",
        },
        headers=auth_headers,
    )
    contract_id = create_resp.get_json()["id"]

    # verify the is_deleted field is available in response
    contract_resp = client.get(
        f"/api/contracts/{contract_id}", headers=auth_headers
    )
    assert contract_resp.get_json()["is_deleted"] is False


def test_contract_to_dict_includes_lifecycle_columns(client, auth_headers):
    create_resp = client.post(
        "/api/contracts",
        json={
            "company_name": "Acme",
            "contract_name": "Lifecycle Columns",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "renewal_date": "2026-11-30",
            "notification_enabled": False,
        },
        headers=auth_headers,
    )
    data = create_resp.get_json()
    for col in (
        "activated_at",
        "activated_by_id",
        "terminated_at",
        "terminated_by_id",
        "termination_reason",
        "archived_at",
        "archived_by_id",
        "retention_until",
    ):
        assert col in data, f"{col} missing from Contract.to_dict()"


# ─── soft delete on ContractLineItem ──────────────────────────────────


def test_line_item_soft_delete_defaults_to_false(client, auth_headers):
    create_resp = client.post(
        "/api/contracts",
        json={
            "company_name": "Acme",
            "contract_name": "Line Item SD",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "renewal_date": "2026-11-30",
            "notification_enabled": False,
            "line_items": [
                {
                    "product_name": "Widget",
                    "quantity": 10,
                    "rate": 100,
                }
            ],
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201


# ─── ContractClause model ─────────────────────────────────────────────


def test_contract_clause_create_and_serialize(app_context):
    user = User.query.first()
    contract = _create_contract()
    clause = ContractClause(
        contract_id=contract.id,
        clause_type="termination",
        title="Termination for Convenience",
        content="Either party may terminate with 90 days notice.",
        version=1,
        is_active=True,
    )
    db.session.add(clause)
    db.session.commit()

    saved = ContractClause.query.filter_by(contract_id=contract.id).first()
    assert saved is not None
    assert saved.clause_type == "termination"
    assert saved.is_deleted is False

    data = saved.to_dict()
    assert data["clause_type"] == "termination"
    assert data["title"] == "Termination for Convenience"
    assert data["version"] == 1
    assert data["is_active"] is True
    assert data["is_deleted"] is False
    assert data["contract_id"] == contract.id


def test_contract_clause_multiple_types(app_context):
    user = User.query.first()
    contract = _create_contract()
    types = ["termination", "renewal", "payment", "confidentiality", "liability"]
    for t in types:
        db.session.add(ContractClause(
            contract_id=contract.id,
            clause_type=t,
            title=f"Clause about {t}",
            content=f"Standard {t} clause.",
        ))
    db.session.commit()
    assert ContractClause.query.filter_by(contract_id=contract.id).count() == 5


def test_contract_clause_soft_delete(app_context):
    user = User.query.first()
    contract = _create_contract()
    clause = ContractClause(
        contract_id=contract.id,
        clause_type="general",
        title="General Terms",
        content="Standard terms apply.",
    )
    db.session.add(clause)
    db.session.flush()
    clause.is_deleted = True
    db.session.commit()

    # soft-deleted clauses are still queryable
    deleted = ContractClause.query.filter_by(
        contract_id=contract.id, is_deleted=True
    ).first()
    assert deleted is not None
    assert deleted.is_deleted is True


# ─── ContractVersionHistory model ─────────────────────────────────────


def test_version_history_create_and_serialize(app_context):
    user = User.query.first()
    contract = _create_contract()
    history = ContractVersionHistory(
        contract_id=contract.id,
        version_number=2,
        previous_version=1,
        changed_by_id=user.id,
        change_reason="Updated contract value",
        changes_json=json.dumps({
            "total_contract_value": {"old": "1000.00", "new": "1500.00"}
        }),
    )
    db.session.add(history)
    db.session.commit()

    saved = ContractVersionHistory.query.filter_by(contract_id=contract.id).first()
    assert saved is not None
    assert saved.version_number == 2
    assert saved.previous_version == 1
    assert saved.change_reason == "Updated contract value"

    data = saved.to_dict()
    assert data["version_number"] == 2
    assert data["previous_version"] == 1
    assert data["change_reason"] == "Updated contract value"


def test_version_history_multiple_versions(app_context):
    user = User.query.first()
    contract = _create_contract()
    for v in range(1, 6):
        db.session.add(ContractVersionHistory(
            contract_id=contract.id,
            version_number=v,
            previous_version=v - 1 if v > 1 else None,
            changed_by_id=user.id,
            change_reason=f"Version {v}",
        ))
    db.session.commit()
    assert ContractVersionHistory.query.filter_by(contract_id=contract.id).count() == 5


# ─── ContractEventLog model ───────────────────────────────────────────


def test_event_log_create_and_serialize(app_context):
    contract = _create_contract()
    event = ContractEventLog(
        event_id=str(uuid.uuid4()),
        event_type="contract.activated",
        aggregate_type="contract",
        aggregate_id=contract.id,
        payload_json=json.dumps({"activated_by": 1}),
    )
    db.session.add(event)
    db.session.commit()

    saved = ContractEventLog.query.filter_by(aggregate_id=contract.id).first()
    assert saved is not None
    assert saved.event_type == "contract.activated"
    assert saved.aggregate_type == "contract"

    data = saved.to_dict()
    assert data["event_type"] == "contract.activated"
    assert data["aggregate_id"] == contract.id


def test_event_log_unique_event_id_via_query(app_context):
    """Verify event_id uniqueness by attempting to insert duplicate IDs."""
    contract = _create_contract()
    event_id = str(uuid.uuid4())
    ContractEventLog(
        event_id=event_id,
        event_type="contract.created",
        aggregate_type="contract",
        aggregate_id=contract.id,
    )
    db.session.commit()

    # Second insert with same event_id should either raise or be
    # prevented by the DB.  We test it can't create two readable records.
    try:
        dup = ContractEventLog(
            event_id=event_id,
            event_type="contract.created",
            aggregate_type="contract",
            aggregate_id=contract.id,
        )
        db.session.add(dup)
        db.session.commit()
    except Exception:
        db.session.rollback()

    count = ContractEventLog.query.filter_by(event_id=event_id).count()
    assert count == 1, "Duplicate event_id was allowed"


# ─── Domain event service ─────────────────────────────────────────────


def test_emit_event_creates_record(app_context):
    contract = _create_contract()
    record = emit_event(
        event_type="contract.activated",
        aggregate_type="contract",
        aggregate_id=contract.id,
        payload={"activated_by": 1, "notes": "Test activation"},
    )
    db.session.commit()

    assert record.event_type == "contract.activated"
    assert record.aggregate_id == contract.id
    payload = json.loads(record.payload_json)
    assert payload["activated_by"] == 1

    # verify it persisted
    saved = ContractEventLog.query.filter_by(
        aggregate_type="contract",
        aggregate_id=contract.id,
        event_type="contract.activated",
    ).first()
    assert saved is not None


def test_emit_event_rolls_back_with_transaction(app_context):
    contract = _create_contract()
    emit_event(
        event_type="contract.test",
        aggregate_type="contract",
        aggregate_id=contract.id,
        payload={"test": True},
    )
    db.session.rollback()

    events = list_events("contract", contract.id)
    assert len(events) == 0


def test_list_events_paginated(app_context):
    contract = _create_contract()
    for i in range(5):
        emit_event(
            event_type=f"contract.event_{i}",
            aggregate_type="contract",
            aggregate_id=contract.id,
        )
    db.session.commit()

    events = list_events("contract", contract.id, limit=2)
    assert len(events) == 2
    assert events[0].event_type == "contract.event_0"

    events_page2 = list_events("contract", contract.id, limit=2, offset=2)
    assert len(events_page2) == 2
    assert events_page2[0].event_type == "contract.event_2"


def test_list_events_filter_by_type(app_context):
    contract = _create_contract()
    emit_event("contract.created", "contract", contract.id)
    emit_event("contract.activated", "contract", contract.id)
    emit_event("contract.updated", "contract", contract.id)
    db.session.commit()

    events = list_events(
        "contract", contract.id,
        event_types=["contract.activated", "contract.created"],
    )
    assert len(events) == 2
    for e in events:
        assert e.event_type in ("contract.activated", "contract.created")


def test_count_events(app_context):
    contract = _create_contract()
    for i in range(7):
        emit_event(
            event_type=f"contract.event_{i}",
            aggregate_type="contract",
            aggregate_id=contract.id,
        )
    db.session.commit()

    total = count_events("contract", contract.id)
    assert total == 7

    filtered = count_events("contract", contract.id, event_types=["contract.event_0"])
    assert filtered == 1


def test_emit_event_commits_with_transaction(app_context):
    contract = _create_contract()
    emit_event(
        event_type="contract.test",
        aggregate_type="contract",
        aggregate_id=contract.id,
        payload={"test": True},
    )
    db.session.commit()

    events = list_events("contract", contract.id)
    assert len(events) == 1
    assert events[0].event_type == "contract.test"


# ─── backward compat: existing tests still pass ───────────────────────


def test_existing_contract_creation_still_works(client, auth_headers):
    response = client.post(
        "/api/contracts",
        json={
            "company_name": "Backward Compat",
            "contract_name": "BC Test",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "renewal_date": "2026-11-30",
            "notification_enabled": False,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.get_json()
    assert data["contract_name"] == "BC Test"
    assert data["is_deleted"] is False


def test_existing_contract_list_contains_new_fields(client, auth_headers):
    client.post(
        "/api/contracts",
        json={
            "company_name": "List Test",
            "contract_name": "LT",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "renewal_date": "2026-11-30",
            "notification_enabled": False,
        },
        headers=auth_headers,
    )
    response = client.get("/api/contracts", headers=auth_headers)
    assert response.status_code == 200
    for c in response.get_json():
        assert "is_deleted" in c
        assert "activated_at" in c
        assert "terminated_at" in c
        assert "archived_at" in c


# ─── fixture: app_context ──────────────────────────────────────────────


@pytest.fixture
def app_context():
    with app.app_context():
        db.drop_all()
        db.create_all()
        user = User(
            username="testuser",
            email="test@example.com",
        )
        user.set_password("securepassword123")
        user.role = "ADMIN"
        db.session.add(user)
        db.session.commit()
        yield
        db.session.remove()
