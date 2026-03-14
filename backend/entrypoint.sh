#!/bin/bash
set -e

echo "Running migrations..."
python manage.py migrate --noinput

echo "Creating superuser..."
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(is_superuser=True).exists():
    User.objects.create_superuser('admin', 'admin@localhost', '${SUPERUSER_PASSWORD:-admin123}')
    print('Superuser created.')
else:
    print('Superuser already exists.')
"

echo "Starting gunicorn..."
exec gunicorn agentdesk.wsgi:application --bind 0.0.0.0:8000
