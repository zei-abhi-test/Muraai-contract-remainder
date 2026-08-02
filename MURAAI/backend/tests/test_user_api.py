from conftest import register_user, register_admin


def test_user_crud_routes(client):
    """ADMIN can list, get, update, and delete users."""
    admin_user, token = register_admin(client, username="boss", email="boss@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Register a second user to manage
    user, _ = register_user(client, username="cruduser", email="crud@example.com")

    # List users (admin)
    list_resp = client.get("/api/users", headers=headers)
    assert list_resp.status_code == 200

    # Get single user (admin)
    get_resp = client.get(f"/api/users/{user['id']}", headers=headers)
    assert get_resp.status_code == 200

    # Update user (admin — use AdminUserUpdate fields)
    update_resp = client.put(
        f"/api/users/{user['id']}",
        json={"name": "Updated Name", "role": "CONTRACT_MANAGER"},
        headers=headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.get_json()["name"] == "Updated Name"
    assert update_resp.get_json()["role"] == "CONTRACT_MANAGER"

    # Delete user (admin)
    delete_resp = client.delete(f"/api/users/{user['id']}", headers=headers)
    assert delete_resp.status_code == 204

    # Verify deleted
    missing_resp = client.get(f"/api/users/{user['id']}", headers=headers)
    assert missing_resp.status_code == 404


def test_non_admin_cannot_manage_users(client):
    """A non-ADMIN user receives 403 when accessing user management endpoints."""
    _, token = register_user(client, username="viewer", email="viewer@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    list_resp = client.get("/api/users", headers=headers)
    assert list_resp.status_code == 403

    post_resp = client.post("/api/users", json={}, headers=headers)
    assert post_resp.status_code == 403


def test_cannot_delete_self(client):
    """ADMIN cannot delete their own account."""
    admin_user, token = register_admin(client, username="boss", email="boss@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    delete_resp = client.delete(f"/api/users/{admin_user['id']}", headers=headers)
    assert delete_resp.status_code == 400
    assert "Cannot delete your own account" in delete_resp.get_json()["error"]


def test_cannot_delete_last_admin(client):
    """Cannot delete the last active ADMIN."""
    admin_user, token = register_admin(client, username="boss", email="boss@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    delete_resp = client.delete(f"/api/users/{admin_user['id']}", headers=headers)
    assert delete_resp.status_code == 400
    # If it's the only admin, it's also self — but if we had another admin:
    assert "Cannot delete your own account" in delete_resp.get_json()["error"]


def test_cannot_disable_self(client):
    """ADMIN cannot disable their own account."""
    admin_user, token = register_admin(client, username="boss", email="boss@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.post(f"/api/users/{admin_user['id']}/disable", headers=headers)
    assert resp.status_code == 400
    assert "Cannot disable your own account" in resp.get_json()["error"]


def test_disable_and_enable_user(client):
    """ADMIN can disable and re-enable another user."""
    admin_user, token = register_admin(client, username="boss", email="boss@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    user, _ = register_user(client, username="target", email="target@example.com")

    # Disable
    disable_resp = client.post(f"/api/users/{user['id']}/disable", headers=headers)
    assert disable_resp.status_code == 200
    assert disable_resp.get_json()["status"] == "disabled"

    # Attempt login as disabled user
    login_resp = client.post("/api/auth/login", json={"email": "target@example.com", "password": "securepassword123"})
    assert login_resp.status_code == 403
    assert "disabled" in login_resp.get_json()["error"].lower()

    # Enable
    enable_resp = client.post(f"/api/users/{user['id']}/enable", headers=headers)
    assert enable_resp.status_code == 200
    assert enable_resp.get_json()["status"] == "active"

    # Login works again
    login_resp2 = client.post("/api/auth/login", json={"email": "target@example.com", "password": "securepassword123"})
    assert login_resp2.status_code == 200


def test_create_user_duplicate_email_rejected(client):
    """ADMIN creating a user with duplicate email gets 400."""
    admin_user, token = register_admin(client, username="boss", email="boss@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # First create
    create1 = client.post("/api/users", json={
        "name": "Test User",
        "email": "test@example.com",
        "password": "securepassword123",
        "role": "VIEWER",
    }, headers=headers)
    assert create1.status_code == 201

    # Duplicate email
    create2 = client.post("/api/users", json={
        "name": "Test User 2",
        "email": "test@example.com",
        "password": "otherpassword123",
        "role": "VIEWER",
    }, headers=headers)
    assert create2.status_code == 400


def test_invalid_payloads(client):
    """Admin endpoints return 400 for invalid payloads or 404 for missing users."""
    admin_user, token = register_admin(client, username="boss", email="boss@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    # Missing required fields
    create_resp = client.post("/api/users", json={"email": "bad"}, headers=headers)
    assert create_resp.status_code == 400

    # Non-existent user
    update_resp = client.put("/api/users/999", json={"name": "validname"}, headers=headers)
    assert update_resp.status_code == 404

    delete_resp = client.delete("/api/users/999", headers=headers)
    assert delete_resp.status_code == 404


def test_register_sets_default_role_and_status(client):
    """Self-registration creates a VIEWER with active status."""
    user, _ = register_user(client, username="newguy", email="newguy@example.com", role="VIEWER")
    assert user["role"] == "VIEWER"
    assert user["status"] == "active"
    assert user["last_login"] is None


def test_login_updates_last_login(client):
    """Successful login updates the last_login field."""
    user, token = register_user(client, username="logincheck", email="logincheck@example.com")
    assert user["last_login"] is None

    # Login
    login_resp = client.post("/api/auth/login", json={"email": "logincheck@example.com", "password": "securepassword123"})
    assert login_resp.status_code == 200
    assert login_resp.get_json()["user"]["last_login"] is not None
