"""
Safety Stop AI — Database Layer
SQLite models and query helpers using aiosqlite.
"""

import sqlite3
import json
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, List, Dict, Any

# pyrefly: ignore [missing-import]
import aiosqlite

from config import DB_PATH


# ── Schema ────────────────────────────────────────────────────────────────────
SCHEMA = """
CREATE TABLE IF NOT EXISTS cameras (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    source      TEXT    NOT NULL,           -- int index OR rtsp URL
    cam_type    TEXT    NOT NULL DEFAULT 'webcam',
    resolution  TEXT,
    fps         REAL,
    status      TEXT    NOT NULL DEFAULT 'offline',
    config_json TEXT    NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    camera_id     INTEGER NOT NULL,
    camera_name   TEXT    NOT NULL,
    timestamp     TEXT    NOT NULL,
    event_type    TEXT    NOT NULL DEFAULT 'Did Not Stop',
    vehicle_id    INTEGER,
    status        TEXT    NOT NULL DEFAULT 'Pending',
    snapshot_path TEXT,
    metadata_json TEXT    NOT NULL DEFAULT '{}',
    FOREIGN KEY (camera_id) REFERENCES cameras(id)
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_camera  ON events(camera_id);
CREATE INDEX IF NOT EXISTS idx_events_ts      ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_status  ON events(status);
"""

DEFAULT_SETTINGS = {
    "speed_threshold": "0.1",
    "stop_duration": "0.6",
    "detection_confidence": "0.5",
    "processing_fps": "25",
    "snapshot_quality": "high",
    "save_snapshots": "true",
    "auto_start_detection": "false",
    "processing_mode": "AUTO",
    "dms_eye_close_threshold": "1.5",
    "dms_yawn_threshold": "2.0",
    "dms_phone_distraction_threshold": "1.0",
    "dms_look_away_threshold": "3.0",
    "dms_alert_beep": "true",
}


# ── Init ──────────────────────────────────────────────────────────────────────
def init_db():
    """Synchronous one-time init at startup."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript(SCHEMA)
        for key, value in DEFAULT_SETTINGS.items():
            conn.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (key, value),
            )
        conn.commit()


# ── Async helpers ─────────────────────────────────────────────────────────────
async def get_db():
    return await aiosqlite.connect(DB_PATH)


# ── Cameras ───────────────────────────────────────────────────────────────────
async def get_all_cameras() -> List[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM cameras ORDER BY id") as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def get_camera(cam_id: int) -> Optional[Dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM cameras WHERE id=?", (cam_id,)) as cur:
            row = await cur.fetchone()
    return dict(row) if row else None


async def upsert_camera(data: Dict) -> int:
    async with aiosqlite.connect(DB_PATH) as db:
        cam_type = data.get("cam_type", data.get("type", "webcam"))
        if "id" in data and data["id"]:
            await db.execute(
                """UPDATE cameras SET name=?, source=?, cam_type=?, resolution=?,
                   fps=?, status=?, config_json=? WHERE id=?""",
                (
                    data["name"], data["source"], cam_type,
                    data.get("resolution"), data.get("fps"),
                    data.get("status", "offline"),
                    json.dumps(data.get("config", {})), data["id"],
                ),
            )
            await db.commit()
            return data["id"]
        else:
            cur = await db.execute(
                """INSERT INTO cameras (name, source, cam_type, resolution, fps, status, config_json)
                   VALUES (?,?,?,?,?,?,?)""",
                (
                    data["name"], data["source"], cam_type,
                    data.get("resolution"), data.get("fps"),
                    data.get("status", "offline"),
                    json.dumps(data.get("config", {})),
                ),
            )
            await db.commit()
            return cur.lastrowid


async def update_camera_status(cam_id: int, status: str, resolution: str = None, fps: float = None):
    async with aiosqlite.connect(DB_PATH) as db:
        if resolution and fps:
            await db.execute(
                "UPDATE cameras SET status=?, resolution=?, fps=? WHERE id=?",
                (status, resolution, fps, cam_id),
            )
        else:
            await db.execute("UPDATE cameras SET status=? WHERE id=?", (status, cam_id))
        await db.commit()


async def update_camera_config(cam_id: int, config: Dict):
    async with aiosqlite.connect(DB_PATH) as db:
        # Read existing config and MERGE (don't replace) to preserve stop_line etc.
        async with db.execute("SELECT config_json FROM cameras WHERE id=?", (cam_id,)) as cur:
            row = await cur.fetchone()
        existing = json.loads(row[0]) if row and row[0] else {}
        existing.update(config)
        await db.execute(
            "UPDATE cameras SET config_json=? WHERE id=?",
            (json.dumps(existing), cam_id),
        )
        await db.commit()



async def delete_camera(cam_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM cameras WHERE id=?", (cam_id,))
        await db.commit()


# ── Events ────────────────────────────────────────────────────────────────────
async def insert_event(
    camera_id: int,
    camera_name: str,
    event_type: str = "Did Not Stop",
    vehicle_id: int = None,
    snapshot_path: str = None,
    metadata: Dict = None,
) -> int:
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    async with aiosqlite.connect(DB_PATH) as db:
        cur = await db.execute(
            """INSERT INTO events (camera_id, camera_name, timestamp, event_type,
               vehicle_id, status, snapshot_path, metadata_json)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                camera_id, camera_name, ts, event_type,
                vehicle_id, "Pending", snapshot_path,
                json.dumps(metadata or {}),
            ),
        )
        await db.commit()
        return cur.lastrowid


async def get_events(
    page: int = 1,
    per_page: int = 10,
    camera_id: Optional[int] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    event_category: Optional[str] = None,  # "all", "traffic", "dms"
) -> Dict:
    conditions, params = [], []
    if camera_id:
        conditions.append("camera_id=?"); params.append(camera_id)
    if status and status != "All Status":
        conditions.append("status=?"); params.append(status)
    if date_from:
        conditions.append("timestamp>=?"); params.append(date_from)
    if date_to:
        conditions.append("timestamp<=?"); params.append(date_to + " 23:59:59")
        
    if event_category == "traffic":
        conditions.append("event_type IN ('Did Not Stop', 'Did Not Stop (Pedestrian Crossing)')")
    elif event_category == "dms":
        conditions.append("event_type NOT IN ('Did Not Stop', 'Did Not Stop (Pedestrian Crossing)')")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(f"SELECT COUNT(*) FROM events {where}", params) as cur:
            total = (await cur.fetchone())[0]
        offset = (page - 1) * per_page
        async with db.execute(
            f"SELECT * FROM events {where} ORDER BY timestamp DESC LIMIT ? OFFSET ?",
            params + [per_page, offset],
        ) as cur:
            rows = await cur.fetchall()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": max(1, -(-total // per_page)),
        "items": [dict(r) for r in rows],
    }


async def get_event_stats() -> Dict:
    today = datetime.now().strftime("%Y-%m-%d")
    week_start = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT COUNT(*) FROM events WHERE timestamp>=?", (today,)
        ) as cur:
            today_count = (await cur.fetchone())[0]
        async with db.execute(
            "SELECT COUNT(*) FROM events WHERE timestamp>=?", (week_start,)
        ) as cur:
            week_count = (await cur.fetchone())[0]
        async with db.execute(
            "SELECT COUNT(*) FROM events WHERE status='Pending'"
        ) as cur:
            pending_count = (await cur.fetchone())[0]
        async with db.execute(
            "SELECT COUNT(*) FROM cameras WHERE status='online'"
        ) as cur:
            active_cams = (await cur.fetchone())[0]
    return {
        "events_today": today_count,
        "events_week": week_count,
        "pending_review": pending_count,
        "active_cameras": active_cams,
    }


async def update_event_status(event_id: int, status: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE events SET status=? WHERE id=?", (status, event_id))
        await db.commit()



async def delete_event(event_id: int):
    """Delete a single event and its snapshot file."""
    from config import SNAPSHOTS_DIR
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT snapshot_path FROM events WHERE id=?", (event_id,)) as cur:
            row = await cur.fetchone()
        if row and row[0]:
            snap = SNAPSHOTS_DIR / Path(row[0]).name
            if snap.exists():
                snap.unlink(missing_ok=True)
        await db.execute("DELETE FROM events WHERE id=?", (event_id,))
        await db.commit()


async def delete_events_bulk(ids: list):
    """Delete multiple events by a list of IDs."""
    from config import SNAPSHOTS_DIR
    if not ids:
        return
    placeholders = ",".join("?" for _ in ids)
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(f"SELECT snapshot_path FROM events WHERE id IN ({placeholders})", ids) as cur:
            rows = await cur.fetchall()
        for row in rows:
            if row[0]:
                snap = SNAPSHOTS_DIR / Path(row[0]).name
                if snap.exists():
                    snap.unlink(missing_ok=True)
        await db.execute(f"DELETE FROM events WHERE id IN ({placeholders})", ids)
        await db.commit()


async def delete_all_events() -> int:
    """Delete ALL events and clean up all snapshot files."""
    from config import SNAPSHOTS_DIR
    import os
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT COUNT(*) FROM events") as cur:
            count = (await cur.fetchone())[0]
        await db.execute("DELETE FROM events")
        await db.commit()
    # Clean snapshots directory
    if SNAPSHOTS_DIR.exists():
        for f in SNAPSHOTS_DIR.iterdir():
            if f.suffix in ('.jpg', '.jpeg', '.png'):
                f.unlink(missing_ok=True)
    return count


# ── Settings ──────────────────────────────────────────────────────────────────
async def get_settings() -> Dict:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT key, value FROM settings") as cur:
            rows = await cur.fetchall()
    return {r["key"]: r["value"] for r in rows}


async def save_settings(data: Dict):
    async with aiosqlite.connect(DB_PATH) as db:
        for key, value in data.items():
            await db.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?,?)",
                (key, str(value)),
            )
        await db.commit()


async def reset_database():
    from config import SNAPSHOTS_DIR
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM cameras")
        await db.execute("DELETE FROM events")
        await db.execute("DELETE FROM settings")
        for key, value in DEFAULT_SETTINGS.items():
            await db.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?)",
                (key, value),
            )
        await db.commit()
    # Clean snapshots directory
    if SNAPSHOTS_DIR.exists():
        for f in SNAPSHOTS_DIR.iterdir():
            if f.suffix in ('.jpg', '.jpeg', '.png'):
                f.unlink(missing_ok=True)
