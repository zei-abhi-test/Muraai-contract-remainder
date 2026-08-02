"""Tests for the Workflow Builder module."""
from datetime import date

from conftest import register_user


def auth(client):
    _, token = register_user(client, role="ADMIN")
    return {"Authorization": f"Bearer {token}"}


def test_create_workflow(client):
    h = auth(client)
    resp = client.post("/api/workflows", headers=h, json={
        "name": "High Value Contract Approval",
        "description": "Approval for contracts over 10L",
        "workflow_type": "contract_approval",
    })
    assert resp.status_code == 201
    d = resp.get_json()
    assert d["name"] == "High Value Contract Approval"
    assert d["workflow_type"] == "contract_approval"
    assert d["is_active"] is True
    assert d["id"] > 0


def test_list_workflows(client):
    h = auth(client)
    client.post("/api/workflows", headers=h, json={"name": "WF1", "workflow_type": "contract_approval"})
    client.post("/api/workflows", headers=h, json={"name": "WF2", "workflow_type": "invoice_approval"})
    resp = client.get("/api/workflows", headers=h)
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 2

    resp2 = client.get("/api/workflows?type=invoice_approval", headers=h)
    assert len(resp2.get_json()) == 1


def test_get_workflow(client):
    h = auth(client)
    c = client.post("/api/workflows", headers=h, json={"name": "My WF", "workflow_type": "contract_approval"}).get_json()
    resp = client.get(f"/api/workflows/{c['id']}", headers=h)
    assert resp.status_code == 200
    assert resp.get_json()["name"] == "My WF"


def test_update_workflow(client):
    h = auth(client)
    c = client.post("/api/workflows", headers=h, json={"name": "Old", "workflow_type": "contract_approval"}).get_json()
    resp = client.put(f"/api/workflows/{c['id']}", headers=h, json={"name": "New", "is_active": False})
    assert resp.status_code == 200
    d = resp.get_json()
    assert d["name"] == "New"
    assert d["is_active"] is False


def test_delete_workflow(client):
    h = auth(client)
    c = client.post("/api/workflows", headers=h, json={"name": "Del", "workflow_type": "contract_approval"}).get_json()
    resp = client.delete(f"/api/workflows/{c['id']}", headers=h)
    assert resp.status_code == 200
    assert client.get(f"/api/workflows/{c['id']}", headers=h).status_code == 404


def test_duplicate_workflow(client):
    h = auth(client)
    c = client.post("/api/workflows", headers=h, json={"name": "Original", "workflow_type": "contract_approval"}).get_json()
    # Add a stage
    client.post(f"/api/workflows/{c['id']}/stages", headers=h, json={
        "name": "Manager Review", "stage_order": 1, "role_required": "APPROVER",
    })
    dup = client.post(f"/api/workflows/{c['id']}/duplicate", headers=h)
    assert dup.status_code == 201
    d = dup.get_json()
    assert "Copy" in d["name"]
    assert len(d["stages"]) == 1
    assert d["stages"][0]["name"] == "Manager Review"


def test_workflow_stages_crud(client):
    h = auth(client)
    wf = client.post("/api/workflows", headers=h, json={"name": "Stages WF", "workflow_type": "contract_approval"}).get_json()
    wid = wf["id"]

    # Add stages
    s1 = client.post(f"/api/workflows/{wid}/stages", headers=h, json={
        "name": "Manager", "stage_order": 1, "role_required": "APPROVER",
    }).get_json()
    s2 = client.post(f"/api/workflows/{wid}/stages", headers=h, json={
        "name": "Finance", "stage_order": 2, "role_required": "FINANCE",
    }).get_json()
    assert s1["id"] > 0
    assert s2["stage_order"] == 2

    # List workflow should include stages
    wf = client.get(f"/api/workflows/{wid}", headers=h).get_json()
    assert len(wf["stages"]) == 2

    # Update stage
    updated = client.put(f"/api/workflows/stages/{s1['id']}", headers=h, json={"name": "Senior Manager"})
    assert updated.get_json()["name"] == "Senior Manager"

    # Delete stage
    client.delete(f"/api/workflows/stages/{s2['id']}", headers=h)
    wf = client.get(f"/api/workflows/{wid}", headers=h).get_json()
    assert len(wf["stages"]) == 1


def test_workflow_rules_crud(client):
    h = auth(client)
    wf = client.post("/api/workflows", headers=h, json={"name": "Rules WF", "workflow_type": "contract_approval"}).get_json()
    wid = wf["id"]

    r1 = client.post(f"/api/workflows/{wid}/rules", headers=h, json={
        "field": "contract_value", "operator": "gt", "value": "1000000", "priority": 10,
    }).get_json()
    assert r1["field"] == "contract_value"

    r2 = client.post(f"/api/workflows/{wid}/rules", headers=h, json={
        "field": "department", "operator": "eq", "value": "Legal", "priority": 5,
    }).get_json()

    wf = client.get(f"/api/workflows/{wid}", headers=h).get_json()
    assert len(wf["rules"]) == 2

    # Update rule
    updated = client.put(f"/api/workflows/rules/{r1['id']}", headers=h, json={"value": "2000000"})
    assert updated.get_json()["value"] == "2000000"

    # Delete rule
    client.delete(f"/api/workflows/rules/{r2['id']}", headers=h)
    wf = client.get(f"/api/workflows/{wid}", headers=h).get_json()
    assert len(wf["rules"]) == 1


def test_workflow_evaluate_no_match(client):
    h = auth(client)
    resp = client.post("/api/workflows/evaluate", headers=h, json={
        "entity_type": "contract_approval",
        "entity_data": {"total_contract_value": 50000},
    })
    assert resp.status_code == 200
    assert resp.get_json()["workflow"] is None


def test_workflow_evaluate_match(client):
    h = auth(client)
    wf = client.post("/api/workflows", headers=h, json={
        "name": "High Value", "workflow_type": "contract_approval",
    }).get_json()
    client.post(f"/api/workflows/{wf['id']}/rules", headers=h, json={
        "field": "contract_value", "operator": "gt", "value": "100000", "priority": 10,
    })
    # Add a stage so workflow is complete
    client.post(f"/api/workflows/{wf['id']}/stages", headers=h, json={
        "name": "CEO", "stage_order": 1, "role_required": "ADMIN",
    })

    resp = client.post("/api/workflows/evaluate", headers=h, json={
        "entity_type": "contract_approval",
        "entity_data": {"total_contract_value": 500000},
    })
    assert resp.status_code == 200
    d = resp.get_json()
    assert d["workflow"] is not None
    assert d["workflow"]["name"] == "High Value"

    # Low value should not match
    resp2 = client.post("/api/workflows/evaluate", headers=h, json={
        "entity_type": "contract_approval",
        "entity_data": {"total_contract_value": 50000},
    })
    assert resp2.get_json()["workflow"] is None


def test_workflow_evaluate_disabled(client):
    h = auth(client)
    wf = client.post("/api/workflows", headers=h, json={
        "name": "Disabled WF", "workflow_type": "contract_approval",
    }).get_json()
    client.post(f"/api/workflows/{wf['id']}/rules", headers=h, json={
        "field": "contract_value", "operator": "gt", "value": "0", "priority": 1,
    })
    client.put(f"/api/workflows/{wf['id']}", headers=h, json={"is_active": False})

    resp = client.post("/api/workflows/evaluate", headers=h, json={
        "entity_type": "contract_approval",
        "entity_data": {"total_contract_value": 999999},
    })
    assert resp.get_json()["workflow"] is None


def test_workflow_meta(client):
    h = auth(client)
    resp = client.get("/api/workflows/meta", headers=h)
    assert resp.status_code == 200
    d = resp.get_json()
    assert "contract_approval" in d["types"]
    assert "gt" in d["operators"]
    assert "contract_value" in d["fields"]


def test_non_admin_cannot_manage_workflows(client):
    _, token = register_user(client, role="VIEWER")
    h = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/workflows", headers=h)
    assert resp.status_code == 403


def test_workflow_evaluate_multiple_rules(client):
    h = auth(client)
    wf = client.post("/api/workflows", headers=h, json={
        "name": "Multi Rule", "workflow_type": "contract_approval",
    }).get_json()
    client.post(f"/api/workflows/{wf['id']}/rules", headers=h, json={
        "field": "contract_value", "operator": "gt", "value": "500000", "priority": 10,
    })
    client.post(f"/api/workflows/{wf['id']}/rules", headers=h, json={
        "field": "department", "operator": "eq", "value": "Engineering", "priority": 5,
    })
    client.post(f"/api/workflows/{wf['id']}/stages", headers=h, json={
        "name": "Review", "stage_order": 1, "role_required": "APPROVER",
    })

    # Both rules match
    resp = client.post("/api/workflows/evaluate", headers=h, json={
        "entity_type": "contract_approval",
        "entity_data": {"total_contract_value": 1000000, "department": "Engineering"},
    })
    assert resp.get_json()["workflow"] is not None

    # Only one rule matches
    resp2 = client.post("/api/workflows/evaluate", headers=h, json={
        "entity_type": "contract_approval",
        "entity_data": {"total_contract_value": 1000000, "department": "Sales"},
    })
    assert resp2.get_json()["workflow"] is None


def test_workflow_no_rules_is_default(client):
    h = auth(client)
    wf = client.post("/api/workflows", headers=h, json={
        "name": "Default WF", "workflow_type": "contract_approval",
    }).get_json()
    client.post(f"/api/workflows/{wf['id']}/stages", headers=h, json={
        "name": "Basic", "stage_order": 1, "role_required": "APPROVER",
    })

    resp = client.post("/api/workflows/evaluate", headers=h, json={
        "entity_type": "contract_approval",
        "entity_data": {"total_contract_value": 100},
    })
    assert resp.get_json()["workflow"] is not None


def test_workflow_types_invalid(client):
    h = auth(client)
    resp = client.post("/api/workflows", headers=h, json={
        "name": "Bad", "workflow_type": "invalid_type",
    })
    assert resp.status_code == 400


def test_workflow_invalid_field(client):
    h = auth(client)
    wf = client.post("/api/workflows", headers=h, json={
        "name": "Bad Rule", "workflow_type": "contract_approval",
    }).get_json()
    resp = client.post(f"/api/workflows/{wf['id']}/rules", headers=h, json={
        "field": "nonexistent", "operator": "eq", "value": "x",
    })
    assert resp.status_code == 400


def test_workflow_stage_reorder(client):
    h = auth(client)
    wf = client.post("/api/workflows", headers=h, json={
        "name": "Reorder", "workflow_type": "contract_approval",
    }).get_json()
    wid = wf["id"]
    s1 = client.post(f"/api/workflows/{wid}/stages", headers=h, json={
        "name": "First", "stage_order": 1, "role_required": "APPROVER",
    }).get_json()
    s2 = client.post(f"/api/workflows/{wid}/stages", headers=h, json={
        "name": "Second", "stage_order": 2, "role_required": "FINANCE",
    }).get_json()
    s3 = client.post(f"/api/workflows/{wid}/stages", headers=h, json={
        "name": "Third", "stage_order": 3, "role_required": "ADMIN",
    }).get_json()

    # Delete first stage; reindex should make remaining stages sequential
    client.delete(f"/api/workflows/stages/{s1['id']}", headers=h)
    wf = client.get(f"/api/workflows/{wid}", headers=h).get_json()
    orders = sorted([(s["name"], s["stage_order"]) for s in wf["stages"]], key=lambda x: x[1])
    assert len(orders) == 2
    assert orders[0][1] == 1
    assert orders[1][1] == 2
    assert orders[0][0] == "Second"


def test_workflow_assignment_list(client):
    h = auth(client)
    resp = client.get("/api/workflows/assignments", headers=h)
    assert resp.status_code == 200
    assert resp.get_json() == []
