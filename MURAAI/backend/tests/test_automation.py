"""Tests for the Automation Engine module."""
from conftest import register_user


def auth(client):
    _, token = register_user(client, role="ADMIN")
    return {"Authorization": f"Bearer {token}"}


def test_create_automation_rule(client):
    h = auth(client)
    resp = client.post("/api/automation/rules", headers=h, json={
        "name": "Notify on contract created",
        "description": "Send email when a new contract is created",
        "trigger_type": "contract_created",
        "actions": [
            {"type": "send_email", "config": {"to": "admin@co.com", "subject": "New Contract", "body": "A contract was created"}},
            {"type": "log_activity", "config": {"title": "Contract Created", "activity_type": "automation"}},
        ],
    })
    assert resp.status_code == 201
    d = resp.get_json()
    assert d["name"] == "Notify on contract created"
    assert d["trigger_type"] == "contract_created"
    assert d["is_enabled"] is True
    assert len(d["actions"]) == 2
    assert d["id"] > 0


def test_list_automation_rules(client):
    h = auth(client)
    client.post("/api/automation/rules", headers=h, json={
        "name": "Rule 1", "trigger_type": "contract_created",
        "actions": [{"type": "log_activity", "config": {}}],
    })
    client.post("/api/automation/rules", headers=h, json={
        "name": "Rule 2", "trigger_type": "invoice_paid",
        "actions": [{"type": "create_notification", "config": {}}],
    })
    resp = client.get("/api/automation/rules", headers=h)
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 2


def test_get_automation_rule(client):
    h = auth(client)
    c = client.post("/api/automation/rules", headers=h, json={
        "name": "My Rule", "trigger_type": "contract_approved",
        "actions": [{"type": "log_activity", "config": {}}],
    }).get_json()
    resp = client.get(f"/api/automation/rules/{c['id']}", headers=h)
    assert resp.status_code == 200
    assert resp.get_json()["name"] == "My Rule"


def test_update_automation_rule(client):
    h = auth(client)
    c = client.post("/api/automation/rules", headers=h, json={
        "name": "Old", "trigger_type": "contract_created",
        "actions": [{"type": "log_activity", "config": {}}],
    }).get_json()
    resp = client.put(f"/api/automation/rules/{c['id']}", headers=h, json={
        "name": "Updated", "is_enabled": False,
    })
    assert resp.status_code == 200
    d = resp.get_json()
    assert d["name"] == "Updated"
    assert d["is_enabled"] is False


def test_delete_automation_rule(client):
    h = auth(client)
    c = client.post("/api/automation/rules", headers=h, json={
        "name": "Del", "trigger_type": "contract_created",
        "actions": [{"type": "log_activity", "config": {}}],
    }).get_json()
    resp = client.delete(f"/api/automation/rules/{c['id']}", headers=h)
    assert resp.status_code == 200
    resp2 = client.get(f"/api/automation/rules/{c['id']}", headers=h)
    assert resp2.status_code == 404


def test_duplicate_automation_rule(client):
    h = auth(client)
    c = client.post("/api/automation/rules", headers=h, json={
        "name": "Original", "trigger_type": "invoice_overdue",
        "actions": [{"type": "send_email", "config": {"to": "a@b.com"}}],
    }).get_json()
    dup = client.post(f"/api/automation/rules/{c['id']}/duplicate", headers=h)
    assert dup.status_code == 201
    d = dup.get_json()
    assert d["name"] == "Original (Copy)"
    assert d["trigger_type"] == "invoice_overdue"
    assert d["is_enabled"] is False
    assert len(d["actions"]) == 1


def test_toggle_automation_rule(client):
    h = auth(client)
    c = client.post("/api/automation/rules", headers=h, json={
        "name": "Toggle", "trigger_type": "contract_created",
        "actions": [{"type": "log_activity", "config": {}}],
    }).get_json()
    assert c["is_enabled"] is True
    toggled = client.post(f"/api/automation/rules/{c['id']}/toggle", headers=h).get_json()
    assert toggled["is_enabled"] is False
    toggled2 = client.post(f"/api/automation/rules/{c['id']}/toggle", headers=h).get_json()
    assert toggled2["is_enabled"] is True


def test_test_automation_rule(client):
    h = auth(client)
    c = client.post("/api/automation/rules", headers=h, json={
        "name": "Test", "trigger_type": "contract_created",
        "actions": [{"type": "log_activity", "config": {"title": "Test", "activity_type": "test"}}],
    }).get_json()
    resp = client.post(f"/api/automation/rules/{c['id']}/test", headers=h, json={
        "entity_data": {"contract_id": 1, "contract_name": "Test Contract"},
    })
    assert resp.status_code == 200
    assert resp.get_json()["triggered"] is True


def test_automation_meta(client):
    h = auth(client)
    resp = client.get("/api/automation/meta", headers=h)
    assert resp.status_code == 200
    d = resp.get_json()
    assert "trigger_types" in d
    assert "action_types" in d
    assert "contract_created" in d["trigger_types"]
    assert "send_email" in d["action_types"]


def test_non_admin_cannot_manage_automation(client):
    user, token = register_user(client, role="VIEWER")
    h = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/automation/rules", headers=h)
    assert resp.status_code == 403
    resp = client.post("/api/automation/rules", headers=h, json={
        "name": "X", "trigger_type": "contract_created",
        "actions": [{"type": "log_activity", "config": {}}],
    })
    assert resp.status_code == 403


def test_automation_requires_auth(client):
    resp = client.get("/api/automation/rules")
    assert resp.status_code == 401


def test_automation_rule_validation(client):
    h = auth(client)
    resp = client.post("/api/automation/rules", headers=h, json={"name": ""})
    assert resp.status_code == 400
    resp = client.post("/api/automation/rules", headers=h, json={
        "name": "No Actions", "trigger_type": "contract_created",
    })
    assert resp.status_code == 201


def test_automation_rule_not_found(client):
    h = auth(client)
    resp = client.get("/api/automation/rules/99999", headers=h)
    assert resp.status_code == 404
    resp = client.put("/api/automation/rules/99999", headers=h, json={"name": "X"})
    assert resp.status_code == 404
    resp = client.delete("/api/automation/rules/99999", headers=h)
    assert resp.status_code == 404


def test_trigger_executes_all_enabled_rules(client):
    h = auth(client)
    client.post("/api/automation/rules", headers=h, json={
        "name": "R1", "trigger_type": "contract_created",
        "actions": [{"type": "log_activity", "config": {"title": "Auto R1", "activity_type": "auto"}}],
    })
    client.post("/api/automation/rules", headers=h, json={
        "name": "R2", "trigger_type": "contract_created",
        "actions": [{"type": "log_activity", "config": {"title": "Auto R2", "activity_type": "auto"}}],
    })
    client.post("/api/automation/rules", headers=h, json={
        "name": "Disabled", "trigger_type": "contract_created", "is_enabled": False,
        "actions": [{"type": "log_activity", "config": {"title": "Should Not Run", "activity_type": "auto"}}],
    })
    from src.services.automation_engine import execute_triggers
    from src import main
    with main.app.app_context():
        execute_triggers("contract_created", {"contract_id": 1, "contract_name": "Test"}, 1)

    rules = client.get("/api/automation/rules", headers=h).get_json()
    r1 = next(r for r in rules if r["name"] == "R1")
    r2 = next(r for r in rules if r["name"] == "R2")
    disabled = next(r for r in rules if r["name"] == "Disabled")
    assert r1["last_run_at"] is not None
    assert r2["last_run_at"] is not None
    assert disabled["last_run_at"] is None


def test_trigger_config_filters(client):
    h = auth(client)
    client.post("/api/automation/rules", headers=h, json={
        "name": "30 Day Reminder", "trigger_type": "reminder_due",
        "trigger_config": {"days": 30},
        "actions": [{"type": "log_activity", "config": {"title": "30d", "activity_type": "auto"}}],
    })
    from src.services.automation_engine import execute_triggers
    from src import main
    with main.app.app_context():
        execute_triggers("reminder_due", {"contract_id": 1, "days_until_end": 30, "contract_name": "Test"}, 1)
    rules = client.get("/api/automation/rules", headers=h).get_json()
    assert rules[0]["last_run_at"] is not None


def test_trigger_executes_multiple_actions(client):
    h = auth(client)
    c = client.post("/api/automation/rules", headers=h, json={
        "name": "Multi Action", "trigger_type": "invoice_paid",
        "actions": [
            {"type": "log_activity", "config": {"title": "Invoice Paid", "activity_type": "auto"}},
            {"type": "create_notification", "config": {"message": "Invoice was paid"}},
        ],
    }).get_json()
    from src.services.automation_engine import execute_triggers
    from src import main
    with main.app.app_context():
        execute_triggers("invoice_paid", {"invoice_id": 1, "invoice_number": "INV-001", "amount": 100}, 1)
    rule = client.get(f"/api/automation/rules/{c['id']}", headers=h).get_json()
    assert rule["last_run_at"] is not None


def test_trigger_skips_disabled_rules(client):
    h = auth(client)
    c = client.post("/api/automation/rules", headers=h, json={
        "name": "Skip Me", "trigger_type": "contract_expired", "is_enabled": False,
        "actions": [{"type": "log_activity", "config": {"title": "Skip", "activity_type": "auto"}}],
    }).get_json()
    from src.services.automation_engine import execute_triggers
    from src import main
    with main.app.app_context():
        execute_triggers("contract_expired", {"contract_id": 1}, 1)
    rule = client.get(f"/api/automation/rules/{c['id']}", headers=h).get_json()
    assert rule["last_run_at"] is None


def test_trigger_executes_only_matching_trigger_type(client):
    h = auth(client)
    c1 = client.post("/api/automation/rules", headers=h, json={
        "name": "On Create", "trigger_type": "contract_created",
        "actions": [{"type": "log_activity", "config": {"title": "Create", "activity_type": "auto"}}],
    }).get_json()
    c2 = client.post("/api/automation/rules", headers=h, json={
        "name": "On Renew", "trigger_type": "contract_renewed",
        "actions": [{"type": "log_activity", "config": {"title": "Renew", "activity_type": "auto"}}],
    }).get_json()
    from src.services.automation_engine import execute_triggers
    from src import main
    with main.app.app_context():
        execute_triggers("contract_created", {"contract_id": 1}, 1)
    r1 = client.get(f"/api/automation/rules/{c1['id']}", headers=h).get_json()
    r2 = client.get(f"/api/automation/rules/{c2['id']}", headers=h).get_json()
    assert r1["last_run_at"] is not None
    assert r2["last_run_at"] is None
