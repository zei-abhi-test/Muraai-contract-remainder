from datetime import date, timedelta
from decimal import Decimal

from conftest import register_user
from src.models.contract import Notification, db


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


def test_contract_list_pagination_shape_and_clamping(client, auth_headers):
    for i in range(3):
        resp = client.post(
            "/api/contracts",
            json=contract_payload(contract_name=f"Pagination {i}"),
            headers=auth_headers,
        )
        assert resp.status_code == 201

    page_one = client.get(
        "/api/contracts?page=1&per_page=2", headers=auth_headers
    ).get_json()
    assert page_one["items"]
    assert page_one["page"] == 1
    assert page_one["per_page"] == 2
    assert page_one["total"] == 3
    assert page_one["total_pages"] == 2

    page_two = client.get(
        "/api/contracts?page=2&per_page=2", headers=auth_headers
    ).get_json()
    assert len(page_two["items"]) == 1
    assert page_two["total_pages"] == 2

    clamped = client.get(
        "/api/contracts?per_page=999", headers=auth_headers
    ).get_json()
    assert clamped["per_page"] == 100


def test_contract_list_search_and_sort(client, auth_headers):
    for name, company in [
        ("Alpha Contract", "Zeta Ltd"),
        ("Beta Contract", "Acme Corp"),
        ("Gamma Agreement", "Beta Ltd"),
    ]:
        resp = client.post(
            "/api/contracts",
            json=contract_payload(contract_name=name, company_name=company),
            headers=auth_headers,
        )
        assert resp.status_code == 201

    search = client.get("/api/contracts?search=contract", headers=auth_headers).get_json()
    names = {item["contract_name"] for item in search["items"]}
    assert names == {"Alpha Contract", "Beta Contract"}
    assert search["total"] == 2

    company_search = client.get(
        "/api/contracts?search=acme", headers=auth_headers
    ).get_json()
    assert company_search["total"] == 1
    assert company_search["items"][0]["company_name"] == "Acme Corp"

    sorted_asc = client.get(
        "/api/contracts?sort_by=contract_name&sort_dir=asc", headers=auth_headers
    ).get_json()
    assert [item["contract_name"] for item in sorted_asc["items"]] == [
        "Alpha Contract",
        "Beta Contract",
        "Gamma Agreement",
    ]

    sorted_desc = client.get(
        "/api/contracts?sort_by=contract_name", headers=auth_headers
    ).get_json()
    assert [item["contract_name"] for item in sorted_desc["items"]] == [
        "Gamma Agreement",
        "Beta Contract",
        "Alpha Contract",
    ]

    invalid_sort = client.get(
        "/api/contracts?sort_by=__dict__;DROP", headers=auth_headers
    )
    assert invalid_sort.status_code == 200


def test_create_and_list_contract_for_authenticated_user(client, auth_headers):
    create_response = client.post(
        "/api/contracts", json=contract_payload(), headers=auth_headers
    )
    list_response = client.get("/api/contracts", headers=auth_headers)

    assert create_response.status_code == 201
    assert create_response.get_json()["user_id"] == 1
    assert list_response.status_code == 200
    assert list_response.get_json()["total"] == 1


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

    assert client.get("/api/contracts", headers=other_headers).get_json()["total"] == 0
    other_contract_response = client.get(
        f"/api/contracts/{contract_id}", headers=other_headers
    )

    assert other_contract_response.status_code == 404


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
    _, second_token = register_user(
        client, username="second", email="second@example.com"
    )

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


def test_dashboard_metrics_use_end_date_not_renewal_date(client):
    _, token = register_user(client, username="metrics", email="metrics@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    today = date.today()

    client.post(
        "/api/contracts",
        json=contract_payload(
            contract_name="Ending Soon",
            start_date=(today - timedelta(days=30)).isoformat(),
            end_date=(today + timedelta(days=28)).isoformat(),
            renewal_date=(today + timedelta(days=120)).isoformat(),
        ),
        headers=headers,
    )
    client.post(
        "/api/contracts",
        json=contract_payload(
            contract_name="Already Ended",
            start_date=(today - timedelta(days=60)).isoformat(),
            end_date=(today - timedelta(days=1)).isoformat(),
            renewal_date=(today + timedelta(days=120)).isoformat(),
        ),
        headers=headers,
    )
    critical_response = client.post(
        "/api/contracts",
        json=contract_payload(
            contract_name="Critical Contract",
            start_date=(today - timedelta(days=60)).isoformat(),
            end_date=(today + timedelta(days=6)).isoformat(),
            renewal_date=(today + timedelta(days=120)).isoformat(),
        ),
        headers=headers,
    )
    db.session.add(
        Notification(
            contract_id=critical_response.get_json()["id"],
            notification_type="email",
            status="sent",
            message="Critical reminder",
        )
    )
    db.session.commit()

    response = client.get("/api/contracts/dashboard", headers=headers)
    payload = response.get_json()

    assert payload["upcoming_count"] == 2
    assert payload["overdue_count"] == 1
    assert payload["active_count"] == 0
    assert payload["ending_soon_count"] == 2
    assert payload["critical_count"] == 1
    assert payload["expired_count"] == 1
    assert payload["total_reminders_sent"] == 1
    assert [contract["contract_name"] for contract in payload["upcoming_expiries"]] == [
        "Critical Contract",
        "Ending Soon",
    ]
    assert payload["critical_contracts"][0]["contract_name"] == "Critical Contract"
    assert payload["expired_contracts"][0]["contract_name"] == "Already Ended"


def test_contract_status_filters_and_sort_order(client):
    _, token = register_user(client, username="filters", email="filters@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    today = date.today()

    contracts = [
        ("Active Later", today + timedelta(days=90)),
        ("Active Nearest", today + timedelta(days=31)),
        ("Ending Later", today + timedelta(days=28)),
        ("Ending Nearest", today),
        ("Expired Older", today - timedelta(days=30)),
        ("Expired Recent", today - timedelta(days=1)),
    ]
    for name, end_date in contracts:
        client.post(
            "/api/contracts",
            json=contract_payload(
                contract_name=name,
                start_date=(today - timedelta(days=90)).isoformat(),
                end_date=end_date.isoformat(),
                renewal_date=(today + timedelta(days=120)).isoformat(),
            ),
            headers=headers,
        )

    active = client.get("/api/contracts?status=active", headers=headers).get_json()["items"]
    ending_soon = client.get(
        "/api/contracts?status=ending-soon", headers=headers
    ).get_json()["items"]
    expired = client.get("/api/contracts?status=expired", headers=headers).get_json()["items"]
    invalid = client.get("/api/contracts?status=unknown", headers=headers)

    assert [contract["contract_name"] for contract in active] == [
        "Active Nearest",
        "Active Later",
    ]
    assert [contract["contract_name"] for contract in ending_soon] == [
        "Ending Nearest",
        "Ending Later",
    ]
    assert [contract["contract_name"] for contract in expired] == [
        "Expired Recent",
        "Expired Older",
    ]
    assert invalid.status_code == 400


def test_contract_health_and_next_reminder_fields(client):
    _, token = register_user(client, username="health", email="health@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    today = date.today()

    response = client.post(
        "/api/contracts",
        json=contract_payload(
            contract_name="Warning Contract",
            start_date=(today - timedelta(days=60)).isoformat(),
            end_date=(today + timedelta(days=29)).isoformat(),
            renewal_date=(today + timedelta(days=120)).isoformat(),
        ),
        headers=headers,
    )
    payload = response.get_json()

    assert payload["health_status"] == "Warning"
    assert payload["days_until_end"] == 29
    assert payload["next_reminder_date"] == (today + timedelta(days=1)).isoformat()


def test_contract_reminder_stats_and_history(client):
    _, token = register_user(client, username="history", email="history@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    today = date.today()
    create_response = client.post(
        "/api/contracts",
        json=contract_payload(
            start_date=(today - timedelta(days=30)).isoformat(),
            end_date=(today + timedelta(days=6)).isoformat(),
        ),
        headers=headers,
    )
    contract_id = create_response.get_json()["id"]
    older = Notification(
        contract_id=contract_id,
        notification_type="email",
        status="sent",
        message="30 days before end date",
    )
    newer = Notification(
        contract_id=contract_id,
        notification_type="mobile",
        status="sent",
        message="28 days before end date",
    )
    failed = Notification(
        contract_id=contract_id,
        notification_type="email",
        status="failed",
        message="Failed send",
    )
    db.session.add_all([older, newer, failed])
    db.session.commit()
    older.send_date = older.send_date - timedelta(days=2)
    db.session.commit()

    contract_response = client.get(f"/api/contracts/{contract_id}", headers=headers)
    history_response = client.get(
        f"/api/notifications/history/{contract_id}", headers=headers
    )
    contract_payload_json = contract_response.get_json()
    history_payload = history_response.get_json()

    assert contract_payload_json["health_status"] == "Critical"
    assert contract_payload_json["total_reminders_sent"] == 2
    assert contract_payload_json["last_reminder_type"] == "mobile"
    assert contract_payload_json["last_reminder_message"] == "28 days before end date"
    assert len(history_payload["items"]) == 3
    assert history_payload["items"][0]["message"] in {"28 days before end date", "Failed send"}
    assert history_payload["total"] == 3


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
        json={
            "contract_id": contract_id,
            "notification_type": "email",
            "status": "sent",
        },
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
    today = date.today()
    create_response = client.post(
        "/api/contracts",
        json=contract_payload(
            contract_name="Original",
            start_date=(today - timedelta(days=30)).isoformat(),
            end_date=(today + timedelta(days=28)).isoformat(),
            renewal_date=(today + timedelta(days=120)).isoformat(),
        ),
        headers=auth_headers,
    )
    contract_id = create_response.get_json()["id"]

    update_response = client.put(
        f"/api/contracts/{contract_id}",
        json={"contract_name": "Updated", "notes": "Changed"},
        headers=auth_headers,
    )
    upcoming_response = client.get(
        "/api/contracts?upcoming_only=true", headers=auth_headers
    )
    delete_response = client.delete(
        f"/api/contracts/{contract_id}", headers=auth_headers
    )
    missing_response = client.get(f"/api/contracts/{contract_id}", headers=auth_headers)

    assert update_response.status_code == 200
    assert update_response.get_json()["contract_name"] == "Updated"
    assert upcoming_response.status_code == 200
    assert upcoming_response.get_json()["total"] == 1
    assert delete_response.status_code == 204
    assert missing_response.status_code == 404


def test_update_allows_renewal_date_before_end_date(client, auth_headers):
    create_response = client.post(
        "/api/contracts", json=contract_payload(), headers=auth_headers
    )
    contract_id = create_response.get_json()["id"]

    update_response = client.put(
        f"/api/contracts/{contract_id}",
        json={"renewal_date": "2026-06-30"},
        headers=auth_headers,
    )

    assert update_response.status_code == 200
    assert update_response.get_json()["renewal_date"] == "2026-06-30"


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
    forbidden_dashboard = client.get(
        "/api/contracts/dashboard?user_id=999", headers=auth_headers
    )

    assert invalid_create.status_code == 400
    assert invalid_update.status_code == 404
    assert forbidden_list.status_code == 403
    assert forbidden_dashboard.status_code == 403


def test_notification_creation_validation(client, auth_headers):
    create_response = client.post(
        "/api/contracts", json=contract_payload(), headers=auth_headers
    )
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


def create_product(client, headers, name="Murai", rate="12", **overrides):
    payload = {"name": name, "rate": rate}
    payload.update(overrides)
    response = client.post("/api/products", json=payload, headers=headers)
    assert response.status_code == 201, response.get_json()
    return response.get_json()


def get_line_items(client, headers, contract_id):
    response = client.get(f"/api/contracts/{contract_id}/line-items", headers=headers)
    assert response.status_code == 200, response.get_json()
    return response.get_json()


def test_create_contract_with_single_line_item_persists_snapshot_and_totals(
    client, auth_headers
):
    product = create_product(client, auth_headers, name="Murai", rate="12")

    create_response = client.post(
        "/api/contracts",
        json=contract_payload(
            line_items=[
                {
                    "product_id": product["id"],
                    "quantity": 3,
                    "rate": 12,
                    "discount": 0,
                    "tax": 23,
                }
            ],
        ),
        headers=auth_headers,
    )
    contract = create_response.get_json()
    line_items = get_line_items(client, auth_headers, contract["id"])

    assert create_response.status_code == 201
    assert len(line_items) == 1
    item = line_items[0]
    assert item["product_id"] == product["id"]
    assert item["sku"] == product["sku"]
    assert item["product_name"] == product["name"]
    assert Decimal(str(item["amount"])) == Decimal("36.00")
    assert Decimal(str(item["line_total"])) == Decimal("44.28")
    assert Decimal(str(contract["total_contract_value"])) == Decimal("44.28")


def test_create_contract_with_multiple_line_items_sums_total(client, auth_headers):
    product_a = create_product(client, auth_headers, name="Product A", rate="100")
    product_b = create_product(client, auth_headers, name="Product B", rate="50")

    create_response = client.post(
        "/api/contracts",
        json=contract_payload(
            line_items=[
                {"product_id": product_a["id"], "quantity": 2, "rate": 100},
                {"product_id": product_b["id"], "quantity": 1, "rate": 50},
            ],
        ),
        headers=auth_headers,
    )
    contract = create_response.get_json()
    line_items = get_line_items(client, auth_headers, contract["id"])

    assert create_response.status_code == 201
    assert len(line_items) == 2
    expected_total = sum(Decimal(str(item["line_total"])) for item in line_items)
    assert Decimal(str(contract["total_contract_value"])) == expected_total
    assert expected_total == Decimal("250.00")


def test_line_item_preserves_custom_negotiated_rate(client, auth_headers):
    product = create_product(client, auth_headers, name="Enterprise Plan", rate="100")

    create_response = client.post(
        "/api/contracts",
        json=contract_payload(
            line_items=[
                {"product_id": product["id"], "quantity": 1, "rate": 80},
            ],
        ),
        headers=auth_headers,
    )
    contract = create_response.get_json()
    line_items = get_line_items(client, auth_headers, contract["id"])

    assert create_response.status_code == 201
    # The contract's negotiated rate (80) must be preserved, not silently
    # replaced by the Product's reference rate (100).
    assert Decimal(str(line_items[0]["rate"])) == Decimal("80")
    assert Decimal(str(product["rate"])) == Decimal("100.00")


def test_line_item_discount_calculation(client, auth_headers):
    create_response = client.post(
        "/api/contracts",
        json=contract_payload(
            line_items=[
                {
                    "product_name": "Custom Item",
                    "quantity": 10,
                    "rate": 10,
                    "discount": 10,
                    "tax": 0,
                }
            ],
        ),
        headers=auth_headers,
    )
    contract = create_response.get_json()
    line_items = get_line_items(client, auth_headers, contract["id"])

    assert create_response.status_code == 201
    assert Decimal(str(line_items[0]["amount"])) == Decimal("100.00")
    assert Decimal(str(line_items[0]["line_total"])) == Decimal("90.00")


def test_line_item_tax_calculation(client, auth_headers):
    create_response = client.post(
        "/api/contracts",
        json=contract_payload(
            line_items=[
                {
                    "product_name": "Custom Item",
                    "quantity": 1,
                    "rate": 100,
                    "discount": 0,
                    "tax": 18,
                }
            ],
        ),
        headers=auth_headers,
    )
    contract = create_response.get_json()
    line_items = get_line_items(client, auth_headers, contract["id"])

    assert create_response.status_code == 201
    assert Decimal(str(line_items[0]["line_total"])) == Decimal("118.00")


def test_contract_total_equals_sum_of_persisted_line_totals(client, auth_headers):
    create_response = client.post(
        "/api/contracts",
        json=contract_payload(
            line_items=[
                {"product_name": "Item A", "quantity": 3, "rate": 12, "discount": 0, "tax": 23},
                {"product_name": "Item B", "quantity": 2, "rate": 5, "discount": 5, "tax": 10},
            ],
        ),
        headers=auth_headers,
    )
    contract = create_response.get_json()
    line_items = get_line_items(client, auth_headers, contract["id"])

    expected_total = sum(Decimal(str(item["line_total"])) for item in line_items)
    assert Decimal(str(contract["total_contract_value"])) == expected_total


def test_invalid_product_id_rejects_contract_creation(client, auth_headers):
    before_count = client.get("/api/contracts", headers=auth_headers).get_json()["total"]

    create_response = client.post(
        "/api/contracts",
        json=contract_payload(
            line_items=[{"product_id": 999999, "quantity": 1, "rate": 10}],
        ),
        headers=auth_headers,
    )
    after_count = client.get("/api/contracts", headers=auth_headers).get_json()["total"]

    assert create_response.status_code == 400
    assert "not found" in create_response.get_json()["error"].lower()
    assert after_count == before_count


def test_failed_line_item_rolls_back_entire_contract(client, auth_headers):
    before_count = client.get("/api/contracts", headers=auth_headers).get_json()["total"]

    create_response = client.post(
        "/api/contracts",
        json=contract_payload(
            line_items=[
                {"product_name": "Valid Item", "quantity": 1, "rate": 10},
                {"product_id": 999999, "quantity": 1, "rate": 10},
            ],
        ),
        headers=auth_headers,
    )
    after_count = client.get("/api/contracts", headers=auth_headers).get_json()["total"]

    assert create_response.status_code == 400
    # Neither the contract nor its valid sibling line item should persist.
    assert after_count == before_count


def test_notifications_disabled_without_email_succeeds(client, auth_headers):
    response = client.post(
        "/api/contracts",
        json=contract_payload(notification_enabled=False, notification_email=None),
        headers=auth_headers,
    )

    assert response.status_code == 201
    assert response.get_json()["notification_enabled"] is False


def test_notifications_enabled_without_email_rejects(client, auth_headers):
    response = client.post(
        "/api/contracts",
        json=contract_payload(notification_enabled=True, notification_email=None),
        headers=auth_headers,
    )

    assert response.status_code == 400
    assert "notification_email" in str(response.get_json()["details"])


def test_notifications_enabled_with_email_succeeds(client, auth_headers):
    response = client.post(
        "/api/contracts",
        json=contract_payload(
            notification_enabled=True, notification_email="reminders@example.com"
        ),
        headers=auth_headers,
    )

    assert response.status_code == 201
    assert response.get_json()["notification_email"] == "reminders@example.com"
