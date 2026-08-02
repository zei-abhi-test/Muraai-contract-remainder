from io import BytesIO
from datetime import date, timedelta

from conftest import register_user


def auth(client):
    _, token = register_user(client, username="reporter", email="reporter@example.com", role="ADMIN")
    return {"Authorization": f"Bearer {token}"}


def create_contract(client, headers, **overrides):
    today = date.today()
    payload = {
        "company_name": "Test Corp",
        "contract_name": "Test Contract",
        "start_date": today.isoformat(),
        "end_date": (today + timedelta(days=365)).isoformat(),
        "renewal_date": (today + timedelta(days=365)).isoformat(),
        "notification_enabled": True,
        "notification_email": "owner@example.com",
        **overrides,
    }
    resp = client.post("/api/contracts", json=payload, headers=headers)
    return resp.get_json()


def create_customer(client, headers, **overrides):
    payload = {"name": "Test Customer", **overrides}
    resp = client.post("/api/customers", json=payload, headers=headers)
    return resp.get_json()


def create_contract_type(client, headers):
    resp = client.post("/api/contract-types", json={"name": "Service"}, headers=headers)
    return resp.get_json()


def create_product(client, headers):
    resp = client.post("/api/products", json={
        "name": "Consulting", "sku": "CON-001", "rate": 1000, "category": "Services",
    }, headers=headers)
    return resp.get_json()


def test_reports_summary_and_statistics(client):
    headers = auth(client)
    summary = client.get("/api/reports/summary", headers=headers).get_json()
    assert summary["total_contracts"] == 0
    assert summary["active_contracts"] == 0

    stats = client.get("/api/reports/statistics", headers=headers).get_json()
    assert stats["contracts_by_status"] == {}
    assert stats["approvals"]["pending"] == 0

    create_contract(client, headers, status="Active")
    summary = client.get("/api/reports/summary", headers=headers).get_json()
    assert summary["total_contracts"] == 1
    assert summary["active_contracts"] == 1

    stats = client.get("/api/reports/statistics", headers=headers).get_json()
    assert stats["contracts_by_status"].get("Active") == 1


def test_reports_charts(client):
    headers = auth(client)
    charts = client.get("/api/reports/charts", headers=headers).get_json()
    assert charts["contracts_per_month"] == []
    assert charts["revenue_trend"] == []
    assert charts["invoice_status"] == []

    create_contract(client, headers, status="Active")
    charts = client.get("/api/reports/charts", headers=headers).get_json()
    assert len(charts["contracts_per_month"]) >= 1


def test_reports_contracts_filter(client):
    headers = auth(client)
    c1 = create_contract(client, headers, status="Active", contract_name="Alpha")
    c2 = create_contract(client, headers, status="Draft", contract_name="Beta")

    all_resp = client.get("/api/reports/contracts", headers=headers).get_json()
    assert len(all_resp) == 2

    filtered = client.get("/api/reports/contracts?status=Active", headers=headers).get_json()
    assert len(filtered) == 1
    assert filtered[0]["contract_name"] == "Alpha"

    searched = client.get("/api/reports/contracts?search=Beta", headers=headers).get_json()
    assert len(searched) == 1
    assert searched[0]["contract_name"] == "Beta"


def test_reports_invoices(client):
    headers = auth(client)
    c = create_contract(client, headers, status="Active")
    invoice_payload = {
        "invoice_number": "INV-001",
        "contract_id": c["id"],
        "amount": 5000,
        "invoice_date": date.today().isoformat(),
        "status": "ISSUED",
    }
    client.post("/api/invoices", json=invoice_payload, headers=headers)

    invoices = client.get("/api/reports/invoices", headers=headers).get_json()
    assert len(invoices) == 1
    assert invoices[0]["invoice_number"] == "INV-001"

    filtered = client.get("/api/reports/invoices?status=ISSUED", headers=headers).get_json()
    assert len(filtered) == 1


def test_reports_purchase_orders(client):
    headers = auth(client)
    po_payload = {
        "po_number": "PO-001", "vendor": "Vendor A", "amount": 10000,
        "po_date": date.today().isoformat(), "status": "Pending",
    }
    client.post("/api/purchase-orders", json=po_payload, headers=headers)

    pos = client.get("/api/reports/purchase-orders", headers=headers).get_json()
    assert len(pos) == 1
    assert pos[0]["po_number"] == "PO-001"


def test_reports_renewals(client):
    headers = auth(client)
    today = date.today()
    create_contract(client, headers, status="Active",
                    renewal_date=(today + timedelta(days=15)).isoformat())
    create_contract(client, headers, status="Active",
                    renewal_date=(today + timedelta(days=90)).isoformat())

    renewals = client.get("/api/reports/renewals", headers=headers).get_json()
    assert len(renewals) == 2


def test_reports_customers(client):
    headers = auth(client)
    cust = create_customer(client, headers)
    c = create_contract(client, headers, status="Active", customer_id=cust["id"])

    customers = client.get("/api/reports/customers", headers=headers).get_json()
    assert len(customers) >= 1
    customer_data = next(c for c in customers if c["id"] == cust["id"])
    assert len(customer_data["contracts"]) >= 1


def test_reports_products(client):
    headers = auth(client)
    prod = create_product(client, headers)

    products = client.get("/api/reports/products", headers=headers).get_json()
    assert len(products) >= 1
    p = next(p for p in products if p["id"] == prod["id"])
    assert "contract_count" in p


def test_reports_revenue(client):
    headers = auth(client)
    revenue = client.get("/api/reports/revenue", headers=headers).get_json()
    assert "total_revenue" in revenue
    assert "total_line_items" in revenue


def test_reports_approvals(client):
    headers = auth(client)
    c = create_contract(client, headers, status="Draft")
    submit_resp = client.post(f"/api/contracts/{c['id']}/submit", headers=headers)
    assert submit_resp.status_code in (200, 201)
    approvals = client.get("/api/reports/approvals", headers=headers).get_json()
    assert len(approvals) >= 1
    assert approvals[0]["status"] == "Pending"


def test_reports_documents_stats(client):
    headers = auth(client)
    c = create_contract(client, headers, status="Active")

    doc_stats = client.get("/api/reports/documents-stats", headers=headers).get_json()
    assert "total_documents" in doc_stats
    assert "total_storage_bytes" in doc_stats
    assert "categories" in doc_stats
    assert "latest_uploads" in doc_stats

    # Upload a document
    today = date.today()
    data = {
        "file": (BytesIO(b"fake pdf content"), "report_test.pdf"),
    }
    client.post(f"/api/contracts/{c['id']}/documents", data=data,
                content_type="multipart/form-data", headers=headers)

    doc_stats2 = client.get("/api/reports/documents-stats", headers=headers).get_json()
    assert doc_stats2["total_documents"] >= 1
    assert doc_stats2["total_storage_bytes"] > 0


def test_reports_activity_stats(client):
    headers = auth(client)
    activity = client.get("/api/reports/activity-stats", headers=headers).get_json()
    assert "by_type" in activity
    assert "trend" in activity

    create_contract(client, headers, status="Active")
    activity2 = client.get("/api/reports/activity-stats", headers=headers).get_json()
    assert len(activity2["by_type"]) >= 1


def test_reports_renewal_stats(client):
    headers = auth(client)
    rs = client.get("/api/reports/renewal-stats", headers=headers).get_json()
    assert "total_renewed" in rs
    assert "upcoming_renewals" in rs
    assert "missed_renewals" in rs
    assert "success_rate" in rs
    assert "avg_approval_time_hours" in rs

    create_contract(client, headers, status="Active")
    rs2 = client.get("/api/reports/renewal-stats", headers=headers).get_json()
    assert rs2["active_contracts"] >= 1


def test_reports_export_csv(client):
    headers = auth(client)
    create_contract(client, headers, status="Active", contract_name="Export Test")

    resp = client.get("/api/reports/export?type=contracts&format=csv", headers=headers)
    assert resp.status_code == 200
    assert resp.content_type.startswith("text/csv")
    assert b"Export Test" in resp.data

    resp2 = client.get("/api/reports/export?type=invoices&format=csv", headers=headers)
    assert resp2.status_code == 200

    resp3 = client.get("/api/reports/export?type=revenue&format=csv", headers=headers)
    assert resp3.status_code == 200


def test_reports_date_filter(client):
    headers = auth(client)
    today = date.today()
    last_year = today - timedelta(days=400)

    create_contract(client, headers, status="Active", contract_name="Current",
                    start_date=today.isoformat())
    create_contract(client, headers, status="Active", contract_name="Old",
                    start_date=last_year.isoformat())

    filtered = client.get(f"/api/reports/contracts?start_date={today.isoformat()}", headers=headers).get_json()
    names = [c["contract_name"] for c in filtered]
    assert "Current" in names
    assert "Old" not in names
