from conftest import register_user


def test_user_crud_routes(client):
    user, _ = register_user(client, username="cruduser", email="crud@example.com")

    list_response = client.get("/api/users")
    get_response = client.get(f"/api/users/{user['id']}")
    update_response = client.put(
        f"/api/users/{user['id']}",
        json={"username": "cruduser2", "email": "crud2@example.com"},
    )
    delete_response = client.delete(f"/api/users/{user['id']}")
    missing_response = client.get(f"/api/users/{user['id']}")

    assert list_response.status_code == 200
    assert get_response.status_code == 200
    assert update_response.status_code == 200
    assert update_response.get_json()["username"] == "cruduser2"
    assert delete_response.status_code == 204
    assert missing_response.status_code == 404


def test_user_duplicate_create_and_update_are_rejected(client):
    first, _ = register_user(client, username="first", email="first@example.com")
    second, _ = register_user(client, username="second", email="second@example.com")

    duplicate_create = client.post(
        "/api/users",
        json={
            "username": "first",
            "email": "other@example.com",
            "password": "securepassword123",
        },
    )
    duplicate_update = client.put(
        f"/api/users/{second['id']}",
        json={"username": first["username"]},
    )

    assert duplicate_create.status_code == 400
    assert duplicate_update.status_code == 400


def test_user_invalid_payloads(client):
    create_response = client.post("/api/users", json={"username": "ab", "email": "bad"})
    update_response = client.put("/api/users/999", json={"username": "validname"})
    delete_response = client.delete("/api/users/999")

    assert create_response.status_code == 400
    assert update_response.status_code == 404
    assert delete_response.status_code == 404
