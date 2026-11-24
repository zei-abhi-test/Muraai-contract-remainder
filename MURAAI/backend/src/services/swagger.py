try:
    from flasgger import Swagger
    _HAS_SWAGGER = True
except ImportError:
    _HAS_SWAGGER = False

swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec_1",
            "route": "/apispec_1.json",
            "rule_filter": lambda rule: True,  # include all routes
            "model_filter": lambda tag: True,  # include all models
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/apidocs/",
}

swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "Muraai Contract Reminder API",
        "description": "Enterprise Contract Lifecycle Management & Portal API",
        "contact": {
            "name": "Muraai Engineering Team",
        },
        "version": "2.0.0",
    },
    "securityDefinitions": {
        "Bearer": {
            "type": "apiKey",
            "name": "Authorization",
            "in": "header",
            "description": "JWT Authorization header using the Bearer scheme. Example: 'Bearer {token}'",
        }
    },
    "security": [
        {
            "Bearer": []
        }
    ],
}


def init_swagger(app):
    """Initialize Flasgger Swagger UI extension on Flask app.
    This is optional and can be disabled via DISABLE_SWAGGER env var.
    If flasgger is not installed and Swagger is not disabled, raise a clear error.
    """
    import os
    from src.services.logging_config import get_structured_logger
    logger = get_structured_logger(__name__)
    if os.getenv('DISABLE_SWAGGER', 'false').lower() == 'true':
        logger.info('Swagger documentation is disabled via DISABLE_SWAGGER env var.')
        return None
    if not _HAS_SWAGGER:
        raise RuntimeError(
            "Flasgger is not installed. Install it with 'python -m pip install flasgger' or set DISABLE_SWAGGER=true to run without Swagger."
        )
    return Swagger(app, config=swagger_config, template=swagger_template)
