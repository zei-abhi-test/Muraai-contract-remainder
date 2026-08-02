# MURAAI Contract Reminder System

## Folder Structure

```
MURAAI/
├── backend/
│   ├── src/              # Backend source code
│   │   ├── models/       # SQLAlchemy models
│   │   ├── routes/       # Flask blueprints
│   │   ├── services/     # Business logic services
│   │   ├── static/       # Static files
│   │   └── main.py       # Flask application entry point
│   ├── migrations/       # Alembic database migrations
│   ├── tests/            # Backend tests
│   ├── docs/             # API documentation
│   ├── .env.example      # Environment variables template
│   ├── Dockerfile        # Docker configuration
│   ├── requirements.txt  # Python dependencies
│   ├── railway.toml      # Railway deployment config
│   └── alembic.ini       # Alembic configuration
│
└── frontend/
    ├── src/              # Frontend source code
    │   ├── api/          # API client functions
    │   ├── components/   # React components
    │   ├── hooks/        # Custom React hooks
    │   ├── lib/          # Utility libraries
    │   ├── pages/        # Page components
    │   ├── services/     # Service layer
    │   └── store/        # State management
    ├── public/           # Public assets
    ├── package.json      # Node.js dependencies
    ├── vite.config.ts    # Vite configuration
    └── tsconfig.json     # TypeScript configuration
```

## Backend Setup

### Prerequisites
- Python 3.11+
- PostgreSQL (or SQLite for development)

### Installation

1. Navigate to backend directory:
```bash
cd MURAAI/backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. Initialize database:
```bash
# For SQLite (default)
python -c "from src.main import app, db; app.app_context().push(); db.create_all()"

# For PostgreSQL with Alembic
alembic upgrade head
```

### Running the Backend

```bash
# Development
python src/main.py

# Production with Gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 src.main:app
```

## Frontend Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Navigate to frontend directory:
```bash
cd MURAAI/frontend
```

2. Install dependencies:
```bash
npm install
```

### Running the Frontend

```bash
# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Import Structure

### Backend Python Imports
The backend uses relative imports with `src.` prefix. The `sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))` in `main.py` ensures the imports work correctly regardless of where the code is run from.

Example:
```python
from src.models.user import User, db
from src.services.auth import generate_token
```

### Frontend TypeScript Imports
The frontend uses the `@` alias for imports, which maps to the `src` directory in `vite.config.ts`.

Example:
```typescript
import { useAuth } from '@/hooks/useAuth'
import { authApi } from '@/api/auth'
```

## Environment Variables

### Backend (.env)
```
FLASK_ENV=development
SECRET_KEY=your-secret-key
JWT_EXPIRATION_HOURS=24
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
EMAIL_USER=your-email@example.com
EMAIL_PASSWORD=your-email-password
FCM_SERVER_KEY=your-fcm-key
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000/api
```

## Docker Deployment

### Backend
```bash
cd MURAAI/backend
docker build -t muraai-backend .
docker run -p 5000:5000 muraai-backend
```

### Frontend
```bash
cd MURAAI/frontend
docker build -t muraai-frontend .
docker run -p 5173:5173 muraai-frontend
```

## Railway Deployment

The backend is configured for Railway deployment via `railway.toml`. Push to a connected Railway repository to deploy automatically.

## Notes

- The backend runs on port 8000 by default (configurable via PORT env var)
- The frontend runs on port 5173 by default (Vite default)
- CORS is pre-configured for localhost development
- The backend includes a `/health` endpoint for health checks
- Database migrations are managed with Alembic
