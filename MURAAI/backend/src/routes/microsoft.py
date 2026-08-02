import os
import tempfile

from flask import Blueprint, jsonify, request, send_file

from src.services.auth import token_required
from src.services.logging_config import get_structured_logger
from src.services.microsoft import MicrosoftConfig, MicrosoftProviderRegistry

microsoft_bp = Blueprint("microsoft", __name__)
logger = get_structured_logger(__name__)

_config = MicrosoftConfig.from_env()
_registry = MicrosoftProviderRegistry(_config)


def _status_dict(provider, name):
    return {
        "provider": name,
        "available": provider.is_available(),
        "configured": _config.has_credentials and getattr(_config, f"{name}_enabled", False),
    }


# ── Status ─────────────────────────────────────────────────────────────

@microsoft_bp.route("/microsoft/status", methods=["GET"])
@token_required
def status(_current_user):
    return jsonify({
        "configured": _config.has_credentials,
        "services": [
            _status_dict(_registry.onedrive, "onedrive"),
            _status_dict(_registry.outlook, "outlook"),
            _status_dict(_registry.teams, "teams"),
            _status_dict(_registry.entra, "entra"),
        ],
    }), 200


# ── OneDrive ───────────────────────────────────────────────────────────

@microsoft_bp.route("/microsoft/onedrive/files", methods=["GET"])
@token_required
def list_onedrive_files(_current_user):
    folder = request.args.get("folder", "/")
    files = _registry.onedrive.list_files(folder)
    return jsonify({"files": files, "available": _registry.onedrive.is_available()}), 200


@microsoft_bp.route("/microsoft/onedrive/upload", methods=["POST"])
@token_required
def upload_onedrive(_current_user):
    if not _registry.onedrive.is_available():
        return jsonify({"error": "OneDrive is not configured"}), 400

    if "file" not in request.files:
        return jsonify({"error": "file is required"}), 400

    f = request.files["file"]
    destination = request.form.get("destination", f"/{f.filename}")

    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(f.filename or "")[1]) as tmp:
        f.save(tmp.name)
        tmp_path = tmp.name

    try:
        result = _registry.onedrive.upload_file(tmp_path, destination)
        if result is None:
            return jsonify({"error": "Upload failed"}), 500
        return jsonify(result), 200
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@microsoft_bp.route("/microsoft/onedrive/download/<file_id>", methods=["GET"])
@token_required
def download_onedrive(_current_user, file_id):
    if not _registry.onedrive.is_available():
        return jsonify({"error": "OneDrive is not configured"}), 400

    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        tmp_path = tmp.name

    try:
        result = _registry.onedrive.download_file(file_id, tmp_path)
        if result is None:
            return jsonify({"error": "Download failed"}), 500
        return send_file(result, as_attachment=True)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@microsoft_bp.route("/microsoft/onedrive/files/<file_id>", methods=["DELETE"])
@token_required
def delete_onedrive(_current_user, file_id):
    if not _registry.onedrive.is_available():
        return jsonify({"error": "OneDrive is not configured"}), 400

    success = _registry.onedrive.delete_file(file_id)
    if not success:
        return jsonify({"error": "Delete failed"}), 500
    return jsonify({"success": True}), 200


@microsoft_bp.route("/microsoft/onedrive/share-link/<file_id>", methods=["GET"])
@token_required
def share_link_onedrive(_current_user, file_id):
    if not _registry.onedrive.is_available():
        return jsonify({"error": "OneDrive is not configured"}), 400

    link_type = request.args.get("type", "view")
    url = _registry.onedrive.get_share_link(file_id, link_type=link_type)
    if not url:
        return jsonify({"error": "Failed to create share link"}), 500
    return jsonify({"webUrl": url}), 200


# ── Outlook ────────────────────────────────────────────────────────────

@microsoft_bp.route("/microsoft/outlook/send", methods=["POST"])
@token_required
def send_outlook_email(_current_user):
    if not _registry.outlook.is_available():
        return jsonify({"error": "Outlook is not configured"}), 400

    data = request.get_json() or {}
    to = data.get("to")
    if not to:
        return jsonify({"error": "to (list of email addresses) is required"}), 400

    success = _registry.outlook.send_email(
        to=to,
        subject=data.get("subject", ""),
        body=data.get("body", ""),
        cc=data.get("cc"),
        bcc=data.get("bcc"),
        attachments=data.get("attachments"),
    )
    if not success:
        return jsonify({"error": "Failed to send email"}), 500
    return jsonify({"success": True}), 200


@microsoft_bp.route("/microsoft/outlook/events", methods=["POST"])
@token_required
def create_outlook_event(_current_user):
    if not _registry.outlook.is_available():
        return jsonify({"error": "Outlook is not configured"}), 400

    data = request.get_json() or {}
    subject = data.get("subject")
    start = data.get("start")
    end = data.get("end")

    if not subject or not start or not end:
        return jsonify({"error": "subject, start, and end are required"}), 400

    event = _registry.outlook.create_calendar_event(
        subject=subject,
        start=start,
        end=end,
        attendees=data.get("attendees"),
        body=data.get("body"),
        location=data.get("location"),
    )
    if event is None:
        return jsonify({"error": "Failed to create event"}), 500
    return jsonify(event), 201


# ── Teams ──────────────────────────────────────────────────────────────

@microsoft_bp.route("/microsoft/teams", methods=["GET"])
@token_required
def list_teams(_current_user):
    teams = _registry.teams.list_teams()
    return jsonify({"teams": teams, "available": _registry.teams.is_available()}), 200


@microsoft_bp.route("/microsoft/teams/<team_id>/channels", methods=["GET"])
@token_required
def list_teams_channels(_current_user, team_id):
    channels = _registry.teams.list_channels(team_id)
    return jsonify({"channels": channels, "available": _registry.teams.is_available()}), 200


@microsoft_bp.route("/microsoft/teams/<team_id>/channels/<channel_id>/messages", methods=["POST"])
@token_required
def send_teams_message(_current_user, team_id, channel_id):
    if not _registry.teams.is_available():
        return jsonify({"error": "Teams is not configured"}), 400

    data = request.get_json() or {}
    message = data.get("message")
    if not message:
        return jsonify({"error": "message is required"}), 400

    result = _registry.teams.send_channel_message(team_id, channel_id, message)
    if result is None:
        return jsonify({"error": "Failed to send message"}), 500
    return jsonify(result), 201


# ── Entra ID ───────────────────────────────────────────────────────────

@microsoft_bp.route("/microsoft/entra/users", methods=["GET"])
@token_required
def list_entra_users(_current_user):
    filter_expr = request.args.get("filter")
    top = request.args.get("top", 100, type=int)
    users = _registry.entra.list_users(filter_expr=filter_expr, top=top)
    return jsonify({"users": users, "available": _registry.entra.is_available()}), 200


@microsoft_bp.route("/microsoft/entra/users/<user_id>", methods=["GET"])
@token_required
def get_entra_user(_current_user, user_id):
    if not _registry.entra.is_available():
        return jsonify({"error": "Entra ID is not configured"}), 400

    user = _registry.entra.get_user(user_id)
    if user is None:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user), 200


@microsoft_bp.route("/microsoft/entra/groups/<group_id>/members", methods=["GET"])
@token_required
def list_entra_group_members(_current_user, group_id):
    members = _registry.entra.get_group_members(group_id)
    return jsonify({"members": members, "available": _registry.entra.is_available()}), 200
