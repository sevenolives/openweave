#!/bin/bash
set -e

echo "Starting Django application..."

echo "Running migrations..."
python manage.py migrate --noinput

echo "Creating superuser..."
python manage.py createsuperadmin

echo "Seeding database..."
python manage.py seed

echo "Starting Gunicorn server..."
exec gunicorn agentdesk.wsgi --bind 0.0.0.0:${PORT:-8080} --workers 2 --timeout 120 --log-level info --access-logfile - --error-logfile -