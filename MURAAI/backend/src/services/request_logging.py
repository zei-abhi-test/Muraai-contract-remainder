"""HTTP request/response logging middleware."""

import time
from uuid import uuid4

from flask import Flask, g, request

from src.services.logging_config import get_structured_logger


logger = get_structured_logger(__name__)


def init_request_logging(app: Flask):
    """Log every HTTP request with status and latency."""

    @app.before_request
    def start_request_timer():
        g.request_id = request.headers.get("X-Request-ID", str(uuid4()))
        g.request_started_at = time.perf_counter()
        logger.info(
            "HTTP request started",
            context={
                "request_id": g.request_id,
                "method": request.method,
                "path": request.path,
                "remote_addr": request.headers.get("X-Forwarded-For", request.remote_addr),
            },
        )

    @app.after_request
    def log_response(response):
        started_at = getattr(g, "request_started_at", None)
        duration_ms = None
        if started_at is not None:
            duration_ms = round((time.perf_counter() - started_at) * 1000, 2)

        request_id = getattr(g, "request_id", str(uuid4()))
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "HTTP request completed",
            context={
                "request_id": request_id,
                "method": request.method,
                "path": request.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
        )
        return response
