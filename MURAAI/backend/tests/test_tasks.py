"""Tests for the Task Management module."""
from datetime import date

from conftest import register_user


def auth(client):
    _, token = register_user(client, role="ADMIN")
    return {"Authorization": f"Bearer {token}"}


def test_create_task(client):
    h = auth(client)
    resp = client.post("/api/tasks", headers=h, json={
        "title": "Review contract",
        "description": "Review the new contract",
        "priority": "HIGH",
        "due_days": 7,
    })
    assert resp.status_code == 201
    d = resp.get_json()
    assert d["title"] == "Review contract"
    assert d["priority"] == "HIGH"
    assert d["status"] == "TODO"
    assert d["id"] > 0


def test_list_tasks(client):
    h = auth(client)
    client.post("/api/tasks", headers=h, json={"title": "Task 1", "priority": "HIGH"})
    client.post("/api/tasks", headers=h, json={"title": "Task 2", "priority": "LOW"})
    resp = client.get("/api/tasks", headers=h)
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 2


def test_list_tasks_filter_by_status(client):
    h = auth(client)
    client.post("/api/tasks", headers=h, json={"title": "Todo Task"})
    t2 = client.post("/api/tasks", headers=h, json={"title": "Completed Task"}).get_json()
    client.put(f"/api/tasks/{t2['id']}/status", headers=h, json={"status": "COMPLETED"})
    resp = client.get("/api/tasks?status=COMPLETED", headers=h)
    assert len(resp.get_json()) == 1


def test_list_tasks_filter_by_priority(client):
    h = auth(client)
    client.post("/api/tasks", headers=h, json={"title": "High", "priority": "HIGH"})
    client.post("/api/tasks", headers=h, json={"title": "Low", "priority": "LOW"})
    resp = client.get("/api/tasks?priority=HIGH", headers=h)
    assert len(resp.get_json()) == 1


def test_get_task(client):
    h = auth(client)
    c = client.post("/api/tasks", headers=h, json={
        "title": "My Task", "priority": "CRITICAL",
    }).get_json()
    resp = client.get(f"/api/tasks/{c['id']}", headers=h)
    assert resp.status_code == 200
    d = resp.get_json()
    assert d["title"] == "My Task"
    assert "comments" in d
    assert "history" in d
    assert "attachments" in d


def test_update_task(client):
    h = auth(client)
    c = client.post("/api/tasks", headers=h, json={
        "title": "Old title", "priority": "LOW",
    }).get_json()
    resp = client.put(f"/api/tasks/{c['id']}", headers=h, json={
        "title": "New title", "priority": "HIGH",
    })
    assert resp.status_code == 200
    d = resp.get_json()
    assert d["title"] == "New title"
    assert d["priority"] == "HIGH"


def test_change_status(client):
    h = auth(client)
    c = client.post("/api/tasks", headers=h, json={"title": "Status Task"}).get_json()
    r = client.put(f"/api/tasks/{c['id']}/status", headers=h, json={"status": "IN_PROGRESS"})
    assert r.status_code == 200
    assert r.get_json()["status"] == "IN_PROGRESS"

    r2 = client.put(f"/api/tasks/{c['id']}/status", headers=h, json={"status": "COMPLETED"})
    assert r2.get_json()["status"] == "COMPLETED"
    assert r2.get_json()["completed_at"] is not None


def test_change_status_invalid(client):
    h = auth(client)
    c = client.post("/api/tasks", headers=h, json={"title": "Bad Status"}).get_json()
    r = client.put(f"/api/tasks/{c['id']}/status", headers=h, json={"status": "INVALID"})
    assert r.status_code == 400


def test_delete_task(client):
    h = auth(client)
    c = client.post("/api/tasks", headers=h, json={"title": "Delete Me"}).get_json()
    resp = client.delete(f"/api/tasks/{c['id']}", headers=h)
    assert resp.status_code == 200
    r2 = client.get(f"/api/tasks/{c['id']}", headers=h)
    assert r2.status_code == 404


def test_task_stats(client):
    h = auth(client)
    client.post("/api/tasks", headers=h, json={"title": "Active"})
    c2 = client.post("/api/tasks", headers=h, json={"title": "Done"}).get_json()
    client.put(f"/api/tasks/{c2['id']}/status", headers=h, json={"status": "COMPLETED"})
    stats = client.get("/api/tasks/stats", headers=h).get_json()
    assert stats["my_tasks"] >= 1
    assert stats["completed"] >= 1


def test_add_comment(client):
    h = auth(client)
    c = client.post("/api/tasks", headers=h, json={"title": "Comment Task"}).get_json()
    r = client.post(f"/api/tasks/{c['id']}/comments", headers=h, json={"content": "Looks good!"})
    assert r.status_code == 201
    assert r.get_json()["content"] == "Looks good!"

    comments = client.get(f"/api/tasks/{c['id']}/comments", headers=h).get_json()
    assert len(comments) == 1


def test_delete_comment(client):
    h = auth(client)
    c = client.post("/api/tasks", headers=h, json={"title": "Del Comment"}).get_json()
    cm = client.post(f"/api/tasks/{c['id']}/comments", headers=h, json={"content": "Delete me"}).get_json()
    r = client.delete(f"/api/tasks/{c['id']}/comments/{cm['id']}", headers=h)
    assert r.status_code == 200
    comments = client.get(f"/api/tasks/{c['id']}/comments", headers=h).get_json()
    assert len(comments) == 0


def test_task_history_created(client):
    h = auth(client)
    c = client.post("/api/tasks", headers=h, json={"title": "History Task"}).get_json()
    history = client.get(f"/api/tasks/{c['id']}/history", headers=h).get_json()
    assert len(history) > 0
    assert history[0]["field"] == "status"


def test_task_requires_auth(client):
    resp = client.get("/api/tasks")
    assert resp.status_code == 401


def test_non_admin_can_access_tasks(client):
    user, token = register_user(client, role="VIEWER")
    h = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/tasks", headers=h)
    assert resp.status_code == 200
    resp = client.post("/api/tasks", headers=h, json={"title": "Viewer Task"})
    assert resp.status_code == 201


def test_task_not_found(client):
    h = auth(client)
    assert client.get("/api/tasks/99999", headers=h).status_code == 404
    assert client.put("/api/tasks/99999", headers=h, json={"title": "X"}).status_code == 404
    assert client.delete("/api/tasks/99999", headers=h).status_code == 404


def test_generate_task_service(client):
    from src.services.task_service import generate_task
    from src import main
    with main.app.app_context():
        task = generate_task(
            title="Auto-generated task",
            description="Generated by service",
            priority="CRITICAL",
            due_days=3,
            related_module="contract",
            related_record_id=42,
        )
        assert task.title == "Auto-generated task"
        assert task.priority == "CRITICAL"
        assert task.status == "TODO"
        assert task.related_module == "contract"
        assert task.related_record_id == 42
        assert task.due_date == date.today() + __import__('datetime').timedelta(days=3)
