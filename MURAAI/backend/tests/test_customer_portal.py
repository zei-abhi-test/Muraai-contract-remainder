import json
from datetime import date, timedelta

from src.models.contract import Customer, Contract, Invoice, PurchaseOrder, db
from src.models.customer_auth import CustomerPortalUser


def _setup_customer_and_portal(client, auth_headers):
    """Create a customer + enable portal access. Returns (customer_id, portal_email, raw_password)."""
    resp = client.post("/api/customers", headers=auth_headers, json={
        "name": "Portal Customer",
        "email": "portal@customer.com",
        "customer_code": "PC001",
    })
    customer = resp.get_json()
    cid = customer["id"]

    resp = client.post(
        f"/api/customers/{cid}/portal/enable",
        headers=auth_headers,
        json={"email": "portal@customer.com", "password": "pass1234"},
    )
    assert resp.status_code == 201, resp.get_json()
    return cid, "portal@customer.com", "pass1234"


def _portal_login(client, email="portal@customer.com", password="pass1234"):
    resp = client.post("/api/portal/auth/login", json={
        "email": email, "password": password,
    })
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()
    return data["token"], data["customer"]


def _create_contract_for_customer(client, auth_headers, customer_id):
    """Create a minimal contract linked to the customer."""
    resp = client.post("/api/contracts", headers=auth_headers, json={
        "contract_name": f"Contract for {customer_id}",
        "company_name": "Test Corp",
        "start_date": date.today().isoformat(),
        "end_date": (date.today() + timedelta(days=90)).isoformat(),
        "renewal_date": (date.today() + timedelta(days=90)).isoformat(),
        "customer_id": customer_id,
        "notification_email": "notify@test.com",
        "notification_enabled": False,
        "currency": "USD",
        "status": "Active",
        "total_contract_value": 50000,
    })
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()


def _create_invoice_for_customer(client, auth_headers, customer_id, contract_id):
    resp = client.post("/api/invoices", headers=auth_headers, json={
        "invoice_number": f"INV-TEST-{customer_id}",
        "customer_id": customer_id,
        "contract_id": contract_id,
        "amount": 2500,
        "invoice_date": date.today().isoformat(),
        "due_date": (date.today() + timedelta(days=30)).isoformat(),
        "status": "ISSUED",
    })
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()


def _create_po_for_customer(client, auth_headers, customer_id):
    resp = client.post("/api/purchase-orders", headers=auth_headers, json={
        "po_number": f"PO-TEST-{customer_id}",
        "vendor": "Test Vendor",
        "customer_id": customer_id,
        "amount": 10000,
        "status": "Issued",
    })
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()


# ── Auth Tests ──────────────────────────────────────────────────────────

def test_portal_login_requires_email_and_password(client):
    resp = client.post("/api/portal/auth/login", json={})
    assert resp.status_code == 400
    assert "required" in resp.get_json()["error"]


def test_portal_login_rejects_bad_credentials(client):
    resp = client.post("/api/portal/auth/login", json={
        "email": "nonexistent@test.com", "password": "x",
    })
    assert resp.status_code == 401


def test_portal_login_success(client, auth_headers):
    cid, email, pw = _setup_customer_and_portal(client, auth_headers)
    token, customer = _portal_login(client, email, pw)
    assert customer["name"] == "Portal Customer"
    assert customer["id"] == cid
    assert customer["portal_email"] == email


def test_portal_me_requires_auth(client):
    resp = client.get("/api/portal/auth/me")
    assert resp.status_code == 401


def test_portal_me_returns_customer(client, auth_headers):
    cid, email, pw = _setup_customer_and_portal(client, auth_headers)
    token, _ = _portal_login(client, email, pw)
    resp = client.get("/api/portal/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["name"] == "Portal Customer"
    assert data["id"] == cid


# ── Data Access Tests ──────────────────────────────────────────────────

def test_portal_dashboard(client, auth_headers):
    cid, email, pw = _setup_customer_and_portal(client, auth_headers)
    _create_contract_for_customer(client, auth_headers, cid)
    token, _ = _portal_login(client, email, pw)

    resp = client.get("/api/portal/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["total_contracts"] >= 1
    assert data["active_contracts"] >= 1


def test_portal_contracts_list(client, auth_headers):
    cid, email, pw = _setup_customer_and_portal(client, auth_headers)
    contract = _create_contract_for_customer(client, auth_headers, cid)
    token, _ = _portal_login(client, email, pw)

    resp = client.get("/api/portal/contracts", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    contracts = resp.get_json()
    assert len(contracts) >= 1
    assert contracts[0]["contract_name"] == contract["contract_name"]


def test_portal_contracts_scoped_to_customer(client, auth_headers):
    cid, email, pw = _setup_customer_and_portal(client, auth_headers)
    token, _ = _portal_login(client, email, pw)

    # Create a second customer (different customer_id)
    resp2 = client.post("/api/customers", headers=auth_headers, json={
        "name": "Other Customer", "email": "other@test.com",
    })
    cid2 = resp2.get_json()["id"]
    _create_contract_for_customer(client, auth_headers, cid2)

    resp = client.get("/api/portal/contracts", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    contracts = resp.get_json()
    for c in contracts:
        assert c["company_name"] == "Test Corp"  # only our customer's


def test_portal_contract_detail(client, auth_headers):
    cid, email, pw = _setup_customer_and_portal(client, auth_headers)
    contract = _create_contract_for_customer(client, auth_headers, cid)
    token, _ = _portal_login(client, email, pw)

    resp = client.get(
        f"/api/portal/contracts/{contract['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["id"] == contract["id"]
    assert "line_items" in data
    assert "documents" in data


def test_portal_contract_detail_rejects_other_customer(client, auth_headers):
    cid, email, pw = _setup_customer_and_portal(client, auth_headers)
    contract = _create_contract_for_customer(client, auth_headers, cid)
    token, _ = _portal_login(client, email, pw)

    # Create another customer's contract
    resp2 = client.post("/api/customers", headers=auth_headers, json={
        "name": "Other", "email": "other2@test.com",
    })
    cid2 = resp2.get_json()["id"]
    other = _create_contract_for_customer(client, auth_headers, cid2)

    resp = client.get(
        f"/api/portal/contracts/{other['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


def test_portal_invoices_list(client, auth_headers):
    cid, email, pw = _setup_customer_and_portal(client, auth_headers)
    contract = _create_contract_for_customer(client, auth_headers, cid)
    _create_invoice_for_customer(client, auth_headers, cid, contract["id"])
    token, _ = _portal_login(client, email, pw)

    resp = client.get("/api/portal/invoices", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    invoices = resp.get_json()
    assert len(invoices) >= 1
    assert invoices[0]["invoice_number"] == f"INV-TEST-{cid}"


def test_portal_invoice_download(client, auth_headers):
    cid, email, pw = _setup_customer_and_portal(client, auth_headers)
    contract = _create_contract_for_customer(client, auth_headers, cid)
    inv = _create_invoice_for_customer(client, auth_headers, cid, contract["id"])
    token, _ = _portal_login(client, email, pw)

    resp = client.get(
        f"/api/portal/invoices/{inv['id']}/download",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.mimetype == "text/csv"


def test_portal_purchase_orders(client, auth_headers):
    cid, email, pw = _setup_customer_and_portal(client, auth_headers)
    _create_po_for_customer(client, auth_headers, cid)
    token, _ = _portal_login(client, email, pw)

    resp = client.get("/api/portal/purchase-orders", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    pos = resp.get_json()
    assert len(pos) >= 1
    assert pos[0]["po_number"] == f"PO-TEST-{cid}"


def test_portal_upload_document(client, auth_headers):
    import io
    cid, email, pw = _setup_customer_and_portal(client, auth_headers)
    contract = _create_contract_for_customer(client, auth_headers, cid)
    token, _ = _portal_login(client, email, pw)

    data = {"file": (io.BytesIO(b"signed content"), "signed.pdf")}
    resp = client.post(
        f"/api/portal/contracts/{contract['id']}/documents",
        headers={"Authorization": f"Bearer {token}"},
        data=data, content_type="multipart/form-data",
    )
    assert resp.status_code == 201
    doc = resp.get_json()
    assert doc["file_name"] == "signed.pdf"


# ── Admin Portal Management Tests ──────────────────────────────────────

def test_portal_enable_creates_portal_user(client, auth_headers):
    resp = client.post("/api/customers", headers=auth_headers, json={
        "name": "Test", "email": "t@t.com",
    })
    cid = resp.get_json()["id"]

    resp = client.post(
        f"/api/customers/{cid}/portal/enable",
        headers=auth_headers,
        json={"email": "portal@t.com", "password": "secure123"},
    )
    assert resp.status_code == 201
    data = resp.get_json()
    assert data["email"] == "portal@t.com"
    assert data["customer_id"] == cid


def test_portal_enable_rejects_duplicate(client, auth_headers):
    resp = client.post("/api/customers", headers=auth_headers, json={
        "name": "Test", "email": "t2@t.com",
    })
    cid = resp.get_json()["id"]
    client.post(
        f"/api/customers/{cid}/portal/enable",
        headers=auth_headers,
        json={"email": "p2@t.com", "password": "secure123"},
    )
    resp = client.post(
        f"/api/customers/{cid}/portal/enable",
        headers=auth_headers,
        json={"email": "p2@t.com", "password": "secure123"},
    )
    assert resp.status_code == 400


def test_portal_disable_removes_portal_user(client, auth_headers):
    resp = client.post("/api/customers", headers=auth_headers, json={
        "name": "Test3", "email": "t3@t.com",
    })
    cid = resp.get_json()["id"]
    client.post(
        f"/api/customers/{cid}/portal/enable",
        headers=auth_headers,
        json={"email": "p3@t.com", "password": "secure123"},
    )
    resp = client.post(
        f"/api/customers/{cid}/portal/disable",
        headers=auth_headers,
    )
    assert resp.status_code == 200

    # Login should now fail
    resp = client.post("/api/portal/auth/login", json={
        "email": "p3@t.com", "password": "secure123",
    })
    assert resp.status_code == 401


def test_portal_status(client, auth_headers):
    resp = client.post("/api/customers", headers=auth_headers, json={
        "name": "Test4", "email": "t4@t.com",
    })
    cid = resp.get_json()["id"]

    resp = client.get(
        f"/api/customers/{cid}/portal",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.get_json()["portal_enabled"] is False

    client.post(
        f"/api/customers/{cid}/portal/enable",
        headers=auth_headers,
        json={"email": "p4@t.com", "password": "secure123"},
    )
    resp = client.get(
        f"/api/customers/{cid}/portal",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.get_json()["portal_enabled"] is True


def test_portal_reset_password(client, auth_headers):
    resp = client.post("/api/customers", headers=auth_headers, json={
        "name": "Test5", "email": "t5@t.com",
    })
    cid = resp.get_json()["id"]
    client.post(
        f"/api/customers/{cid}/portal/enable",
        headers=auth_headers,
        json={"email": "p5@t.com", "password": "oldpass123"},
    )

    # Login with old password works
    resp = client.post("/api/portal/auth/login", json={
        "email": "p5@t.com", "password": "oldpass123",
    })
    assert resp.status_code == 200

    # Reset password
    resp = client.post(
        f"/api/customers/{cid}/portal/reset-password",
        headers=auth_headers,
        json={"password": "newpass456"},
    )
    assert resp.status_code == 200

    # Old password fails
    resp = client.post("/api/portal/auth/login", json={
        "email": "p5@t.com", "password": "oldpass123",
    })
    assert resp.status_code == 401

    # New password works
    resp = client.post("/api/portal/auth/login", json={
        "email": "p5@t.com", "password": "newpass456",
    })
    assert resp.status_code == 200


def test_portal_routes_reject_regular_user_token(client, auth_headers):
    cid, email, pw = _setup_customer_and_portal(client, auth_headers)
    # Use the admin auth_headers (regular user token) on portal routes
    resp = client.get("/api/portal/dashboard", headers=auth_headers)
    assert resp.status_code == 401


def test_portal_disable_soft_deactivates_and_blocks_login_and_token(client, auth_headers):
    cid, email, pw = _setup_customer_and_portal(client, auth_headers)
    token, _ = _portal_login(client, email, pw)

    # Disable portal access
    resp = client.post(f"/api/customers/{cid}/portal/disable", headers=auth_headers)
    assert resp.status_code == 200

    # User record is retained in database with is_active=False
    portal_user = CustomerPortalUser.query.filter_by(customer_id=cid).first()
    assert portal_user is not None
    assert portal_user.is_active is False

    # Login fails
    resp = client.post("/api/portal/auth/login", json={"email": email, "password": pw})
    assert resp.status_code == 401

    # Active token requests are rejected
    resp = client.get("/api/portal/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


def test_portal_enable_reactivates_disabled_account(client, auth_headers):
    cid, email, pw = _setup_customer_and_portal(client, auth_headers)

    # Disable
    client.post(f"/api/customers/{cid}/portal/disable", headers=auth_headers)

    # Reactivate via enable
    resp = client.post(
        f"/api/customers/{cid}/portal/enable",
        headers=auth_headers,
        json={"password": "reactivatedpass"},
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["is_active"] is True

    # Login with new password works
    token, _ = _portal_login(client, email, "reactivatedpass")
    assert token is not None

