import os
import sys
from dotenv import load_dotenv
from datetime import datetime, timezone
from sqlalchemy import text

# Load environment variables from .env file
load_dotenv()

# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory
from flask_cors import CORS
from src.models.user import db
from src.routes.user import user_bp
from src.routes.contract import contract_bp
from src.routes.notification import notification_bp
from src.routes.management import management_bp
from src.routes.approvals import approvals_bp
from src.routes.purchase_orders import purchase_orders_bp
from src.routes.invoices import invoices_bp
from src.routes.activity import activity_bp
from src.routes.search import search_bp
from src.routes.settings import settings_bp
from src.routes.reports import reports_bp
from src.routes.calendar import calendar_bp
from src.routes.assistance import assistance_bp
from src.routes.microsoft import microsoft_bp
from src.routes.customer_portal import customer_portal_bp
from src.routes.documents import documents_bp
from src.routes.workflow import workflow_bp
from src.routes.automation import automation_bp
from src.routes.tasks import tasks_bp
from src.routes.timeline import timeline_bp
from src.models.calendar import Task, CalendarEvent, ReminderConfig, TaskComment, TaskAttachment, TaskHistory
from src.services.notification_service import notification_service
from src.services.scheduler_service import scheduler_service
from src.services.logging_config import setup_logging, get_structured_logger
from src.services.request_logging import init_request_logging
from src.services.domain_event import dispatcher
from src.services.timeline.service import TimelineService
from src.services.policy_engine import PolicyRegistry, PolicyEngine

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), "static"))

# Configure structured logging early
setup_logging(app)
logger = get_structured_logger(__name__)

# Security Configuration
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
if not app.config["SECRET_KEY"]:
    raise ValueError("SECRET_KEY environment variable is required. Set it in .env file")

# Email configuration (from environment variables)
app.config["SMTP_SERVER"] = os.getenv("SMTP_SERVER", "smtp.gmail.com")
app.config["SMTP_PORT"] = int(os.getenv("SMTP_PORT", 587))
app.config["EMAIL_USER"] = os.getenv("EMAIL_USER")
app.config["EMAIL_PASSWORD"] = os.getenv("EMAIL_PASSWORD")

if not app.config["EMAIL_USER"] or not app.config["EMAIL_PASSWORD"]:
    raise ValueError("EMAIL_USER and EMAIL_PASSWORD environment variables are required")

# Firebase Cloud Messaging configuration (from environment variables)
app.config["FCM_SERVER_KEY"] = os.getenv("FCM_SERVER_KEY")

# CORS configuration - restrict to specific origins in production
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
        }
    },
    supports_credentials=True,
)

# Initialize security
from src.services.security import init_security_headers, init_error_handlers

init_security_headers(app)
init_error_handlers(app)
init_request_logging(app)

# Database configuration
database_url = os.getenv("DATABASE_URL")
if database_url:
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
else:
    db_path = os.path.join(os.path.dirname(__file__), "database")
    os.makedirs(db_path, exist_ok=True)
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{os.path.join(db_path, 'app.db')}"

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
if not app.config["SQLALCHEMY_DATABASE_URI"].startswith("sqlite"):
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_size": int(os.getenv("DB_POOL_SIZE", 10)),
        "pool_recycle": int(os.getenv("DB_POOL_RECYCLE", 3600)),
        "pool_pre_ping": True,
    }

# Initialize database
db.init_app(app)
if os.getenv("AUTO_CREATE_TABLES", "false").lower() == "true" or app.config[
    "SQLALCHEMY_DATABASE_URI"
].startswith("sqlite"):
    with app.app_context():
        db.create_all()

# Initialize services
notification_service.init_app(app)
if os.getenv("SCHEDULER_ENABLED", "true").lower() == "true" and os.getenv("FLASK_ENV") != "testing":
    scheduler_service.init_app(app)
else:
    logger.info(
        "Scheduler startup skipped",
        context={
            "scheduler_enabled": os.getenv("SCHEDULER_ENABLED", "true"),
            "environment": os.getenv("FLASK_ENV", "development"),
        },
    )

# Initialize timeline projection (observes all domain events via dispatcher.on_emit)
if not os.getenv("FLASK_ENV") == "testing":
    with app.app_context():
        timeline_service = TimelineService()
        dispatcher.on_emit(timeline_service.record_event)
        logger.info(
            "Timeline projection initialised",
            context={"observer": "TimelineService.record_event"},
        )

# Initialize policy engine (shared singleton for all policy dispatch)
policy_registry = PolicyRegistry()
policy_engine = PolicyEngine(policy_registry)
logger.info("Policy engine initialised", context={"registered_policies": 0})

# Register blueprints
app.register_blueprint(user_bp, url_prefix="/api")
app.register_blueprint(contract_bp, url_prefix="/api")
app.register_blueprint(notification_bp, url_prefix="/api")
app.register_blueprint(management_bp, url_prefix="/api")
app.register_blueprint(approvals_bp, url_prefix="/api")
app.register_blueprint(purchase_orders_bp, url_prefix="/api")
app.register_blueprint(invoices_bp, url_prefix="/api")
app.register_blueprint(activity_bp, url_prefix="/api")
app.register_blueprint(search_bp, url_prefix="/api")
app.register_blueprint(settings_bp, url_prefix="/api")
app.register_blueprint(reports_bp, url_prefix="/api")
app.register_blueprint(calendar_bp, url_prefix="/api")
app.register_blueprint(assistance_bp, url_prefix="/api")
app.register_blueprint(microsoft_bp, url_prefix="/api")
app.register_blueprint(customer_portal_bp, url_prefix="/api")
app.register_blueprint(documents_bp, url_prefix="/api")
app.register_blueprint(workflow_bp, url_prefix="/api")
app.register_blueprint(automation_bp, url_prefix="/api")
app.register_blueprint(tasks_bp, url_prefix="/api")
app.register_blueprint(timeline_bp, url_prefix="/api")


@app.route("/test-email")
def test_email():
    success, message = notification_service.send_email_notification(
        to_email="rekha.mh@muraai.com",
        subject="Muraai Test Email",
        body="<h1>Email system working!</h1>"
    )

    return {
        "success": success,
        "message": message
    }


@app.route("/debug-resend")
def debug_resend():
    import os

    key = os.getenv("RESEND_API_KEY")

    return {
        "exists": key is not None,
        "prefix": key[:8] if key else None,
        "length": len(key) if key else 0
    }


@app.route("/run-reminders", methods=["GET", "POST"])
def run_reminders():
    results = notification_service.check_and_send_notifications()
    return results


@app.route("/test-resend")
def test_resend():
    import requests
    import os

    response = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {os.getenv('RESEND_API_KEY')}",
            "Content-Type": "application/json"
        },
        json={
            "from": "Muraai <onboarding@resend.dev>",
            "to": ["rekha.mh@muraai.com"],
            "subject": "Resend Test",
            "html": "<h1>Hello from Muraai</h1>"
        }
    )

    return {
        "status": response.status_code,
        "response": response.text
    }


# Health check endpoint
@app.route("/health", methods=["GET"])
def health_check():
    try:
        db.session.execute(text("SELECT 1"))
        logger.info("Health check passed", context={"endpoint": "/health", "status": "healthy"})
        return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}, 200
    except Exception as e:
        logger.error("Health check failed", context={"endpoint": "/health", "error": str(e)})
        return {"status": "unhealthy", "error": str(e)}, 500


@app.route("/openapi.yaml", methods=["GET"])
def openapi_spec():
    docs_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "docs")
    return send_from_directory(docs_path, "openapi.yaml")


# Static file serving
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    if path.startswith("api/"):
        return {"error": "Not found"}, 404

    static_folder_path = app.static_folder
    if static_folder_path is None:
        return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, "index.html")
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, "index.html")
        else:
            return "index.html not found", 404


if __name__ == "__main__":
    port = int(os.getenv("PORT", 10000))
    debug = os.getenv("FLASK_ENV") == "development"
    app.run(host="127.0.0.1", port=8000, debug=debug)
