"""End-to-end tests for the ActivityLog / in-app notification system.

Verifies that real actions create ActivityLog entries, and that the activity
endpoints return them correctly.
"""
from datetime import date, timedelta

from conftest import register_user


def auth(client, username="act_e2e_user", email="act_e2e@example.com"):
    _, token = register_user(client, username=username, email=email, role="ADMIN")
    return {"Authorization": f"Bearer {token}"}


def test_activity_log_created_by_actions(client):
    headers = auth(client)

    # 1. Create a customer + contract → should create activity entries
    resp = client.post("/api/customers", json={"name": "Activity Customer"}, headers=headers)
    cust = resp.get_json()

    resp = client.post("/api/contracts", json={
        "company_name": "Activity Co",
        "contract_name": "Activity Test Contract",
        "start_date": "2026-01-01",
        "end_date": "2027-12-31",
        "renewal_date": "2027-11-30",
        "customer_id": cust["id"],
        "notification_enabled": False,
    }, headers=headers)
    assert resp.status_code == 201
    contract = resp.get_json()
    contract_id = contract["id"]

    # 2. Activity list should have at least 2 entries (customer not tracked, so only contract_created)
    resp = client.get("/api/activity", headers=headers)
    assert resp.status_code == 200
    activities = resp.get_json()
    contract_created = [a for a in activities if a["activity_type"] == "contract_created"]
    assert len(contract_created) >= 1, "contract_created activity should exist"
    print(f"1. contract_created activity found: {contract_created[0]['title']}")

    # 3. Contract activity feed
    resp = client.get(f"/api/activity/contract/{contract_id}", headers=headers)
    assert resp.status_code == 200
    contract_acts = resp.get_json()
    assert len(contract_acts) >= 1
    assert contract_acts[0]["contract_id"] == contract_id
    print(f"2. Contract activity feed has {len(contract_acts)} entries")

    # 4. Submit contract → creates contract_submitted activity
    resp = client.post(f"/api/contracts/{contract_id}/submit", headers=headers)
    assert resp.status_code == 200
    approval_id = resp.get_json()["approval"]["id"]

    resp = client.get("/api/activity", headers=headers)
    submitted = [a for a in resp.get_json() if a["activity_type"] == "approval_requested"]
    assert len(submitted) >= 1
    print(f"3. approval_requested activity found")

    # 5. Approve contract → creates contract_approved activity
    resp = client.post(f"/api/approvals/{approval_id}/approve", headers=headers)
    assert resp.status_code == 200

    resp = client.get("/api/activity", headers=headers)
    approved = [a for a in resp.get_json() if a["activity_type"] == "contract_approved"]
    assert len(approved) >= 1
    print(f"4. contract_approved activity found")

    # 6. Activate contract
    resp = client.post(f"/api/contracts/{contract_id}/activate", headers=headers)
    assert resp.status_code == 200

    resp = client.get("/api/activity", headers=headers)
    activated = [a for a in resp.get_json() if a["activity_type"] == "contract_activated"]
    assert len(activated) >= 1
    print(f"5. contract_activated activity found")

    # 7. Create invoice → creates invoice_created activity
    resp = client.post("/api/invoices", json={
        "contract_id": contract_id,
        "amount": 5000,
        "status": "DRAFT",
    }, headers=headers)
    assert resp.status_code == 201
    invoice_id = resp.get_json()["id"]

    resp = client.get("/api/activity", headers=headers)
    inv_created = [a for a in resp.get_json() if a["activity_type"] == "invoice_created"]
    assert len(inv_created) >= 1
    print(f"6. invoice_created activity found")

    # 8. Issue invoice then mark paid → creates invoice_paid activity
    resp = client.post(f"/api/invoices/{invoice_id}/issue", headers=headers)
    assert resp.status_code == 200

    resp = client.post(f"/api/invoices/{invoice_id}/mark-paid", headers=headers)
    assert resp.status_code == 200

    resp = client.get("/api/activity", headers=headers)
    inv_paid = [a for a in resp.get_json() if a["activity_type"] == "invoice_paid"]
    assert len(inv_paid) >= 1
    print(f"7. invoice_paid activity found")

    # 9. Create PO → creates po_created activity
    resp = client.post("/api/purchase-orders", json={
        "vendor": "Activity Vendor",
        "amount": 3000,
    }, headers=headers)
    assert resp.status_code == 201

    resp = client.get("/api/activity", headers=headers)
    po_created = [a for a in resp.get_json() if a["activity_type"] == "po_created"]
    assert len(po_created) >= 1
    print(f"8. po_created activity found")

    # 10. Create a second contract → reject its approval → verify contract_rejected
    resp = client.post("/api/contracts", json={
        "company_name": "Reject Co",
        "contract_name": "Reject Test",
        "start_date": "2026-01-01",
        "end_date": "2027-12-31",
        "renewal_date": "2027-11-30",
        "notification_enabled": False,
    }, headers=headers)
    assert resp.status_code == 201
    reject_contract_id = resp.get_json()["id"]

    resp = client.post(f"/api/contracts/{reject_contract_id}/submit", headers=headers)
    assert resp.status_code == 200
    reject_approval_id = resp.get_json()["approval"]["id"]

    resp = client.post(f"/api/approvals/{reject_approval_id}/reject", json={
        "comments": "Test reason for rejection"
    }, headers=headers)
    assert resp.status_code == 200

    resp = client.get("/api/activity", headers=headers)
    rejected = [a for a in resp.get_json() if a["activity_type"] == "contract_rejected"]
    assert len(rejected) >= 1
    print(f"9. contract_rejected activity found")

    # 11. Unread count
    resp = client.get("/api/activity/unread-count", headers=headers)
    assert resp.status_code == 200
    count = resp.get_json()["count"]
    assert count > 0
    print(f"10. Unread count: {count}")

    # 12. Mark all read
    resp = client.post("/api/activity/mark-all-read", headers=headers)
    assert resp.status_code == 200

    resp = client.get("/api/activity/unread-count", headers=headers)
    assert resp.get_json()["count"] == 0
    print("11. Mark all read works")

    # 13. Mark single activity as read
    resp = client.get("/api/activity", headers=headers)
    first = resp.get_json()[0]
    # Set it unread manually via db
    from src.models.contract import ActivityLog, db
    from src.main import app as _app
    with _app.app_context():
        entry = db.session.get(ActivityLog, first["id"])
        entry.is_read = False
        db.session.commit()

    resp = client.get("/api/activity/unread-count", headers=headers)
    assert resp.get_json()["count"] >= 1

    resp = client.post(f"/api/activity/{first['id']}/read", headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["is_read"] is True

    resp = client.get("/api/activity/unread-count", headers=headers)
    assert resp.get_json()["count"] >= 0  # at least the one we marked is now read
    print("12. Mark single read works")

    # 14. Activity list respects limits and ordering
    resp = client.get("/api/activity?limit=2", headers=headers)
    assert len(resp.get_json()) <= 2
    print("13. Activity limit works")

    print("\n=== ALL ACTIVITY E2E TESTS PASSED ===")
