FROM python:3.12-slim

# System deps (optional but good for psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# requirements first to leverage layer cache
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# ADD THIS: copy your ops (alembic) folder into the image
COPY ops /app/ops

# app code
COPY app /app/app

ENV PYTHONPATH=/app
EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers", "--forwarded-allow-ips", "*"]
