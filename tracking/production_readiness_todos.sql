CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS todo_deps (
    todo_id TEXT,
    depends_on TEXT,
    PRIMARY KEY (todo_id, depends_on),
    FOREIGN KEY (todo_id) REFERENCES todos(id),
    FOREIGN KEY (depends_on) REFERENCES todos(id)
);

INSERT OR REPLACE INTO todos (id, title, description, status) VALUES
('sec-1-secrets', 'Externalize all secrets to .env', 'Move hardcoded Gmail credentials, FCM key, and SECRET_KEY to environment variables. Remove from main.py and create secure .env.example', 'completed'),
('sec-2-validation', 'Add input validation to routes', 'Use Pydantic models for request validation in user.py and contract.py routes. Add try-catch error handling', 'completed'),
('sec-3-headers', 'Add security headers middleware', 'Implement CORS security, CSP, HSTS, and other security headers. Audit nginx config', 'completed'),
('auth-1-model', 'Update User model with auth fields', 'Add password hash field, created_at, updated_at. Implement password hashing with bcrypt', 'completed'),
('auth-2-jwt', 'Implement JWT authentication', 'Create login/register endpoints with JWT token generation. Add auth middleware/decorators', 'completed'),
('auth-3-protect', 'Protect existing routes', 'Add @login_required decorator to contract routes. Ensure users can only see their own contracts', 'completed'),
('test-1-setup', 'Setup pytest & test structure', 'Install pytest, create tests/ directory with conftest.py, setup test database', 'completed'),
('test-2-unit', 'Write unit tests', 'Test notification_service, models, and utility functions. Target 80%+ coverage', 'completed'),
('test-3-api', 'Write API integration tests', 'Test all endpoints with valid/invalid inputs. Test authentication & authorization', 'completed'),
('db-1-alembic', 'Setup Alembic migrations', 'Initialize Alembic, create initial schema migration, document process', 'completed'),
('db-2-postgres', 'Setup PostgreSQL support', 'Create docker-compose with PostgreSQL service, test connection pooling', 'completed'),
('log-1-setup', 'Setup structured logging', 'Install python-json-logger, configure logging in all services, create log formatter', 'completed'),
('log-2-middleware', 'Add request/response logging', 'Create middleware to log all HTTP requests/responses with timing, create /health endpoint', 'completed'),
('api-1-docs', 'Create API documentation', 'Generate Swagger/OpenAPI spec, create endpoint docs with examples', 'completed'),
('api-2-cleanup', 'Code quality improvements', 'Run black formatter, flake8 linter, fix style issues, add docstrings', 'completed'),
('readme-1-create', 'Write comprehensive README', 'Local setup, API overview, deployment instructions, troubleshooting guide', 'completed'),
('deploy-1-test', 'Test production deployment locally', 'Build Docker image, run docker-compose with PostgreSQL, test all functionality', 'completed'),
('deploy-2-company', 'Deploy to company server', 'Setup systemd service, Nginx reverse proxy, SSL with Let''s Encrypt, test 24/7 operation', 'pending'),
('frontend-1-optional', '[OPTIONAL] Create web frontend', 'Build simple React/Vue dashboard for contract management, serve from /static', 'completed');

INSERT OR REPLACE INTO todo_deps (todo_id, depends_on) VALUES
('sec-2-validation', 'sec-1-secrets'),
('sec-3-headers', 'sec-1-secrets'),
('auth-1-model', 'sec-1-secrets'),
('auth-2-jwt', 'auth-1-model'),
('auth-3-protect', 'auth-2-jwt'),
('test-1-setup', 'sec-2-validation'),
('test-2-unit', 'test-1-setup'),
('test-3-api', 'test-2-unit'),
('auth-3-protect', 'test-3-api'),
('db-1-alembic', 'auth-3-protect'),
('db-2-postgres', 'db-1-alembic'),
('log-1-setup', 'sec-1-secrets'),
('log-2-middleware', 'log-1-setup'),
('api-1-docs', 'auth-3-protect'),
('api-2-cleanup', 'api-1-docs'),
('readme-1-create', 'api-2-cleanup'),
('deploy-1-test', 'db-2-postgres'),
('deploy-1-test', 'log-2-middleware'),
('deploy-2-company', 'deploy-1-test'),
('deploy-2-company', 'readme-1-create');
