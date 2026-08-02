import json
from datetime import datetime, date, timedelta

from src.models.automation import AutomationRule
from src.models.contract import (
    Contract, ContractLineItem, Notification, Invoice, InvoiceLineItem,
    PurchaseOrder, PurchaseOrderContract, ActivityLog, db,
)
from src.models.calendar import CalendarEvent, Task
from src.models.user import User
from src.routes.activity import log_activity
from src.services.logging_config import get_structured_logger
from src.services.notification_service import notification_service

logger = get_structured_logger(__name__)


def execute_triggers(trigger_type, entity_data, user_id):
    """Find and execute all enabled automation rules for the given trigger."""
    rules = AutomationRule.query.filter_by(
        trigger_type=trigger_type, is_enabled=True
    ).all()

    for rule in rules:
        try:
            _execute_rule(rule, entity_data, user_id)
            rule.last_run_at = datetime.utcnow()
            rule.last_error = None
            db.session.commit()
        except Exception as e:
            logger.error("Automation rule failed", context={
                "rule_id": rule.id, "rule_name": rule.name, "error": str(e),
            })
            rule.last_error = str(e)
            db.session.commit()


def _execute_rule(rule, entity_data, user_id):
    """Execute all actions for a single rule against entity data."""
    actions = json.loads(rule.actions) if isinstance(rule.actions, str) else rule.actions
    if not actions:
        return

    trigger_config = {}
    if rule.trigger_config:
        trigger_config = json.loads(rule.trigger_config) if isinstance(rule.trigger_config, str) else rule.trigger_config

    for action in actions:
        _execute_action(action, entity_data, user_id, trigger_config)


def _resolve_user_by_role(role):
    """Find the first active user with the given role."""
    user = User.query.filter_by(role=role, status="active").first()
    return user


def _execute_action(action, entity_data, user_id, trigger_config):
    """Dispatch a single action."""
    action_type = action.get("type")
    config = action.get("config", {})

    if action_type == "send_email":
        _action_send_email(config, entity_data)
    elif action_type == "create_notification":
        _action_create_notification(config, entity_data, user_id)
    elif action_type == "create_calendar_event":
        _action_create_calendar_event(config, entity_data, user_id)
    elif action_type == "assign_task":
        _action_assign_task(config, entity_data, user_id)
    elif action_type == "generate_renewal":
        _action_generate_renewal(config, entity_data, user_id)
    elif action_type == "generate_invoice":
        _action_generate_invoice(config, entity_data, user_id)
    elif action_type == "generate_purchase_order":
        _action_generate_purchase_order(config, entity_data, user_id)
    elif action_type == "call_webhook":
        _action_call_webhook(config, entity_data)
    elif action_type == "log_activity":
        _action_log_activity(config, entity_data, user_id)
    else:
        logger.warning("Unknown action type", context={"action_type": action_type})


def _resolve_recipient(config, entity_data):
    """Resolve recipient email from config or entity data."""
    to = config.get("to", "")
    if to == "{contract.owner}" and "owner_email" in entity_data:
        return entity_data["owner_email"]
    if to == "{customer.email}" and "customer_email" in entity_data:
        return entity_data["customer_email"]
    if to == "{user.email}" and "user_email" in entity_data:
        return entity_data["user_email"]
    role = config.get("to_role", "")
    if role:
        user = _resolve_user_by_role(role)
        if user:
            return user.email
    return to


def _resolve_assignee(config):
    """Resolve assignee user from config."""
    role = config.get("assignee_role", "")
    if role:
        user = _resolve_user_by_role(role)
        if user:
            return user.id
    return None


def _interpolate(template, entity_data):
    """Simple template interpolation with entity data fields."""
    if not template:
        return template
    result = template
    for key, value in entity_data.items():
        placeholder = "{{" + key + "}}"
        if placeholder in result:
            result = result.replace(placeholder, str(value))
    return result


def _action_send_email(config, entity_data):
    """Send an email notification."""
    to = _resolve_recipient(config, entity_data)
    if not to:
        return
    subject = _interpolate(config.get("subject", "Automation Notification"), entity_data)
    body = _interpolate(config.get("body", ""), entity_data)
    contract_id = entity_data.get("contract_id")
    notification_service.send_email_notification(
        to_email=to, subject=subject, body=body, contract_id=contract_id,
    )


def _action_create_notification(config, entity_data, user_id):
    """Create an internal notification record."""
    target_role = config.get("target_role", "")
    target_user_id = user_id
    if target_role:
        user = _resolve_user_by_role(target_role)
        if user:
            target_user_id = user.id

    contract_id = entity_data.get("contract_id") or entity_data.get("entity_id")
    if not contract_id:
        return
    message = _interpolate(config.get("message", "Automation notification"), entity_data)
    notification = Notification(
        contract_id=contract_id,
        notification_type="email",
        status="pending",
        message=message,
    )
    db.session.add(notification)
    db.session.commit()


def _action_create_calendar_event(config, entity_data, user_id):
    """Create a calendar event."""
    target_role = config.get("target_role", "")
    target_user_id = user_id
    if target_role:
        user = _resolve_user_by_role(target_role)
        if user:
            target_user_id = user.id

    days_from_now = config.get("days_from_now", 1)
    title = _interpolate(config.get("title", "Automation Event"), entity_data)
    description = _interpolate(config.get("description", ""), entity_data)
    start = datetime.utcnow() + timedelta(days=days_from_now)

    event = CalendarEvent(
        user_id=target_user_id,
        title=title,
        description=description,
        event_type="automation",
        start=start,
        end=start + timedelta(hours=1),
        entity_type=entity_data.get("entity_type", "contract"),
        entity_id=entity_data.get("entity_id") or entity_data.get("contract_id"),
    )
    db.session.add(event)
    db.session.commit()


def _action_assign_task(config, entity_data, user_id):
    """Create a task assigned to a user/role."""
    assignee_id = _resolve_assignee(config)
    if not assignee_id:
        assignee_id = user_id

    due_days = config.get("due_days", 7)
    title = _interpolate(config.get("title", "Automation Task"), entity_data)
    description = _interpolate(config.get("description", ""), entity_data)
    due_date = date.today() + timedelta(days=due_days)

    task = Task(
        user_id=assignee_id,
        title=title,
        description=description,
        due_date=due_date,
        priority=config.get("priority", "medium"),
    )
    db.session.add(task)
    db.session.commit()


def _action_generate_renewal(config, entity_data, user_id):
    """Generate a renewal draft for a contract."""
    contract_id = entity_data.get("contract_id")
    if not contract_id:
        return
    contract = db.session.get(Contract, contract_id)
    if not contract:
        return

    from src.services.contract_lifecycle import apply_transition, LifecycleError
    try:
        apply_transition(contract, "mark_renewal_due")
        contract.updated_at = datetime.utcnow()
        db.session.commit()
    except LifecycleError:
        pass


def _action_generate_invoice(config, entity_data, user_id):
    """Generate an invoice draft from a contract."""
    contract_id = entity_data.get("contract_id")
    if not contract_id:
        return
    contract = db.session.get(Contract, contract_id)
    if not contract:
        return

    from src.models.contract import generate_invoice_number
    invoice = Invoice(
        user_id=user_id,
        contract_id=contract.id,
        customer_id=contract.customer_id,
        invoice_number=generate_invoice_number(),
        amount=contract.total_contract_value or 0,
        status="DRAFT",
        issue_date=date.today(),
        due_date=date.today() + timedelta(days=30),
    )
    db.session.add(invoice)
    db.session.commit()


def _action_generate_purchase_order(config, entity_data, user_id):
    """Generate a purchase order from a contract."""
    contract_id = entity_data.get("contract_id")
    if not contract_id:
        return
    contract = db.session.get(Contract, contract_id)
    if not contract:
        return

    from src.models.contract import generate_po_number
    po = PurchaseOrder(
        user_id=user_id,
        contract_id=contract.id,
        customer_id=contract.customer_id,
        po_number=generate_po_number(),
        amount=contract.total_contract_value or 0,
        status="Draft",
        vendor=contract.company_name,
        issue_date=date.today(),
    )
    db.session.add(po)
    db.session.commit()


def _action_call_webhook(config, entity_data):
    """Call an external webhook URL."""
    url = config.get("url", "")
    if not url:
        return
    try:
        import requests
        payload = {k: str(v) for k, v in entity_data.items()}
        requests.post(url, json=payload, timeout=10)
    except Exception as e:
        logger.warning("Webhook call failed", context={"url": url, "error": str(e)})


def _action_log_activity(config, entity_data, user_id):
    """Log an activity entry."""
    title = _interpolate(config.get("title", "Automation Action"), entity_data)
    description = _interpolate(config.get("description", ""), entity_data)
    activity_type = config.get("activity_type", "system_action")
    log_activity(
        user_id=user_id,
        activity_type=activity_type,
        title=title,
        description=description,
        contract_id=entity_data.get("contract_id"),
        entity_type=entity_data.get("entity_type", "contract"),
        entity_id=entity_data.get("entity_id") or entity_data.get("contract_id", 0),
    )
