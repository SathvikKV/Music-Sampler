FROM python:3.11-slim

WORKDIR /app

# install deps
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# copy backend code
COPY app /app/app
COPY .env /app/.env

# make sure /app/ops exists, because your alembic.ini points to ops/alembic
RUN mkdir -p /app/ops

# copy alembic stuff to the SAME path the ini expects
COPY ops/alembic.ini /app/ops/alembic.ini
COPY ops/alembic /app/ops/alembic

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
