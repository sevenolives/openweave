FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Make start script executable
RUN chmod +x start.sh

# Collect static files
RUN python manage.py collectstatic --noinput || true

EXPOSE 8080

CMD ["./start.sh"]
