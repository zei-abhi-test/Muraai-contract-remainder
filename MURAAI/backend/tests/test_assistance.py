import json
from datetime import date, timedelta

from src.models.user import db as _db
from src.models.contract import Contract, ContractLineItem


def _create_customer(client, auth_headers):
    resp = client.post("/api/customers", headers=auth_headers, json={
        "name": "Test Customer",
        "customer_code": "C001",
        "email": "customer@test.com",
    })
    return resp.get_json()


def _create_contact(client, auth_headers, customer_id):
    resp = client.post(f"/api/customers/{customer_id}/contacts", headers=auth_headers, json={
        "contact_name": "Test Contact",
        "contact_number": "1234567890",
        "email": "contact@test.com",
    })
    return resp.get_json()


def _create_contract(client, auth_headers, **overrides):
    payload = {
        "contract_name": "Test Contract",
        "company_name": "Test Corp",
        "start_date": date.today().isoformat(),
        "end_date": (date.today() + timedelta(days=60)).isoformat(),
        "renewal_date": (date.today() + timedelta(days=60)).isoformat(),
        "customer_id": overrides.pop("customer_id", None),
        "contact_person_id": overrides.pop("contact_person_id", None),
        "notification_email": "test@example.com",
        "notification_enabled": True,
        "currency": "USD",
        "status": "Active",
        "total_contract_value": 10000,
    }
    payload.update(overrides)
    # Remove None values that may cause validation errors
    clean = {k: v for k, v in payload.items() if k not in ("customer_id", "contact_person_id") or v is not None}
    resp = client.post("/api/contracts", headers=auth_headers, json=clean)
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()


def test_assistance_requires_auth(client):
    resp = client.get("/api/contracts/1/assistance")
    assert resp.status_code == 401


def test_assistance_not_found(client, auth_headers):
    resp = client.get("/api/contracts/99999/assistance", headers=auth_headers)
    assert resp.status_code == 404


def test_assistance_returns_health_score_and_readiness(client, auth_headers):
    cust = _create_customer(client, auth_headers)
    contact = _create_contact(client, auth_headers, cust["id"])
    contract = _create_contract(client, auth_headers,
        customer_id=cust["id"], contact_person_id=contact["id"])
    cid = contract["id"]

    resp = client.get(f"/api/contracts/{cid}/assistance", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()

    assert data["contract_id"] == cid
    assert data["contract_name"] == "Test Contract"

    hs = data["health_score"]
    assert "score" in hs
    assert "level" in hs
    assert isinstance(hs["score"], int)
    assert 0 <= hs["score"] <= 100
    assert hs["level"] in ("excellent", "good", "fair", "poor", "critical")

    assert len(hs["factors"]) == 5
    factor_labels = {f["label"] for f in hs["factors"]}
    assert "Contract Expiry" in factor_labels
    assert "Documents Uploaded" in factor_labels
    assert "Approval Status" in factor_labels
    assert "Renewal Status" in factor_labels
    assert "Invoice Status" in factor_labels

    for f in hs["factors"]:
        assert 0 <= f["score"] <= f["max"]
        assert f["status"] in ("healthy", "good", "warning", "critical", "missing")

    rd = data["readiness"]
    assert rd["total"] == 6
    assert rd["passed"] <= rd["total"]
    assert len(rd["checks"]) == 6
    check_labels = {c["label"] for c in rd["checks"]}
    assert "Customer Assigned" in check_labels
    assert "Contact Person" in check_labels
    assert "Products / Line Items" in check_labels
    assert "Dates Complete" in check_labels
    assert "Notification Email" in check_labels
    assert "Required Documents" in check_labels

    assert isinstance(data["risks"], list)
    assert data["version_comparison"] is None


def test_assistance_with_missing_customer_shows_risk(client, auth_headers):
    cust = _create_customer(client, auth_headers)
    contact = _create_contact(client, auth_headers, cust["id"])
    contract = _create_contract(client, auth_headers)
    cid = contract["id"]

    resp = client.get(f"/api/contracts/{cid}/assistance", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()

    customer_check = [c for c in data["readiness"]["checks"] if c["label"] == "Customer Assigned"]
    assert customer_check
    assert customer_check[0]["passed"] is False

    risk_types = [r["type"] for r in data["risks"]]
    assert "missing_customer" in risk_types


def test_assistance_with_expired_contract_has_critical_health(client, auth_headers):
    cust = _create_customer(client, auth_headers)
    contact = _create_contact(client, auth_headers, cust["id"])
    contract = _create_contract(client, auth_headers,
        customer_id=cust["id"], contact_person_id=contact["id"],
        end_date=(date.today() - timedelta(days=10)).isoformat(),
        start_date=(date.today() - timedelta(days=40)).isoformat())
    cid = contract["id"]

    resp = client.get(f"/api/contracts/{cid}/assistance", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()

    expiry_factor = [f for f in data["health_score"]["factors"] if f["label"] == "Contract Expiry"]
    assert expiry_factor
    assert expiry_factor[0]["status"] == "critical"
    assert expiry_factor[0]["score"] == 0

    risk_types = [r["type"] for r in data["risks"]]
    assert "expired" in risk_types


def test_assistance_does_not_leak_other_users_contract(client, auth_headers):
    from src.models.user import User

    other = User(email="other@test.com", name="Other", username="other")
    other.set_password("x")
    _db.session.add(other)
    _db.session.commit()

    c = Contract(
        contract_name="Other's Contract", company_name="Other Inc",
        start_date=date.today(), end_date=date.today() + timedelta(days=30),
        renewal_date=date.today() + timedelta(days=30),
        user_id=other.id,
    )
    _db.session.add(c)
    _db.session.commit()

    resp = client.get(f"/api/contracts/{c.id}/assistance", headers=auth_headers)
    assert resp.status_code == 404


def test_assistance_readiness_scores_accurately(client, auth_headers):
    contract = _create_contract(client, auth_headers,
        notification_email=None, notification_enabled=False)
    cid = contract["id"]

    resp = client.get(f"/api/contracts/{cid}/assistance", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()

    assert data["readiness"]["passed"] == 1  # only dates are set
    assert data["readiness"]["ready"] is False
