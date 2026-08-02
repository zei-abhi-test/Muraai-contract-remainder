"""Tests for the contract lifecycle/approval workflow, delete-safety,
purchase orders, invoices, and the SKU collision fix."""
from datetime import date, timedelta

from conftest import register_user


def auth(client, username="workflow_user", email="workflow_user@example.com"):
    _, token = register_user(client, username=username, email=email, role="ADMIN")
    return {"Authorization": f"Bearer {token}"}


def contract_payload(**overrides):
    today = date.today()
    payload = {
        "company_name": "Acme Corp",
        "contract_name": "Software License",
        "start_date": today.isoformat(),
        "end_date": (today + timedelta(days=365)).isoformat(),
        "renewal_date": (today + timedelta(days=365)).isoformat(),
        "notification_enabled": False,
    }
    payload.update(overrides)
    return payload


def create_customer(client, headers, name="Test Customer"):
    return client.post("/api/customers", json={"name": name}, headers=headers).get_json()


def create_contact(client, headers, customer_id, name="Test Contact"):
    return client.post(
        f"/api/customers/{customer_id}/contacts",
        json={"contact_name": name, "contact_number": "9999999999"},
        headers=headers,
    ).get_json()


def create_product(client, headers, name="Test Product", rate="10", category="General"):
    return client.post(
        "/api/products", json={"name": name, "rate": rate, "category": category}, headers=headers
    ).get_json()


# --------------------------------------------------------------------------
# LIFECYCLE
# --------------------------------------------------------------------------


def test_draft_to_submit_creates_pending_approval(client):
    headers = auth(client)
    contract = client.post("/api/contracts", json=contract_payload(), headers=headers).get_json()
    assert contract["status"] == "Draft"
    assert "submit" in contract["allowed_actions"]

    submit_response = client.post(f"/api/contracts/{contract['id']}/submit", headers=headers)
    assert submit_response.status_code == 200
    body = submit_response.get_json()
    assert body["status"] == "Pending Approval"
    assert body["approval"]["status"] == "Pending"


def test_pending_approval_to_approved_to_active(client):
    headers = auth(client)
    contract = client.post("/api/contracts", json=contract_payload(), headers=headers).get_json()
    submit_body = client.post(f"/api/contracts/{contract['id']}/submit", headers=headers).get_json()
    approval_id = submit_body["approval"]["id"]

    approve_response = client.post(f"/api/approvals/{approval_id}/approve", headers=headers)
    assert approve_response.status_code == 200
    assert approve_response.get_json()["contract_status"] == "Approved"

    activate_response = client.post(f"/api/contracts/{contract['id']}/activate", headers=headers)
    assert activate_response.status_code == 200
    assert activate_response.get_json()["status"] == "Active"


def test_reject_approval_requires_comments_and_moves_contract_to_rejected(client):
    headers = auth(client)
    contract = client.post("/api/contracts", json=contract_payload(), headers=headers).get_json()
    submit_body = client.post(f"/api/contracts/{contract['id']}/submit", headers=headers).get_json()
    approval_id = submit_body["approval"]["id"]

    missing_comments = client.post(f"/api/approvals/{approval_id}/reject", json={}, headers=headers)
    assert missing_comments.status_code == 400

    reject_response = client.post(
        f"/api/approvals/{approval_id}/reject",
        json={"comments": "Pricing needs revision"},
        headers=headers,
    )
    assert reject_response.status_code == 200
    assert reject_response.get_json()["contract_status"] == "Rejected"


def test_contract_cannot_become_active_without_approval(client):
    headers = auth(client)
    contract = client.post("/api/contracts", json=contract_payload(), headers=headers).get_json()

    # Draft -> Active directly is not a valid transition.
    activate_response = client.post(f"/api/contracts/{contract['id']}/activate", headers=headers)
    assert activate_response.status_code == 409

    client.post(f"/api/contracts/{contract['id']}/submit", headers=headers)
    # Pending Approval -> Active directly (skipping approval) is still invalid.
    activate_response = client.post(f"/api/contracts/{contract['id']}/activate", headers=headers)
    assert activate_response.status_code == 409


def test_invalid_lifecycle_transition_returns_409(client):
    headers = auth(client)
    contract = client.post("/api/contracts", json=contract_payload(), headers=headers).get_json()

    hold_response = client.post(f"/api/contracts/{contract['id']}/hold", headers=headers)
    assert hold_response.status_code == 409
    assert "cannot" in hold_response.get_json()["error"].lower()


# --------------------------------------------------------------------------
# APPROVAL LIFECYCLE (cancel, delete, pagination, search)
# --------------------------------------------------------------------------


def test_approval_cancel_reverts_contract_to_draft(client):
    headers = auth(client)
    contract = client.post("/api/contracts", json=contract_payload(), headers=headers).get_json()
    submit_body = client.post(f"/api/contracts/{contract['id']}/submit", headers=headers).get_json()
    approval_id = submit_body["approval"]["id"]

    cancel_response = client.post(f"/api/approvals/{approval_id}/cancel", headers=headers)
    assert cancel_response.status_code == 200
    body = cancel_response.get_json()
    assert body["status"] == "Cancelled"
    assert body["contract_status"] == "Draft"

    # Verify contract is back to Draft
    contract_get = client.get(f"/api/contracts/{contract['id']}", headers=headers).get_json()
    assert contract_get["status"] == "Draft"


def test_approval_cancel_fails_for_non_pending(client):
    headers = auth(client)
    contract = client.post("/api/contracts", json=contract_payload(), headers=headers).get_json()
    submit_body = client.post(f"/api/contracts/{contract['id']}/submit", headers=headers).get_json()
    approval_id = submit_body["approval"]["id"]

    # Approve first
    client.post(f"/api/approvals/{approval_id}/approve", headers=headers)

    # Now cancel should fail
    cancel_response = client.post(f"/api/approvals/{approval_id}/cancel", headers=headers)
    assert cancel_response.status_code == 409


def test_delete_approval_fails_for_pending(client):
    headers = auth(client)
    contract = client.post("/api/contracts", json=contract_payload(), headers=headers).get_json()
    submit_body = client.post(f"/api/contracts/{contract['id']}/submit", headers=headers).get_json()
    approval_id = submit_body["approval"]["id"]

    delete_response = client.delete(f"/api/approvals/{approval_id}", headers=headers)
    assert delete_response.status_code == 409


def test_delete_approval_succeeds_for_cancelled(client):
    headers = auth(client)
    contract = client.post("/api/contracts", json=contract_payload(), headers=headers).get_json()
    submit_body = client.post(f"/api/contracts/{contract['id']}/submit", headers=headers).get_json()
    approval_id = submit_body["approval"]["id"]

    client.post(f"/api/approvals/{approval_id}/cancel", headers=headers)
    delete_response = client.delete(f"/api/approvals/{approval_id}", headers=headers)
    assert delete_response.status_code == 200


def test_approval_list_pagination(client):
    headers = auth(client)
    # Create 3 contracts and submit them
    for i in range(3):
        contract = client.post(
            "/api/contracts", json=contract_payload(contract_name=f"Contract {i}"),
            headers=headers
        ).get_json()
        client.post(f"/api/contracts/{contract['id']}/submit", headers=headers)

    # Default pagination
    resp = client.get("/api/approvals", headers=headers).get_json()
    assert resp["total"] == 3
    assert len(resp["approvals"]) == 3
    assert resp["pages"] == 1

    # With per_page=1
    resp = client.get("/api/approvals?per_page=1&page=1", headers=headers).get_json()
    assert resp["total"] == 3
    assert len(resp["approvals"]) == 1
    assert resp["pages"] == 3


def test_approval_list_search(client):
    headers = auth(client)
    contract = client.post(
        "/api/contracts", json=contract_payload(contract_name="AlphaSearch"),
        headers=headers
    ).get_json()
    client.post(f"/api/contracts/{contract['id']}/submit", headers=headers)

    contract2 = client.post(
        "/api/contracts", json=contract_payload(contract_name="Beta"),
        headers=headers
    ).get_json()
    client.post(f"/api/contracts/{contract2['id']}/submit", headers=headers)

    resp = client.get("/api/approvals?search=Alpha", headers=headers).get_json()
    assert resp["total"] == 1
    assert resp["approvals"][0]["contract_name"] == "AlphaSearch"


def test_approval_list_status_filter(client):
    headers = auth(client)
    contract = client.post("/api/contracts", json=contract_payload(), headers=headers).get_json()
    submit_body = client.post(f"/api/contracts/{contract['id']}/submit", headers=headers).get_json()
    approval_id = submit_body["approval"]["id"]

    # Filter pending
    resp = client.get("/api/approvals?status=pending", headers=headers).get_json()
    assert resp["total"] == 1

    # Approve
    client.post(f"/api/approvals/{approval_id}/approve", headers=headers)

    # Filter approved
    resp = client.get("/api/approvals?status=approved", headers=headers).get_json()
    assert resp["total"] == 1

    # Filter pending - should be 0
    resp = client.get("/api/approvals?status=pending", headers=headers).get_json()
    assert resp["total"] == 0


def test_requested_by_set_on_submit(client):
    headers = auth(client)
    contract = client.post("/api/contracts", json=contract_payload(), headers=headers).get_json()
    submit_body = client.post(f"/api/contracts/{contract['id']}/submit", headers=headers).get_json()
    assert submit_body["approval"]["requested_by"] is not None


def test_approval_detail_includes_new_fields(client):
    headers = auth(client)
    contract = client.post("/api/contracts", json=contract_payload(), headers=headers).get_json()
    submit_body = client.post(f"/api/contracts/{contract['id']}/submit", headers=headers).get_json()
    approval_id = submit_body["approval"]["id"]

    resp = client.get(f"/api/approvals/{approval_id}", headers=headers).get_json()
    assert "requester_name" in resp
    assert "approver_name" in resp
    assert "approval_level" in resp
    assert "cancelled_at" in resp


def test_approvals_list_shows_pending_submission(client):
    headers = auth(client)
    contract = client.post("/api/contracts", json=contract_payload(), headers=headers).get_json()
    client.post(f"/api/contracts/{contract['id']}/submit", headers=headers)

    resp = client.get("/api/approvals", headers=headers).get_json()
    assert resp["total"] == 1
    assert resp["approvals"][0]["contract_id"] == contract["id"]
    assert resp["approvals"][0]["status"] == "Pending"


# --------------------------------------------------------------------------
# DELETE SAFETY
# --------------------------------------------------------------------------


def test_delete_unreferenced_customer_succeeds(client):
    headers = auth(client)
    customer = create_customer(client, headers)
    response = client.delete(f"/api/customers/{customer['id']}", headers=headers)
    assert response.status_code == 200


def test_delete_referenced_customer_rejected_with_409(client):
    headers = auth(client)
    customer = create_customer(client, headers)
    client.post(
        "/api/contracts",
        json=contract_payload(customer_id=customer["id"]),
        headers=headers,
    )
    response = client.delete(f"/api/customers/{customer['id']}", headers=headers)
    assert response.status_code == 409
    assert "contract" in response.get_json()["error"].lower()


def test_delete_unreferenced_contact_succeeds(client):
    headers = auth(client)
    customer = create_customer(client, headers)
    contact = create_contact(client, headers, customer["id"])
    response = client.delete(f"/api/contacts/{contact['id']}", headers=headers)
    assert response.status_code == 200


def test_delete_referenced_contact_rejected_with_409(client):
    headers = auth(client)
    customer = create_customer(client, headers)
    contact = create_contact(client, headers, customer["id"])
    client.post(
        "/api/contracts",
        json=contract_payload(customer_id=customer["id"], contact_person_id=contact["id"]),
        headers=headers,
    )
    response = client.delete(f"/api/contacts/{contact['id']}", headers=headers)
    assert response.status_code == 409


def test_delete_unreferenced_product_hard_deletes(client):
    headers = auth(client)
    product = create_product(client, headers)
    response = client.delete(f"/api/products/{product['id']}", headers=headers)
    assert response.status_code == 200
    assert response.get_json()["deactivated"] is False


def test_delete_referenced_product_deactivates_instead_of_deleting(client):
    headers = auth(client)
    product = create_product(client, headers)
    client.post(
        "/api/contracts",
        json=contract_payload(
            line_items=[{"product_id": product["id"], "quantity": 1, "rate": 10}],
        ),
        headers=headers,
    )
    response = client.delete(f"/api/products/{product['id']}", headers=headers)
    assert response.status_code == 200
    body = response.get_json()
    assert body["deactivated"] is True
    assert body["product"]["status"] == "inactive"

    # The line item snapshot itself must remain untouched.
    line_items = client.get("/api/reports/line-items", headers=headers).get_json()
    assert any(item["product_id"] == product["id"] for item in line_items)


# --------------------------------------------------------------------------
# PURCHASE ORDERS
# --------------------------------------------------------------------------


def test_create_purchase_order(client):
    headers = auth(client)
    customer = create_customer(client, headers)
    response = client.post(
        "/api/purchase-orders",
        json={"vendor": "Acme Vendor", "customer_id": customer["id"], "amount": "5000"},
        headers=headers,
    )
    assert response.status_code == 201
    body = response.get_json()
    assert body["po_number"]
    assert body["vendor"] == "Acme Vendor"


def test_purchase_order_links_to_contracts(client):
    headers = auth(client)
    customer = create_customer(client, headers)
    contract = client.post(
        "/api/contracts",
        json=contract_payload(customer_id=customer["id"]),
        headers=headers,
    ).get_json()

    response = client.post(
        "/api/purchase-orders",
        json={
            "vendor": "Acme Vendor",
            "customer_id": customer["id"],
            "amount": "1000",
            "contract_ids": [contract["id"]],
        },
        headers=headers,
    )
    assert response.status_code == 201
    assert response.get_json()["contract_ids"] == [contract["id"]]


def test_purchase_order_rejects_another_users_contract(client):
    headers = auth(client, username="po_owner", email="po_owner@example.com")
    other_headers = auth(client, username="po_other", email="po_other@example.com")

    other_contract = client.post(
        "/api/contracts", json=contract_payload(), headers=other_headers
    ).get_json()

    response = client.post(
        "/api/purchase-orders",
        json={"vendor": "Acme Vendor", "amount": "1000", "contract_ids": [other_contract["id"]]},
        headers=headers,
    )
    assert response.status_code == 400


# --------------------------------------------------------------------------
# INVOICES
# --------------------------------------------------------------------------


def test_create_invoice_derives_customer_from_contract(client):
    headers = auth(client)
    customer = create_customer(client, headers)
    contract = client.post(
        "/api/contracts",
        json=contract_payload(customer_id=customer["id"]),
        headers=headers,
    ).get_json()

    response = client.post(
        "/api/invoices",
        json={"contract_id": contract["id"], "amount": "1500"},
        headers=headers,
    )
    assert response.status_code == 201
    body = response.get_json()
    assert body["customer_id"] == customer["id"]
    assert body["contract_id"] == contract["id"]


def test_invoice_rejects_another_users_contract(client):
    headers = auth(client, username="inv_owner", email="inv_owner@example.com")
    other_headers = auth(client, username="inv_other", email="inv_other@example.com")

    other_contract = client.post(
        "/api/contracts", json=contract_payload(), headers=other_headers
    ).get_json()

    response = client.post(
        "/api/invoices",
        json={"contract_id": other_contract["id"], "amount": "500"},
        headers=headers,
    )
    assert response.status_code == 404


def test_invoice_overdue_status_derived_from_due_date(client):
    headers = auth(client)
    past_due = (date.today() - timedelta(days=5)).isoformat()
    response = client.post(
        "/api/invoices",
        json={"amount": "200", "due_date": past_due, "status": "ISSUED"},
        headers=headers,
    )
    assert response.status_code == 201
    assert response.get_json()["status"] == "OVERDUE"


# --------------------------------------------------------------------------
# RENEWALS
# --------------------------------------------------------------------------


def _activate_contract(client, headers, contract_id):
    submit_body = client.post(f"/api/contracts/{contract_id}/submit", headers=headers).get_json()
    approval_id = submit_body["approval"]["id"]
    client.post(f"/api/approvals/{approval_id}/approve", headers=headers)
    client.post(f"/api/contracts/{contract_id}/activate", headers=headers)


def test_renewal_requires_eligible_status(client):
    headers = auth(client)
    contract = client.post("/api/contracts", json=contract_payload(), headers=headers).get_json()

    response = client.post(f"/api/contracts/{contract['id']}/renew", json={}, headers=headers)
    assert response.status_code == 409


def test_renewal_creates_new_version_and_preserves_original(client):
    headers = auth(client)
    today = date.today()
    contract = client.post("/api/contracts", json=contract_payload(), headers=headers).get_json()
    _activate_contract(client, headers, contract["id"])

    renewal_response = client.post(
        f"/api/contracts/{contract['id']}/renew",
        json={
            "start_date": (today + timedelta(days=366)).isoformat(),
            "end_date": (today + timedelta(days=730)).isoformat(),
        },
        headers=headers,
    )
    assert renewal_response.status_code == 201
    renewed = renewal_response.get_json()
    assert renewed["previous_contract_id"] == contract["id"]
    assert renewed["contract_version"] == 2

    original = client.get(f"/api/contracts/{contract['id']}", headers=headers).get_json()
    assert original["status"] == "Renewed"
    assert original["contract_name"] == contract["contract_name"]


# --------------------------------------------------------------------------
# SKU COLLISION FIX
# --------------------------------------------------------------------------


def test_two_users_creating_products_same_category_year_get_unique_skus(client):
    headers_a = auth(client, username="sku_user_a", email="sku_user_a@example.com")
    headers_b = auth(client, username="sku_user_b", email="sku_user_b@example.com")

    product_a = client.post(
        "/api/products",
        json={"name": "First Product", "rate": "10", "category": "Widgets"},
        headers=headers_a,
    ).get_json()
    product_b = client.post(
        "/api/products",
        json={"name": "First Product", "rate": "10", "category": "Widgets"},
        headers=headers_b,
    ).get_json()

    assert product_a["sku"] != product_b["sku"]
    assert "sku" in product_a
    assert product_a["sku"].startswith("SKU-WID-MUR")


def test_same_user_sequential_products_get_unique_skus(client):
    headers = auth(client, username="sku_seq_user", email="sku_seq_user@example.com")

    skus = set()
    for i in range(5):
        resp = client.post(
            "/api/products",
            json={"name": f"Seq Product {i}", "rate": "10", "category": "Widgets"},
            headers=headers,
        )
        assert resp.status_code == 201, f"Request {i} failed: {resp.get_json()}"
        product = resp.get_json()
        assert "sku" in product
        assert product["sku"] not in skus, f"Duplicate SKU {product['sku']} at index {i}"
        skus.add(product["sku"])

    assert len(skus) == 5


def test_different_categories_produce_different_sku_prefixes(client):
    headers = auth(client, username="sku_cat_user", email="sku_cat_user@example.com")

    product_a = client.post(
        "/api/products",
        json={"name": "Widget Product", "rate": "10", "category": "Widgets"},
        headers=headers,
    ).get_json()
    product_b = client.post(
        "/api/products",
        json={"name": "Service Product", "rate": "20", "category": "Services"},
        headers=headers,
    ).get_json()

    assert product_a["sku"].startswith("SKU-WID-MUR")
    assert product_b["sku"].startswith("SKU-SER-MUR")
    assert product_a["sku"] != product_b["sku"]


def test_creating_three_products_same_category_sequential_skus(client):
    headers = auth(client, username="sku_three_user", email="sku_three_user@example.com")

    year = date.today().year
    products = []
    for i in range(3):
        resp = client.post(
            "/api/products",
            json={"name": f"Product {i}", "rate": "10", "category": "Widgets"},
            headers=headers,
        )
        assert resp.status_code == 201
        products.append(resp.get_json())

    for product in products:
        assert product["sku"].startswith("SKU-WID-MUR")

    skus = [p["sku"] for p in products]
    assert len(set(skus)) == 3, f"Expected 3 unique SKUs, got {skus}"

    suffixes = [int(sku.rsplit("-", 1)[1]) for sku in skus]
    suffixes.sort()
    assert suffixes == [1, 2, 3], f"Expected sequential suffixes [1, 2, 3], got {suffixes}"
