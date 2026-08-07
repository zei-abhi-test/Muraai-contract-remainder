# Muraai Contract Reminder

A Flask-based contract reminder system that automatically sends email and push notifications for upcoming contract end dates. Built for production deployment with security, reliability, and scalability in mind.

## Features

✅ **Contract Management** - Create, read, update, and delete contracts with detailed information
✅ **Automated Notifications** - Email and mobile push notifications for upcoming renewals
✅ **Scheduled Tasks** - APScheduler runs daily renewal checks and weekly summaries
✅ **RESTful API** - Comprehensive API for all operations
✅ **Dashboard Data** - Get overview of upcoming and overdue contracts
✅ **Input Validation** - Pydantic-based validation for all requests
✅ **Security Hardening** - Security headers, CORS configuration, environment-based secrets
✅ **Production Ready** - Docker support, database pooling, health checks

## Architecture

```
src/
├── main.py                    # Flask app initialization
├── models/
│   ├── user.py               # User model
│   └── contract.py           # Contract & Notification models
├── routes/
│   ├── user.py               # User endpoints
│   ├── contracts/            # Modularized contract submodules (crud, lifecycle, renewals, etc.)
│   ├── customers.py          # Customer & contact endpoints
│   ├── products.py           # Products & contract-types endpoints
│   ├── customer_portal_admin.py # Portal administration endpoints
│   └── notification.py       # Notification endpoints
└── services/
    ├── notification_service.py # Email/SMS notifications
    ├── scheduler_service.py   # APScheduler jobs
    ├── security.py           # Security headers & error handlers
    └── validators.py         # Pydantic validators
```

## Requirements

- Python 3.11+
- PostgreSQL (production) or SQLite (development)
- Gmail account with app password (for email notifications)
- Firebase Cloud Messaging setup (for push notifications, optional)

## Installation

### 1. Clone and Setup

```bash
git clone <repository-url>
cd muraai-contract-reminder
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.template .env
```

Edit `.env` with your actual values:

```env
# Flask
FLASK_ENV=development
SECRET_KEY=your-secret-key-here-min-32-chars

# Database (optional - defaults to SQLite)
DATABASE_URL=  # Leave empty for SQLite

# Email (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password

# Firebase (optional)
FCM_SERVER_KEY=your-fcm-server-key

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5000

# Server
PORT=5000
```

### 3. Initialize Database

```bash
python -c "from src.main import app; app.app_context().push()"
```

The database will be created automatically on first run.

## Running Locally

### Development Server

```bash
python src/main.py
```

Server runs at `http://localhost:5000`

### Production with Gunicorn

```bash
gunicorn -w 4 -b 0.0.0.0:5000 src.main:app
```

### Docker

```bash
# Build
docker build -t muraai-contract-reminder .

# Run
docker run -p 5000:5000 --env-file .env muraai-contract-reminder
```

### Docker Compose (with PostgreSQL)

```bash
docker-compose up -d
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register user and return JWT
- `POST /api/auth/login` - Authenticate user and return JWT
- `GET /api/auth/me` - Return current user from `Authorization: Bearer <token>`

### Users
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `GET /api/users/<id>` - Get user
- `PUT /api/users/<id>` - Update user
- `DELETE /api/users/<id>` - Delete user

### Contracts
- `GET /api/contracts` - List contracts (optional: `?user_id=1&upcoming_only=true`)
- `GET /api/contracts?status=active` - Contracts with more than 30 days remaining
- `GET /api/contracts?status=ending-soon` - Contracts ending today through the next 30 days
- `GET /api/contracts?status=critical` - Contracts ending today through the next 7 days
- `GET /api/contracts?status=expired` - Contracts with `end_date` before today
- `POST /api/contracts` - Create contract
- `GET /api/contracts/<id>` - Get contract
- `PUT /api/contracts/<id>` - Update contract
- `DELETE /api/contracts/<id>` - Delete contract
- `GET /api/contracts/dashboard` - Dashboard counts and grouped lists for active, ending soon, and expired contracts

### Notifications
- `GET /api/notifications` - List notifications (optional: `?contract_id=1`)
- `POST /api/notifications` - Create notification

### System
- `GET /health` - Health check endpoint
- `GET /openapi.yaml` - OpenAPI specification

## Example API Usage

### Register and Login

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john_doe",
    "email": "john@example.com",
    "password": "securepassword123"
  }'

curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "securepassword123"
  }'
```

### Create a Contract

```bash
curl -X POST http://localhost:5000/api/contracts \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Acme Corp",
    "contract_name": "Software License",
    "start_date": "2023-01-01",
    "end_date": "2025-12-31",
    "renewal_date": "2025-11-15",
    "notification_enabled": true,
    "notification_email": "john@example.com",
    "user_id": 1
  }'
```

### Customer, Contact, and Line Item Workflow

Create reusable customers and contacts first, then link them when creating contracts. Contract line items automatically calculate `amount = quantity * rate`, and the contract stores `total_contract_value`.

```bash
# Replace TOKEN with the JWT from login.
curl -X POST http://localhost:5000/api/customers \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "customer_code": "ACM-001",
    "email": "admin@acme.example",
    "phone": "+91 9876543210"
  }'

curl -X POST http://localhost:5000/api/customers/1/contacts \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contact_name": "Priya Sharma",
    "contact_number": "+91 9876543210",
    "email": "priya@acme.example",
    "designation": "Procurement Manager"
  }'

curl -X POST http://localhost:5000/api/contracts \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Acme Corp",
    "contract_name": "Software License",
    "customer_id": 1,
    "contact_person_id": 1,
    "contract_date": "2026-01-01",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "renewal_date": "2026-12-31",
    "status": "Active",
    "currency": "INR",
    "payment_terms": "Net 30",
    "notification_enabled": true,
    "notification_email": "john@example.com",
    "line_items": [
      {"product": "Cloud license", "quantity": 10, "rate": 350}
    ]
  }'
```

### Documents, Renewals, and Reports

```bash
curl -X POST http://localhost:5000/api/contracts/1/documents \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@agreement.pdf"

curl -X POST http://localhost:5000/api/contracts/1/renew \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"end_date": "2027-12-31", "renewal_date": "2027-12-31"}'

curl -H "Authorization: Bearer TOKEN" http://localhost:5000/api/contracts/1/renewal-history
curl -H "Authorization: Bearer TOKEN" http://localhost:5000/api/reports/line-items
```

Renewal is append-only: the old contract is preserved, and the renewed contract is linked with `parent_contract_id`, `previous_contract_id`, and `contract_version`.

### Get Dashboard

```bash
curl -H "Authorization: Bearer TOKEN" http://localhost:5000/api/contracts/dashboard
```

### Filter Contracts by Status

```bash
curl http://localhost:5000/api/contracts?status=active
curl http://localhost:5000/api/contracts?status=ending-soon
curl http://localhost:5000/api/contracts?status=critical
curl http://localhost:5000/api/contracts?status=expired
```

Status rules:
- Active: `end_date` is more than 30 days from today
- Ending Soon: `end_date` is today through the next 30 days
- Critical: `end_date` is today through the next 7 days
- Expired: `end_date` is before today

Contract responses include reminder tracking fields:
- `health_status`: Healthy, Warning, Critical, or Expired
- `next_reminder_date`: the next scheduled reminder date based on the 30, 28, 26 ... 0 day schedule
- `total_reminders_sent`: sent notification count from the existing `Notification` table
- `last_reminder_sent_at`, `last_reminder_type`, `last_reminder_message`

## Scheduled Jobs

The application automatically runs these scheduled tasks:

### Daily Notification Check (9:00 AM)
Scans all contracts and sends notifications based on `end_date`.

Reminder eligibility is dynamic:
- Calculate `days_until_end = (end_date - today).days`
- Send when `0 <= days_until_end <= 30`
- Send only on even values of `days_until_end`
- Example reminder days: 30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2, 0

The `renewal_date` field is still stored for reference and backward compatibility, but it is not used for reminder scheduling.

### Weekly Summary (Monday 8:00 AM)
Sends a summary email of all contracts ending in the next 7 days.

## Database Setup

### SQLite (Development)
Automatically created in `src/database/app.db`

### PostgreSQL (Production)
```bash
# Create database
createdb muraai_contracts

# Set DATABASE_URL in .env
DATABASE_URL=postgresql://username:password@localhost:5432/muraai_contracts

# Application creates tables automatically on startup
```

## Logging

Logs are output to console with structured JSON format in production.

```bash
# View logs (Docker)
docker logs <container-id>

# View logs (systemd)
journalctl -u muraai-contracts -f
```

## Monitoring

### Health Check

```bash
curl http://localhost:5000/health
# Response: {"status": "healthy", "timestamp": "..."}
```

### Metrics
Monitor the following endpoints:
- `/health` - Application health
- Database connection pool health
- Scheduler job execution

## Deployment

### Systemd Service (Linux)

```bash
sudo cp muraai-contracts.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable muraai-contracts
sudo systemctl start muraai-contracts
sudo systemctl status muraai-contracts
```

### Nginx Reverse Proxy

See `nginx.conf` for configuration example.

```bash
sudo cp nginx.conf /etc/nginx/sites-available/muraai-contracts
sudo ln -s /etc/nginx/sites-available/muraai-contracts /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### SSL/TLS with Let's Encrypt

```bash
sudo certbot certonly --standalone -d yourdomain.com
# Update nginx.conf with certificate paths
sudo systemctl restart nginx
```

## Testing

Run tests with pytest:

```bash
python -m pytest

# Lint and format checks
python -m black --check src tests migrations
python -m flake8 --jobs=1 src tests migrations

# Run with coverage report
python -m pytest --cov=src --cov-report=html
```

## Database Migrations

```bash
python -m alembic upgrade head
python -m alembic revision --autogenerate -m "describe change"
```

## Troubleshooting

### Email Notifications Not Sending

1. Check environment variables:
   ```bash
   echo $EMAIL_USER
   echo $EMAIL_PASSWORD
   ```

2. Verify Gmail app password is correct (not your regular password)

3. Check logs:
   ```bash
   journalctl -u muraai-contracts -f
   ```

4. Test email manually:
   ```python
   from src.services.notification_service import notification_service
   success, msg = notification_service.send_email_notification(
       'test@example.com',
       'Test Subject',
       'Test body'
   )
   print(success, msg)
   ```

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql postgresql://user:password@localhost:5432/muraai_contracts

# Check connection pool settings in .env
DB_POOL_SIZE=10
DB_POOL_RECYCLE=3600
```

### Scheduler Not Running

```bash
# Check systemd logs
sudo journalctl -u muraai-contracts -n 50

# Verify scheduler is initialized
# Check logs for: "Scheduler started successfully"
```

## Contributing

1. Create a feature branch
2. Make changes and test locally
3. Ensure all tests pass
4. Submit a pull request

## Security Notes

- All secrets stored in `.env` file (not in repository)
- SECRET_KEY must be at least 32 characters (use `python -c "import secrets; print(secrets.token_hex(16))"`)
- Enable HTTPS in production
- Restrict CORS origins to known domains
- Keep dependencies updated: `pip install --upgrade -r requirements.txt`

## License

[Your License Here]

## Support

For issues or questions:
1. Check this README and troubleshooting section
2. Check application logs: `journalctl -u muraai-contracts -f`
3. Open an issue on GitHub

---

**Last Updated:** 2026-05-27
**Version:** 1.0.0-beta
