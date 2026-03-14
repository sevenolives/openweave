#!/bin/bash

echo "=== Collecting static files ==="
python manage.py collectstatic --no-input 2>&1

echo "=== Fixing squashed migrations ==="
python manage.py fix_squashed_migrations 2>&1 || echo "WARNING: fix_squashed_migrations failed, continuing..."

echo "=== Running migrations ==="
python manage.py migrate --noinput 2>&1 || echo "WARNING: migrate failed, continuing..."

echo "=== Creating superuser ==="
python manage.py createsuperadmin 2>&1 || echo "WARNING: createsuperadmin failed, continuing..."

echo "=== Seeding master data ==="
python manage.py seed_master 2>&1 || echo "WARNING: seed_master failed, continuing..."

echo "=== Starting gunicorn on port ${PORT:-8000} ==="
exec gunicorn agentdesk.wsgi:application --bind 0.0.0.0:${PORT:-8000} --timeout 120
