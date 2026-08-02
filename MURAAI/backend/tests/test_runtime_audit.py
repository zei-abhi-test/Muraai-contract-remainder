"""Runtime audit: test every API endpoint for all pages."""
import json
from datetime import date, datetime, timedelta

from src.models.contract import (
    Contract, ContractApproval, ContractDocument, ContractLineItem,
    ContactPerson, Customer, Invoice, Notification, Product, PurchaseOrder, 
    PurchaseOrderContract, ActivityLog, db,
)
from src.models.user import User
from src.models.calendar import CalendarEvent


def _seed_all(uid):
    """Seed data for every entity type."""
    now = datetime.utcnow()
    today = date.today()
    
    cust = Customer(name="Test Corp", email="c@t.com", phone="123", user_id=uid)
    db.session.add(cust)
    db.session.flush()
    
    contact = ContactPerson(contact_name="Bob", contact_number="123", email="b@t.com", customer_id=cust.id, user_id=uid)
    db.session.add(contact)
    
    prod = Product(name="Widget", sku="W-1", rate=100, user_id=uid)
    db.session.add(prod)
    db.session.flush()
    
    contract = Contract(
        contract_name="Test Contract", contract_number="C-1",
        company_name="Test Corp", customer_id=cust.id, user_id=uid,
        status="Active", start_date=today - timedelta(days=30),
        end_date=today + timedelta(days=30), renewal_date=today + timedelta(days=15),
        total_contract_value=10000,
    )
    db.session.add(contract)
    db.session.flush()
    
    line = ContractLineItem(
        contract_id=contract.id, product_id=prod.id, product_name="Widget",
        quantity=1, rate=100, line_total=100,
    )
    db.session.add(line)
    
    appr = ContractApproval(
        contract_id=contract.id, status="Pending",
        requested_by=uid, submitted_at=now,
    )
    db.session.add(appr)
    
    inv = Invoice(
        invoice_number="INV-1", user_id=uid, customer_id=cust.id,
        contract_id=contract.id, status="ISSUED", amount=1000,
        due_date=today + timedelta(days=7),
    )
    db.session.add(inv)
    
    po = PurchaseOrder(
        po_number="PO-1", user_id=uid, vendor="Vendor Inc",
        amount=500, status="Pending", po_date=today,
    )
    db.session.add(po)
    db.session.flush()
    
    db.session.add(PurchaseOrderContract(purchase_order_id=po.id, contract_id=contract.id))
    
    doc = ContractDocument(
        contract_id=contract.id, file_name="doc.pdf",
        stored_file_name="s_doc.pdf", file_path="/tmp/doc.pdf",
        uploaded_at=now,
    )
    db.session.add(doc)
    
    notif = Notification(
        contract_id=contract.id, notification_type="email",
        status="pending", message="Test",
    )
    db.session.add(notif)
    
    act = ActivityLog(
        user_id=uid, activity_type="created",
        title="Test", description="desc",
    )
    db.session.add(act)
    
    event = CalendarEvent(
        user_id=uid, title="Test Event", event_type="meeting",
        start=datetime.combine(today, datetime.min.time()),
        end=datetime.combine(today + timedelta(hours=1), datetime.min.time()),
    )
    db.session.add(event)
    
    db.session.commit()


# ── Dashboard ──

def test_dashboard_data(client, admin_headers):
    resp = client.get("/api/dashboard/data", headers=admin_headers)
    assert resp.status_code == 200, f"DASHBOARD empty: {resp.get_json()}"

def test_dashboard_data_seeded(client, admin_headers):
    me = client.get("/api/auth/me", headers=admin_headers).get_json()
    _seed_all(me["id"])
    resp = client.get("/api/dashboard/data", headers=admin_headers)
    assert resp.status_code == 200, f"DASHBOARD seeded: {resp.get_json()}"
    body = resp.get_json()
    assert body["summary"]["total_contracts"] >= 1
    assert body["summary"]["total_customers"] >= 1
    assert body["summary"]["total_products"] >= 1

def test_dashboard_legacy(client, admin_headers):
    resp = client.get("/api/contracts/dashboard", headers=admin_headers)
    assert resp.status_code == 200, f"DASHBOARD legacy: {resp.get_json()}"


# ── Customers ──

def test_customers_empty(client, admin_headers):
    resp = client.get("/api/customers", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.get_json() == []

def test_customers_crud(client, admin_headers):
    me = client.get("/api/auth/me", headers=admin_headers).get_json()
    uid = me["id"]
    # Create
    resp = client.post("/api/customers", json={"name": "NewCo", "email": "n@c.com"}, headers=admin_headers)
    assert resp.status_code == 201, f"CREATE customer: {resp.get_json()}"
    cid = resp.get_json()["id"]
    # List
    resp = client.get("/api/customers", headers=admin_headers)
    assert resp.status_code == 200
    assert len(resp.get_json()) == 1
    # Search
    resp = client.get("/api/customers?search=NewCo", headers=admin_headers)
    assert resp.status_code == 200
    assert len(resp.get_json()) >= 1
    # Get
    resp = client.get(f"/api/customers/{cid}", headers=admin_headers)
    assert resp.status_code == 200
    # Update
    resp = client.put(f"/api/customers/{cid}", json={"name": "UpdatedCo"}, headers=admin_headers)
    assert resp.status_code == 200, f"UPDATE customer: {resp.get_json()}"
    # Delete
    resp = client.delete(f"/api/customers/{cid}", headers=admin_headers)
    assert resp.status_code == 200


# ── Contacts ──

def test_contacts_empty(client, admin_headers):
    resp = client.get("/api/contacts", headers=admin_headers)
    assert resp.status_code == 200

def test_contacts_crud(client, admin_headers):
    cust_resp = client.post("/api/customers", json={"name": "CustCo"}, headers=admin_headers)
    cid = cust_resp.get_json()["id"]
    resp = client.post(f"/api/customers/{cid}/contacts", json={"contact_name": "Alice", "contact_number": "123", "email": "a@c.com"}, headers=admin_headers)
    assert resp.status_code == 201, f"CREATE contact: {resp.get_json()}"
    ctid = resp.get_json()["id"]
    resp = client.get("/api/contacts", headers=admin_headers)
    assert resp.status_code == 200
    resp = client.put(f"/api/contacts/{ctid}", json={"contact_name": "AliceUpdated"}, headers=admin_headers)
    assert resp.status_code == 200
    resp = client.delete(f"/api/contacts/{ctid}", headers=admin_headers)
    assert resp.status_code == 200


# ── Products ──

def test_products_empty(client, admin_headers):
    resp = client.get("/api/products", headers=admin_headers)
    assert resp.status_code == 200

def test_products_crud(client, admin_headers):
    resp = client.post("/api/products", json={"name": "Gadget", "rate": 50, "sku": "G-1"}, headers=admin_headers)
    assert resp.status_code == 201, f"CREATE product: {resp.get_json()}"
    pid = resp.get_json()["id"]
    resp = client.get("/api/products", headers=admin_headers)
    assert resp.status_code == 200
    assert len(resp.get_json()) >= 1
    resp = client.get(f"/api/products/{pid}", headers=admin_headers)
    assert resp.status_code == 200
    resp = client.put(f"/api/products/{pid}", json={"name": "GadgetPro"}, headers=admin_headers)
    assert resp.status_code == 200
    resp = client.delete(f"/api/products/{pid}", headers=admin_headers)
    assert resp.status_code == 200


# ── Contracts ──

def test_contracts_empty(client, admin_headers):
    resp = client.get("/api/contracts", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data is not None

def test_contracts_crud(client, admin_headers):
    me = client.get("/api/auth/me", headers=admin_headers).get_json()
    cust = client.post("/api/customers", json={"name": "ContractCo"}, headers=admin_headers).get_json()
    resp = client.post("/api/contracts", json={
        "contract_name": "Test", "company_name": "Co",
        "start_date": "2024-01-01", "end_date": "2024-12-31",
        "renewal_date": "2024-11-30", "customer_id": cust["id"],
        "notification_enabled": False,
    }, headers=admin_headers)
    assert resp.status_code == 201, f"CREATE contract: {resp.get_json()}"
    ctid = resp.get_json()["id"]
    resp = client.get("/api/contracts?status=active", headers=admin_headers)
    assert resp.status_code == 200
    resp = client.get("/api/contracts?search=Test", headers=admin_headers)
    assert resp.status_code == 200
    resp = client.get(f"/api/contracts/{ctid}", headers=admin_headers)
    assert resp.status_code == 200
    resp = client.put(f"/api/contracts/{ctid}", json={"contract_name": "Updated"}, headers=admin_headers)
    assert resp.status_code == 200
    resp = client.delete(f"/api/contracts/{ctid}", headers=admin_headers)
    assert resp.status_code in (200, 204)


# ── Purchase Orders ──

def test_purchase_orders_crud(client, admin_headers):
    resp = client.get("/api/purchase-orders", headers=admin_headers)
    assert resp.status_code == 200
    resp = client.post("/api/purchase-orders", json={"vendor": "VendorX", "amount": 100}, headers=admin_headers)
    assert resp.status_code == 201, f"CREATE PO: {resp.get_json()}"
    poid = resp.get_json()["id"]
    resp = client.get(f"/api/purchase-orders/{poid}", headers=admin_headers)
    assert resp.status_code == 200
    resp = client.put(f"/api/purchase-orders/{poid}", json={"vendor": "VendorY"}, headers=admin_headers)
    assert resp.status_code == 200
    resp = client.delete(f"/api/purchase-orders/{poid}", headers=admin_headers)
    assert resp.status_code == 200


# ── Invoices ──

def test_invoices_crud(client, admin_headers):
    resp = client.get("/api/invoices", headers=admin_headers)
    assert resp.status_code == 200
    me = client.get("/api/auth/me", headers=admin_headers).get_json()
    cust = client.post("/api/customers", json={"name": "InvCo"}, headers=admin_headers).get_json()
    resp = client.post("/api/invoices", json={
        "customer_id": cust["id"], "amount": 500, "status": "DRAFT",
    }, headers=admin_headers)
    assert resp.status_code == 201, f"CREATE invoice: {resp.get_json()}"
    iid = resp.get_json()["id"]
    resp = client.get(f"/api/invoices/{iid}", headers=admin_headers)
    assert resp.status_code == 200
    resp = client.put(f"/api/invoices/{iid}", json={"amount": 600}, headers=admin_headers)
    assert resp.status_code == 200
    resp = client.delete(f"/api/invoices/{iid}", headers=admin_headers)
    assert resp.status_code == 200


# ── Approvals ──

def test_approvals_empty(client, admin_headers):
    resp = client.get("/api/approvals", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert "approvals" in data
    assert "total" in data

def test_approvals_crud(client, admin_headers):
    me = client.get("/api/auth/me", headers=admin_headers).get_json()
    cust = client.post("/api/customers", json={"name": "ApprCo"}, headers=admin_headers).get_json()
    ct = client.post("/api/contracts", json={
        "contract_name": "Appr", "company_name": "Co",
        "start_date": "2024-01-01", "end_date": "2024-12-31",
        "renewal_date": "2024-11-30", "customer_id": cust["id"],
        "notification_enabled": False,
    }, headers=admin_headers).get_json()
    appr = ContractApproval(
        contract_id=ct["id"], status="Pending",
        requested_by=me["id"], submitted_at=datetime.utcnow(),
    )
    db.session.add(appr)
    db.session.commit()
    resp = client.get("/api/approvals", headers=admin_headers)
    assert resp.status_code == 200
    appr_id = resp.get_json()["approvals"][0]["id"]
    resp = client.get(f"/api/approvals/{appr_id}", headers=admin_headers)
    assert resp.status_code == 200


# ── Documents ──

def test_documents_empty(client, admin_headers):
    resp = client.get("/api/documents", headers=admin_headers)
    assert resp.status_code == 200


# ── Reports ──

def test_reports_all(client, admin_headers):
    endpoints = [
        "/api/reports/summary",
        "/api/reports/statistics",
        "/api/reports/charts",
        "/api/reports/contracts",
        "/api/reports/invoices",
        "/api/reports/purchase-orders",
        "/api/reports/renewals",
        "/api/reports/customers",
        "/api/reports/products",
        "/api/reports/revenue",
        "/api/reports/approvals",
        "/api/reports/documents-stats",
        "/api/reports/activity-stats",
        "/api/reports/renewal-stats",
    ]
    for ep in endpoints:
        resp = client.get(ep, headers=admin_headers)
        assert resp.status_code == 200, f"REPORT {ep}: {resp.get_json()}"


# ── Calendar ──

def test_calendar_empty(client, admin_headers):
    resp = client.get("/api/calendar/events", headers=admin_headers)
    assert resp.status_code == 200

def test_calendar_crud(client, admin_headers):
    resp = client.post("/api/calendar/events", json={
        "title": "Meeting", "event_type": "meeting",
        "start": "2026-07-16T10:00:00", "end": "2026-07-16T11:00:00",
    }, headers=admin_headers)
    assert resp.status_code == 201, f"CREATE event: {resp.get_json()}"
    eid = resp.get_json()["id"]
    resp = client.get("/api/calendar/events", headers=admin_headers)
    assert resp.status_code == 200
    resp = client.put(f"/api/calendar/events/{eid}", json={"title": "Updated"}, headers=admin_headers)
    assert resp.status_code == 200
    resp = client.delete(f"/api/calendar/events/{eid}", headers=admin_headers)
    assert resp.status_code == 200


# ── Settings ──

def test_settings(client, admin_headers):
    resp = client.get("/api/settings/profile", headers=admin_headers)
    assert resp.status_code == 200


# ── Users ──

def test_users_list(client, admin_headers):
    resp = client.get("/api/users", headers=admin_headers)
    assert resp.status_code == 200


# ── Notifications ──

def test_notifications_empty(client, admin_headers):
    resp = client.get("/api/notifications", headers=admin_headers)
    assert resp.status_code == 200


# ── Activity ──

def test_activity_empty(client, admin_headers):
    resp = client.get("/api/activity", headers=admin_headers)
    assert resp.status_code == 200


# ── Permissions ──

def test_permissions_no_token(client):
    endpoints = [
        "/api/dashboard/data", "/api/customers", "/api/contacts",
        "/api/products", "/api/contracts", "/api/invoices",
        "/api/purchase-orders", "/api/approvals", "/api/documents",
        "/api/reports/summary", "/api/calendar/events",
        "/api/settings/profile", "/api/users", "/api/notifications", "/api/activity",
    ]
    for ep in endpoints:
        resp = client.get(ep)
        assert resp.status_code == 401, f"{ep} without token: {resp.status_code}"


# ── Search ──

def test_search(client, admin_headers):
    resp = client.get("/api/search?q=test", headers=admin_headers)
    assert resp.status_code == 200


# ── Error states ──

def test_404(client, admin_headers):
    resp = client.get("/api/customers/99999", headers=admin_headers)
    assert resp.status_code == 404

def test_bad_request(client, admin_headers):
    resp = client.post("/api/customers", json={}, headers=admin_headers)
    assert resp.status_code == 400


# ── Tasks ──

def test_tasks_empty(client, admin_headers):
    resp = client.get("/api/tasks", headers=admin_headers)
    assert resp.status_code == 200

def test_tasks_crud(client, admin_headers):
    resp = client.post("/api/tasks", json={
        "title": "Task 1", "priority": "HIGH",
    }, headers=admin_headers)
    assert resp.status_code == 201, f"CREATE task: {resp.get_json()}"
    tid = resp.get_json()["id"]
    resp = client.get(f"/api/tasks/{tid}", headers=admin_headers)
    assert resp.status_code == 200
    resp = client.put(f"/api/tasks/{tid}", json={"title": "Updated"}, headers=admin_headers)
    assert resp.status_code == 200
    resp = client.delete(f"/api/tasks/{tid}", headers=admin_headers)
    assert resp.status_code == 200


# ── Pagination ──

def test_pagination(client, admin_headers):
    me = client.get("/api/auth/me", headers=admin_headers).get_json()
    cust = client.post("/api/customers", json={"name": "PagCo"}, headers=admin_headers).get_json()
    for i in range(5):
        client.post("/api/contracts", json={
            "contract_name": f"Contract {i}", "company_name": "Co",
            "start_date": "2024-01-01", "end_date": "2024-12-31",
            "renewal_date": "2024-11-30", "customer_id": cust["id"],
            "notification_enabled": False,
        }, headers=admin_headers)
    resp = client.get("/api/contracts?page=1&per_page=2", headers=admin_headers)
    assert resp.status_code == 200
