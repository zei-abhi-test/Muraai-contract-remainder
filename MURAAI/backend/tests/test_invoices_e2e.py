"""End-to-end tests for Invoices: create, edit, issue, mark paid, cancel, delete."""
from datetime import date, timedelta

from conftest import register_user


def auth(client, username="inv_e2e_user", email="inv_e2e@example.com"):
    _, token = register_user(client, username=username, email=email, role="ADMIN")
    return {"Authorization": f"Bearer {token}"}


def test_invoice_full_workflow(client):
    headers = auth(client)

    # 1. Create a customer
    resp = client.post("/api/customers", json={"name": "Invoice Customer"}, headers=headers)
    assert resp.status_code == 201
    customer_id = resp.get_json()["id"]

    # 2. Create a contract under that customer
    resp = client.post("/api/contracts", json={
        "company_name": "Invoice Contract Co",
        "contract_name": "Invoice Test Contract",
        "start_date": "2026-01-01",
        "end_date": "2027-12-31",
        "renewal_date": "2027-11-30",
        "customer_id": customer_id,
        "notification_enabled": False,
    }, headers=headers)
    assert resp.status_code == 201
    contract = resp.get_json()
    contract_id = contract["id"]

    # 3. Create a draft invoice linked to contract
    resp = client.post("/api/invoices", json={
        "contract_id": contract_id,
        "amount": 5000.00,
        "status": "DRAFT",
        "due_date": (date.today() + timedelta(days=30)).isoformat(),
    }, headers=headers)
    assert resp.status_code == 201
    inv = resp.get_json()
    inv_id = inv["id"]
    assert inv["customer_id"] == customer_id  # resolved from contract
    assert inv["contract_id"] == contract_id
    assert inv["amount"] == 5000.00
    assert inv["status"] == "DRAFT"
    assert inv["invoice_number"].startswith("INV-")
    print(f"1. Created draft invoice {inv_id}: customer={inv['customer_id']}, amount={inv['amount']}")

    # 4. Frontend customer_id should be ignored when contract is provided
    resp = client.post("/api/invoices", json={
        "contract_id": contract_id,
        "customer_id": 99999,
        "amount": 3000,
        "status": "DRAFT",
    }, headers=headers)
    assert resp.status_code == 201
    assert resp.get_json()["customer_id"] == customer_id, "customer_id must be resolved from contract, not frontend"
    fake_cust_inv_id = resp.get_json()["id"]
    print(f"2. Frontend customer_id ignored — resolved from contract: {customer_id}")

    # 5. Edit draft invoice
    resp = client.put(f"/api/invoices/{inv_id}", json={
        "amount": 7500.50,
        "due_date": (date.today() + timedelta(days=45)).isoformat(),
    }, headers=headers)
    assert resp.status_code == 200
    edited = resp.get_json()
    assert edited["amount"] == 7500.50
    print(f"3. Edited draft invoice: amount=7500.50")

    # 6. Verify non-draft cannot be edited
    # First issue it
    resp = client.post(f"/api/invoices/{inv_id}/issue", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "ISSUED"

    resp = client.put(f"/api/invoices/{inv_id}", json={"amount": 10000}, headers=headers)
    assert resp.status_code == 409
    assert "DRAFT" in resp.get_json()["error"]
    print(f"4. Issued invoice {inv_id}, edit rejected (409)")

    # 7. Mark issued invoice as paid
    resp = client.post(f"/api/invoices/{inv_id}/mark-paid", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "PAID"
    print(f"5. Marked invoice {inv_id} as PAID")

    # 8. Cannot cancel paid invoice
    resp = client.post(f"/api/invoices/{inv_id}/cancel", headers=headers)
    assert resp.status_code == 409
    assert "PAID" in resp.get_json()["error"]
    print(f"6. Cancel paid invoice rejected (409)")

    # 9. Full flow: create draft -> delete draft
    resp = client.post("/api/invoices", json={
        "contract_id": contract_id,
        "amount": 2000,
        "status": "DRAFT",
    }, headers=headers)
    assert resp.status_code == 201
    delete_inv_id = resp.get_json()["id"]

    resp = client.delete(f"/api/invoices/{delete_inv_id}", headers=headers)
    assert resp.status_code == 200
    print(f"7. Created and deleted draft invoice {delete_inv_id}")

    # 10. Cannot delete issued invoice
    resp = client.post("/api/invoices", json={
        "contract_id": contract_id,
        "amount": 3000,
        "status": "ISSUED",
    }, headers=headers)
    assert resp.status_code == 201
    issued_inv_id = resp.get_json()["id"]

    resp = client.delete(f"/api/invoices/{issued_inv_id}", headers=headers)
    assert resp.status_code == 409
    print(f"8. Delete issued invoice {issued_inv_id} rejected (409)")

    # 11. Cancel issued invoice
    resp = client.post(f"/api/invoices/{issued_inv_id}/cancel", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "CANCELLED"
    print(f"9. Cancelled invoice {issued_inv_id}")

    # 12. Invoice without contract (standalone) works
    resp = client.post("/api/invoices", json={
        "customer_id": customer_id,
        "amount": 1000,
        "status": "DRAFT",
    }, headers=headers)
    assert resp.status_code == 201
    standalone_id = resp.get_json()["id"]
    assert resp.get_json()["customer_id"] == customer_id
    print(f"10. Created standalone invoice {standalone_id} with explicit customer")

    # 13. List and search
    resp = client.get("/api/invoices", headers=headers)
    all_invoices = resp.get_json()
    assert len(all_invoices) >= 4  # at least 4 invoices created
    print(f"11. Listed invoices: {len(all_invoices)} total")

    resp = client.get(f"/api/invoices?search={inv['invoice_number']}", headers=headers)
    assert len(resp.get_json()) == 1
    print(f"12. Search by invoice number works")

    # 14. Filter by contract_id
    resp = client.get(f"/api/invoices?contract_id={contract_id}", headers=headers)
    assert len(resp.get_json()) >= 2
    print(f"13. Filter by contract_id works")

    # 15. Verify overdue status is derived
    past_due = (date.today() - timedelta(days=5)).isoformat()
    resp = client.post("/api/invoices", json={
        "contract_id": contract_id,
        "amount": 500,
        "due_date": past_due,
        "status": "ISSUED",
    }, headers=headers)
    assert resp.status_code == 201
    assert resp.get_json()["status"] == "OVERDUE"
    print(f"14. Overdue derived from past due_date")

    # 16. Get single invoice
    resp = client.get(f"/api/invoices/{inv_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["id"] == inv_id
    print("15. Get single invoice works")

    # Cleanup: remove the fake-customer invoice
    resp = client.delete(f"/api/invoices/{fake_cust_inv_id}", headers=headers)
    assert resp.status_code == 200

    print("\n=== ALL INVOICE E2E TESTS PASSED ===")


def test_invoice_new_fields_and_calculation(client):
    """Test new fields: tax, discount, total, currency, remarks, purchase_order_id."""
    headers = auth(client, username="inv_fields", email="inv_fields@example.com")

    resp = client.post("/api/invoices", json={
        "amount": 10000,
        "tax": 1800,
        "discount": 500,
        "total": 11300,
        "currency": "USD",
        "remarks": "Test invoice",
        "status": "DRAFT",
    }, headers=headers)
    assert resp.status_code == 201
    inv = resp.get_json()
    assert inv["amount"] == 10000
    assert inv["tax"] == 1800
    assert inv["discount"] == 500
    assert inv["total"] == 11300
    assert inv["currency"] == "USD"
    assert inv["remarks"] == "Test invoice"
    assert inv["paid_date"] is None
    assert inv["line_items"] == []

    # Edit new fields
    resp = client.put(f"/api/invoices/{inv['id']}", json={
        "tax": 2000,
        "remarks": "Updated remarks",
    }, headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["tax"] == 2000
    assert resp.get_json()["remarks"] == "Updated remarks"


def test_invoice_duplicate(client):
    """Test duplicating an invoice."""
    headers = auth(client, username="inv_dup", email="inv_dup@example.com")

    resp = client.post("/api/invoices", json={
        "amount": 5000,
        "tax": 500,
        "currency": "EUR",
        "remarks": "Original",
        "status": "DRAFT",
    }, headers=headers)
    assert resp.status_code == 201
    original_id = resp.get_json()["id"]

    resp = client.post(f"/api/invoices/{original_id}/duplicate", headers=headers)
    assert resp.status_code == 201
    dup = resp.get_json()
    assert dup["amount"] == 5000
    assert dup["tax"] == 500
    assert dup["currency"] == "EUR"
    assert dup["status"] == "DRAFT"
    assert dup["id"] != original_id


def test_invoice_pdf_download(client):
    """Test PDF download returns a file."""
    headers = auth(client, username="inv_pdf", email="inv_pdf@example.com")

    resp = client.post("/api/invoices", json={
        "amount": 7500,
        "status": "DRAFT",
    }, headers=headers)
    assert resp.status_code == 201
    inv_id = resp.get_json()["id"]

    resp = client.get(f"/api/invoices/{inv_id}/pdf", headers=headers)
    assert resp.status_code == 200
    assert "text/plain" in resp.content_type


def test_invoice_send_email(client):
    """Test send-email endpoint (will fail if Resend is not configured, but
    should return a proper error, not crash)."""
    headers = auth(client, username="inv_email", email="inv_email@example.com")

    resp = client.post("/api/invoices", json={
        "amount": 3000,
        "status": "DRAFT",
    }, headers=headers)
    assert resp.status_code == 201
    inv_id = resp.get_json()["id"]

    # Missing to_email
    resp = client.post(f"/api/invoices/{inv_id}/send-email", json={}, headers=headers)
    assert resp.status_code == 400
    assert "to_email" in resp.get_json()["error"]


def test_invoice_line_items(client):
    """Test creating invoice with line items."""
    headers = auth(client, username="inv_line", email="inv_line@example.com")

    resp = client.post("/api/invoices", json={
        "amount": 1000,
        "total": 1000,
        "status": "DRAFT",
        "line_items": [
            {"product_name": "Item A", "quantity": 2, "rate": 300, "amount": 600},
            {"product_name": "Item B", "quantity": 1, "rate": 400, "amount": 400},
        ],
    }, headers=headers)
    assert resp.status_code == 201
    inv = resp.get_json()
    assert len(inv["line_items"]) == 2
    assert inv["line_items"][0]["product_name"] == "Item A"
    assert inv["line_items"][0]["quantity"] == 2
    assert inv["line_items"][1]["product_name"] == "Item B"
    assert inv["line_items"][1]["amount"] == 400


def test_invoice_paid_date_recorded(client):
    """Verify paid_date is set when marking as paid."""
    headers = auth(client, username="inv_pdate", email="inv_pdate@example.com")

    resp = client.post("/api/invoices", json={
        "amount": 2000,
        "status": "ISSUED",
    }, headers=headers)
    assert resp.status_code == 201
    inv_id = resp.get_json()["id"]

    resp = client.post(f"/api/invoices/{inv_id}/mark-paid", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["paid_date"] is not None
    assert resp.get_json()["status"] == "PAID"
