from datetime import datetime, date, timedelta

from src.models.calendar import Task, TaskHistory, db
from src.models.user import User
from src.services.notification_service import notification_service


def generate_task(
    title: str,
    description: str | None = None,
    priority: str = "MEDIUM",
    due_days: int | None = None,
    assigned_to: int | None = None,
    assigned_by: int | None = None,
    related_module: str | None = None,
    related_record_id: int | None = None,
    user_id: int | None = None,
) -> Task:
    """Create a task and optionally notify the assignee."""
    task = Task(
        user_id=user_id or assigned_to or 1,
        title=title,
        description=description,
        priority=priority,
        status="TODO",
        due_date=date.today() + timedelta(days=due_days) if due_days else None,
        assigned_to=assigned_to,
        assigned_by=assigned_by,
        related_module=related_module,
        related_record_id=related_record_id,
    )
    db.session.add(task)
    db.session.commit()

    _log_history(task.id, assigned_by or user_id or 1, "status", None, "TODO")
    _notify_assigned(task)

    return task


def _log_history(task_id, user_id, field, old_value, new_value):
    history = TaskHistory(
        task_id=task_id,
        user_id=user_id,
        field=field,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
    )
    db.session.add(history)
    db.session.commit()


def _notify_assigned(task):
    if not task.assigned_to:
        return
    assignee = db.session.get(User, task.assigned_to)
    if not assignee or not assignee.email:
        return
    notification_service.send_email_notification(
        to_email=assignee.email,
        subject=f"Task Assigned: {task.title}",
        body=f"<p>You have been assigned a new task:</p><p><strong>{task.title}</strong></p>"
             f"<p>{task.description or ''}</p>"
             f"<p>Priority: {task.priority} | Due: {task.due_date or 'No due date'}</p>",
    )


def update_task_status(task, new_status, user_id):
    """Update task status with history logging and notification."""
    old_status = task.status
    if old_status == new_status:
        return task
    task.status = new_status
    if new_status == "COMPLETED" and not task.completed_at:
        task.completed_at = datetime.utcnow()
    elif new_status != "COMPLETED":
        task.completed_at = None
    db.session.commit()
    _log_history(task.id, user_id, "status", old_status, new_status)
    return task
