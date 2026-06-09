FROM python:3.11-slim

# Keep Python output unbuffered so logs show up live in `docker compose up`.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# System deps for OCR fallback on scanned PDFs:
#   tesseract-ocr + Turkish language pack, poppler (pdf2image backend).
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-tur \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only torch FIRST. Docker-for-Mac has no GPU, and the default
# PyPI torch wheel pulls ~2.5GB of CUDA libs — the CPU wheel is far smaller/faster.
# sentence-transformers then sees torch as already satisfied.
RUN pip install --no-cache-dir torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu

# Install deps first for better layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App source is bind-mounted in docker-compose for live reload during dev;
# we still copy it so the image is runnable standalone.
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
