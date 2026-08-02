"""Tests for Calendar & Scheduler module: events, tasks, reminders."""
from datetime import date, timedelta

from conftest import register_user


def auth(client, username="cal_user", email="cal@example.com"):
    _, token = register_user(client, username=username, email=email, role="ADMIN")
    return {"Authorization": f"Bearer {token}"}


def test_calendar_events_empty(client):
    headers = auth(client)
    today = date.today().isoformat()
    resp = client.get(f"/api/calendar/events?start={today}&end={today}", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert "events" in data
    assert data["total"] == 0


def test_calendar_events_with_contract(client):
    headers = auth(client)
    # Create customer + contract
    resp = client.post("/api/customers", json={"name": "Cal Cust"}, headers=headers)
    cust_id = resp.get_json()["id"]
    resp = client.post("/api/contracts", json={
        "company_name": "Cal Co", "contract_name": "Cal Contract",
        "start_date": "2026-01-01", "end_date": (date.today() + timedelta(days=10)).isoformat(),
        "renewal_date": (date.today() + timedelta(days=5)).isoformat(),
        "customer_id": cust_id, "notification_enabled": False,
        "status": "Active",
    }, headers=headers)
    assert resp.status_code == 201

    # Check contract_end and renewal appear in events
    today = date.today().isoformat()
    end = (date.today() + timedelta(days=15)).isoformat()
    resp = client.get(f"/api/calendar/events?start={today}&end={end}&types=contract_end,renewal", headers=headers)
    data = resp.get_json()
    assert data["total"] >= 2, f"Expected >=2 events, got {data['total']}"
    types = {e["type"] for e in data["events"]}
    assert "contract_end" in types
    assert "renewal" in types


def test_create_and_get_calendar_event(client):
    headers = auth(client)
    today = date.today()
    event_date = (today + timedelta(days=3)).isoformat()
    resp = client.post("/api/calendar/events", json={
        "title": "Test Reminder", "description": "A test",
        "event_type": "reminder", "start": event_date, "all_day": True,
    }, headers=headers)
    assert resp.status_code == 201
    ev = resp.get_json()
    assert ev["title"] == "Test Reminder"
    assert ev["event_type"] == "reminder"

    # Query with a wider range to ensure event falls within bounds
    start = (today - timedelta(days=1)).isoformat()
    end = (today + timedelta(days=10)).isoformat()
    resp = client.get(f"/api/calendar/events?start={start}&end={end}&types=reminder", headers=headers)
    data = resp.get_json()
    assert data["total"] >= 1, f"Expected >=1 events, got {data['total']}"
    assert any(e["entity_type"] == "calendar_event" for e in data["events"])


def test_update_calendar_event(client):
    headers = auth(client)
    future = (date.today() + timedelta(days=3)).isoformat()
    resp = client.post("/api/calendar/events", json={
        "title": "Original", "event_type": "reminder", "start": future,
    }, headers=headers)
    ev_id = resp.get_json()["id"]

    resp = client.put(f"/api/calendar/events/{ev_id}", json={"title": "Updated", "priority": "high"}, headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["title"] == "Updated"
    assert resp.get_json()["priority"] == "high"


def test_delete_calendar_event(client):
    headers = auth(client)
    future = (date.today() + timedelta(days=3)).isoformat()
    resp = client.post("/api/calendar/events", json={
        "title": "Delete Me", "event_type": "reminder", "start": future,
    }, headers=headers)
    ev_id = resp.get_json()["id"]

    resp = client.delete(f"/api/calendar/events/{ev_id}", headers=headers)
    assert resp.status_code == 200

    resp = client.delete(f"/api/calendar/events/{ev_id}", headers=headers)
    assert resp.status_code == 404


def test_calendar_event_not_found(client):
    headers = auth(client)
    resp = client.put("/api/calendar/events/99999", json={"title": "Nope"}, headers=headers)
    assert resp.status_code == 404
    resp = client.delete("/api/calendar/events/99999", headers=headers)
    assert resp.status_code == 404


def test_create_task(client):
    headers = auth(client)
    future = (date.today() + timedelta(days=7)).isoformat()
    resp = client.post("/api/tasks", json={
        "title": "My Task", "description": "Do something",
        "due_date": future, "priority": "high",
    }, headers=headers)
    assert resp.status_code == 201
    t = resp.get_json()
    assert t["title"] == "My Task"
    assert t["priority"] == "HIGH"
    assert t["status"] == "TODO"
    assert t["due_date"] == future


def test_list_tasks(client):
    headers = auth(client)
    # Create some tasks
    for i in range(3):
        client.post("/api/tasks", json={
            "title": f"Task {i}", "due_date": (date.today() + timedelta(days=i)).isoformat(),
        }, headers=headers)

    resp = client.get("/api/tasks", headers=headers)
    assert resp.status_code == 200
    tasks = resp.get_json()
    assert len(tasks) >= 3


def test_update_task(client):
    headers = auth(client)
    resp = client.post("/api/tasks", json={"title": "Old Title"}, headers=headers)
    t_id = resp.get_json()["id"]

    resp = client.put(f"/api/tasks/{t_id}", json={"title": "New Title", "priority": "critical"}, headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["title"] == "New Title"
    assert resp.get_json()["priority"] == "critical"


def test_complete_task(client):
    headers = auth(client)
    resp = client.post("/api/tasks", json={"title": "Complete Me"}, headers=headers)
    t_id = resp.get_json()["id"]

    resp = client.put(f"/api/tasks/{t_id}/status", json={"status": "COMPLETED"}, headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "COMPLETED"
    assert resp.get_json()["completed_at"] is not None


def test_delete_task(client):
    headers = auth(client)
    resp = client.post("/api/tasks", json={"title": "Delete Me"}, headers=headers)
    t_id = resp.get_json()["id"]

    resp = client.delete(f"/api/tasks/{t_id}", headers=headers)
    assert resp.status_code == 200

    resp = client.delete(f"/api/tasks/{t_id}", headers=headers)
    assert resp.status_code == 404


def test_task_not_found(client):
    headers = auth(client)
    resp = client.put("/api/tasks/99999", json={"title": "Nope"}, headers=headers)
    assert resp.status_code == 404
    resp = client.delete("/api/tasks/99999", headers=headers)
    assert resp.status_code == 404
    resp = client.put("/api/tasks/99999/status", json={"status": "COMPLETED"}, headers=headers)
    assert resp.status_code == 404


def test_reminder_config_defaults(client):
    headers = auth(client)
    resp = client.post("/api/reminders/defaults", headers=headers)
    assert resp.status_code == 201
    configs = resp.get_json()
    assert len(configs) > 0

    # Calling again should return existing
    resp = client.post("/api/reminders/defaults", headers=headers)
    assert resp.status_code == 200


def test_reminder_config_save_and_get(client):
    headers = auth(client)
    configs = [
        {"event_type": "contract_end", "days_before": 7, "enabled": True, "notification_method": "email"},
        {"event_type": "invoice_due", "days_before": 3, "enabled": True, "notification_method": "notification"},
    ]
    resp = client.post("/api/reminders/config", json=configs, headers=headers)
    assert resp.status_code == 200
    saved = resp.get_json()
    assert len(saved) == 2

    resp = client.get("/api/reminders/config", headers=headers)
    assert resp.status_code == 200
    assert len(resp.get_json()) == 2


def test_calendar_filters(client):
    headers = auth(client)
    # Create a customer + contract for filter data
    resp = client.post("/api/customers", json={"name": "Filter Cust"}, headers=headers)
    cust_id = resp.get_json()["id"]
    client.post("/api/contracts", json={
        "company_name": "Filter Co", "contract_name": "Filter Contract",
        "start_date": "2026-01-01", "end_date": "2027-12-31",
        "customer_id": cust_id, "notification_enabled": False,
    }, headers=headers)

    resp = client.get("/api/calendar/filters", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert "customers" in data
    assert "contracts" in data
    assert "event_types" in data
    assert len(data["event_types"]) == 10


def test_calendar_event_auth_required(client):
    resp = client.get("/api/calendar/events")
    assert resp.status_code == 401
    resp = client.post("/api/calendar/events", json={"title": "X"})
    assert resp.status_code == 401
    resp = client.post("/api/tasks", json={"title": "X"})
    assert resp.status_code == 401
    resp = client.get("/api/reminders/config")
    assert resp.status_code == 401


def test_create_event_missing_title(client):
    headers = auth(client)
    resp = client.post("/api/calendar/events", json={"start": "2026-07-20"}, headers=headers)
    assert resp.status_code == 400


def test_create_task_missing_title(client):
    headers = auth(client)
    resp = client.post("/api/tasks", json={"priority": "high"}, headers=headers)
    assert resp.status_code == 400


def test_multi_event_types(client):
    headers = auth(client)
    # Create a contract
    resp = client.post("/api/customers", json={"name": "Multi Cust"}, headers=headers)
    cust_id = resp.get_json()["id"]
    resp = client.post("/api/contracts", json={
        "company_name": "Multi Co", "contract_name": "Multi Contract",
        "start_date": (date.today() - timedelta(days=1)).isoformat(),
        "end_date": (date.today() + timedelta(days=20)).isoformat(),
        "renewal_date": (date.today() + timedelta(days=10)).isoformat(),
        "customer_id": cust_id, "notification_enabled": False,
        "status": "Active",
    }, headers=headers)
    assert resp.status_code == 201
    contract_id = resp.get_json()["id"]

    # Create invoice
    resp = client.post("/api/invoices", json={
        "contract_id": contract_id, "amount": 1000, "status": "ISSUED",
        "due_date": (date.today() + timedelta(days=15)).isoformat(),
    }, headers=headers)
    assert resp.status_code == 201

    today = (date.today() - timedelta(days=2)).isoformat()
    end = (date.today() + timedelta(days=25)).isoformat()
    resp = client.get(
        f"/api/calendar/events?start={today}&end={end}"
        f"&types=contract_start,contract_end,renewal,invoice_due",
        headers=headers
    )
    data = resp.get_json()
    types_found = {e["type"] for e in data["events"]}
    assert "contract_start" in types_found or "contract_end" in types_found
