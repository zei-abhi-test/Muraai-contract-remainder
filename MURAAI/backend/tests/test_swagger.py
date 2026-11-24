import pytest


def test_swagger_ui_endpoint(client):
    """Verify Swagger UI renders at /apidocs/ with HTTP 200."""
    response = client.get("/apidocs/")
    assert response.status_code == 200
    assert b"Swagger UI" in response.data or b"Muraai Contract Reminder API" in response.data or b"swagger" in response.data.lower()


def test_apispec_json_endpoint(client):
    """Verify OpenAPI dynamic JSON specification at /apispec_1.json."""
    response = client.get("/apispec_1.json")
    assert response.status_code == 200
    data = response.get_json()
    assert isinstance(data, dict)
    assert data.get("swagger") == "2.0"
    assert "info" in data
    assert data["info"]["title"] == "Muraai Contract Reminder API"
    assert "paths" in data
    assert "securityDefinitions" in data
    assert "Bearer" in data["securityDefinitions"]
