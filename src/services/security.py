"""Security middleware and utilities for Flask application."""

import os
from flask import Flask


def init_security_headers(app: Flask):
    """Initialize security headers for all responses."""

    @app.after_request
    def set_security_headers(response):
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking attacks
        response.headers["X-Frame-Options"] = "DENY"

        # Enable XSS protection in older browsers
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Enable HSTS (only in production)
        if os.getenv("FLASK_ENV") == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Disable client-side caching for sensitive data
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Content Security Policy. Inline styles are currently needed by email/static assets.
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "font-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )

        return response


def init_error_handlers(app: Flask):
    """Initialize global error handlers."""

    @app.errorhandler(400)
    def bad_request(error):
        return {"error": "Bad request", "message": str(error)}, 400

    @app.errorhandler(404)
    def not_found(error):
        return {"error": "Not found", "message": "The requested resource was not found"}, 404

    @app.errorhandler(500)
    def internal_error(error):
        return {"error": "Internal server error", "message": "An unexpected error occurred"}, 500

    @app.errorhandler(Exception)
    def handle_exception(error):
        # Log the error if needed
        app.logger.error(f"Unhandled exception: {str(error)}")
        return {"error": "Internal server error", "message": "An unexpected error occurred"}, 500
