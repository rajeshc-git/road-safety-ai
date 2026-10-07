"""
Safety Stop AI — Configuration
All tuneable parameters and path constants.
"""

import os
import json
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR         = Path(__file__).resolve().parent.parent
DATA_DIR         = BASE_DIR / "data"
SNAPSHOTS_DIR    = DATA_DIR / "snapshots"
TEST_VIDEOS_DIR  = DATA_DIR / "test_videos"
DB_PATH          = DATA_DIR / "safety_stop.db"

# YOLO model: look in project-local data/models/ first, then sibling 'yolo weights' folder
_local_model = DATA_DIR / "models" / "yolov8n.pt"
_sibling_model = BASE_DIR.parent / "yolo weights" / "yolov8n.pt"
YOLO_MODEL_PATH = _local_model if _local_model.exists() else _sibling_model

# DMS-specific YOLO model (custom 8-class driver behavior detection)
DMS_YOLO_MODEL_PATH = BASE_DIR / "best.pt"


# Make required directories
SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)
TEST_VIDEOS_DIR.mkdir(parents=True, exist_ok=True)


# ── Detection Defaults ────────────────────────────────────────────────────────
DEFAULT_CONFIDENCE      = 0.5    # Minimum YOLO confidence
DEFAULT_SPEED_THRESHOLD = 0.1    # m/s — max speed considered "stopped"
DEFAULT_PROCESSING_FPS  = 25     # Max frames to process per second

# ── YOLO Classes ──────────────────────────────────────────────────────────────
VEHICLE_CLASSES = {"car", "motorbike", "bus", "truck"}
PERSON_CLASS    = "person"

# ── WebSocket / Streaming ─────────────────────────────────────────────────────
JPEG_QUALITY   = 80              # JPEG compression for streamed frames
MAX_WS_FPS     = 25             # Max WebSocket frame rate

# ── Storage ───────────────────────────────────────────────────────────────────
SNAPSHOT_QUALITY       = 90      # JPEG quality for saved snapshots  (0-100)

# ── Violation Detection ───────────────────────────────────────────────────────
STOP_LINE_TOLERANCE_PX  = 30     # Pixel buffer on each side of stop line
PEDESTRIAN_ZONE_MARGIN  = 80     # Extra px around stop line for pedestrian zone
VIOLATION_COOLDOWN_SEC  = 5      # Min seconds between violations for same vehicle
MIN_TRACKED_FRAMES      = 5      # Must track vehicle ≥ N frames before violation check

# ── Redis Configuration ───────────────────────────────────────────────────────
REDIS_ENABLED   = os.getenv("REDIS_ENABLED", "true").lower() in ("1", "true", "yes")
REDIS_URL       = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# ── MinIO / S3 Object Storage Configuration ───────────────────────────────────
MINIO_ENABLED   = os.getenv("MINIO_ENABLED", "true").lower() in ("1", "true", "yes")
MINIO_ENDPOINT  = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
MINIO_SECURE    = os.getenv("MINIO_SECURE", "false").lower() in ("1", "true", "yes")
MINIO_BUCKET    = os.getenv("MINIO_BUCKET", "safety-violations")

# ── WebRTC Configuration ──────────────────────────────────────────────────────
WEBRTC_ENABLED  = os.getenv("WEBRTC_ENABLED", "true").lower() in ("1", "true", "yes")
ICE_SERVERS     = json.loads(os.getenv("ICE_SERVERS", '[{"urls": ["stun:stun.l.google.com:19302"]}]')) if "json" in globals() else [{"urls": ["stun:stun.l.google.com:19302"]}]

# ── App Server ────────────────────────────────────────────────────────────────
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

