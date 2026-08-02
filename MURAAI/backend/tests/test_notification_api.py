from conftest import register_user


def create_contract(client, token):
    response = client.post(
        "/api/contracts",
        json={
            "company_name": "Notify Co",
            "contract_name": "Notify Contract",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
            "renewal_date": "2026-12-31",
            "notification_enabled": True,
            "notification_email": "notify@example.com",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    return response.get_json()


def test_send_test_email_notification(client, monkeypatch):
    _, token = register_user(client, username="notify", email="notify@example.com")
    contract = create_contract(client, token)

    monkeypatch.setattr(
        "src.routes.notification.notification_service.send_email_notification",
        lambda *args, **kwargs: (True, "sent"),
    )

    response = client.post(
        "/api/notifications/send-test",
        json={"contract_id": contract["id"], "type": "email"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.get_json()["success"] is True


def test_send_test_mobile_notification(client):
    _, token = register_user(client, username="mobile", email="mobile@example.com")
    contract = create_contract(client, token)

    response = client.post(
        "/api/notifications/send-test",
        json={"contract_id": contract["id"], "type": "mobile"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.get_json()["type"] == "mobile"


def test_notification_settings_and_history(client):
    _, token = register_user(client, username="settings", email="settings@example.com")
    contract = create_contract(client, token)
    headers = {"Authorization": f"Bearer {token}"}

    settings_response = client.put(
        f"/api/notifications/settings/{contract['id']}",
        json={"notification_enabled": False, "notification_mobile": True},
        headers=headers,
    )
    history_response = client.get(f"/api/notifications/history/{contract['id']}", headers=headers)
    configure_response = client.post(
        "/api/notifications/configure",
        json={"daily_hour": 9},
        headers=headers,
    )

    assert settings_response.status_code == 200
    assert settings_response.get_json()["contract"]["notification_enabled"] is False
    assert history_response.status_code == 200
    assert configure_response.status_code == 200


def test_check_renewals_uses_current_user(client, monkeypatch):
    _, token = register_user(client, username="renewals", email="renewals@example.com")

    monkeypatch.setattr(
        "src.routes.notification.notification_service.check_and_send_notifications",
        lambda user_id=None: {"emails_sent": 1, "push_notifications_sent": 0, "errors": []},
    )

    response = client.post(
        "/api/notifications/check-renewals",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.get_json()["results"]["emails_sent"] == 1


def test_notification_routes_reject_missing_or_foreign_contract(client):
    _, owner_token = register_user(client, username="owner", email="owner-notify@example.com")
    contract = create_contract(client, owner_token)
    _, other_token = register_user(client, username="other", email="other-notify@example.com")
    other_headers = {"Authorization": f"Bearer {other_token}"}

    bad_id_response = client.post(
        "/api/notifications/send-test",
        json={"contract_id": "bad", "type": "email"},
        headers=other_headers,
    )
    foreign_response = client.get(
        f"/api/notifications/history/{contract['id']}",
        headers=other_headers,
    )

    assert bad_id_response.status_code == 400
    assert foreign_response.status_code == 404
