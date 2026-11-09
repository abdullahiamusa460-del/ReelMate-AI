# ReelMate AI backend
# Build:  docker build -t reelmate-backend .
# Run:    docker run --env-file .env -p 8000:8000 reelmate-backend
FROM python:3.12-slim

WORKDIR /app

# System dependencies: ffmpeg/ffprobe for media frame extraction, libpq for psycopg/asyncpg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libpq5 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Application code
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .
COPY pytest.ini .

# Non-root runtime user
RUN useradd --create-home --shell /bin/bash reelmate && \
    mkdir -p /app/uploads && chown reelmate:reelmate /app/uploads
USER reelmate

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATABASE_URL=postgresql+asyncpg://reelmate:reelmate@127.0.0.1:5432/reelmate \
    BACKEND_PUBLIC_URL=http://localhost:8000 \
    FRONTEND_URL=http://localhost:3000 \
    CORS_ORIGINS=http://localhost:3000 \
    APP_ENV=production \
    LOG_LEVEL=INFO \
    ENABLE_WORKER=true

EXPOSE 8000

# Migrate then start. DATABASE_URL and secrets must be supplied via --env-file or environment.
CMD sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"
