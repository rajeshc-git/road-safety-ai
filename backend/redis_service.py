"""
Safety Stop AI — Redis Service
High-performance Redis Pub/Sub event bus and fast in-memory caching.
Gracefully falls back if Redis is not available.
"""

import asyncio
import json
import logging
from typing import Optional, Dict, Any

from config import REDIS_ENABLED, REDIS_URL

logger = logging.getLogger("safety_stop.redis")

# Global Redis async client
_redis_client = None
_is_connected = False


async def init_redis() -> bool:
    """Initialize Redis connection if enabled."""
    global _redis_client, _is_connected
    if not REDIS_ENABLED:
        logger.info("Redis is disabled in config.")
        _is_connected = False
        return False

    try:
        import redis.asyncio as aioredis
        _redis_client = aioredis.from_url(
            REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            socket_timeout=2.0,
            socket_connect_timeout=2.0,
        )
        # Test ping
        await _redis_client.ping()
        _is_connected = True
        logger.info(f"✅ Successfully connected to Redis at {REDIS_URL}")
        return True
    except Exception as e:
        logger.warning(f"⚠️ Redis connection failed ({REDIS_URL}): {e}. Operating in standalone fallback mode.")
        _redis_client = None
        _is_connected = False
        return False


async def close_redis():
    """Cleanly close Redis connection on shutdown."""
    global _redis_client, _is_connected
    if _redis_client is not None:
        try:
            await _redis_client.close()
        except Exception:
            pass
        _redis_client = None
        _is_connected = False


def is_redis_available() -> bool:
    return _is_connected and _redis_client is not None


async def publish_camera_telemetry(camera_id: int, meta: dict):
    """Publish real-time camera metadata/detections over Redis Pub/Sub."""
    if not is_redis_available():
        return
    try:
        channel = f"camera:{camera_id}:telemetry"
        payload = json.dumps({"camera_id": camera_id, "meta": meta})
        await _redis_client.publish(channel, payload)
    except Exception as e:
        logger.debug(f"Redis publish telemetry error: {e}")


async def publish_violation(event_payload: dict):
    """Publish violation event to global violation event channel."""
    if not is_redis_available():
        return
    try:
        channel = "safety:violations"
        payload = json.dumps(event_payload)
        await _redis_client.publish(channel, payload)
        # Also push to violation recent stream/list
        await _redis_client.lpush("safety:recent_violations", payload)
        await _redis_client.ltrim("safety:recent_violations", 0, 99)
    except Exception as e:
        logger.debug(f"Redis publish violation error: {e}")


async def cache_camera_status(camera_id: int, status: dict, ttl: int = 10):
    """Cache camera runtime status in Redis."""
    if not is_redis_available():
        return
    try:
        key = f"camera:{camera_id}:status"
        await _redis_client.set(key, json.dumps(status), ex=ttl)
    except Exception:
        pass


async def get_cached_camera_status(camera_id: int) -> Optional[dict]:
    """Retrieve cached camera runtime status."""
    if not is_redis_available():
        return None
    try:
        key = f"camera:{camera_id}:status"
        val = await _redis_client.get(key)
        if val:
            return json.loads(val)
    except Exception:
        pass
    return None


async def cache_set(key: str, val: Any, ttl: int = 60):
    if not is_redis_available():
        return
    try:
        await _redis_client.set(f"cache:{key}", json.dumps(val), ex=ttl)
    except Exception:
        pass


async def cache_get(key: str) -> Optional[Any]:
    if not is_redis_available():
        return None
    try:
        val = await _redis_client.get(f"cache:{key}")
        if val:
            return json.loads(val)
    except Exception:
        pass
    return None


async def get_redis_info() -> Dict[str, Any]:
    """Get Redis stats and health for system status endpoint."""
    if not is_redis_available():
        return {"status": "offline", "enabled": REDIS_ENABLED, "url": REDIS_URL}
    try:
        info = await _redis_client.info()
        return {
            "status": "online",
            "enabled": True,
            "url": REDIS_URL,
            "version": info.get("redis_version", "unknown"),
            "used_memory_human": info.get("used_memory_human", "0B"),
            "connected_clients": info.get("connected_clients", 0),
            "uptime_in_seconds": info.get("uptime_in_seconds", 0),
        }
    except Exception as e:
        return {"status": "error", "error": str(e), "enabled": REDIS_ENABLED, "url": REDIS_URL}
