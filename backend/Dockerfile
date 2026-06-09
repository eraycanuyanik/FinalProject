FROM python:3.11-slim

# Keep Python output unbuffered so logs show up live in `docker compose up`.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install deps first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App source is bind-mounted in docker-compose for live reload during dev;
# we still copy it so the image is runnable standalone.
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
