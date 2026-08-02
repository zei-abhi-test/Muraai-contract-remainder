"""End-to-end tests for Purchase Orders: CRUD, status lifecycle, duplicate, search."""
from datetime import date

from conftest import register_user


def auth(client, username="po_e2e_user", email="po_e2e@example.com"):
    _, token = register_user(client, username=username, email=email, role="ADMIN")
    return {"Authorization": f"Bearer {token}"}


def test_purchase_order_full_workflow(client):
    headers = auth(client)

    # 1. Create a customer
    resp = client.post("/api/customers", json={"name": "PO E2E Customer"}, headers=headers)
    assert resp.status_code == 201
    customer_id = resp.get_json()["id"]

    # 2. Create another customer (no contracts)
    resp = client.post("/api/customers", json={"name": "Empty Customer"}, headers=headers)
    assert resp.status_code == 201
    empty_cust_id = resp.get_json()["id"]

    # 3. Create two contracts under first customer
    contract_ids = []
    for i in range(2):
        resp = client.post("/api/contracts", json={
            "company_name": f"PO Contract {i+1}",
            "contract_name": f"Contract {i+1}",
            "start_date": "2026-01-01",
            "end_date": "2027-12-31",
            "renewal_date": "2027-11-30",
            "customer_id": customer_id,
            "notification_enabled": False,
        }, headers=headers)
        assert resp.status_code == 201
        contract_ids.append(resp.get_json()["id"])

    # 4. Verify contracts are filtered by customer correctly
    resp = client.get("/api/contracts", headers=headers)
    all_contracts = resp.get_json()
    customer_contracts = [c for c in all_contracts if c.get("customer_id") == empty_cust_id]
    assert len(customer_contracts) == 0, "Empty customer should have no contracts"
    customer_contracts = [c for c in all_contracts if c.get("customer_id") == customer_id]
    assert len(customer_contracts) == 2, "First customer should have 2 contracts"

    # 5. Create PO linked to customer + both contracts (with new fields)
    resp = client.post("/api/purchase-orders", json={
        "vendor": "Test Vendor Inc.",
        "customer_id": customer_id,
        "amount": 15000.00,
        "status": "Draft",
        "issue_date": "2026-06-01",
        "expected_delivery": "2026-08-15",
        "currency": "USD",
        "remarks": "Urgent order",
        "contract_ids": contract_ids,
    }, headers=headers)
    assert resp.status_code == 201
    po = resp.get_json()
    po_id = po["id"]
    assert po["vendor"] == "Test Vendor Inc."
    assert po["customer_id"] == customer_id
    assert po["amount"] == 15000.00
    assert po["status"] == "Draft"
    assert po["issue_date"] == "2026-06-01"
    assert po["expected_delivery"] == "2026-08-15"
    assert po["currency"] == "USD"
    assert po["remarks"] == "Urgent order"
    assert sorted(po["contract_ids"]) == sorted(contract_ids)
    assert po["po_number"].startswith("PO-")
    assert "allowed_actions" in po
    assert "edit" in po["allowed_actions"]

    # 6. List POs
    resp = client.get("/api/purchase-orders", headers=headers)
    assert resp.status_code == 200
    assert len(resp.get_json()) == 1
    assert resp.get_json()[0]["id"] == po_id

    # 7. Search by vendor
    resp = client.get("/api/purchase-orders?search=Vendor", headers=headers)
    assert resp.status_code == 200
    assert len(resp.get_json()) == 1

    resp = client.get("/api/purchase-orders?search=NonExistent", headers=headers)
    assert resp.status_code == 200
    assert len(resp.get_json()) == 0

    # 8. Filter by contract_id
    resp = client.get(f"/api/purchase-orders?contract_id={contract_ids[0]}", headers=headers)
    assert resp.status_code == 200
    assert len(resp.get_json()) == 1

    resp = client.get("/api/purchase-orders?contract_id=99999", headers=headers)
    assert resp.status_code == 200
    assert len(resp.get_json()) == 0

    # 9. Get single PO detail
    resp = client.get(f"/api/purchase-orders/{po_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["vendor"] == "Test Vendor Inc."

    # 10. Edit PO (update new fields)
    resp = client.put(f"/api/purchase-orders/{po_id}", json={
        "vendor": "Updated Vendor LLC",
        "amount": 25000.50,
        "status": "Approved",
        "currency": "EUR",
        "remarks": "Updated remarks",
        "contract_ids": [contract_ids[0]],  # remove one contract
    }, headers=headers)
    assert resp.status_code == 200
    updated = resp.get_json()
    assert updated["vendor"] == "Updated Vendor LLC"
    assert updated["amount"] == 25000.50
    assert updated["status"] == "Approved"
    assert updated["currency"] == "EUR"
    assert updated["remarks"] == "Updated remarks"
    assert updated["contract_ids"] == [contract_ids[0]]

    # 11. Verify edit persisted
    resp = client.get(f"/api/purchase-orders/{po_id}", headers=headers)
    assert resp.get_json()["vendor"] == "Updated Vendor LLC"

    # --- Status lifecycle ---

    # 12. Cancel from Approved should fail (not in allowed transitions)
    resp = client.post(f"/api/purchase-orders/{po_id}/cancel", headers=headers)
    assert resp.status_code == 409

    # 13. Mark received
    resp = client.post(f"/api/purchase-orders/{po_id}/mark-received", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "Completed"

    # 14. Delete PO
    resp = client.delete(f"/api/purchase-orders/{po_id}", headers=headers)
    assert resp.status_code == 200

    # 15. Verify deleted
    resp = client.get(f"/api/purchase-orders/{po_id}", headers=headers)
    assert resp.status_code == 404

    resp = client.get("/api/purchase-orders", headers=headers)
    assert len(resp.get_json()) == 0

    # 16. Create PO with auto-generated number (global sequential)
    resp = client.post("/api/purchase-orders", json={
        "vendor": "Auto Number Vendor",
        "amount": 5000,
    }, headers=headers)
    assert resp.status_code == 201
    assert resp.get_json()["po_number"].startswith("PO-")

    # 17. Create PO with explicit PO number
    resp = client.post("/api/purchase-orders", json={
        "po_number": "PO-CUSTOM-001",
        "vendor": "Custom Number Vendor",
        "amount": 3000,
    }, headers=headers)
    assert resp.status_code == 201

    # 18. Duplicate PO number rejected
    resp = client.post("/api/purchase-orders", json={
        "po_number": "PO-CUSTOM-001",
        "vendor": "Another Vendor",
        "amount": 1000,
    }, headers=headers)
    assert resp.status_code == 400

    # 19. PO without vendor rejected
    resp = client.post("/api/purchase-orders", json={"amount": 100}, headers=headers)
    assert resp.status_code == 400

    # 20. PO links contract from wrong customer rejected
    resp = client.post("/api/customers", json={"name": "Other Customer"}, headers=headers)
    other_cust_id = resp.get_json()["id"]
    resp = client.post("/api/contracts", json={
        "company_name": "Other Contract",
        "contract_name": "Other",
        "start_date": "2026-01-01",
        "end_date": "2027-12-31",
        "renewal_date": "2027-11-30",
        "customer_id": other_cust_id,
        "notification_enabled": False,
    }, headers=headers)
    other_contract_id = resp.get_json()["id"]

    resp = client.post("/api/purchase-orders", json={
        "vendor": "Wrong Link",
        "customer_id": customer_id,
        "amount": 100,
        "contract_ids": [other_contract_id],
    }, headers=headers)
    assert resp.status_code == 400
    assert "does not belong to" in resp.get_json()["error"]


def test_purchase_order_lifecycle(client):
    """Test the Draft -> Submitted -> Approved -> Completed lifecycle route."""
    headers = auth(client, username="po_lifecycle", email="po_lifecycle@example.com")

    resp = client.post("/api/purchase-orders", json={
        "vendor": "Lifecycle Vendor",
        "amount": 10000,
        "status": "Draft",
    }, headers=headers)
    assert resp.status_code == 201
    po_id = resp.get_json()["id"]

    # Draft -> Submitted
    resp = client.post(f"/api/purchase-orders/{po_id}/submit", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "Submitted"

    # Submitted -> Approved (via PUT update for now)
    # We don't have a dedicated approve endpoint, so use status update
    resp = client.put(f"/api/purchase-orders/{po_id}", json={"status": "Approved"}, headers=headers)
    assert resp.status_code == 200

    # Approved -> Completed (mark received)
    resp = client.post(f"/api/purchase-orders/{po_id}/mark-received", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "Completed"

    # Cannot mark received again
    resp = client.post(f"/api/purchase-orders/{po_id}/mark-received", headers=headers)
    assert resp.status_code == 409


def test_purchase_order_duplicate(client):
    """Test duplicating a PO."""
    headers = auth(client, username="po_dup", email="po_dup@example.com")

    resp = client.post("/api/purchase-orders", json={
        "vendor": "Original Vendor",
        "amount": 5000,
        "currency": "USD",
        "remarks": "Original",
    }, headers=headers)
    assert resp.status_code == 201
    original_id = resp.get_json()["id"]

    resp = client.post(f"/api/purchase-orders/{original_id}/duplicate", headers=headers)
    assert resp.status_code == 201
    dup = resp.get_json()
    assert dup["vendor"] == "Original Vendor"
    assert dup["amount"] == 5000
    assert dup["currency"] == "USD"
    assert dup["status"] == "Draft"
    assert dup["id"] != original_id


def test_purchase_order_pdf_download(client):
    """Test PDF download endpoint returns a file."""
    headers = auth(client, username="po_pdf", email="po_pdf@example.com")

    resp = client.post("/api/purchase-orders", json={
        "vendor": "PDF Vendor",
        "amount": 7500,
    }, headers=headers)
    assert resp.status_code == 201
    po_id = resp.get_json()["id"]

    resp = client.get(f"/api/purchase-orders/{po_id}/pdf", headers=headers)
    assert resp.status_code == 200
    assert "text/plain" in resp.content_type
