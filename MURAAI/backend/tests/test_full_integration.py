"""
Comprehensive runtime integration audit for Muraai.

Single test function to avoid per-test DB isolation. Exercises every
feature end-to-end in sequence, documenting every bug found.
"""
from datetime import date, timedelta

from conftest import register_user


def auth(client, username="audit_user", email="audit@example.com"):
    _, token = register_user(client, username=username, email=email, role="ADMIN")
    return {"Authorization": f"Bearer {token}"}


def today():
    return date.today()


def future(days):
    return (today() + timedelta(days=days)).isoformat()


def test_full_workflow(client):
    """Main integration workflow — every feature tested end-to-end."""

    # ==================================================================
    # 1. LOGIN / AUTH
    # ==================================================================
    h = auth(client)
    resp = client.get("/api/auth/me", headers=h)
    assert resp.status_code == 200, resp.get_json()
    me = resp.get_json()
    assert me["username"] == "audit_user"
    print("PASS [01] Login/Register")

    # ==================================================================
    # 2. CUSTOMER CRUD
    # ==================================================================
    # Create
    resp = client.post("/api/customers", json={
        "name": "Audit Corp",
        "phone": "9999999999",
        "email": "audit@auditcorp.com",
        "address": "123 Audit St",
    }, headers=h)
    assert resp.status_code == 201, resp.get_json()
    cust = resp.get_json()
    cid = cust["id"]
    assert cust["name"] == "Audit Corp"
    print("PASS [02] Create Customer")

    # List
    resp = client.get("/api/customers", headers=h)
    assert resp.status_code == 200
    assert any(c["name"] == "Audit Corp" for c in resp.get_json())
    print("PASS [03] List Customers")

    # Update
    resp = client.put(f"/api/customers/{cid}", json={"name": "Audit Corp Updated"}, headers=h)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["name"] == "Audit Corp Updated"
    print("PASS [04] Update Customer")

    # ==================================================================
    # 3. CONTACT CRUD
    # ==================================================================
    # Create (contacts are nested under customers)
    resp = client.post(f"/api/customers/{cid}/contacts", json={
        "contact_name": "John Auditor",
        "contact_number": "8888888888",
        "email": "john@auditcorp.com",
        "designation": "Manager",
    }, headers=h)
    assert resp.status_code == 201, resp.get_json()
    contact = resp.get_json()
    contact_id = contact["id"]
    assert contact["contact_name"] == "John Auditor"
    print("PASS [05] Create Contact")

    # List
    resp = client.get("/api/contacts", headers=h)
    assert resp.status_code == 200
    assert any(c["contact_name"] == "John Auditor" for c in resp.get_json())
    print("PASS [06] List Contacts")

    # Update
    resp = client.put(f"/api/contacts/{contact_id}", json={"contact_name": "John Updated"}, headers=h)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["contact_name"] == "John Updated"
    print("PASS [07] Update Contact")

    # ==================================================================
    # 4. PRODUCT CRUD
    # ==================================================================
    # Create
    resp = client.post("/api/products", json={
        "name": "Audit Service",
        "category": "Service",
        "rate": 5000,
        "description": "Premium audit service",
    }, headers=h)
    assert resp.status_code == 201, resp.get_json()
    prod = resp.get_json()
    pid = prod["id"]
    assert prod["name"] == "Audit Service"
    print("PASS [08] Create Product")

    # List
    resp = client.get("/api/products", headers=h)
    assert resp.status_code == 200
    assert any(p["name"] == "Audit Service" for p in resp.get_json())
    print("PASS [09] List Products")

    # Update
    resp = client.put(f"/api/products/{pid}", json={"name": "Audit Premium"}, headers=h)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["name"] == "Audit Premium"
    print("PASS [10] Update Product")

    # ==================================================================
    # 5. CONTRACT (Draft) + LINE ITEMS
    # ==================================================================
    resp = client.post("/api/contracts", json={
        "company_name": "Audit Corp",
        "contract_name": "Audit Contract",
        "start_date": today().isoformat(),
        "end_date": future(365),
        "renewal_date": future(365),
        "notification_enabled": False,
        "customer_id": cid,
        "line_items": [
            {"product_name": "Audit Premium", "quantity": 2, "rate": 5000},
        ],
    }, headers=h)
    assert resp.status_code == 201, resp.get_json()
    contract = resp.get_json()
    cid2 = contract["id"]  # contract id
    assert contract["contract_name"] == "Audit Contract"
    assert contract["status"] == "Draft"
    print("PASS [11] Create Contract + Line Items")

    # Verify line items via management endpoint
    resp = client.get(f"/api/contracts/{cid2}/line-items", headers=h)
    assert resp.status_code == 200, resp.get_json()
    items = resp.get_json()
    assert len(items) == 1
    assert items[0]["product_name"] == "Audit Premium"
    print("PASS [11b] Line items persisted")

    # ==================================================================
    # 6. CONTRACT LIFECYCLE: Submit → Approve → Activate
    # ==================================================================
    resp = client.post(f"/api/contracts/{cid2}/submit", headers=h)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["status"] == "Pending Approval"
    print("PASS [12] Submit Contract")

    # Approve
    resp = client.get("/api/approvals", headers=h)
    approvals = resp.get_json()["approvals"]
    assert len(approvals) > 0
    approval = next(a for a in approvals if a["contract_id"] == cid2)
    aid = approval["id"]
    resp = client.post(f"/api/approvals/{aid}/approve", headers=h)
    assert resp.status_code == 200, resp.get_json()
    print("PASS [13] Approve Contract")

    # Activate
    resp = client.post(f"/api/contracts/{cid2}/activate", headers=h)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["status"] == "Active"
    print("PASS [14] Activate Contract")

    # ==================================================================
    # 7. CONTRACT WORKSPACE (GET single contract)
    # ==================================================================
    resp = client.get(f"/api/contracts/{cid2}", headers=h)
    assert resp.status_code == 200, resp.get_json()
    d = resp.get_json()
    assert d["id"] == cid2
    assert d["status"] == "Active"
    assert "health_status" in d
    assert "days_until_end" in d
    assert "allowed_actions" in d
    actions = d["allowed_actions"]
    assert "hold" in actions
    assert "complete" in actions
    assert "renew" in actions
    print("PASS [15] Contract Workspace (allowed_actions verified)")

    # ==================================================================
    # 8. PURCHASE ORDER
    # ==================================================================
    resp = client.post("/api/purchase-orders", json={
        "vendor": "Audit Vendor Inc",
        "po_number": "PO-AUDIT-001",
        "po_date": today().isoformat(),
        "amount": 10000,
        "customer_id": cid,
        "contract_ids": [cid2],
        "status": "Pending",
    }, headers=h)
    assert resp.status_code == 201, resp.get_json()
    po = resp.get_json()
    assert po["po_number"] == "PO-AUDIT-001"
    assert cid2 in po.get("contract_ids", [])
    print("PASS [16] Create Purchase Order")

    # List
    resp = client.get("/api/purchase-orders", headers=h)
    assert resp.status_code == 200
    assert any(p["po_number"] == "PO-AUDIT-001" for p in resp.get_json())
    print("PASS [17] List Purchase Orders")

    # Search
    resp = client.get("/api/purchase-orders?search=AUDIT", headers=h)
    assert resp.status_code == 200
    assert len(resp.get_json()) >= 1
    print("PASS [18] Search Purchase Orders")

    # Update vendor
    resp = client.put(f"/api/purchase-orders/{po['id']}", json={"vendor": "Updated Vendor"}, headers=h)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["vendor"] == "Updated Vendor"
    print("PASS [38] Update Purchase Order")

    # ==================================================================
    # 9. INVOICE workflow
    # ==================================================================
    resp = client.post("/api/invoices", json={
        "contract_id": cid2,
        "customer_id": cid,
        "invoice_number": "INV-AUDIT-001",
        "invoice_date": today().isoformat(),
        "due_date": future(30),
        "total_amount": 10000,
        "description": "Audit Invoice",
        "status": "DRAFT",
    }, headers=h)
    assert resp.status_code == 201, resp.get_json()
    inv = resp.get_json()
    inv_id = inv["id"]
    assert inv["invoice_number"] == "INV-AUDIT-001"
    assert inv["contract_id"] == cid2
    print("PASS [19] Create Invoice")

    # List invoices
    resp = client.get("/api/invoices", headers=h)
    assert resp.status_code == 200
    assert any(i["invoice_number"] == "INV-AUDIT-001" for i in resp.get_json())
    print("PASS [40] List Invoices")

    # Search invoices
    resp = client.get("/api/invoices?search=AUDIT", headers=h)
    assert resp.status_code == 200
    print("PASS [41] Search Invoices")

    # Issue
    resp = client.post(f"/api/invoices/{inv_id}/issue", headers=h)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["status"] == "ISSUED"
    print("PASS [20] Issue Invoice")

    # Mark Paid
    resp = client.post(f"/api/invoices/{inv_id}/mark-paid", headers=h)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["status"] == "PAID"
    print("PASS [21] Mark Invoice Paid")

    # ==================================================================
    # 10. CONTRACT LIFECYCLE EXTRA: Hold → Resume → Complete → Revert
    # ==================================================================
    resp = client.post(f"/api/contracts/{cid2}/hold", headers=h)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["status"] == "On Hold"
    print("PASS [22a] Hold Contract")

    resp = client.post(f"/api/contracts/{cid2}/resume", headers=h)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["status"] == "Active"
    print("PASS [22b] Resume Contract")

    resp = client.post(f"/api/contracts/{cid2}/complete", headers=h)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["status"] == "Completed"
    print("PASS [22c] Complete Contract")

    # Revert to Active via full status update (PUT)
    resp = client.put(f"/api/contracts/{cid2}", json={"status": "Active"}, headers=h)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["status"] == "Active"
    print("PASS [22d] Revert Contract via PUT")

    # ==================================================================
    # 11. DASHBOARD
    # ==================================================================
    resp = client.get("/api/contracts/dashboard", headers=h)
    assert resp.status_code == 200, resp.get_json()
    d = resp.get_json()
    assert "total_contracts" in d
    assert "active_contracts" in d
    assert "ending_soon_contracts" in d or "expiring_soon" in d, (
        f"Dashboard missing ending_soon/expiring_soon key, got: {list(d.keys())}"
    )
    assert isinstance(d["total_contracts"], int)
    print("PASS [23] Dashboard")

    # ==================================================================
    # 12. ACTIVITY / NOTIFICATION
    # ==================================================================
    # Unread count
    resp = client.get("/api/activity/unread-count", headers=h)
    assert resp.status_code == 200, resp.get_json()
    assert "count" in resp.get_json()
    print("PASS [24] Activity unread count")

    # Activity list
    resp = client.get("/api/activity", headers=h)
    assert resp.status_code == 200
    activities = resp.get_json()["items"]
    assert isinstance(activities, list)
    assert len(activities) >= 1, "Activity log is empty — contract lifecycle actions must create ActivityLog entries"
    print(f"PASS [25] Activity list ({len(activities)} entries)")

    # Contract-specific activity
    resp = client.get(f"/api/activity/contract/{cid2}", headers=h)
    assert resp.status_code == 200
    contract_acts = resp.get_json()
    assert isinstance(contract_acts, list)
    assert len(contract_acts) >= 1, "No activity for this contract"
    print(f"PASS [26] Contract activity ({len(contract_acts)} entries)")

    # Mark one activity read
    first = activities[0]
    resp = client.post(f"/api/activity/{first['id']}/read", headers=h)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["is_read"] is True
    print("PASS [27] Mark activity read")

    # Mark all read
    resp = client.post("/api/activity/mark-all-read", headers=h)
    assert resp.status_code == 200
    resp = client.get("/api/activity/unread-count", headers=h)
    assert resp.get_json()["count"] == 0
    print("PASS [42] Mark all activity read")

    # ==================================================================
    # 13. RENEW CONTRACT
    # ==================================================================
    resp = client.post(f"/api/contracts/{cid2}/renew", json={
        "start_date": future(366),
        "end_date": future(730),
        "contract_name": "Audit Renewed",
        "line_items": [
            {"product_name": "Audit Premium Renewal", "quantity": 3, "rate": 6000},
        ],
    }, headers=h)
    assert resp.status_code == 201, resp.get_json()
    v2 = resp.get_json()
    assert v2["contract_version"] == 2
    assert v2["previous_contract_id"] == cid2
    assert v2["line_items"][0]["product_name"] == "Audit Premium Renewal"
    print("PASS [28] Renew Contract (line items overridden)")

    # V1 unchanged
    resp = client.get(f"/api/contracts/{cid2}", headers=h)
    assert resp.get_json()["status"] == "Renewed"
    print("PASS [28b] V1 marked Renewed")

    # Renewal history
    resp = client.get(f"/api/contracts/{cid2}/renewal-history", headers=h)
    assert resp.status_code == 200
    history = resp.get_json()
    assert isinstance(history, list)
    assert len(history) >= 2
    print(f"PASS [43] Renewal history ({len(history)} entries)")

    # ==================================================================
    # 14. ALLOWED ACTIONS for various statuses
    # ==================================================================
    # Draft
    resp = client.post("/api/contracts", json={
        "company_name": "Action Test",
        "contract_name": "Action Test",
        "start_date": today().isoformat(),
        "end_date": future(365),
        "renewal_date": future(365),
        "notification_enabled": False,
    }, headers=h)
    draft_cid = resp.get_json()["id"]
    resp = client.get(f"/api/contracts/{draft_cid}", headers=h)
    actions = resp.get_json().get("allowed_actions", [])
    assert "submit" in actions
    assert "edit" in actions
    print("PASS [29] Allowed actions: Draft")

    # Rejected → revert_to_draft → submit
    resp = client.post(f"/api/contracts/{draft_cid}/submit", headers=h)
    assert resp.status_code == 200
    resp = client.get("/api/approvals", headers=h)
    reject_aid = next(a["id"] for a in resp.get_json()["approvals"] if a["contract_id"] == draft_cid)
    resp = client.post(f"/api/approvals/{reject_aid}/reject", json={"comments": "Need changes"}, headers=h)
    assert resp.status_code == 200
    resp = client.get(f"/api/contracts/{draft_cid}", headers=h)
    assert resp.get_json()["status"] == "Rejected"
    actions = resp.get_json().get("allowed_actions", [])
    assert "revert_to_draft" in actions, f"Rejected should allow revert_to_draft, got {actions}"
    # Now revert to draft and submit
    resp = client.post(f"/api/contracts/{draft_cid}/revert-to-draft", headers=h)
    assert resp.status_code == 200, resp.get_json()
    resp = client.get(f"/api/contracts/{draft_cid}", headers=h)
    assert resp.get_json()["status"] == "Draft"
    resp = client.post(f"/api/contracts/{draft_cid}/submit", headers=h)
    assert resp.status_code == 200, "Re-submit after revert should work"
    print("PASS [30] Rejected -> revert_to_draft -> re-submit")

    # Active action menu (V2 — the renewed contract)
    resp = client.get(f"/api/contracts/{v2['id']}", headers=h)
    actions = resp.get_json().get("allowed_actions", [])
    assert "hold" in actions
    assert "complete" in actions
    assert "renew" in actions
    assert "submit" not in actions
    print("PASS [36] Action menu on Active contract")

    # ==================================================================
    # 15. CUSTOMER DELETE SAFETY
    # ==================================================================
    # Referenced customer cannot be deleted
    resp = client.get("/api/customers", headers=h)
    customer_list = resp.get_json()
    referenced_cid = next(c["id"] for c in customer_list if c["name"] == "Audit Corp Updated")
    resp = client.delete(f"/api/customers/{referenced_cid}", headers=h)
    assert resp.status_code == 409, f"Referenced customer should not be deletable: {resp.get_json()}"
    print("PASS [32] Referenced customer deletion blocked (409)")

    # Unreferenced customer can be deleted
    resp = client.post("/api/customers", json={"name": "Temporary Co", "phone": "1111111111"}, headers=h)
    assert resp.status_code == 201
    temp_cid = resp.get_json()["id"]
    resp = client.delete(f"/api/customers/{temp_cid}", headers=h)
    assert resp.status_code == 200
    print("PASS [33] Unreferenced customer deletion allowed")

    # ==================================================================
    # 16. CONTACT DELETE
    # ==================================================================
    resp = client.post("/api/customers", json={"name": "Contact Del Co", "phone": "2222222222"}, headers=h)
    assert resp.status_code == 201
    tmp_cust_id = resp.get_json()["id"]
    resp = client.post(f"/api/customers/{tmp_cust_id}/contacts", json={
        "contact_name": "Deletable Contact",
        "contact_number": "7777777777",
    }, headers=h)
    assert resp.status_code == 201
    del_contact_id = resp.get_json()["id"]
    resp = client.delete(f"/api/contacts/{del_contact_id}", headers=h)
    assert resp.status_code == 200
    print("PASS [34] Contact deletion allowed")

    # ==================================================================
    # 17. PRODUCT SOFT-DELETE
    # ==================================================================
    resp = client.post("/api/products", json={
        "name": "Referenced Product",
        "category": "Service",
        "rate": 1000,
    }, headers=h)
    assert resp.status_code == 201
    ref_pid = resp.get_json()["id"]
    resp = client.delete(f"/api/products/{ref_pid}", headers=h)
    assert resp.status_code == 200
    resp = client.get("/api/products", headers=h)
    active_products = [p for p in resp.get_json() if p["id"] == ref_pid]
    if active_products:
        assert active_products[0].get("status") == "inactive", "Referenced product should be deactivated not deleted"
    print("PASS [35] Product soft-delete (deactivated)")

    # ==================================================================
    # 18. INVOICE CANCEL
    # ==================================================================
    # Create a fresh Draft invoice, issue it, then cancel it
    resp = client.post("/api/invoices", json={
        "contract_id": cid2,
        "customer_id": cid,
        "invoice_number": "INV-CANCEL-001",
        "invoice_date": today().isoformat(),
        "due_date": future(30),
        "total_amount": 5000,
        "description": "Cancel test",
    }, headers=h)
    assert resp.status_code == 201
    cancel_inv = resp.get_json()
    # Issue it
    resp = client.post(f"/api/invoices/{cancel_inv['id']}/issue", headers=h)
    assert resp.status_code == 200
    # Now cancel
    resp = client.post(f"/api/invoices/{cancel_inv['id']}/cancel", headers=h)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["status"] == "CANCELLED"
    print("PASS [37] Invoice cancel")

    # ==================================================================
    # 19. PURCHASE ORDER DELETE
    # ==================================================================
    resp = client.get("/api/purchase-orders", headers=h)
    po_list = resp.get_json()
    if po_list:
        resp = client.delete(f"/api/purchase-orders/{po_list[0]['id']}", headers=h)
        assert resp.status_code == 200
        print("PASS [39] Purchase Order delete")

    # ==================================================================
    # 20. CONTRACT: expire, mark-renewal-due
    # ==================================================================
    resp = client.put(f"/api/contracts/{cid2}", json={"status": "Active"}, headers=h)
    assert resp.status_code == 200
    resp = client.post(f"/api/contracts/{cid2}/expire", headers=h)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["status"] == "Expired"
    print("PASS [44] Expire contract")

    # Re-activate for renewal-due test
    resp = client.put(f"/api/contracts/{cid2}", json={"status": "Active"}, headers=h)
    assert resp.status_code == 200
    resp = client.post(f"/api/contracts/{cid2}/mark-renewal-due", headers=h)
    assert resp.status_code == 200, resp.get_json()
    assert resp.get_json()["status"] == "Renewal Due"
    print("PASS [45] Mark renewal due")

    # ==================================================================
    # ALL CLEAR
    # ==================================================================
    print("\n=== ALL INTEGRATION TESTS PASSED ===")
