"""
Safety Stop AI — MinIO Service
S3-compatible Object Storage for violation snapshots, cropped evidence, and media archives.
Automatically provisions buckets and gracefully falls back to local disk if unavailable.
"""

import io
import asyncio
import logging
from typing import Optional, Dict, Any

from config import (
    MINIO_ENABLED,
    MINIO_ENDPOINT,
    MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY,
    MINIO_SECURE,
    MINIO_BUCKET,
    SNAPSHOTS_DIR,
)

logger = logging.getLogger("safety_stop.minio")

_minio_client = None
_is_connected = False


def _get_minio_sync():
    """Create synchronous Minio client and ensure bucket exists."""
    global _minio_client, _is_connected
    if not MINIO_ENABLED:
        return None

    try:
        from minio import Minio
        # Strip protocol if present in endpoint (e.g. http://localhost:9000 -> localhost:9000)
        endpoint = MINIO_ENDPOINT
        secure = MINIO_SECURE
        if endpoint.startswith("http://"):
            endpoint = endpoint[7:]
            secure = False
        elif endpoint.startswith("https://"):
            endpoint = endpoint[8:]
            secure = True

        client = Minio(
            endpoint=endpoint,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=secure,
        )

        # Check and create bucket
        if not client.bucket_exists(MINIO_BUCKET):
            client.make_bucket(MINIO_BUCKET)
            logger.info(f"Created MinIO bucket '{MINIO_BUCKET}'.")

        _minio_client = client
        _is_connected = True
        logger.info(f"✅ Successfully connected to MinIO at {MINIO_ENDPOINT} (Bucket: {MINIO_BUCKET})")
        return client
    except Exception as e:
        logger.warning(f"⚠️ MinIO initialization failed ({MINIO_ENDPOINT}): {e}. Using local disk storage.")
        _minio_client = None
        _is_connected = False
        return None


async def init_minio() -> bool:
    """Async wrapper to initialize MinIO during FastAPI startup."""
    client = await asyncio.to_thread(_get_minio_sync)
    return client is not None


def is_minio_available() -> bool:
    return _is_connected and _minio_client is not None


def _sync_upload_bytes(filename: str, data: bytes, content_type: str = "image/jpeg") -> bool:
    if not _minio_client:
        return False
    try:
        data_stream = io.BytesIO(data)
        _minio_client.put_object(
            bucket_name=MINIO_BUCKET,
            object_name=filename,
            data=data_stream,
            length=len(data),
            content_type=content_type,
        )
        return True
    except Exception as e:
        logger.error(f"Error uploading {filename} to MinIO: {e}")
        return False


async def upload_snapshot_bytes(filename: str, data: bytes, content_type: str = "image/jpeg") -> bool:
    """Upload snapshot bytes to MinIO asynchronously."""
    if not is_minio_available():
        return False
    return await asyncio.to_thread(_sync_upload_bytes, filename, data, content_type)


def _sync_get_bytes(filename: str) -> Optional[bytes]:
    if not _minio_client:
        return None
    try:
        response = _minio_client.get_object(MINIO_BUCKET, filename)
        data = response.read()
        response.close()
        response.release_conn()
        return data
    except Exception as e:
        logger.debug(f"Object {filename} not in MinIO or error: {e}")
        return None


async def get_snapshot_bytes(filename: str) -> Optional[bytes]:
    """Retrieve snapshot image bytes from MinIO or fall back to local disk."""
    if is_minio_available():
        data = await asyncio.to_thread(_sync_get_bytes, filename)
        if data is not None:
            return data

    # Local disk fallback
    local_path = SNAPSHOTS_DIR / filename
    if local_path.exists():
        try:
            return local_path.read_bytes()
        except Exception:
            pass
    return None


def _sync_delete_object(filename: str) -> bool:
    if not _minio_client:
        return False
    try:
        _minio_client.remove_object(MINIO_BUCKET, filename)
        return True
    except Exception:
        return False


async def delete_snapshot(filename: str) -> bool:
    """Delete snapshot from both MinIO and local disk."""
    # Delete from MinIO
    if is_minio_available():
        await asyncio.to_thread(_sync_delete_object, filename)

    # Delete local file if present
    local_path = SNAPSHOTS_DIR / filename
    if local_path.exists():
        try:
            local_path.unlink()
        except Exception:
            pass
    return True


async def get_minio_info() -> Dict[str, Any]:
    """Get MinIO health and bucket object count."""
    if not is_minio_available():
        return {
            "status": "offline",
            "enabled": MINIO_ENABLED,
            "endpoint": MINIO_ENDPOINT,
            "bucket": MINIO_BUCKET,
        }

    try:
        def _get_stats():
            objects = list(_minio_client.list_objects(MINIO_BUCKET, recursive=False))
            total_size = sum(obj.size for obj in objects if obj.size is not None)
            return len(objects), total_size

        obj_count, total_bytes = await asyncio.to_thread(_get_stats)
        mb = round(total_bytes / (1024 * 1024), 2)
        return {
            "status": "online",
            "enabled": True,
            "endpoint": MINIO_ENDPOINT,
            "bucket": MINIO_BUCKET,
            "object_count": obj_count,
            "storage_used_mb": mb,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "enabled": MINIO_ENABLED,
            "endpoint": MINIO_ENDPOINT,
            "bucket": MINIO_BUCKET,
        }
