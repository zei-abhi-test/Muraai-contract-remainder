from conftest import register_user


def contract_payload(**overrides):
    payload = {
        "company_name": "Acme Corp",
        "contract_name": "Software License",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "renewal_date": "2026-12-31",
        "notification_enabled": True,
        "notification_email": "owner@example.com",
        "notification_mobile": False,
        "notes": "Annual renewal",
    }
    payload.update(overrides)
    return payload


def test_contract_routes_require_authentication(client):
    response = client.get("/api/contracts")

    assert response.status_code == 401


def test_create_and_list_contract_for_authenticated_user(client, auth_headers):
    create_response = client.post("/api/contracts", json=contract_payload(), headers=auth_headers)
    list_response = client.get("/api/contracts", headers=auth_headers)

    assert create_response.status_code == 201
    assert create_response.get_json()["user_id"] == 1
    assert list_response.status_code == 200
    assert len(list_response.get_json()) == 1


def test_user_cannot_read_another_users_contract(client):
    _, owner_token = register_user(client, username="owner", email="owner@example.com")
    create_response = client.post(
        "/api/contracts",
        json=contract_payload(),
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    contract_id = create_response.get_json()["id"]

    _, other_token = register_user(client, username="other", email="other@example.com")
    other_headers = {"Authorization": f"Bearer {other_token}"}

    assert client.get("/api/contracts", headers=other_headers).get_json() == []
    assert client.get(f"/api/contracts/{contract_id}", headers=other_headers).status_code == 404


def test_user_cannot_create_contract_for_another_user(client):
    _, owner_token = register_user(client, username="owner", email="owner@example.com")
    register_user(client, username="other", email="other@example.com")

    response = client.post(
        "/api/contracts",
        json=contract_payload(user_id=2),
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    assert response.status_code == 403


def test_dashboard_is_scoped_to_authenticated_user(client):
    _, first_token = register_user(client, username="first", email="first@example.com")
    _, second_token = register_user(client, username="second", email="second@example.com")

    client.post(
        "/api/contracts",
        json=contract_payload(contract_name="First Contract"),
        headers={"Authorization": f"Bearer {first_token}"},
    )
    client.post(
        "/api/contracts",
        json=contract_payload(contract_name="Second Contract"),
        headers={"Authorization": f"Bearer {second_token}"},
    )

    response = client.get(
        "/api/contracts/dashboard", headers={"Authorization": f"Bearer {first_token}"}
    )

    assert response.status_code == 200
    assert response.get_json()["total_contracts"] == 1


def test_notification_history_is_scoped_to_contract_owner(client):
    _, owner_token = register_user(client, username="owner", email="owner@example.com")
    create_response = client.post(
        "/api/contracts",
        json=contract_payload(),
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    contract_id = create_response.get_json()["id"]
    client.post(
        "/api/notifications",
        json={"contract_id": contract_id, "notification_type": "email", "status": "sent"},
        headers={"Authorization": f"Bearer {owner_token}"},
    )

    _, other_token = register_user(client, username="other", email="other@example.com")

    owner_response = client.get(
        f"/api/notifications?contract_id={contract_id}",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    other_response = client.get(
        f"/api/notifications?contract_id={contract_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )

    assert owner_response.status_code == 200
    assert len(owner_response.get_json()) == 1
    assert other_response.status_code == 404


def test_update_delete_and_upcoming_contract_filter(client, auth_headers):
    create_response = client.post(
        "/api/contracts",
        json=contract_payload(
            contract_name="Original",
            start_date="2026-01-01",
            end_date="2026-05-28",
            renewal_date="2026-05-28",
        ),
        headers=auth_headers,
    )
    contract_id = create_response.get_json()["id"]

    update_response = client.put(
        f"/api/contracts/{contract_id}",
        json={"contract_name": "Updated", "notes": "Changed"},
        headers=auth_headers,
    )
    upcoming_response = client.get("/api/contracts?upcoming_only=true", headers=auth_headers)
    delete_response = client.delete(f"/api/contracts/{contract_id}", headers=auth_headers)
    missing_response = client.get(f"/api/contracts/{contract_id}", headers=auth_headers)

    assert update_response.status_code == 200
    assert update_response.get_json()["contract_name"] == "Updated"
    assert upcoming_response.status_code == 200
    assert len(upcoming_response.get_json()) == 1
    assert delete_response.status_code == 204
    assert missing_response.status_code == 404


def test_contract_validation_and_forbidden_filters(client, auth_headers):
    invalid_create = client.post(
        "/api/contracts",
        json=contract_payload(end_date="2026-01-01"),
        headers=auth_headers,
    )
    invalid_update = client.put(
        "/api/contracts/999", json={"contract_name": "Nope"}, headers=auth_headers
    )
    forbidden_list = client.get("/api/contracts?user_id=999", headers=auth_headers)
    forbidden_dashboard = client.get("/api/contracts/dashboard?user_id=999", headers=auth_headers)

    assert invalid_create.status_code == 400
    assert invalid_update.status_code == 404
    assert forbidden_list.status_code == 403
    assert forbidden_dashboard.status_code == 403


def test_notification_creation_validation(client, auth_headers):
    create_response = client.post("/api/contracts", json=contract_payload(), headers=auth_headers)
    contract_id = create_response.get_json()["id"]

    invalid_response = client.post(
        "/api/notifications",
        json={"contract_id": contract_id, "notification_type": "fax"},
        headers=auth_headers,
    )
    missing_response = client.post(
        "/api/notifications",
        json={"contract_id": 999, "notification_type": "email"},
        headers=auth_headers,
    )

    assert invalid_response.status_code == 400
    assert missing_response.status_code == 404
