def test_health_openapi_and_static_routes(client):
    health = client.get("/health")
    openapi = client.get("/openapi.yaml")
    index = client.get("/")
    missing_asset = client.get("/missing-file.js")

    assert health.status_code == 200
    assert health.get_json()["status"] == "healthy"
    assert openapi.status_code == 200
    assert b"openapi: 3.0.3" in openapi.data
    assert index.status_code == 200
    assert b"Muraai Contract Reminder" in index.data
    assert missing_asset.status_code == 200
    assert b"Muraai Contract Reminder" in missing_asset.data
