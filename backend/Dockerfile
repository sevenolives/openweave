FROM python:3.13-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Collect static files
RUN python manage.py collectstatic --noinput 2>/dev/null || true

EXPOSE 8080

CMD python manage.py migrate --noinput && python manage.py createsuperadmin && python manage.py seed && gunicorn agentdesk.wsgi --bind 0.0.0.0:${PORT:-8080}
