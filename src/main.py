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
from src.services.notification_service import notification_service
from src.services.scheduler_service import scheduler_service
from src.services.logging_config import setup_logging, get_structured_logger
from src.services.request_logging import init_request_logging

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
            "origins": os.getenv("CORS_ORIGINS", "*").split(","),
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
        }
    },
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

# Register blueprints
app.register_blueprint(user_bp, url_prefix="/api")
app.register_blueprint(contract_bp, url_prefix="/api")
app.register_blueprint(notification_bp, url_prefix="/api")

# @app.route("/test-email")
# def test_email():
#     success, message = notification_service.send_email_notification(
#         to_email="usethinkpad27@gmail.com",
#         subject="Muraai Test Email",
#         body="<h1>Email system working!</h1>"
#     )

#     return {
#         "success": success,
#         "message": message
#     }

@app.route("/run-reminders", methods=["GET", "POST"])
def run_reminders():
    results = notification_service.check_and_send_notifications()
    return results

@app.route("/smtp-test")
def smtp_test():
    import smtplib
    import os

    try:
        server = smtplib.SMTP(
            os.getenv("SMTP_SERVER"),
            int(os.getenv("SMTP_PORT"))
        )
        server.starttls()
        server.login(
            os.getenv("EMAIL_USER"),
            os.getenv("EMAIL_PASSWORD")
        )
        server.quit()

        return {"status": "SMTP OK"}

    except Exception as e:
        return {"error": str(e)}

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
    app.run(host="0.0.0.0", port=port, debug=debug)

