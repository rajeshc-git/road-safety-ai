import sqlite3
import threading
from config import DB_PATH

_cached_settings = {}
_cache_lock = threading.Lock()

def reload_runtime_settings():
    """Force reload settings from the SQLite database into memory cache."""
    global _cached_settings
    try:
        with sqlite3.connect(DB_PATH) as conn:
            cur = conn.execute("SELECT key, value FROM settings")
            new_settings = {row[0]: row[1] for row in cur.fetchall()}
            with _cache_lock:
                _cached_settings = new_settings
            return new_settings
    except Exception:
        return _cached_settings

def get_runtime_settings():
    """Get settings from memory cache instantly. Ultra-fast, thread-safe, and avoids disk I/O."""
    global _cached_settings
    with _cache_lock:
        if not _cached_settings:
            try:
                with sqlite3.connect(DB_PATH) as conn:
                    cur = conn.execute("SELECT key, value FROM settings")
                    _cached_settings = {row[0]: row[1] for row in cur.fetchall()}
            except Exception:
                pass
        return _cached_settings.copy()

def get_setting(key, default=None):
    return get_runtime_settings().get(key, default)
