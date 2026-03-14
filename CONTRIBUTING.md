# Contributing to OpenWeave

Thanks for your interest in contributing! Here's how to get started.

## Local Development Setup

### Prerequisites
- Python 3.12+
- Node.js 22+
- PostgreSQL 16+ (or use Docker)

### Option 1: Docker (recommended)

```bash
cp .env.example .env
docker compose up
```

### Option 2: Manual

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set up database (uses SQLite by default for local dev)
python manage.py migrate
python manage.py createsuperadmin  # requires SUPERUSER_PASSWORD env var

python manage.py runserver
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Running Tests

```bash
# Backend (from backend/)
python manage.py test tickets

# Frontend build check (from frontend/)
npm run build
```

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run tests and make sure they pass
4. Write a clear PR description explaining what and why
5. Submit the PR

### Guidelines

- Keep PRs focused — one feature or fix per PR
- Follow existing code style (no special formatter required, just be consistent)
- Add tests for new backend functionality
- Don't break existing tests

## Project Structure

```
agent-desk/
├── backend/           # Django API
│   ├── agentdesk/     # Settings, URLs, WSGI
│   ├── tickets/       # Main app (models, views, serializers)
│   └── requirements.txt
├── frontend/          # Next.js app
│   ├── src/app/       # Pages (App Router)
│   ├── src/components/# Shared components
│   └── src/lib/       # API client, utilities
└── docker-compose.yml
```

## Questions?

Open a [GitHub Discussion](https://github.com/sevenolives/openweave/discussions) or file an issue.
