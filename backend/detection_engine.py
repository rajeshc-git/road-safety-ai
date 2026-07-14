"""
Safety Stop AI — Detection Engine
Per-camera YOLO detection + ByteTrack tracking in a background thread.
"""

import threading
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Optional, Dict, Callable, List, Tuple


# pyrefly: ignore [missing-import]
import cv2 as cv
import numpy as np
# pyrefly: ignore [missing-import]
from ultralytics import YOLO
# pyrefly: ignore [missing-import]
import supervision as sv

from config import (
    YOLO_MODEL_PATH, DMS_YOLO_MODEL_PATH, DEFAULT_CONFIDENCE, DEFAULT_PROCESSING_FPS,
    JPEG_QUALITY, VEHICLE_CLASSES, PERSON_CLASS, MIN_TRACKED_FRAMES,
    STOP_LINE_TOLERANCE_PX, PEDESTRIAN_ZONE_MARGIN,
)

_model: Optional[YOLO] = None
_model_lock = threading.Lock()

_dms_model: Optional[YOLO] = None
_dms_model_lock = threading.Lock()


def get_model() -> YOLO:
    global _model
    with _model_lock:
        if _model is None:
            _model = YOLO(str(YOLO_MODEL_PATH))
    return _model


def get_dms_model() -> YOLO:
    """Singleton loader for the custom 8-class DMS YOLO model (best.pt)."""
    global _dms_model
    with _dms_model_lock:
        if _dms_model is None:
            _dms_model = YOLO(str(DMS_YOLO_MODEL_PATH))
            print(f"  [DMS] Loaded custom model: {DMS_YOLO_MODEL_PATH}")
            print(f"  [DMS] Classes: {_dms_model.names}")
    return _dms_model


def get_selected_classes(model: YOLO):
    vehicle_ids, person_ids = [], []
    for cls_id, name in model.names.items():
        if name in VEHICLE_CLASSES:
            vehicle_ids.append(cls_id)
        elif name == PERSON_CLASS:
            person_ids.append(cls_id)
    return vehicle_ids, person_ids


from settings_loader import get_runtime_settings

class TrackHistory:
    """Per-vehicle tracking state.
    
    Stop detection uses **displacement-based** logic (industry standard):
    - While a vehicle is inside the drawn zone, we measure how many
      consecutive frames it stays nearly stationary (displacement < threshold).
    - If it stays still for STOP_CONFIRM_FRAMES in a row, has_stopped = True.
    - This is robust against tracker jitter (bounding boxes wobble 2-5px even
      for parked cars).
    """
    STOP_DISPLACEMENT_PX = 10.0   # max px movement per inference update to count as "still" (covers tracker jitter ~2-5px)
    STOP_CONFIRM_FRAMES  = 5      # consecutive still inference-updates needed to confirm stop (5 × 3 frames ≈ 15 real frames ≈ 0.6s at 25fps)

    def __init__(self, maxlen: int = 30):
        self.positions: deque = deque(maxlen=maxlen)
        self.timestamps: deque = deque(maxlen=maxlen)
        self.frame_count: int = 0
        self.violation_reported: bool = False
        self.last_violation_time: float = 0.0

        # Zone-aware stop compliance state
        self.in_zone: bool = False
        self.in_zone_idx: int = -1            # which zone the vehicle is currently inside
        self.has_stopped: bool = False
        self.zones_stopped: set = set()       # set of zone indices where vehicle confirmed a stop
        self.consecutive_still_frames: int = 0
        self._position_fresh: bool = False     # True only when update() recorded a genuinely new position

    def update(self, cx: float, cy: float):
        self.positions.append((cx, cy))
        self.timestamps.append(time.time())
        self.frame_count += 1
        self._position_fresh = True  # Mark that a genuinely new position was recorded

    def frame_displacement(self) -> float:
        """Pixel displacement between the last two recorded positions."""
        if len(self.positions) < 2:
            return 0.0
        x1, y1 = self.positions[-2]
        x2, y2 = self.positions[-1]
        return ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5

    def estimate_speed_px(self) -> float:
        if len(self.positions) < 2:
            return 0.0
        displacements = []
        n = min(5, len(self.positions))
        for i in range(1, n):
            dx = self.positions[-i][0] - self.positions[-i-1][0]
            dy = self.positions[-i][1] - self.positions[-i-1][1]
            dt = self.timestamps[-i] - self.timestamps[-i-1]
            if dt > 0:
                displacements.append(((dx**2 + dy**2) ** 0.5) / dt)
        return sum(displacements) / len(displacements) if displacements else 0.0


class CameraStream:
    def __init__(self, camera_id: int, camera_name: str, source,
                 on_frame: Callable, on_violation: Callable, config: Optional[Dict] = None):
        self.camera_id    = camera_id
        self.camera_name  = camera_name
        self.source       = source
        self.on_frame     = on_frame
        self.on_violation = on_violation
        self.config       = config or {}
        self._stop_event  = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._lock        = threading.Lock()
        self.model        = get_model()
        self.dms_model    = get_dms_model() if (config or {}).get("mode") == "driver" else None
        self.vehicle_ids, self.person_ids = get_selected_classes(self.model)
        self.tracker      = sv.ByteTrack()
        self.smoother     = sv.DetectionsSmoother()
        self.track_history: Dict[int, TrackHistory] = defaultdict(TrackHistory)
        self.is_running   = False
        self.fps_actual   = 0.0
        self.frame_size   = (0, 0)
        self.detection_on = True
        self.tracking_on  = True
        self._latest_frame: Optional[bytes] = None  # for MJPEG streaming
        self.dms_state = {
            "eye_closed_start": None,
            "yawn_start": None,
            "look_away_start": None,
            "phone_use_start": None,
            "last_alert_time": {},
            "attention_score": 100.0,
            "drowsiness_level": 0.0,
            "violation_active_state": {},
            "violation_last_seen_time": {},
        }

    @property
    def camera_mode(self) -> str:
        return self.config.get("mode", "traffic")

    @property
    def stop_line(self) -> Optional[Dict]:
        return self.config.get("stop_line")

    @property
    def stop_lines(self) -> List[Dict]:
        """Return all stop lines. Falls back to wrapping single stop_line for backward compat."""
        sl_list = self.config.get("stop_lines")
        if sl_list and isinstance(sl_list, list):
            return sl_list
        single = self.stop_line
        return [single] if single else []

    @property
    def stop_zones(self) -> List[List[Dict[str, float]]]:
        """Return all stop zones. Falls back to wrapping single stop_zone or converting stop_lines."""
        zones = self.config.get("stop_zones")
        if zones and isinstance(zones, list):
            return zones

        single = self.config.get("stop_zone")
        if single and isinstance(single, list) and len(single) == 4:
            return [single]

        # Convert stop_lines to 4-point quadrilateral zones
        lines = self.stop_lines
        if lines:
            converted = []
            for line in lines:
                converted.append([
                    {"x": line["x1"], "y": line["y1"]}, # P1
                    {"x": line["x2"], "y": line["y2"]}, # P2
                    {"x": line["x2"], "y": line["y2"] + 150}, # P3
                    {"x": line["x1"], "y": line["y1"] + 150}, # P4
                ])
            return converted

        return []

    def _point_in_polygon(self, px: float, py: float, polygon: List[Dict[str, float]]) -> bool:
        """Check if point (px, py) is inside a 4-point polygon using OpenCV's pointPolygonTest."""
        if not polygon or len(polygon) != 4:
            return False
        pts = np.array([[pt["x"], pt["y"]] for pt in polygon], dtype=np.int32)
        pts = pts.reshape((-1, 1, 2))
        dist = cv.pointPolygonTest(pts, (px, py), False)
        return dist >= 0


    @property
    def confidence(self) -> float:
        global_conf = get_runtime_settings().get("detection_confidence")
        if global_conf: return float(global_conf)
        return float(self.config.get("confidence", DEFAULT_CONFIDENCE))

    @property
    def target_fps(self) -> int:
        global_fps = get_runtime_settings().get("processing_fps")
        if global_fps: return int(global_fps)
        return int(self.config.get("processing_fps", DEFAULT_PROCESSING_FPS))


    def update_config(self, new_config: Dict):
        with self._lock:
            self.config.update(new_config)
        if "stop_zones" in new_config:
            sz_list = new_config["stop_zones"]
            if sz_list and isinstance(sz_list, list):
                print(f"  [CAM {self.camera_id}] ✅ {len(sz_list)} stop zone(s) LOADED")
                for i, sz in enumerate(sz_list):
                    print(f"    Zone {i+1}: {len(sz)} point(s) loaded")
            else:
                print(f"  [CAM {self.camera_id}] Stop zones cleared")
        elif "stop_zone" in new_config:
            sz = new_config["stop_zone"]
            if sz:
                print(f"  [CAM {self.camera_id}] ✅ Stop zone LOADED: {len(sz)} point(s)")
            else:
                print(f"  [CAM {self.camera_id}] Stop zone cleared")
        elif "stop_lines" in new_config:
            sl_list = new_config["stop_lines"]
            if sl_list and isinstance(sl_list, list):
                print(f"  [CAM {self.camera_id}] ✅ {len(sl_list)} stop line(s) LOADED (migrated to zones)")
            else:
                print(f"  [CAM {self.camera_id}] Stop lines cleared")
        else:
            print(f"  [CAM {self.camera_id}] Config updated: {list(new_config.keys())}")


    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name=f"cam-{self.camera_id}")
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        self.is_running = False
        def wait_and_clear():
            if self._thread:
                self._thread.join(timeout=2)
        threading.Thread(target=wait_and_clear, daemon=True).start()

    def _run(self):
        src = int(self.source) if str(self.source).isdigit() else self.source
        cap = cv.VideoCapture(src)
        if not cap.isOpened():
            return
        self.is_running = True
        width  = int(cap.get(cv.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv.CAP_PROP_FRAME_HEIGHT))
        cam_fps = cap.get(cv.CAP_PROP_FPS) or 25
        self.frame_size = (width, height)
        self.tracker = sv.ByteTrack(frame_rate=int(cam_fps))

        thickness  = sv.calculate_optimal_line_thickness((width, height))
        text_scale = sv.calculate_optimal_text_scale((width, height))
        box_ann    = sv.RoundBoxAnnotator(thickness=thickness, color_lookup=sv.ColorLookup.TRACK)
        label_ann  = sv.LabelAnnotator(
            text_scale=text_scale, text_thickness=thickness,
            text_position=sv.Position.TOP_CENTER, color_lookup=sv.ColorLookup.TRACK)

        frame_interval = 1.0 / max(1, self.target_fps)
        last_frame_time = 0.0
        fps_counter, fps_timer = 0, time.time()

        # Device selection: AUTO (default) | GPU (force) | CPU (force)
        device = "cpu"
        try:
            import sqlite3
            from config import DB_PATH
            with sqlite3.connect(DB_PATH) as conn:
                cur = conn.execute("SELECT value FROM settings WHERE key='processing_mode'")
                row = cur.fetchone()
                mode = (row[0].upper() if row else "AUTO")

            # pyrefly: ignore [missing-import]
            import torch
            import shutil
            import subprocess

            gpu_physically_present = False
            gpu_name = ""
            if shutil.which("nvidia-smi"):
                try:
                    res = subprocess.run(["nvidia-smi", "-L"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                    if res.returncode == 0 and res.stdout.strip():
                        gpu_physically_present = True
                        gpu_name = res.stdout.strip().split("\n")[0]
                except Exception:
                    pass

            if mode == "CPU":
                device = "cpu"
                print(f"  [CAM {self.camera_id}] Forced CPU mode (user setting)")
            elif mode == "GPU":
                if torch.cuda.is_available():
                    device = 0
                    print(f"  [CAM {self.camera_id}] Forced GPU mode: {torch.cuda.get_device_name(0)}")
                else:
                    device = "cpu"
                    print(f"  [CAM {self.camera_id}] GPU forced but PyTorch CUDA support is not available. Falling back to CPU.")
                    if gpu_physically_present:
                        print(f"  [SYSTEM WARNING] ⚠️ NVIDIA GPU ('{gpu_name}') detected via system drivers, but PyTorch is CPU-only.")
                        print(f"  [SYSTEM TIP] To enable GPU acceleration, reinstall PyTorch with CUDA support:")
                        print(f"               pip install torch --index-url https://download.pytorch.org/whl/cu121")
            else:  # AUTO (default)
                if torch.cuda.is_available():
                    device = 0
                    print(f"  [CAM {self.camera_id}] Auto-detected GPU: {torch.cuda.get_device_name(0)}")
                else:
                    device = "cpu"
                    print(f"  [CAM {self.camera_id}] Auto-detected: no compatible PyTorch CUDA device, using CPU.")
                    if gpu_physically_present:
                        print(f"  [SYSTEM WARNING] ⚠️ NVIDIA GPU ('{gpu_name}') detected via system drivers, but PyTorch is CPU-only.")
                        print(f"  [SYSTEM TIP] To enable GPU acceleration, reinstall PyTorch with CUDA support:")
                        print(f"               pip install torch --index-url https://download.pytorch.org/whl/cu121")
        except Exception:
            pass



        # Initialize MediaPipe Face Landmarker for DMS (new Tasks API — mp 0.10+)
        face_mesh = None
        if self.camera_mode == "driver":
            try:
                # pyrefly: ignore [missing-import]
                import mediapipe as mp
                import urllib.request, tempfile, os
                # Download the Face Landmarker model task file if not already present
                model_path = str(
                    (Path(__file__).parent.parent / "data" / "face_landmarker.task")
                )
                if not os.path.exists(model_path):
                    os.makedirs(os.path.dirname(model_path), exist_ok=True)
                    print(f"  [CAM {self.camera_id}] ⬇️  Downloading face_landmarker.task...")
                    urllib.request.urlretrieve(
                        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                        model_path,
                    )
                    print(f"  [CAM {self.camera_id}] ✅ Model downloaded to {model_path}")

                BaseOptions      = mp.tasks.BaseOptions
                FaceLandmarker   = mp.tasks.vision.FaceLandmarker
                FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
                VisionRunningMode = mp.tasks.vision.RunningMode

                options = FaceLandmarkerOptions(
                    base_options=BaseOptions(model_asset_path=model_path),
                    running_mode=VisionRunningMode.IMAGE,
                    num_faces=1,
                    min_face_detection_confidence=0.5,
                    min_face_presence_confidence=0.5,
                    min_tracking_confidence=0.5,
                    output_face_blendshapes=False,
                    output_facial_transformation_matrixes=False,
                )
                face_mesh = FaceLandmarker.create_from_options(options)
                print(f"  [CAM {self.camera_id}] ✅ MediaPipe FaceLandmarker (Tasks API) initialized successfully.")
            except Exception as e:
                import traceback; traceback.print_exc()
                print(f"  [CAM {self.camera_id}] ❌ Error loading MediaPipe: {e}")

        while not self._stop_event.is_set():
            now = time.time()
            
            # Dynamic lazy throttling: run at target_fps if actively watched, otherwise drop to a power-saving 10 FPS
            current_target = self.target_fps if getattr(self, "has_subscribers", False) else min(10, self.target_fps)
            frame_interval = 1.0 / max(1, current_target)

            elapsed = now - last_frame_time
            if elapsed < frame_interval:
                sleep_time = frame_interval - elapsed
                if sleep_time > 0.001:
                    is_live = not (isinstance(src, str) and not src.isdigit())
                    if is_live:
                        # For live streams, sleep a short duration to yield CPU but wake up often enough to read and clear buffers
                        time.sleep(min(sleep_time, 0.02))
                    else:
                        # For video files, sleep the entire duration for maximum power saving
                        time.sleep(sleep_time)
                continue

            ret, frame = cap.read()
            if not ret:
                # If it's a local video file, let's rewind and loop automatically for seamless testing!
                if isinstance(src, str) and not src.isdigit():
                    cap.set(cv.CAP_PROP_POS_FRAMES, 0)
                    time.sleep(0.15)
                    last_frame_time = time.time()
                    continue
                else:
                    time.sleep(0.05)
                    continue
            
            last_frame_time = time.time()
            annotated = frame.copy()

            if self.detection_on:
                try:
                    if self.camera_mode == "driver":
                        self._process_dms(frame, annotated, device, face_mesh)
                    else:
                        self.dms_state["yolo_traffic_count"] = self.dms_state.get("yolo_traffic_count", 0) + 1
                        is_inference_frame = (self.dms_state["yolo_traffic_count"] % 3 == 0 or 
                                              "last_traffic_detections" not in self.dms_state)

                        if is_inference_frame:
                            use_half = isinstance(device, int) or (isinstance(device, str) and "cuda" in device.lower())
                            # Blazing-fast inference downsampling: imgsz=416 (imgsz=384 for CPU fallback)
                            img_sz = 384 if device == "cpu" else 416
                            results = self.model(frame, conf=self.confidence, imgsz=img_sz, half=use_half, device=device, verbose=False)[0]
                            detections = sv.Detections.from_ultralytics(results)

                            if self.tracking_on:
                                detections = self.tracker.update_with_detections(detections)
                                detections = self.smoother.update_with_detections(detections)
                            self.dms_state["last_traffic_detections"] = detections
                        else:
                            # Re-use tracking coordinates from the last inference frame to maintain seamless visual tracking at 0 computing cost!
                            detections = self.dms_state["last_traffic_detections"]

                        veh_mask = np.isin(detections.class_id, self.vehicle_ids)
                        ped_mask = np.isin(detections.class_id, self.person_ids)
                        veh_dets = detections[veh_mask]
                        ped_dets = detections[ped_mask]

                        if veh_dets.tracker_id is not None and is_inference_frame:
                            for tid, bottom_center in zip(
                                veh_dets.tracker_id,
                                veh_dets.get_anchors_coordinates(sv.Position.BOTTOM_CENTER)):
                                self.track_history[tid].update(*bottom_center)

                        if veh_dets.tracker_id is not None and len(veh_dets) > 0:
                            labels = []
                            for tid, cid in zip(veh_dets.tracker_id, veh_dets.class_id):
                                hist = self.track_history.get(tid)
                                if hist and getattr(hist, "has_stopped", False):
                                    labels.append(f"#{tid} {self.model.names[int(cid)]} [STOPPED]")
                                else:
                                    labels.append(f"#{tid} {self.model.names[int(cid)]}")
                            box_ann.annotate(annotated, veh_dets)
                            label_ann.annotate(annotated, veh_dets, labels)

                            # Overlay bright green highlight for compliant stopped vehicles
                            for tid, box in zip(veh_dets.tracker_id, veh_dets.xyxy):
                                hist = self.track_history.get(tid)
                                if hist and getattr(hist, "has_stopped", False):
                                    x1, y1, x2, y2 = map(int, box)
                                    cv.rectangle(annotated, (x1, y1), (x2, y2), (0, 220, 60), 3)
                                    cv.rectangle(annotated, (x1, y1 - 25), (x1 + 175, y1), (0, 220, 60), cv.FILLED)
                                    cv.putText(annotated, "STOPPED (COMPLIANT)", (x1 + 5, y1 - 8),
                                               cv.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 2, cv.LINE_AA)

                        if len(ped_dets) > 0:
                            for box in ped_dets.xyxy:
                                x1, y1, x2, y2 = map(int, box)
                                cv.rectangle(annotated, (x1, y1), (x2, y2), (255, 120, 0), thickness)
                                cv.putText(annotated, "Person", (x1, y1 - 6),
                                           cv.FONT_HERSHEY_SIMPLEX, text_scale, (255, 120, 0), thickness)

                        # Check violations on every frame (not just inference frames) so zone enter/exit is never missed
                        if len(self.stop_zones) > 0 and veh_dets.tracker_id is not None:
                            self._check_violations(frame, annotated, veh_dets, ped_dets)
                except Exception as e:
                    import traceback
                    traceback.print_exc()

            if self.camera_mode != "driver":
                self._draw_stop_zones(annotated)

            # Skip expensive JPEG compression completely if no active viewers are streaming!
            if getattr(self, "has_subscribers", False):
                ok, buf = cv.imencode(".jpg", annotated, [cv.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
                if ok:
                    frame_bytes = buf.tobytes()
                    self._latest_frame = frame_bytes  # for MJPEG streaming
                    self.on_frame(self.camera_id, frame_bytes, {
                        "fps": round(self.fps_actual, 1),
                        "width": width, "height": height,
                        "detection": self.detection_on,
                        "tracking": self.tracking_on,
                        "camera_name": self.camera_name,
                        "mode": self.camera_mode,
                        "attention_score": round(self.dms_state.get("attention_score", 100.0), 1),
                        "drowsiness_level": round(self.dms_state.get("drowsiness_level", 0.0), 1),
                        "active_violations": list(self.dms_state.get("active_violations", [])) if self.camera_mode == "driver" else [],
                    })
            else:
                self._latest_frame = None

            fps_counter += 1
            if now - fps_timer >= 1.0:
                self.fps_actual = fps_counter / (now - fps_timer)
                fps_counter = 0
                fps_timer = now

        cap.release()
        if face_mesh is not None:
            try:
                face_mesh.close()
            except Exception:
                pass
        self.is_running = False

    def _check_violations(self, raw_frame, annotated, veh_dets, ped_dets):
        """Zone-based stop compliance check.
        
        The correct logic (per Roboflow / industry research):
        1. When a vehicle ENTERS the drawn zone → start monitoring displacement.
        2. While INSIDE the zone, count consecutive frames where the car barely
           moved (displacement < STOP_DISPLACEMENT_PX). If it stays still for
           STOP_CONFIRM_FRAMES in a row → has_stopped = True.
        3. When the vehicle EXITS the zone (leaves the polygon):
           - If has_stopped is True → compliant, no violation.
           - If has_stopped is False → violation ("Did Not Stop").
        
        This replaces the old speed-threshold approach which was unreliable
        because tracker bounding-box jitter causes non-zero speed even for
        parked cars.
        """
        from config import VIOLATION_COOLDOWN_SEC
        all_zones = self.stop_zones
        if not all_zones:
            return

        # Read stop duration from UI settings (default 0.6s) and convert to inference-frame count
        # At ~8 inference updates/sec (24fps ÷ 3), 0.6s ≈ 5 inference frames
        stop_duration_sec = float(get_runtime_settings().get("stop_duration", "0.6"))
        inferences_per_sec = max(1, self.target_fps / 3.0)
        stop_confirm_frames = max(2, round(stop_duration_sec * inferences_per_sec))

        # Pedestrian zone checks
        ped_near_any_line = False
        if len(ped_dets) > 0:
            for box in ped_dets.xyxy:
                px1, py1, px2, py2 = box
                pcx, pcy = (px1 + px2) / 2, (py1 + py2) / 2
                for zone in all_zones:
                    if len(zone) == 4:
                        if self._point_in_polygon(pcx, pcy, zone):
                            ped_near_any_line = True
                            break
                        p1_x, p1_y = zone[0]["x"], zone[0]["y"]
                        p2_x, p2_y = zone[1]["x"], zone[1]["y"]
                        if self._point_near_line(pcx, pcy, p1_x, p1_y, p2_x, p2_y, PEDESTRIAN_ZONE_MARGIN * 2):
                            ped_near_any_line = True
                            break
                if ped_near_any_line:
                    break

        now = time.time()
        for tid, bottom_center, box in zip(
            veh_dets.tracker_id,
            veh_dets.get_anchors_coordinates(sv.Position.BOTTOM_CENTER),
            veh_dets.xyxy,
        ):
            bx, by = float(bottom_center[0]), float(bottom_center[1])
            hist = self.track_history[tid]

            if len(hist.positions) < 2:
                continue

            # Is the vehicle currently inside ANY stop zone?
            currently_in_any_zone = False
            for zone_idx, zone in enumerate(all_zones):
                if len(zone) != 4:
                    continue

                in_zone = self._point_in_polygon(bx, by, zone)

                if in_zone:
                    currently_in_any_zone = True

                    # ── INSIDE THE ZONE: monitor displacement ──
                    if not hist.in_zone or hist.in_zone_idx != zone_idx:
                        # Vehicle just ENTERED this zone (or switched zones)
                        hist.in_zone = True
                        hist.in_zone_idx = zone_idx
                        hist.has_stopped = False
                        hist.violation_reported = False   # Reset so this zone can be evaluated fresh
                        hist.consecutive_still_frames = 0

                    # Check frame-to-frame displacement — ONLY on frames with fresh position data
                    # (On cached/non-inference frames, displacement is artificially 0 since the bbox is reused)
                    if hist._position_fresh:
                        hist._position_fresh = False
                        disp = hist.frame_displacement()
                        if disp < TrackHistory.STOP_DISPLACEMENT_PX:
                            hist.consecutive_still_frames += 1
                        else:
                            hist.consecutive_still_frames = 0

                    # If the car stayed still long enough → it stopped
                    if hist.consecutive_still_frames >= stop_confirm_frames:
                        hist.has_stopped = True
                        hist.zones_stopped.add(zone_idx)

                elif hist.in_zone and hist.in_zone_idx == zone_idx and not in_zone:
                    # ── Vehicle just EXITED this specific zone ──
                    hist.in_zone = False
                    hist.in_zone_idx = -1

                    if zone_idx not in hist.zones_stopped:
                        # Car drove through the zone without stopping → VIOLATION
                        if (hist.frame_count >= MIN_TRACKED_FRAMES
                                and not hist.violation_reported
                                and (now - hist.last_violation_time >= VIOLATION_COOLDOWN_SEC)):
                            hist.violation_reported = True
                            hist.last_violation_time = now
                            cv.rectangle(annotated,
                                         (int(box[0]), int(box[1])), (int(box[2]), int(box[3])),
                                         (0, 0, 255), 3)
                            cv.putText(annotated, "VIOLATION!", (int(box[0]), int(box[1]) - 10),
                                       cv.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
                            self.on_violation(
                                self.camera_id, self.camera_name,
                                int(tid), raw_frame.copy(),
                                tuple(map(int, box)), ped_near_any_line,
                                "Did Not Stop", zone_idx,
                            )
                    # Reset displacement counter (do NOT break — continue checking other zones)
                    hist.consecutive_still_frames = 0

            # If the vehicle is not in any zone anymore, make sure in_zone is cleared
            if not currently_in_any_zone and hist.in_zone:
                prev_zone_idx = hist.in_zone_idx
                hist.in_zone = False
                hist.in_zone_idx = -1
                if prev_zone_idx not in hist.zones_stopped:
                    if (hist.frame_count >= MIN_TRACKED_FRAMES
                            and not hist.violation_reported
                            and (now - hist.last_violation_time >= VIOLATION_COOLDOWN_SEC)):
                        hist.violation_reported = True
                        hist.last_violation_time = now
                        cv.rectangle(annotated,
                                     (int(box[0]), int(box[1])), (int(box[2]), int(box[3])),
                                     (0, 0, 255), 3)
                        cv.putText(annotated, "VIOLATION!", (int(box[0]), int(box[1]) - 10),
                                   cv.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
                        self.on_violation(
                            self.camera_id, self.camera_name,
                            int(tid), raw_frame.copy(),
                            tuple(map(int, box)), ped_near_any_line,
                            "Did Not Stop", max(0, prev_zone_idx),
                        )
                hist.consecutive_still_frames = 0

    def _line_intersection(self, p1, q1, p2, q2) -> bool:
        """Check if line segment p1q1 and p2q2 intersect."""
        def on_segment(p, q, r):
            return q[0] <= max(p[0], r[0]) and q[0] >= min(p[0], r[0]) and \
                   q[1] <= max(p[1], r[1]) and q[1] >= min(p[1], r[1])

        def orientation(p, q, r):
            val = (float(q[1]) - p[1]) * (r[0] - q[0]) - (float(q[0]) - p[0]) * (r[1] - q[1])
            if val > 0: return 1
            if val < 0: return 2
            return 0

        o1 = orientation(p1, q1, p2)
        o2 = orientation(p1, q1, q2)
        o3 = orientation(p2, q2, p1)
        o4 = orientation(p2, q2, q1)

        if (o1 != o2) and (o3 != o4): return True
        if (o1 == 0) and on_segment(p1, p2, q1): return True
        if (o2 == 0) and on_segment(p1, q2, q1): return True
        if (o3 == 0) and on_segment(p2, p1, q2): return True
        if (o4 == 0) and on_segment(p2, q1, q2): return True
        return False

    def _point_near_line(self, px, py, x1, y1, x2, y2, tolerance) -> bool:
        dx, dy = x2 - x1, y2 - y1
        if dx == 0 and dy == 0:
            return False
        t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
        dist = (((px - x1 - t * dx) ** 2 + (py - y1 - t * dy) ** 2) ** 0.5)
        return dist <= tolerance


    def _draw_stop_zones(self, frame):
        """Draw all 4-point stop zones and their stop lines with distinct colors."""
        all_zones = self.stop_zones
        if not all_zones:
            return

        # Distinct BGR colors for each zone boundary
        zone_colors_bgr = [
            (0, 0, 255),     # Red
            (235, 130, 59),  # Blue/Orange
            (0, 158, 245),   # Amber
            (129, 185, 16),  # Green
            (246, 92, 139),  # Purple
            (153, 72, 236),  # Pink
        ]
        color_white = (255, 255, 255)
        color_red = (0, 0, 255)

        for idx, zone in enumerate(all_zones):
            if len(zone) != 4:
                continue
                
            color = zone_colors_bgr[idx % len(zone_colors_bgr)]
            
            # 1. Draw Translucent Filled Stopping Zone (2D polygon representation)
            overlay = frame.copy()
            pts = np.array([[int(pt["x"]), int(pt["y"])] for pt in zone], dtype=np.int32)
            pts = pts.reshape((-1, 1, 2))
            cv.fillPoly(overlay, [pts], color)
            # Blend overlay with 15% opacity
            cv.addWeighted(overlay, 0.15, frame, 0.85, 0, frame)

            # 2. Draw Stop Line (Exit threshold between P1 and P2) as a bold dashed line
            p1_x, p1_y = int(zone[0]["x"]), int(zone[0]["y"])
            p2_x, p2_y = int(zone[1]["x"]), int(zone[1]["y"])
            dist = ((p2_x - p1_x) ** 2 + (p2_y - p1_y) ** 2) ** 0.5
            if dist > 10:
                dash_len = 16
                for d in range(0, int(dist), dash_len * 2):
                    r1 = d / dist
                    r2 = min((d + dash_len) / dist, 1.0)
                    sx = int(p1_x + (p2_x - p1_x) * r1)
                    sy = int(p1_y + (p2_y - p1_y) * r1)
                    ex = int(p1_x + (p2_x - p1_x) * r2)
                    ey = int(p1_y + (p2_y - p1_y) * r2)
                    cv.line(frame, (sx, sy), (ex, ey), color_red, 4, cv.LINE_AA)
            else:
                cv.line(frame, (p1_x, p1_y), (p2_x, p2_y), color_red, 4, cv.LINE_AA)

            # 3. Draw remaining boundary lines as solid lines
            for i in range(1, 4):
                start_pt = zone[i]
                end_pt = zone[(i + 1) % 4]
                cv.line(frame, 
                        (int(start_pt["x"]), int(start_pt["y"])), 
                        (int(end_pt["x"]), int(end_pt["y"])), 
                        color, 2, cv.LINE_AA)

            # 4. Draw Corner Nodes (Vertices)
            for p_idx, pt in enumerate(zone):
                node_color = color_red if p_idx < 2 else color
                cv.circle(frame, (int(pt["x"]), int(pt["y"])), 12, color_white, -1, cv.LINE_AA)
                cv.circle(frame, (int(pt["x"]), int(pt["y"])), 12, node_color, 2, cv.LINE_AA)
                # Label the node number inside
                cv.putText(frame, str(p_idx + 1), (int(pt["x"]) - 5, int(pt["y"]) + 4),
                           cv.FONT_HERSHEY_SIMPLEX, 0.45, node_color, 2, cv.LINE_AA)

            # 5. Draw Label Box
            lx, ly = (p1_x, p1_y) if p1_x <= p2_x else (p2_x, p2_y)
            label = f"STOP ZONE {idx + 1}" if len(all_zones) > 1 else "STOP ZONE"
            font = cv.FONT_HERSHEY_SIMPLEX
            font_scale = 0.6
            thickness = 2
            (tw, th), baseline = cv.getTextSize(label, font, font_scale, thickness)
            
            pad = 8
            bx1 = lx - tw - pad * 2 if lx > tw + 40 else lx + 30
            by1 = ly - th - pad * 2
            bx2 = bx1 + tw + pad * 2
            by2 = by1 + th + pad * 2
            
            cv.rectangle(frame, (bx1, by1), (bx2, by2), color_red, cv.FILLED)
            cv.putText(frame, label, (bx1 + pad, by2 - pad - 2), font, font_scale, color_white, 2, cv.LINE_AA)



    def _draw_info_overlay(self, frame, w, h):
        overlay = frame.copy()
        cv.rectangle(overlay, (8, 8), (280, 110), (10, 14, 26), cv.FILLED)
        cv.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)
        cv.putText(frame, "Camera Info", (18, 28),
                   cv.FONT_HERSHEY_SIMPLEX, 0.55, (180, 180, 200), 1)
        cv.putText(frame, f"Source: {self.source}", (18, 48),
                   cv.FONT_HERSHEY_SIMPLEX, 0.45, (140, 200, 140), 1)
        cv.putText(frame, f"Res: {w}x{h}", (18, 65),
                   cv.FONT_HERSHEY_SIMPLEX, 0.45, (140, 200, 140), 1)
        cv.putText(frame, f"FPS: {self.fps_actual:.1f}", (18, 82),
                   cv.FONT_HERSHEY_SIMPLEX, 0.45, (140, 200, 140), 1)
        color = (0, 220, 60) if self.is_running else (60, 60, 200)
        cv.putText(frame, f"Status: {'Online' if self.is_running else 'Offline'}",
                   (18, 99), cv.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)


    def _trigger_dms_violation(self, frame, box, event_type: str):
        """Trigger a DMS safety alert with an built-in cooldown."""
        import time
        from settings_loader import get_runtime_settings
        now = time.time()
        
        # State-Machine Check: Suppress repeated database logs for a continuous violation
        if self.dms_state.get("violation_active_state", {}).get(event_type, False):
            return

        # Hierarchical Cooldown: Suppress generic Attention Warning if any specific DMS alert was triggered recently
        if event_type == "Distraction: Attention Warning":
            specific_types = [
                "Drowsiness: Sleep", "Drowsiness: Yawning", "Distraction: Looking Away",
                "Distraction: Phone Use", "Distraction: Smoking", "Distraction: Eating",
                "Distraction: Drinking", "Drowsiness: Drowsy Driving", "Distraction: Driver Distracted"
            ]
            for st in specific_types:
                last_st = self.dms_state["last_alert_time"].get(st, 0.0)
                if now - last_st < 10.0:
                    return

        # 8-second cooldown per alert type to avoid database flooding
        cooldown = 8.0
        last_triggered = self.dms_state["last_alert_time"].get(event_type, 0.0)
        if now - last_triggered < cooldown:
            return
            
        self.dms_state["last_alert_time"][event_type] = now
        self.dms_state["violation_active_state"][event_type] = True
        
        self.on_violation(
            self.camera_id,
            self.camera_name,
            0,  # vehicle_id is 0 for driver events
            frame,
            box,
            False,  # pedestrian_involved is False
            event_type, # Pass custom event type
        )

    def _process_dms(self, frame, annotated, device, face_mesh):
        import time
        import numpy as np
        # pyrefly: ignore [missing-import]
        import supervision as sv
        from settings_loader import get_runtime_settings
        
        if face_mesh is None:
            return
            
        h, w = frame.shape[:2]
        
        # ── ADAPTIVE FRAME SKIPPING (To let CPU/GPU breathe) ──────────────────
        if "dms_frame_index" not in self.dms_state:
            self.dms_state["dms_frame_index"] = 0
            self.dms_state["last_driver_face"] = None
            self.dms_state["last_eyes_status"] = "OPEN"
            self.dms_state["last_attention_status"] = "FOCUSED"

        self.dms_state["dms_frame_index"] += 1

        is_focused = (
            self.dms_state.get("attention_score", 100.0) >= 80.0
            and len(self.dms_state.get("active_violations", [])) == 0
            and self.dms_state.get("eye_closed_start") is None
            and self.dms_state.get("yawn_start") is None
            and self.dms_state.get("look_away_start") is None
            and self.dms_state.get("phone_use_start") is None
        )

        skip_interval = 5 if is_focused else 1
        should_run_inference = (self.dms_state["dms_frame_index"] % skip_interval == 0)

        if not should_run_inference:
            # Re-use cached states and positions for skipped frames to prevent GUI flicker
            eyes_status = self.dms_state.get("last_eyes_status", "OPEN")
            attention_status = self.dms_state.get("last_attention_status", "FOCUSED")
            driver_face = self.dms_state.get("last_driver_face")
            
            # Draw cached YOLO bounding boxes
            dms_boxes = self.dms_state.get("last_dms_detections", [])
            dms_colors = {
                "Distracted":  (0, 150, 255),
                "Drinking":    (255, 165, 0),
                "Drowsy":      (50, 50, 255),
                "Eating":      (0, 200, 255),
                "PhoneUse":    (0, 70, 255),
                "SafeDriving": (46, 225, 110),
                "Seatbelt":    (230, 180, 50),
                "Smoking":     (80, 50, 220),
            }
            dms_labels = {
                "Distracted":  "DISTRACTED",
                "Drinking":    "DRINKING",
                "Drowsy":      "DROWSY",
                "Eating":      "EATING",
                "PhoneUse":    "PHONE USE",
                "SafeDriving": "SAFE DRIVING",
                "Seatbelt":    "SEATBELT ON",
                "Smoking":     "SMOKING",
            }
            for box, cls_name, conf_val in dms_boxes:
                px1, py1, px2, py2 = box
                color = dms_colors.get(cls_name, (200, 200, 200))
                label = dms_labels.get(cls_name, cls_name.upper())
                cv.rectangle(annotated, (px1, py1), (px2, py2), color, 2, cv.LINE_AA)
                cv.putText(annotated, f"{label} {conf_val:.0%}", (px1, py1 - 6),
                           cv.FONT_HERSHEY_SIMPLEX, 0.45, color, 2, cv.LINE_AA)
            
            hud_bg = (15, 11, 24)
            white = (245, 248, 255)
            green = (46, 225, 110)
            orange = (0, 150, 255)
            red = (50, 50, 255)
            status_colors = {
                "FOCUSED": green,
                "DROWSY": red,
                "YAWNING": orange,
                "DISTRACTED": orange,
                "PHONE_USE": red,
                "EATING": orange,
                "DRINKING": orange,
                "SMOKING": red,
                "SEATBELT_UNFASTENED": red,
            }
            status_color = status_colors.get(attention_status, green)
            
            if driver_face is not None:
                x, y, fw, fh = driver_face
                cv.rectangle(annotated, (x, y), (x+fw, y+fh), status_color, 3, cv.LINE_AA)
                cv.putText(annotated, f"DRIVER: {attention_status}", (x, y - 8), 
                           cv.FONT_HERSHEY_SIMPLEX, 0.55, status_color, 2, cv.LINE_AA)
                           
            overlay = annotated.copy()
            cv.rectangle(overlay, (10, 10), (330, 175), hud_bg, cv.FILLED)
            cv.addWeighted(overlay, 0.8, annotated, 0.2, 0, annotated)
            cv.putText(annotated, "CABIN MONITOR SYSTEM (DMS)", (20, 28), cv.FONT_HERSHEY_SIMPLEX, 0.42, (150, 155, 170), 1, cv.LINE_AA)
            cv.putText(annotated, f"Attention Score: {self.dms_state['attention_score']:.1f}%", (20, 52), cv.FONT_HERSHEY_SIMPLEX, 0.42, white, 1, cv.LINE_AA)
            bar_w = int(self.dms_state['attention_score'] * 1.6)
            cv.rectangle(annotated, (20, 62), (180, 71), (40, 42, 50), cv.FILLED)
            cv.rectangle(annotated, (20, 62), (20 + bar_w, 71), green if self.dms_state['attention_score'] > 50 else red, cv.FILLED)
            cv.putText(annotated, f"Fatigue Level: {self.dms_state['drowsiness_level']:.1f}%", (20, 92), cv.FONT_HERSHEY_SIMPLEX, 0.42, white, 1, cv.LINE_AA)
            d_bar_w = int(self.dms_state['drowsiness_level'] * 1.6)
            cv.rectangle(annotated, (20, 102), (180, 111), (40, 42, 50), cv.FILLED)
            cv.rectangle(annotated, (20, 102), (20 + d_bar_w, 111), red if self.dms_state['drowsiness_level'] > 40 else green, cv.FILLED)
            cv.putText(annotated, f"Eyes: {eyes_status}", (20, 132), cv.FONT_HERSHEY_SIMPLEX, 0.42, green if eyes_status=="OPEN" else red if eyes_status=="CLOSED" else white, 1, cv.LINE_AA)
            cv.putText(annotated, f"State: {attention_status}", (20, 152), cv.FONT_HERSHEY_SIMPLEX, 0.42, status_color, 1, cv.LINE_AA)
            return

        # ── INFERENCE PATH (Process frame with MediaPipe & YOLO) ───────────────
        # MediaPipe Tasks API requires an mp.Image wrapper around the RGB frame
        # pyrefly: ignore [missing-import]
        import mediapipe as mp
        rgb = cv.cvtColor(frame, cv.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        results = face_mesh.detect(mp_image)
        
        eyes_status = "UNKNOWN"
        attention_status = "FOCUSED"
        drowsy_level_delta = -1.2   # Fatigue decays when no drowsiness is detected
        attention_score_delta = 0.8  # Attention recovers when focused
        
        current_frame_violations = set()
        
        driver_face = None
        x, y, fw, fh = 0, 0, 0, 0
        
        # Helper to convert normalized landmark (NormalizedLandmark) to pixel coordinate
        # In the Tasks API each landmark has .x .y .z (all normalized 0-1)
        def get_pt(landmarks_list, idx):
            lm = landmarks_list[idx]
            return np.array([lm.x * w, lm.y * h])
            
        # Helper to calculate Eye Aspect Ratio (EAR)
        def calculate_ear(landmarks_list, eye_indices):
            pt1 = get_pt(landmarks_list, eye_indices[0])
            pt2 = get_pt(landmarks_list, eye_indices[1])
            pt3 = get_pt(landmarks_list, eye_indices[2])
            pt4 = get_pt(landmarks_list, eye_indices[3])
            pt5 = get_pt(landmarks_list, eye_indices[4])
            pt6 = get_pt(landmarks_list, eye_indices[5])
            
            vertical1 = np.linalg.norm(pt2 - pt6)
            vertical2 = np.linalg.norm(pt3 - pt5)
            horizontal = np.linalg.norm(pt1 - pt4)
            
            if horizontal < 0.001:
                return 0.0
            return (vertical1 + vertical2) / (2.0 * horizontal)
            
        # Helper to calculate Mouth Aspect Ratio (MAR)
        def calculate_mar(landmarks_list, mouth_indices):
            pt1 = get_pt(landmarks_list, mouth_indices[0])
            pt2 = get_pt(landmarks_list, mouth_indices[1])
            pt3 = get_pt(landmarks_list, mouth_indices[2])
            pt4 = get_pt(landmarks_list, mouth_indices[3])
            pt5 = get_pt(landmarks_list, mouth_indices[4])
            pt6 = get_pt(landmarks_list, mouth_indices[5])
            
            vertical1 = np.linalg.norm(pt2 - pt6)
            vertical2 = np.linalg.norm(pt3 - pt5)
            horizontal = np.linalg.norm(pt1 - pt4)
            
            if horizontal < 0.001:
                return 0.0
            return (vertical1 + vertical2) / (2.0 * horizontal)

        # Tasks API: results.face_landmarks is a list-of-lists (one per face)
        if results.face_landmarks:
            landmarks = results.face_landmarks[0]   # plain list of NormalizedLandmark
            
            # 1. EAR Drowsiness Check
            left_ear = calculate_ear(landmarks, [33, 160, 158, 133, 153, 144])
            right_ear = calculate_ear(landmarks, [263, 385, 387, 362, 380, 373])
            avg_ear = (left_ear + right_ear) / 2.0
            
            # Eye closure threshold mapping
            ear_thresh = 0.18
            if avg_ear < ear_thresh:
                eyes_status = "CLOSED"
                drowsy_level_delta = 5.0
                attention_score_delta = -4.0
                if self.dms_state["eye_closed_start"] is None:
                    self.dms_state["eye_closed_start"] = time.time()
                else:
                    duration = time.time() - self.dms_state["eye_closed_start"]
                    eye_thresh = float(get_runtime_settings().get("dms_eye_close_threshold", "1.5"))
                    if duration >= eye_thresh:
                        attention_status = "DROWSY"
                        current_frame_violations.add("Drowsiness: Sleep")
                        x_coords = [lm.x * w for lm in landmarks]
                        y_coords = [lm.y * h for lm in landmarks]
                        xmin, xmax = int(min(x_coords)), int(max(x_coords))
                        ymin, ymax = int(min(y_coords)), int(max(y_coords))
                        self._trigger_dms_violation(frame, (xmin, ymin, xmax - xmin, ymax - ymin), "Drowsiness: Sleep")
            else:
                eyes_status = "OPEN"
                self.dms_state["eye_closed_start"] = None
                
            # 2. MAR Yawning Check
            mar = calculate_mar(landmarks, [78, 81, 311, 308, 402, 178])
            yawn_thresh = 0.55
            if mar > yawn_thresh:
                if self.dms_state["yawn_start"] is None:
                    self.dms_state["yawn_start"] = time.time()
                else:
                    duration = time.time() - self.dms_state["yawn_start"]
                    yawn_thresh_s = float(get_runtime_settings().get("dms_yawn_threshold", "2.0"))
                    drowsy_level_delta = 4.0
                    attention_score_delta = -3.5
                    if duration >= yawn_thresh_s:
                        attention_status = "YAWNING"
                        current_frame_violations.add("Drowsiness: Yawning")
                        x_coords = [lm.x * w for lm in landmarks]
                        y_coords = [lm.y * h for lm in landmarks]
                        xmin, xmax = int(min(x_coords)), int(max(x_coords))
                        ymin, ymax = int(min(y_coords)), int(max(y_coords))
                        self._trigger_dms_violation(frame, (xmin, ymin, xmax - xmin, ymax - ymin), "Drowsiness: Yawning")
            else:
                self.dms_state["yawn_start"] = None
                
            self.dms_state["look_away_start"] = None
            
            # Compute face bounding box coordinates
            x_coords = [lm.x * w for lm in landmarks]
            y_coords = [lm.y * h for lm in landmarks]
            xmin, xmax = int(min(x_coords)), int(max(x_coords))
            ymin, ymax = int(min(y_coords)), int(max(y_coords))
            x, y, fw, fh = xmin, ymin, xmax - xmin, ymax - ymin
            driver_face = (x, y, fw, fh)
            
            # Draw facial landmarks on the annotated frame
            for idx in [33, 133, 160, 158, 153, 144, 263, 362, 385, 387, 380, 373, 78, 308, 81, 311, 402, 178]:
                pt = get_pt(landmarks, idx)
                cv.circle(annotated, (int(pt[0]), int(pt[1])), 2, (0, 255, 66), -1, cv.LINE_AA)
        else:
            # 4. Looking Away Check (No Face Detected)
            eyes_status = "UNKNOWN"
            attention_status = "DISTRACTED"
            attention_score_delta = -3.5
            if self.dms_state["look_away_start"] is None:
                self.dms_state["look_away_start"] = time.time()
            else:
                duration = time.time() - self.dms_state["look_away_start"]
                look_away_thresh = float(get_runtime_settings().get("dms_look_away_threshold", "3.0"))
                if duration >= look_away_thresh:
                    current_frame_violations.add("Distraction: Looking Away")
                    fb = (int(w*0.25), int(h*0.25), int(w*0.5), int(h*0.5))
                    self._trigger_dms_violation(frame, fb, "Distraction: Looking Away")
                    
        # 5. Custom DMS YOLO Detection (8-class best.pt: Distracted, Drinking, Drowsy, Eating, PhoneUse, SafeDriving, Seatbelt, Smoking)
        try:
            if self.dms_model is not None:
                run_yolo = (skip_interval > 1) or (self.dms_state.get("yolo_frame_count", 0) % 3 == 0) or ("last_dms_detections" not in self.dms_state)
                
                if run_yolo:
                    self.dms_state["yolo_frame_count"] = self.dms_state.get("yolo_frame_count", 0) + 1
                    use_half = isinstance(device, int) or (isinstance(device, str) and "cuda" in device.lower())
                    results_yolo = self.dms_model(frame, conf=self.confidence, imgsz=320, half=use_half, device=device, verbose=False)[0]
                    detections = sv.Detections.from_ultralytics(results_yolo)
                    
                    cached_boxes = []
                    for box, cid, conf_val in zip(detections.xyxy, detections.class_id, detections.confidence):
                        cls_name = self.dms_model.names[int(cid)]
                        cached_boxes.append((list(map(int, box)), cls_name, float(conf_val)))
                    self.dms_state["last_dms_detections"] = cached_boxes
                    
                dms_boxes = self.dms_state.get("last_dms_detections", [])
                
                dms_colors = {
                    "Distracted":  (0, 150, 255),
                    "Drinking":    (255, 165, 0),
                    "Drowsy":      (50, 50, 255),
                    "Eating":      (0, 200, 255),
                    "PhoneUse":    (0, 70, 255),
                    "SafeDriving": (46, 225, 110),
                    "Seatbelt":    (230, 180, 50),
                    "Smoking":     (80, 50, 220),
                }
                dms_labels = {
                    "Distracted":  "DISTRACTED",
                    "Drinking":    "DRINKING",
                    "Drowsy":      "DROWSY",
                    "Eating":      "EATING",
                    "PhoneUse":    "PHONE USE",
                    "SafeDriving": "SAFE DRIVING",
                    "Seatbelt":    "SEATBELT ON",
                    "Smoking":     "SMOKING",
                }
                dms_violation_map = {
                    "Distracted":  "Distraction: Driver Distracted",
                    "Drinking":    "Distraction: Drinking",
                    "Drowsy":      "Drowsiness: Drowsy Driving",
                    "Eating":      "Distraction: Eating",
                    "PhoneUse":    "Distraction: Phone Use",
                    "Smoking":     "Distraction: Smoking",
                }
                dms_penalties = {
                    "Distracted": -6.0,
                    "Drinking":   -5.0,
                    "Drowsy":     -8.0,
                    "Eating":     -4.0,
                    "PhoneUse":   -8.0,
                    "Smoking":    -5.0,
                }
                
                detected_classes = {cls_name for _, cls_name, _ in dms_boxes}

                if "PhoneUse" in detected_classes:
                    if self.dms_state.get("phone_use_start") is None:
                        self.dms_state["phone_use_start"] = time.time()
                    else:
                        duration = time.time() - self.dms_state["phone_use_start"]
                        phone_thresh = float(get_runtime_settings().get("dms_phone_distraction_threshold", "1.0"))
                        if duration >= phone_thresh:
                            current_frame_violations.add("Distraction: Phone Use")
                else:
                    self.dms_state["phone_use_start"] = None

                for box, cls_name, conf_val in dms_boxes:
                    px1, py1, px2, py2 = box
                    color = dms_colors.get(cls_name, (200, 200, 200))
                    label = dms_labels.get(cls_name, cls_name.upper())
                    
                    cv.rectangle(annotated, (px1, py1), (px2, py2), color, 2, cv.LINE_AA)
                    cv.putText(annotated, f"{label} {conf_val:.0%}", (px1, py1 - 6),
                               cv.FONT_HERSHEY_SIMPLEX, 0.45, color, 2, cv.LINE_AA)
                    
                    if cls_name in ("SafeDriving", "Seatbelt"):
                        continue
                    
                    violation_type = dms_violation_map.get(cls_name)
                    if violation_type:
                        if cls_name == "PhoneUse":
                            if "Distraction: Phone Use" in current_frame_violations:
                                self._trigger_dms_violation(frame, (px1, py1, px2 - px1, py2 - py1), violation_type)
                        else:
                            current_frame_violations.add(violation_type)
                            self._trigger_dms_violation(frame, (px1, py1, px2 - px1, py2 - py1), violation_type)
                    
                    penalty = dms_penalties.get(cls_name, -3.0)
                    attention_score_delta = min(attention_score_delta, penalty)
                    
                    if cls_name == "Drowsy":
                        drowsy_level_delta = max(drowsy_level_delta, 6.0)

                if "Drowsiness: Sleep" in current_frame_violations:
                    attention_status = "DROWSY"
                elif "Distraction: Phone Use" in current_frame_violations:
                    attention_status = "PHONE_USE"
                elif "Distraction: Smoking" in current_frame_violations:
                    attention_status = "SMOKING"
                elif "Drowsiness: Yawning" in current_frame_violations:
                    attention_status = "YAWNING"
                elif "Distraction: Eating" in current_frame_violations:
                    attention_status = "EATING"
                elif "Distraction: Drinking" in current_frame_violations:
                    attention_status = "DRINKING"
                elif any(v in current_frame_violations for v in ("Distraction: Driver Distracted", "Distraction: Looking Away")):
                    attention_status = "DISTRACTED"
                elif "SafeDriving" in detected_classes:
                    attention_status = "FOCUSED"
        except Exception:
            import traceback; traceback.print_exc()
            
        self.dms_state["drowsiness_level"] = max(0.0, min(100.0, self.dms_state["drowsiness_level"] + drowsy_level_delta))
        self.dms_state["attention_score"] = max(0.0, min(100.0, self.dms_state["attention_score"] + attention_score_delta))

        # Suppress generic Attention Warning if a specific DMS violation is active in the current frame
        has_specific_violation = any(
            v in current_frame_violations 
            for v in ["Drowsiness: Sleep", "Drowsiness: Yawning", "Distraction: Looking Away", 
                      "Distraction: Phone Use", "Distraction: Smoking", "Distraction: Eating", 
                      "Distraction: Drinking", "Drowsiness: Drowsy Driving", "Distraction: Driver Distracted"]
        )
        if self.dms_state["attention_score"] < 50.0 and not has_specific_violation:
            current_frame_violations.add("Distraction: Attention Warning")
            attention_status = "DISTRACTED"
            fb = driver_face if driver_face is not None else (int(w * 0.25), int(h * 0.25), int(w * 0.5), int(h * 0.5))
            self._trigger_dms_violation(frame, fb, "Distraction: Attention Warning")

        self.dms_state["active_violations"] = list(current_frame_violations)
        
        # Update state-machine active state and last seen timers
        all_dms_event_types = [
            "Drowsiness: Sleep", "Drowsiness: Yawning", "Distraction: Looking Away",
            "Distraction: Phone Use", "Distraction: Smoking", "Distraction: Eating",
            "Distraction: Drinking", "Drowsiness: Drowsy Driving", "Distraction: Driver Distracted",
            "Distraction: Attention Warning"
        ]
        now_dms = time.time()
        for et in all_dms_event_types:
            if et in current_frame_violations:
                self.dms_state["violation_last_seen_time"][et] = now_dms
            else:
                last_seen = self.dms_state["violation_last_seen_time"].get(et, 0.0)
                if now_dms - last_seen >= 5.0:  # 5 seconds recovery period
                    self.dms_state["violation_active_state"][et] = False

        # Save values to cache for skipped frames
        self.dms_state["last_driver_face"] = driver_face
        self.dms_state["last_eyes_status"] = eyes_status
        self.dms_state["last_attention_status"] = attention_status
        
        hud_bg = (15, 11, 24)
        white = (245, 248, 255)
        green = (46, 225, 110)
        orange = (0, 150, 255)
        red = (50, 50, 255)
        
        status_colors = {
            "FOCUSED": green,
            "DROWSY": red,
            "YAWNING": orange,
            "DISTRACTED": orange,
            "PHONE_USE": red,
            "EATING": orange,
            "DRINKING": orange,
            "SMOKING": red,
            "SEATBELT_UNFASTENED": red,
        }
        status_color = status_colors.get(attention_status, green)
        
        if driver_face is not None:
            cv.rectangle(annotated, (x, y), (x+fw, y+fh), status_color, 3, cv.LINE_AA)
            cv.putText(annotated, f"DRIVER: {attention_status}", (x, y - 8), 
                       cv.FONT_HERSHEY_SIMPLEX, 0.55, status_color, 2, cv.LINE_AA)
                       
        overlay = annotated.copy()
        cv.rectangle(overlay, (10, 10), (330, 175), hud_bg, cv.FILLED)
        cv.addWeighted(overlay, 0.8, annotated, 0.2, 0, annotated)
        
        cv.putText(annotated, "CABIN MONITOR SYSTEM (DMS)", (20, 28), cv.FONT_HERSHEY_SIMPLEX, 0.42, (150, 155, 170), 1, cv.LINE_AA)
        cv.putText(annotated, f"Attention Score: {self.dms_state['attention_score']:.1f}%", (20, 52), cv.FONT_HERSHEY_SIMPLEX, 0.42, white, 1, cv.LINE_AA)
        bar_w = int(self.dms_state['attention_score'] * 1.6)
        cv.rectangle(annotated, (20, 62), (180, 71), (40, 42, 50), cv.FILLED)
        cv.rectangle(annotated, (20, 62), (20 + bar_w, 71), green if self.dms_state['attention_score'] > 50 else red, cv.FILLED)
        
        cv.putText(annotated, f"Fatigue Level: {self.dms_state['drowsiness_level']:.1f}%", (20, 92), cv.FONT_HERSHEY_SIMPLEX, 0.42, white, 1, cv.LINE_AA)
        d_bar_w = int(self.dms_state['drowsiness_level'] * 1.6)
        cv.rectangle(annotated, (20, 102), (180, 111), (40, 42, 50), cv.FILLED)
        cv.rectangle(annotated, (20, 102), (20 + d_bar_w, 111), red if self.dms_state['drowsiness_level'] > 40 else green, cv.FILLED)
        
        cv.putText(annotated, f"Eyes: {eyes_status}", (20, 132), cv.FONT_HERSHEY_SIMPLEX, 0.42, green if eyes_status=="OPEN" else red if eyes_status=="CLOSED" else white, 1, cv.LINE_AA)
        cv.putText(annotated, f"State: {attention_status}", (20, 152), cv.FONT_HERSHEY_SIMPLEX, 0.42, status_color, 1, cv.LINE_AA)
