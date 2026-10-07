"""
VIGILIX AI — FastAPI Application
Autonomous Traffic & Cabin Compliance Monitoring System
"""

import asyncio
import json
import os
import time
from pathlib import Path
from typing import Optional

# pyrefly: ignore [missing-import]
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Request
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse, Response
# pyrefly: ignore [missing-import]
from fastapi.staticfiles import StaticFiles

import database as db
from camera_manager import CameraManager
from config import SNAPSHOTS_DIR, HOST, PORT
import redis_service
import minio_service
import webrtc_service

# ── App Setup ─────────────────────────────────────────────────────────────────
app = FastAPI(title="VIGILIX AI", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Will be initialized on startup
camera_manager: Optional[CameraManager] = None

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


# ── Startup / Shutdown ────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    global camera_manager
    db.init_db()
    await redis_service.init_redis()
    await minio_service.init_minio()
    loop = asyncio.get_event_loop()
    camera_manager = CameraManager(loop)
    await camera_manager.load_existing_cameras()
    await camera_manager.auto_detect_cameras()


@app.on_event("shutdown")
async def shutdown():
    await webrtc_service.close_all_webrtc_connections()
    await redis_service.close_redis()



# ── WebSocket: Live Camera Stream ─────────────────────────────────────────────
@app.websocket("/ws/camera/{camera_id}")
async def ws_camera(websocket: WebSocket, camera_id: int):
    await websocket.accept()
    camera_manager.subscribe(camera_id, websocket)
    try:
        while True:
            # Keep alive: handle any incoming messages (config updates, etc.)
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                msg = json.loads(data)
                if msg.get("type") == "update_config":
                    await camera_manager.update_config(camera_id, msg.get("config", {}))
                elif msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except asyncio.TimeoutError:
                await websocket.send_text(json.dumps({"type": "ping"}))
    except WebSocketDisconnect:
        pass
    finally:
        camera_manager.unsubscribe(camera_id, websocket)


# ── Cameras API ───────────────────────────────────────────────────────────────
@app.get("/api/cameras")
async def list_cameras():
    cams = await db.get_all_cameras()
    result = []
    for cam in cams:
        status = await camera_manager.get_status(cam["id"])
        result.append({**cam, "runtime_status": status})
    return result


@app.post("/api/cameras")
async def add_camera(data: dict):
    result = await camera_manager.add_camera(data)
    return result


@app.delete("/api/cameras/{cam_id}")
async def remove_camera(cam_id: int):
    await camera_manager.remove_camera(cam_id)
    return {"status": "removed"}


@app.get("/api/cameras/{cam_id}")
async def get_camera(cam_id: int):
    cam = await db.get_camera(cam_id)
    if not cam:
        raise HTTPException(404, "Camera not found")
    status = await camera_manager.get_status(cam_id)
    return {**cam, "runtime_status": status}


@app.put("/api/cameras/{cam_id}/config")
async def update_camera_config(cam_id: int, data: dict):
    await camera_manager.update_config(cam_id, data)
    return {"status": "updated"}


@app.post("/api/cameras/{cam_id}/detection/start")
async def start_detection(cam_id: int):
    await camera_manager.start_detection(cam_id)
    return {"status": "started"}


@app.post("/api/cameras/{cam_id}/detection/switch")
async def switch_detection(cam_id: int):
    await camera_manager.switch_active_stream(cam_id)
    return {"status": "switched", "active_camera_id": cam_id}


@app.post("/api/cameras/{cam_id}/detection/stop")
async def stop_detection(cam_id: int):
    await camera_manager.stop_detection(cam_id)
    return {"status": "stopped"}


@app.post("/api/cameras/detect")
async def auto_detect():
    found = await camera_manager.auto_detect_cameras()
    return {"found": len(found), "cameras": found}


@app.get("/api/test-videos")
async def list_test_videos():
    """List available test video files in data/test_videos/."""
    from config import TEST_VIDEOS_DIR
    videos = []
    if TEST_VIDEOS_DIR.exists():
        for f in sorted(TEST_VIDEOS_DIR.glob("*.mp4")):
            videos.append({"filename": f.name, "path": str(f), "size_mb": round(f.stat().st_size / 1e6, 1)})
    return videos



# ── Events API ────────────────────────────────────────────────────────────────
@app.get("/api/events")
async def list_events(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    camera_id: Optional[int] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    event_category: Optional[str] = None,
):
    return await db.get_events(page, per_page, camera_id, status, date_from, date_to, event_category)


@app.get("/api/events/ids")
async def list_event_ids(
    camera_id: Optional[int] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    event_category: Optional[str] = None,
):
    ids = await db.get_event_ids(camera_id, status, date_from, date_to, event_category)
    return {"ids": ids, "total": len(ids)}


@app.get("/api/events/stats")
async def event_stats():
    return await db.get_event_stats()


@app.put("/api/events/{event_id}/status")
async def update_event_status(event_id: int, data: dict):
    await db.update_event_status(event_id, data.get("status", "Pending"))
    return {"status": "updated"}


@app.delete("/api/events/{event_id}")
async def delete_event(event_id: int):
    """Delete a single event and its snapshot file."""
    await db.delete_event(event_id)
    return {"status": "deleted"}


@app.post("/api/events/bulk-delete")
async def bulk_delete_events(data: dict):
    """Delete multiple events by ID list."""
    ids = data.get("ids", [])
    if not ids:
        raise HTTPException(400, "No event IDs provided")
    await db.delete_events_bulk(ids)
    return {"status": "deleted", "count": len(ids)}


@app.delete("/api/events")
async def delete_all_events():
    """Delete ALL events from the database."""
    count = await db.delete_all_events()
    return {"status": "deleted", "count": count}


@app.post("/api/cameras/{cam_id}/webrtc/offer")
async def webrtc_offer(cam_id: int, data: dict):
    """WebRTC signaling endpoint for browser video streaming."""
    offer_sdp = data.get("sdp")
    offer_type = data.get("type", "offer")
    if not offer_sdp:
        raise HTTPException(400, "Missing SDP offer")
    answer = await webrtc_service.handle_webrtc_offer(cam_id, offer_sdp, offer_type)
    if not answer:
        raise HTTPException(500, "Failed to negotiate WebRTC session")
    return answer


# ── Snapshots ─────────────────────────────────────────────────────────────────
@app.get("/api/snapshots/{filename}")
async def get_snapshot(filename: str):
    img_bytes = await minio_service.get_snapshot_bytes(filename)
    if not img_bytes:
        raise HTTPException(404, "Snapshot not found")
    return Response(content=img_bytes, media_type="image/jpeg")


# ── Settings API ──────────────────────────────────────────────────────────────
@app.get("/api/settings")
async def get_settings():
    return await db.get_settings()


@app.put("/api/settings")
async def save_settings(data: dict):
    await db.save_settings(data)
    from settings_loader import reload_runtime_settings
    reload_runtime_settings()
    await camera_manager.restart_all_streams()
    return {"status": "saved"}


# ── System Status ─────────────────────────────────────────────────────────────
def _get_gpu_usage():
    try:
        import subprocess
        res = subprocess.run(["nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=2)
        if res.returncode == 0:
            return float(res.stdout.strip())
    except Exception:
        pass
    return None

@app.get("/api/system/status")
async def system_status():
    try:
        import psutil
        cpu  = psutil.cpu_percent(interval=0.1)
        mem  = psutil.virtual_memory().percent
        disk = psutil.disk_usage("C:\\" if os.name == "nt" else "/").percent
        gpu  = _get_gpu_usage()
    except Exception:
        cpu, mem, disk, gpu = 0, 0, 0, None

    redis_info = await redis_service.get_redis_info()
    minio_info = await minio_service.get_minio_info()

    return {
        "status": "running",
        "cpu_usage": cpu,
        "memory_usage": mem,
        "disk_usage": disk,
        "gpu_usage": gpu,
        "redis": redis_info,
        "minio": minio_info,
    }


@app.post("/api/system/reset")
async def system_reset():
    camera_manager.stop_all_streams()
    await db.reset_database()
    from settings_loader import reload_runtime_settings
    reload_runtime_settings()
    return {"status": "success", "message": "Database reset successfully"}



# ── MJPEG Streaming ──────────────────────────────────────────────────────────
@app.get("/api/cameras/{cam_id}/stream")
async def mjpeg_stream(cam_id: int):
    """MJPEG stream — much more efficient than base64-over-WebSocket."""
    async def generate():
        camera_manager.increment_mjpeg_viewers(cam_id)
        try:
            # Adaptive boot-up wait: wait up to 3 seconds for the camera thread to spin up
            for _ in range(30):
                stream = camera_manager.get_stream(cam_id)
                if stream and stream.is_running:
                    break
                await asyncio.sleep(0.1)

            while True:
                stream = camera_manager.get_stream(cam_id)
                if not stream or not stream.is_running:
                    break
                if hasattr(stream, '_latest_frame') and stream._latest_frame is not None:
                    yield (b"--frame\r\n"
                           b"Content-Type: image/jpeg\r\n\r\n" +
                           stream._latest_frame + b"\r\n")
                fps_cap = getattr(stream, "target_fps", 25)
                await asyncio.sleep(1.0 / max(1, fps_cap))
        finally:
            camera_manager.decrement_mjpeg_viewers(cam_id)

    return StreamingResponse(
        generate(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ── Frontend Production Static Files (dist) ───────────────────────────────────
FRONTEND_DIST = FRONTEND_DIR / "dist"
STATIC_DIR = FRONTEND_DIST if (FRONTEND_DIST / "index.html").exists() else FRONTEND_DIR
ASSETS_DIR = STATIC_DIR / "assets"

if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="frontend_assets")
elif STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR)), name="frontend_assets")


@app.get("/")
async def serve_index():
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return JSONResponse({"status": "Safety Stop AI running — frontend production build not found. Run 'bun run build' in frontend/"})


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # Try serving exact file if it exists in static dir
    file_path = STATIC_DIR / full_path
    if file_path.exists() and file_path.is_file():
        return FileResponse(str(file_path))
    # Fall back to index.html for SPA client-side routing
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(str(index))
    raise HTTPException(404)

