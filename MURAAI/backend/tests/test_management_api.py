from io import BytesIO
from datetime import date, timedelta

from conftest import register_user


def auth(client):
    _, token = register_user(client, username="manager", email="manager@example.com", role="ADMIN")
    return {"Authorization": f"Bearer {token}"}


def contract_payload(**overrides):
    today = date.today()
    payload = {
        "company_name": "Acme Corp",
        "contract_name": "Software License",
        "start_date": today.isoformat(),
        "end_date": (today + timedelta(days=365)).isoformat(),
        "renewal_date": (today + timedelta(days=365)).isoformat(),
        "notification_enabled": True,
        "notification_email": "owner@example.com",
    }
    payload.update(overrides)
    return payload


def test_customer_contact_contract_line_items_and_reports(client):
    headers = auth(client)

    customer_response = client.post(
        "/api/customers",
        json={"name": "Muraai Client", "email": "client@example.com"},
        headers=headers,
    )
    customer = customer_response.get_json()
    contact_response = client.post(
        f"/api/customers/{customer['id']}/contacts",
        json={
            "contact_name": "Priya",
            "contact_number": "9999999999",
            "email": "priya@example.com",
            "designation": "Manager",
        },
        headers=headers,
    )
    contact = contact_response.get_json()

    contract_response = client.post(
        "/api/contracts",
        json=contract_payload(
            customer_id=customer["id"],
            contact_person_id=contact["id"],
            currency="INR",
            payment_terms="Net 30",
            line_items=[
                {"product_name": "License", "quantity": 2, "rate": 1500},
                {"product_name": "Support", "quantity": 1, "rate": 500},
            ],
        ),
        headers=headers,
    )
    contract = contract_response.get_json()
    line_items = client.get(
        f"/api/contracts/{contract['id']}/line-items",
        headers=headers,
    ).get_json()
    line_report = client.get("/api/reports/line-items", headers=headers).get_json()

    assert customer_response.status_code == 201
    assert contact_response.status_code == 201
    assert contract_response.status_code == 201
    assert contract["customer_id"] == customer["id"]
    assert contract["contact_person_id"] == contact["id"]
    assert contract["currency"] == "INR"
    assert contract["total_contract_value"] == 3500.0
    assert len(line_items) == 2
    assert len(line_report) == 2


def test_contract_renewal_creates_new_contract_and_preserves_previous(client):
    headers = auth(client)
    today = date.today()
    contract_response = client.post(
        "/api/contracts",
        json=contract_payload(
            line_items=[{"product_name": "Hosting", "quantity": 3, "rate": 100}],
        ),
        headers=headers,
    )
    previous = contract_response.get_json()

    # Only ACTIVE (or ON_HOLD/RENEWAL_DUE) contracts are eligible for
    # renewal - drive the contract through the real submit/approve/activate
    # lifecycle endpoints rather than writing the status directly.
    submit_response = client.post(f"/api/contracts/{previous['id']}/submit", headers=headers)
    approval_id = submit_response.get_json()["approval"]["id"]
    client.post(f"/api/approvals/{approval_id}/approve", headers=headers)
    activate_response = client.post(f"/api/contracts/{previous['id']}/activate", headers=headers)
    assert activate_response.status_code == 200
    assert activate_response.get_json()["status"] == "Active"

    renewal_response = client.post(
        f"/api/contracts/{previous['id']}/renew",
        json={
            "start_date": (today + timedelta(days=366)).isoformat(),
            "end_date": (today + timedelta(days=730)).isoformat(),
            "contract_name": "Software License Renewal",
        },
        headers=headers,
    )
    renewed = renewal_response.get_json()
    history = client.get(
        f"/api/contracts/{previous['id']}/renewal-history",
        headers=headers,
    ).get_json()

    assert renewal_response.status_code == 201
    assert renewed["id"] != previous["id"]
    assert renewed["previous_contract_id"] == previous["id"]
    assert renewed["parent_contract_id"] == previous["id"]
    assert renewed["contract_version"] == 2
    assert renewed["line_items"][0]["product_name"] == "Hosting"
    assert len(history) == 2
    assert history[0]["id"] == previous["id"]


def test_contract_document_upload_metadata(client):
    headers = auth(client)
    contract = client.post(
        "/api/contracts",
        json=contract_payload(),
        headers=headers,
    ).get_json()
    upload = client.post(
        f"/api/contracts/{contract['id']}/documents",
        data={"file": (BytesIO(b"contract pdf"), "contract.pdf")},
        content_type="multipart/form-data",
        headers=headers,
    )
    documents = client.get(
        f"/api/contracts/{contract['id']}/documents",
        headers=headers,
    ).get_json()

    assert upload.status_code == 201
    assert upload.get_json()["file_name"] == "contract.pdf"
    assert len(documents) == 1
