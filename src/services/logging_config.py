import logging
import os
import sys
from pythonjsonlogger import jsonlogger


class ContextFilter(logging.Filter):
    """Add contextual information to log records"""

    def filter(self, record):
        record.app_name = os.getenv("APP_NAME", "muraai-contract-reminder")
        record.environment = os.getenv("FLASK_ENV", "development")
        return True


def setup_logging(app):
    """
    Configure structured JSON logging for the Flask application

    Args:
        app: Flask application instance
    """
    # Determine log level based on environment
    flask_env = os.getenv("FLASK_ENV", "development")
    log_level = logging.DEBUG if flask_env == "development" else logging.INFO

    # Get the root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)

    # Create JSON formatter
    json_formatter = jsonlogger.JsonFormatter(
        fmt="%(asctime)s %(levelname)s %(name)s %(message)s %(context)s",
        rename_fields={"asctime": "timestamp", "levelname": "level"},
        defaults={"context": {}},
    )

    console_handler.setFormatter(json_formatter)

    # Add context filter
    context_filter = ContextFilter()
    console_handler.addFilter(context_filter)

    # Add handler to root logger
    root_logger.addHandler(console_handler)

    # Set up logging for specific libraries to reduce noise
    logging.getLogger("werkzeug").setLevel(logging.WARNING)
    logging.getLogger("apscheduler").setLevel(logging.INFO)

    app.logger.info(
        "Structured JSON logging configured",
        extra={"context": {"environment": flask_env, "log_level": logging.getLevelName(log_level)}},
    )


class StructuredLogger:
    """Helper class for structured logging with context"""

    def __init__(self, logger):
        self.logger = logger

    def _log(self, level, message, **kwargs):
        """Internal logging method with context support"""
        context = kwargs.pop("context", {})
        self.logger.log(level, message, extra={"context": context}, **kwargs)

    def debug(self, message, **kwargs):
        self._log(logging.DEBUG, message, **kwargs)

    def info(self, message, **kwargs):
        self._log(logging.INFO, message, **kwargs)

    def warning(self, message, **kwargs):
        self._log(logging.WARNING, message, **kwargs)

    def error(self, message, **kwargs):
        self._log(logging.ERROR, message, **kwargs)

    def critical(self, message, **kwargs):
        self._log(logging.CRITICAL, message, **kwargs)


def get_structured_logger(name):
    """Get a structured logger instance"""
    logger = logging.getLogger(name)
    return StructuredLogger(logger)
