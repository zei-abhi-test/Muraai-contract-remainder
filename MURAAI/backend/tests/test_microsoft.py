"""Tests for Microsoft integration routes.

Because no Azure credentials are set in the test environment, every
provider returns a null stub.  All routes must still respond with sensible
HTTP status codes (not 500) when credentials are absent.
"""


def test_status_endpoint_returns_services(client, auth_headers):
    resp = client.get("/api/microsoft/status", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert "configured" in data
    assert data["configured"] is False  # no creds in test env
    assert len(data["services"]) == 4
    for svc in data["services"]:
        assert svc["available"] is False
        assert svc["configured"] is False


def test_status_requires_auth(client):
    resp = client.get("/api/microsoft/status")
    assert resp.status_code == 401


def test_onedrive_list_files_without_creds(client, auth_headers):
    resp = client.get("/api/microsoft/onedrive/files", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["available"] is False
    assert data["files"] == []


def test_onedrive_upload_without_creds(client, auth_headers):
    resp = client.post("/api/microsoft/onedrive/upload", headers=auth_headers)
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "OneDrive is not configured"


def test_onedrive_download_without_creds(client, auth_headers):
    resp = client.get("/api/microsoft/onedrive/download/fake-id", headers=auth_headers)
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "OneDrive is not configured"


def test_onedrive_delete_without_creds(client, auth_headers):
    resp = client.delete("/api/microsoft/onedrive/files/fake-id", headers=auth_headers)
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "OneDrive is not configured"


def test_onedrive_share_link_without_creds(client, auth_headers):
    resp = client.get("/api/microsoft/onedrive/share-link/fake-id", headers=auth_headers)
    assert resp.status_code == 400


def test_outlook_send_without_creds(client, auth_headers):
    resp = client.post(
        "/api/microsoft/outlook/send",
        headers=auth_headers,
        json={"to": ["user@test.com"], "subject": "Hi", "body": "<p>Hi</p>"},
    )
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "Outlook is not configured"


def test_outlook_send_requires_to_returns_400(client, auth_headers):
    resp = client.post(
        "/api/microsoft/outlook/send",
        headers=auth_headers,
        json={"subject": "Hi"},
    )
    assert resp.status_code == 400


def test_outlook_create_event_without_creds(client, auth_headers):
    resp = client.post(
        "/api/microsoft/outlook/events",
        headers=auth_headers,
        json={"subject": "Meeting", "start": "2026-07-15T09:00:00", "end": "2026-07-15T10:00:00"},
    )
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "Outlook is not configured"


def test_outlook_create_event_requires_fields_returns_400(client, auth_headers):
    resp = client.post(
        "/api/microsoft/outlook/events",
        headers=auth_headers,
        json={"subject": "Meeting"},
    )
    assert resp.status_code == 400


def test_teams_list_without_creds(client, auth_headers):
    resp = client.get("/api/microsoft/teams", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["available"] is False
    assert data["teams"] == []


def test_teams_list_channels_without_creds(client, auth_headers):
    resp = client.get("/api/microsoft/teams/fake-team/channels", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["available"] is False
    assert data["channels"] == []


def test_teams_send_message_without_creds(client, auth_headers):
    resp = client.post(
        "/api/microsoft/teams/fake-team/channels/fake-channel/messages",
        headers=auth_headers,
        json={"message": "Hello"},
    )
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "Teams is not configured"


def test_entra_list_users_without_creds(client, auth_headers):
    resp = client.get("/api/microsoft/entra/users", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["available"] is False
    assert data["users"] == []


def test_entra_get_user_without_creds(client, auth_headers):
    resp = client.get("/api/microsoft/entra/users/fake-id", headers=auth_headers)
    assert resp.status_code == 400


def test_entra_group_members_without_creds(client, auth_headers):
    resp = client.get("/api/microsoft/entra/groups/fake-group/members", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["available"] is False
    assert data["members"] == []
