from datetime import date, timedelta

from src.models.contract import Contract, Notification, db
from src.models.user import User
from src.main import app
from src.services.notification_service import NotificationService
from src.services.scheduler_service import SchedulerService


class FakeResponse:
    status_code = 200
    text = "ok"


def create_model_contract(days_until_end=30, renewal_offset=None):
    user = User(username="service", email="service@example.com")
    user.set_password("securepassword123")
    db.session.add(user)
    db.session.commit()

    end_date = date.today() + timedelta(days=days_until_end)
    renewal_date = (
        date.today() + timedelta(days=renewal_offset) if renewal_offset is not None else end_date
    )

    contract = Contract(
        company_name="Service Co",
        contract_name="Service Contract",
        start_date=date.today(),
        end_date=end_date,
        renewal_date=renewal_date,
        notification_enabled=True,
        notification_email="service@example.com",
        notification_mobile=True,
        user_id=user.id,
    )
    db.session.add(contract)
    db.session.commit()
    return user, contract


def test_send_email_notification_success(client, monkeypatch):
    _, contract = create_model_contract()
    service = NotificationService()
    service.resend_api_key = "test-key"
    monkeypatch.setattr(
        "src.services.notification_service.requests.post", lambda *a, **k: FakeResponse()
    )

    success, message = service.send_email_notification(
        "recipient@example.com",
        "Subject",
        "<p>Hello</p>",
        contract.id,
    )

    notification = Notification.query.filter_by(contract_id=contract.id).first()
    assert success is True
    assert message == "Email sent successfully"
    assert notification.status == "sent"


def test_send_push_notification_success(client, monkeypatch):
    _, contract = create_model_contract()
    service = NotificationService()
    service.fcm_server_key = "key"
    service.fcm_url = "https://fcm.example.com"

    monkeypatch.setattr(
        "src.services.notification_service.requests.post", lambda *a, **k: FakeResponse()
    )

    success, message = service.send_push_notification(
        "device-token",
        "Title",
        "Body",
        contract.id,
    )

    assert success is True
    assert message == "Push notification sent successfully"
    assert (
        Notification.query.filter_by(contract_id=contract.id, notification_type="mobile").count()
        == 1
    )


def test_check_and_send_notifications_is_user_scoped(client, monkeypatch):
    user, contract = create_model_contract()
    service = NotificationService()

    monkeypatch.setattr(
        service,
        "send_email_notification",
        lambda *args, **kwargs: (True, "sent"),
    )

    results = service.check_and_send_notifications(user_id=user.id)

    assert results["emails_sent"] == 1
    assert contract.id


def test_check_and_send_notifications_uses_even_end_date_days(client, monkeypatch):
    user, _ = create_model_contract(days_until_end=28, renewal_offset=90)
    service = NotificationService()

    monkeypatch.setattr(
        service,
        "send_email_notification",
        lambda *args, **kwargs: (True, "sent"),
    )

    results = service.check_and_send_notifications(user_id=user.id)

    assert results["emails_sent"] == 1


def test_check_and_send_notifications_skips_odd_end_date_days(client, monkeypatch):
    user, _ = create_model_contract(days_until_end=29, renewal_offset=29)
    service = NotificationService()

    monkeypatch.setattr(
        service,
        "send_email_notification",
        lambda *args, **kwargs: (True, "sent"),
    )

    results = service.check_and_send_notifications(user_id=user.id)

    assert results["emails_sent"] == 0


def test_recent_end_date_notification_prevents_duplicate_send(client, monkeypatch):
    user, contract = create_model_contract(days_until_end=28)
    db.session.add(
        Notification(
            contract_id=contract.id,
            notification_type="email",
            status="sent",
            message="Contract end date reminder: 28 days until end date",
        )
    )
    db.session.commit()
    service = NotificationService()

    monkeypatch.setattr(
        service,
        "send_email_notification",
        lambda *args, **kwargs: (True, "sent"),
    )

    results = service.check_and_send_notifications(user_id=user.id)

    assert results["emails_sent"] == 0


def test_scheduler_job_management():
    class FakeScheduler:
        def __init__(self):
            self.jobs = []

        def add_job(self, func, trigger, id, name, replace_existing):
            self.jobs.append(
                type(
                    "Job", (), {"id": id, "name": name, "next_run_time": None, "trigger": trigger}
                )()
            )

        def remove_job(self, job_id):
            self.jobs = [job for job in self.jobs if job.id != job_id]

        def get_jobs(self):
            return self.jobs

    service = SchedulerService()
    service.scheduler = FakeScheduler()

    assert service.add_custom_job(lambda: None, "interval", "job-1", "Job 1") is True
    assert service.get_jobs()[0]["id"] == "job-1"
    assert service.remove_job("job-1") is True
    assert service.get_jobs() == []


def test_scheduler_runs_notification_check(monkeypatch):
    service = SchedulerService()
    service.app = app

    monkeypatch.setattr(
        "src.services.scheduler_service.notification_service.check_and_send_notifications",
        lambda: {"emails_sent": 1, "push_notifications_sent": 1, "errors": []},
    )

    result = service.check_and_send_notifications()

    assert result["emails_sent"] == 1
    assert result["push_notifications_sent"] == 1


def test_scheduler_weekly_summary_sends_email(client, monkeypatch):
    create_model_contract(days_until_end=3)
    service = SchedulerService()
    service.app = app
    sent = []

    monkeypatch.setattr(
        "src.services.scheduler_service.notification_service.send_email_notification",
        lambda email, subject, body: sent.append((email, subject, body)) or (True, "sent"),
    )

    service.send_weekly_summary()

    assert sent
    assert "Weekly Contract Expiry Summary" in sent[0][1]


def test_scheduler_weekly_summary_template(client):
    _, contract = create_model_contract()
    service = SchedulerService()

    html = service.create_weekly_summary_template([contract])

    assert "Service Contract" in html
    assert "Contracts Ending This Week" in html
