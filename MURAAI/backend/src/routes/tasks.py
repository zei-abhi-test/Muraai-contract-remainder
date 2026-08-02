import json
import os
from datetime import date, datetime
from functools import wraps

from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from src.models.calendar import Task, TaskComment, TaskAttachment, TaskHistory, TASK_STATUSES, TASK_PRIORITIES
from src.models.user import User, db
from src.services.auth import token_required, require_resource
from src.services.logging_config import get_structured_logger
from src.services.task_service import generate_task, update_task_status

tasks_bp = Blueprint("tasks", __name__)
logger = get_structured_logger(__name__)


def _task_to_dict(task):
    d = task.to_dict()
    d["comment_count"] = TaskComment.query.filter_by(task_id=task.id).count()
    d["attachment_count"] = TaskAttachment.query.filter_by(task_id=task.id).count()
    return d


@tasks_bp.route("/tasks/stats", methods=["GET"])
@token_required
@require_resource("tasks")
def task_stats(current_user):
    today = date.today()
    my_tasks = Task.query.filter(
        or_(Task.assigned_to == current_user.id, Task.user_id == current_user.id),
        Task.status.in_(["TODO", "IN_PROGRESS", "BLOCKED"]),
    ).count()

    overdue = Task.query.filter(
        or_(Task.assigned_to == current_user.id, Task.user_id == current_user.id),
        Task.status.in_(["TODO", "IN_PROGRESS", "BLOCKED"]),
        Task.due_date < today,
    ).count()

    critical = Task.query.filter(
        or_(Task.assigned_to == current_user.id, Task.user_id == current_user.id),
        Task.status.in_(["TODO", "IN_PROGRESS", "BLOCKED"]),
        Task.priority == "CRITICAL",
    ).count()

    today_tasks = Task.query.filter(
        or_(Task.assigned_to == current_user.id, Task.user_id == current_user.id),
        Task.status.in_(["TODO", "IN_PROGRESS", "BLOCKED"]),
        Task.due_date == today,
    ).count()

    completed = Task.query.filter(
        or_(Task.assigned_to == current_user.id, Task.user_id == current_user.id),
        Task.status == "COMPLETED",
    ).count()

    return jsonify({
        "my_tasks": my_tasks,
        "overdue": overdue,
        "critical": critical,
        "today": today_tasks,
        "completed": completed,
    })


@tasks_bp.route("/tasks", methods=["GET"])
@token_required
@require_resource("tasks")
def list_tasks(current_user):
    status = request.args.get("status")
    priority = request.args.get("priority")
    assigned_to = request.args.get("assigned_to", type=int)
    module = request.args.get("module")
    search = request.args.get("search")
    view = request.args.get("view", "all")

    q = Task.query.filter(
        or_(Task.assigned_to == current_user.id, Task.user_id == current_user.id)
    )

    if status:
        statuses = [s.strip() for s in status.split(",")]
        q = q.filter(Task.status.in_(statuses))
    if priority:
        priorities = [p.strip() for p in priority.split(",")]
        q = q.filter(Task.priority.in_(priorities))
    if assigned_to:
        q = q.filter(Task.assigned_to == assigned_to)
    if module:
        q = q.filter(Task.related_module == module)
    if search:
        q = q.filter(Task.title.ilike(f"%{search}%"))
    if view == "my":
        q = q.filter(Task.assigned_to == current_user.id)
    elif view == "assigned":
        q = q.filter(Task.assigned_by == current_user.id)

    q = q.order_by(Task.due_date.asc().nullslast(), Task.priority.desc(), Task.created_at.desc())
    return jsonify([_task_to_dict(t) for t in q.all()])


@tasks_bp.route("/tasks/<int:task_id>", methods=["GET"])
@token_required
@require_resource("tasks")
def get_task(current_user, task_id):
    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    d = _task_to_dict(task)
    d["comments"] = [c.to_dict() for c in TaskComment.query.filter_by(task_id=task.id).order_by(TaskComment.created_at.asc()).all()]
    d["attachments"] = [a.to_dict() for a in TaskAttachment.query.filter_by(task_id=task.id).order_by(TaskAttachment.created_at.desc()).all()]
    d["history"] = [h.to_dict() for h in TaskHistory.query.filter_by(task_id=task.id).order_by(TaskHistory.created_at.desc()).all()]
    return jsonify(d)


@tasks_bp.route("/tasks", methods=["POST"])
@token_required
@require_resource("tasks")
def create_task(current_user):
    data = request.get_json(silent=True) or {}
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400

    assigned_to = data.get("assigned_to")
    if assigned_to:
        assignee = db.session.get(User, assigned_to)
        if not assignee:
            return jsonify({"error": "Assigned user not found"}), 404

    priority = data.get("priority", "MEDIUM")
    if priority:
        priority = priority.upper()

    task = generate_task(
        title=title,
        description=data.get("description"),
        priority=priority,
        due_days=data.get("due_days"),
        assigned_to=assigned_to,
        assigned_by=current_user.id,
        related_module=data.get("related_module"),
        related_record_id=data.get("related_record_id"),
        user_id=current_user.id,
    )
    if data.get("due_date"):
        try:
            task.due_date = date.fromisoformat(data["due_date"])
            db.session.commit()
        except (ValueError, TypeError):
            pass

    return jsonify(_task_to_dict(task)), 201


@tasks_bp.route("/tasks/<int:task_id>", methods=["PUT"])
@token_required
@require_resource("tasks")
def update_task(current_user, task_id):
    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404

    data = request.get_json(silent=True) or {}
    tracked = {"title", "description", "priority", "status", "assigned_to", "due_date"}

    for field in tracked:
        if field not in data:
            continue
        old_val = getattr(task, field)
        new_val = data[field]

        if field == "due_date":
            try:
                new_val = date.fromisoformat(new_val) if new_val else None
            except (ValueError, TypeError):
                continue

        if old_val != new_val:
            _log_change(task.id, current_user.id, field, old_val, new_val)
            setattr(task, field, new_val)

    if data.get("status") == "COMPLETED" and not task.completed_at:
        task.completed_at = datetime.utcnow()
    elif data.get("status") and data["status"] != "COMPLETED":
        task.completed_at = None

    if "assigned_to" in data and data["assigned_to"] != task.assigned_to:
        from src.services.task_service import _notify_assigned
        _notify_assigned(task)

    db.session.commit()
    return jsonify(_task_to_dict(task))


@tasks_bp.route("/tasks/<int:task_id>/status", methods=["PUT"])
@token_required
@require_resource("tasks")
def change_status(current_user, task_id):
    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    data = request.get_json(silent=True) or {}
    new_status = data.get("status", "").upper()
    if new_status not in TASK_STATUSES:
        return jsonify({"error": f"Invalid status. Must be one of {TASK_STATUSES}"}), 400
    update_task_status(task, new_status, current_user.id)
    return jsonify(_task_to_dict(task))


@tasks_bp.route("/tasks/<int:task_id>", methods=["DELETE"])
@token_required
@require_resource("tasks")
def delete_task(current_user, task_id):
    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    db.session.delete(task)
    db.session.commit()
    return jsonify({"message": "Task deleted"}), 200


@tasks_bp.route("/tasks/<int:task_id>/comments", methods=["GET"])
@token_required
@require_resource("tasks")
def list_comments(current_user, task_id):
    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    comments = TaskComment.query.filter_by(task_id=task_id).order_by(TaskComment.created_at.asc()).all()
    return jsonify([c.to_dict() for c in comments])


@tasks_bp.route("/tasks/<int:task_id>/comments", methods=["POST"])
@token_required
@require_resource("tasks")
def add_comment(current_user, task_id):
    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    data = request.get_json(silent=True) or {}
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"error": "Content is required"}), 400
    comment = TaskComment(task_id=task_id, user_id=current_user.id, content=content)
    db.session.add(comment)
    db.session.commit()
    _log_change(task_id, current_user.id, "comment", None, f"Comment added by {current_user.username}")
    return jsonify(comment.to_dict()), 201


@tasks_bp.route("/tasks/<int:task_id>/comments/<int:comment_id>", methods=["DELETE"])
@token_required
@require_resource("tasks")
def delete_comment(current_user, task_id, comment_id):
    comment = TaskComment.query.filter_by(id=comment_id, task_id=task_id).first()
    if not comment:
        return jsonify({"error": "Comment not found"}), 404
    db.session.delete(comment)
    db.session.commit()
    return jsonify({"message": "Comment deleted"}), 200


@tasks_bp.route("/tasks/<int:task_id>/attachments", methods=["GET"])
@token_required
@require_resource("tasks")
def list_attachments(current_user, task_id):
    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    attachments = TaskAttachment.query.filter_by(task_id=task_id).order_by(TaskAttachment.created_at.desc()).all()
    return jsonify([a.to_dict() for a in attachments])


@tasks_bp.route("/tasks/<int:task_id>/attachments", methods=["POST"])
@token_required
@require_resource("tasks")
def upload_attachment(current_user, task_id):
    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "tasks")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{task_id}_{file.filename}")
    file.save(file_path)

    attachment = TaskAttachment(
        task_id=task_id,
        user_id=current_user.id,
        filename=file.filename,
        file_path=file_path,
        file_size=os.path.getsize(file_path),
    )
    db.session.add(attachment)
    db.session.commit()
    return jsonify(attachment.to_dict()), 201


@tasks_bp.route("/tasks/<int:task_id>/attachments/<int:attachment_id>", methods=["DELETE"])
@token_required
@require_resource("tasks")
def delete_attachment(current_user, task_id, attachment_id):
    attachment = TaskAttachment.query.filter_by(id=attachment_id, task_id=task_id).first()
    if not attachment:
        return jsonify({"error": "Attachment not found"}), 404
    try:
        if os.path.exists(attachment.file_path):
            os.remove(attachment.file_path)
    except Exception:
        pass
    db.session.delete(attachment)
    db.session.commit()
    return jsonify({"message": "Attachment deleted"}), 200


@tasks_bp.route("/tasks/<int:task_id>/history", methods=["GET"])
@token_required
@require_resource("tasks")
def list_history(current_user, task_id):
    task = db.session.get(Task, task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
    history = TaskHistory.query.filter_by(task_id=task_id).order_by(TaskHistory.created_at.desc()).all()
    return jsonify([h.to_dict() for h in history])


def _log_change(task_id, user_id, field, old_val, new_val):
    history = TaskHistory(
        task_id=task_id,
        user_id=user_id,
        field=field,
        old_value=str(old_val) if old_val is not None else None,
        new_value=str(new_val) if new_val is not None else None,
    )
    db.session.add(history)
    db.session.commit()
