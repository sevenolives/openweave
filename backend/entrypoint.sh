#!/bin/bash
set -e

echo "Collecting static files..."
python manage.py collectstatic --no-input

echo "Fixing squashed migrations..."
python manage.py fix_squashed_migrations

echo "Running migrations..."
python manage.py migrate --noinput

echo "Creating superuser..."
python manage.py createsuperadmin

echo "Seeding master data..."
python manage.py seed_master

echo "Starting gunicorn..."
exec gunicorn agentdesk.wsgi:application --bind 0.0.0.0:${PORT:-8000}
