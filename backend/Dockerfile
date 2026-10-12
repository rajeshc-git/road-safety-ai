# syntax=docker/dockerfile:1
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Prevent Python from writing pyc files, buffer logs, and configure Ultralytics temp path
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    YOLO_CONFIG_DIR=/tmp/Ultralytics \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility,video


# Install minimal OS dependencies for video decoding, OpenCV headless, MediaPipe EGL/GL, and build requirements
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libglib2.0-0 \
    libgomp1 \
    libegl1 \
    libgl1 \
    curl \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# ── HEAVY DEPENDENCY LAYER (cached across ALL rebuilds via BuildKit mount) ────
# Pre-install PyTorch + TorchVision with CUDA 12.8 support (includes CUDA runtime)
# Full native support for NVIDIA Blackwell (RTX 5080 / RTX 5090 with sm_120),
# Ada Lovelace (RTX 40xx), Ampere (RTX 30xx), and Turing (RTX 20xx / GTX 16xx).
#
# --mount=type=cache persists pip's download cache in a Docker volume.
# Even if this layer is invalidated, pip finds packages already downloaded
# and skips the multi-GB network transfer entirely.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip setuptools wheel && \
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128


# Copy requirements file first for layer caching
COPY backend/requirements.txt ./backend/requirements.txt

# Install dependencies, pre-cache EasyOCR, and purge temporary build tools to keep image ultra-lean
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r backend/requirements.txt && \
    (python -c "import easyocr; easyocr.Reader(['en'], download_enabled=True, gpu=False)" || true) && \
    apt-get purge -y --auto-remove gcc python3-dev && \
    rm -rf /var/lib/apt/lists/*


# ── APPLICATION CODE (only this rebuilds on code changes) ────────────────────
COPY backend/ ./backend/
COPY run.py ./
COPY best.pt* ./
COPY data/face_landmarker.task* ./data/

# Expose API port
EXPOSE 8000

# Healthcheck to verify the backend is responsive
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD curl -f http://localhost:8000/docs || exit 1

# Command to run the application
CMD ["python", "run.py"]
