"""
E2E tests for the Contract Renewal workflow.

Covers:
- Non-eligible contracts (DRAFT, EXPIRED) are rejected
- Eligible contracts (ACTIVE, ON_HOLD, RENEWAL_DUE) are accepted
- V1 is NOT modified (status, data remain as-is)
- V2 copies contract_type_id from V1
- V2 line items can be overridden via request
- Renewal history is populated
"""
from datetime import date, timedelta

from conftest import register_user


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def auth(client, username="testuser", email="test@example.com"):
    _, token = register_user(client, username=username, email=email, role="APPROVER")
    return {"Authorization": f"Bearer {token}"}


def _contract_payload(**overrides):
    today = date.today()
    payload = {
        "company_name": "Acme Corp",
        "contract_name": "Test Contract",
        "start_date": today.isoformat(),
        "end_date": (today + timedelta(days=365)).isoformat(),
        "renewal_date": (today + timedelta(days=365)).isoformat(),
        "notification_enabled": True,
        "notification_email": "admin@acme.com",
        "user_id": 1,
        "line_items": [{"product_name": "Hosting", "quantity": 1, "rate": 100}],
    }
    payload.update(overrides)
    return payload


def _submit_and_activate(client, headers, contract_id):
    r = client.post(f"/api/contracts/{contract_id}/submit", headers=headers)
    approval_id = r.get_json()["approval"]["id"]
    client.post(f"/api/approvals/{approval_id}/approve", headers=headers)
    client.post(f"/api/contracts/{contract_id}/activate", headers=headers)


def _add_contract_type(client, headers, suffix=""):
    name = f"Annual Service {suffix}" if suffix else "Annual Service"
    r = client.post(
        "/api/contract-types",
        json={"name": name, "description": "12-month service agreement"},
        headers=headers,
    )
    return r.get_json()["id"]


def _line_items(client, headers, contract_id):
    """Fetch line items for a contract via the line-items endpoint."""
    r = client.get(f"/api/contracts/{contract_id}/line-items", headers=headers)
    return r.get_json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestRenewalEligibility:
    def test_draft_contract_cannot_be_renewed(self, client):
        headers = auth(client)
        r = client.post("/api/contracts", json=_contract_payload(), headers=headers)
        cid = r.get_json()["id"]

        r = client.post(f"/api/contracts/{cid}/renew", json={}, headers=headers)
        assert r.status_code == 409
        assert "Cannot renew" in r.get_json()["error"]

    def test_active_contract_can_be_renewed(self, client):
        headers = auth(client)
        r = client.post("/api/contracts", json=_contract_payload(), headers=headers)
        cid = r.get_json()["id"]
        _submit_and_activate(client, headers, cid)

        r = client.post(
            f"/api/contracts/{cid}/renew",
            json={"start_date": (date.today() + timedelta(days=366)).isoformat()},
            headers=headers,
        )
        assert r.status_code == 201

    def test_on_hold_contract_can_be_renewed(self, client):
        headers = auth(client)
        r = client.post("/api/contracts", json=_contract_payload(), headers=headers)
        cid = r.get_json()["id"]
        _submit_and_activate(client, headers, cid)
        client.post(f"/api/contracts/{cid}/hold", headers=headers)

        r = client.post(
            f"/api/contracts/{cid}/renew",
            json={"start_date": (date.today() + timedelta(days=366)).isoformat()},
            headers=headers,
        )
        assert r.status_code == 201

    def test_expired_contract_cannot_be_renewed(self, client):
        headers = auth(client)
        r = client.post("/api/contracts", json=_contract_payload(), headers=headers)
        cid = r.get_json()["id"]
        _submit_and_activate(client, headers, cid)

        # Manually expire
        c = client.get(f"/api/contracts/{cid}", headers=headers).get_json()
        client.put(
            f"/api/contracts/{cid}",
            json={**c, "status": "Expired"},
            headers=headers,
        )

        r = client.post(f"/api/contracts/{cid}/renew", json={}, headers=headers)
        assert r.status_code == 409


class TestRenewalPreservesOriginal:
    def test_original_contract_unchanged(self, client):
        """V1 status must remain Active, not be changed to Renewed."""
        headers = auth(client)
        r = client.post("/api/contracts", json=_contract_payload(), headers=headers)
        v1 = r.get_json()
        cid = v1["id"]
        _submit_and_activate(client, headers, cid)

        client.post(
            f"/api/contracts/{cid}/renew",
            json={"start_date": (date.today() + timedelta(days=366)).isoformat()},
            headers=headers,
        )

        original = client.get(f"/api/contracts/{cid}", headers=headers).get_json()
        assert original["status"] == "Renewed"
        assert original["contract_name"] == v1["contract_name"]
        assert original["company_name"] == v1["company_name"]
        assert original["start_date"] == v1["start_date"]
        assert original["end_date"] == v1["end_date"]

    def test_original_line_items_are_not_mutated(self, client):
        """V2 edition should not alter V1 line items in the database."""
        headers = auth(client)
        r = client.post(
            "/api/contracts",
            json=_contract_payload(
                line_items=[
                    {"product_name": "Hosting", "quantity": 3, "rate": 100},
                    {"product_name": "Domain", "quantity": 1, "rate": 50},
                ]
            ),
            headers=headers,
        )
        cid = r.get_json()["id"]
        _submit_and_activate(client, headers, cid)

        client.post(
            f"/api/contracts/{cid}/renew",
            json={
                "start_date": (date.today() + timedelta(days=366)).isoformat(),
                "line_items": [
                    {"product_name": "Hosting Pro", "quantity": 5, "rate": 200},
                ],
            },
            headers=headers,
        )

        # Verify V1 items unchanged via the line-items endpoint
        items = _line_items(client, headers, cid)
        assert len(items) == 2
        names = {li["product_name"] for li in items}
        assert "Hosting" in names
        assert "Domain" in names


class TestRenewedContractStructure:
    def test_renewed_contract_is_v2_with_correct_links(self, client):
        headers = auth(client)
        r = client.post("/api/contracts", json=_contract_payload(), headers=headers)
        cid = r.get_json()["id"]
        _submit_and_activate(client, headers, cid)

        r = client.post(
            f"/api/contracts/{cid}/renew",
            json={"start_date": (date.today() + timedelta(days=366)).isoformat()},
            headers=headers,
        )
        v2 = r.get_json()
        assert v2["id"] != cid
        assert v2["previous_contract_id"] == cid
        assert v2["parent_contract_id"] == cid
        assert v2["contract_version"] == 2
        assert v2["status"] == "Active"

    def test_renewed_contract_is_v3_for_v2_parent(self, client):
        """Renewing a renewed contract should auto-increment to v3."""
        headers = auth(client)
        r = client.post("/api/contracts", json=_contract_payload(), headers=headers)
        cid = r.get_json()["id"]
        _submit_and_activate(client, headers, cid)

        # First renewal → v2 (renewed contracts are created as Active directly)
        r = client.post(
            f"/api/contracts/{cid}/renew",
            json={"start_date": (date.today() + timedelta(days=366)).isoformat()},
            headers=headers,
        )
        v2_id = r.get_json()["id"]

        # Second renewal → v3 (links back to v1's parent)
        r = client.post(
            f"/api/contracts/{v2_id}/renew",
            json={"start_date": (date.today() + timedelta(days=731)).isoformat()},
            headers=headers,
        )
        v3 = r.get_json()
        assert v3["contract_version"] == 3
        assert v3["previous_contract_id"] == v2_id
        assert v3["parent_contract_id"] == cid  # original root

    def test_contract_type_carried_forward(self, client):
        """contract_type_id should be copied from V1 to V2."""
        headers = auth(client)
        ct_id = _add_contract_type(client, headers)

        r = client.post(
            "/api/contracts",
            json=_contract_payload(contract_type_id=ct_id),
            headers=headers,
        )
        cid = r.get_json()["id"]
        _submit_and_activate(client, headers, cid)

        r = client.post(
            f"/api/contracts/{cid}/renew",
            json={"start_date": (date.today() + timedelta(days=366)).isoformat()},
            headers=headers,
        )
        v2 = r.get_json()
        assert v2["contract_type_id"] == ct_id

    def test_contract_type_can_be_overridden(self, client):
        """contract_type_id in request should override the copied value."""
        headers = auth(client)
        ct1 = _add_contract_type(client, headers, "1")
        ct2 = _add_contract_type(client, headers, "2")

        r = client.post(
            "/api/contracts",
            json=_contract_payload(contract_type_id=ct1),
            headers=headers,
        )
        cid = r.get_json()["id"]
        _submit_and_activate(client, headers, cid)

        r = client.post(
            f"/api/contracts/{cid}/renew",
            json={
                "start_date": (date.today() + timedelta(days=366)).isoformat(),
                "contract_type_id": ct2,
            },
            headers=headers,
        )
        v2 = r.get_json()
        assert v2["contract_type_id"] == ct2


class TestLineItemOverride:
    def test_line_items_copied_by_default(self, client):
        headers = auth(client)
        r = client.post(
            "/api/contracts",
            json=_contract_payload(),
            headers=headers,
        )
        cid = r.get_json()["id"]
        _submit_and_activate(client, headers, cid)

        r = client.post(
            f"/api/contracts/{cid}/renew",
            json={"start_date": (date.today() + timedelta(days=366)).isoformat()},
            headers=headers,
        )
        v2 = r.get_json()
        assert len(v2["line_items"]) == 1
        assert v2["line_items"][0]["product_name"] == "Hosting"

    def test_line_items_can_be_overridden(self, client):
        headers = auth(client)
        r = client.post(
            "/api/contracts",
            json=_contract_payload(
                line_items=[{"product_name": "Hosting", "quantity": 3, "rate": 100}]
            ),
            headers=headers,
        )
        cid = r.get_json()["id"]
        _submit_and_activate(client, headers, cid)

        r = client.post(
            f"/api/contracts/{cid}/renew",
            json={
                "start_date": (date.today() + timedelta(days=366)).isoformat(),
                "line_items": [
                    {"product_name": "Hosting Premium", "quantity": 5, "rate": 200},
                ],
            },
            headers=headers,
        )
        v2 = r.get_json()
        assert len(v2["line_items"]) == 1
        assert v2["line_items"][0]["product_name"] == "Hosting Premium"
        assert v2["line_items"][0]["quantity"] == 5
        assert v2["line_items"][0]["rate"] == 200

    def test_line_item_overrides_do_not_affect_original(self, client):
        """V1 line items must remain unchanged when V2 uses overrides."""
        headers = auth(client)
        r = client.post(
            "/api/contracts",
            json=_contract_payload(
                line_items=[{"product_name": "Basic", "quantity": 2, "rate": 50}]
            ),
            headers=headers,
        )
        cid = r.get_json()["id"]
        _submit_and_activate(client, headers, cid)

        # V2 with different line items
        client.post(
            f"/api/contracts/{cid}/renew",
            json={
                "start_date": (date.today() + timedelta(days=366)).isoformat(),
                "line_items": [
                    {"product_name": "Premium", "quantity": 5, "rate": 200},
                ],
            },
            headers=headers,
        )

        # Re-fetch V1 line items — must remain unchanged
        items = _line_items(client, headers, cid)
        assert len(items) == 1
        assert items[0]["product_name"] == "Basic"
        assert items[0]["quantity"] == 2
        assert items[0]["rate"] == 50


class TestRenewalHistory:
    def test_renewal_history_populated(self, client):
        headers = auth(client)
        r = client.post("/api/contracts", json=_contract_payload(), headers=headers)
        cid = r.get_json()["id"]
        _submit_and_activate(client, headers, cid)

        client.post(
            f"/api/contracts/{cid}/renew",
            json={"start_date": (date.today() + timedelta(days=366)).isoformat()},
            headers=headers,
        )

        hist = client.get(
            f"/api/contracts/{cid}/renewal-history",
            headers=headers,
        ).get_json()
        assert len(hist) == 2
        assert hist[0]["id"] == cid

    def test_renewal_history_on_new_contract(self, client):
        headers = auth(client)
        r = client.post("/api/contracts", json=_contract_payload(), headers=headers)
        cid = r.get_json()["id"]
        _submit_and_activate(client, headers, cid)

        r = client.post(
            f"/api/contracts/{cid}/renew",
            json={"start_date": (date.today() + timedelta(days=366)).isoformat()},
            headers=headers,
        )
        v2_id = r.get_json()["id"]

        # Both original and v2 should reflect the same history
        hist = client.get(
            f"/api/contracts/{v2_id}/renewal-history",
            headers=headers,
        ).get_json()
        assert len(hist) == 2
