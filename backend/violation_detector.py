"""
Safety Stop AI — Violation Detector
Handles snapshot saving and database insertion for violations.
"""

import asyncio
import json
import os
import threading
from datetime import datetime
from typing import Tuple, Optional

# pyrefly: ignore [missing-import]
import cv2 as cv

from config import SNAPSHOTS_DIR
from settings_loader import get_runtime_settings
import database as db
import minio_service
import redis_service


def _save_violation_images(snap_path: Optional[str], frame, crop_path: Optional[str], crop, quality: int):
    """Synchronous file-writing helper to run in a separate thread pool."""
    if snap_path:
        cv.imwrite(snap_path, frame, [cv.IMWRITE_JPEG_QUALITY, quality])
    if crop_path and crop is not None and crop.size > 0:
        cv.imwrite(crop_path, crop, [cv.IMWRITE_JPEG_QUALITY, quality])


_ocr_readers = {}
_ocr_lock = threading.Lock()

# Sequential Background OCR Queue
_ocr_queue: Optional[asyncio.Queue] = None
_ocr_worker_task: Optional[asyncio.Task] = None


async def _ocr_queue_consumer():
    """Background consumer that processes vehicle OCR crops sequentially one-by-one."""
    while True:
        try:
            item = await _ocr_queue.get()
            if item is None:
                break
            (
                camera_id,
                event_id,
                crop_copy,
                frame_copy,
                box,
                snap_path,
                crop_path,
                filename,
                crop_filename,
                quality,
                x1c,
                y1c,
            ) = item

            try:
                # Run OCR extraction asynchronously in threadpool
                _, plate_en, plate_coords = await asyncio.to_thread(_extract_license_plate, crop_copy)
                resolved_plate = plate_en if (plate_en and plate_en.strip()) else "NOT CLEAR"

                # Update database event with resolved plate status
                await db.update_event_license_plate(event_id, resolved_plate)

                # Draw green bounding box & label onto crop and full frame snapshots if plate detected
                if plate_coords and resolved_plate != "NOT CLEAR":
                    px1, py1, px2, py2 = plate_coords
                    cv.rectangle(crop_copy, (px1, py1), (px2, py2), (0, 220, 60), 3)
                    cv.rectangle(crop_copy, (px1, py1 - 22), (px1 + len(resolved_plate) * 11 + 10, py1), (0, 220, 60), cv.FILLED)
                    cv.putText(crop_copy, resolved_plate, (px1 + 5, py1 - 6), cv.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 2, cv.LINE_AA)

                    if frame_copy is not None:
                        fx1 = x1c + px1
                        fy1 = y1c + py1
                        fx2 = x1c + px2
                        fy2 = y1c + py2
                        cv.rectangle(frame_copy, (fx1, fy1), (fx2, fy2), (0, 220, 60), 3)
                        cv.rectangle(frame_copy, (fx1, fy1 - 25), (fx1 + len(resolved_plate) * 14 + 10, fy1), (0, 220, 60), cv.FILLED)
                        cv.putText(frame_copy, resolved_plate, (fx1 + 5, fy1 - 8), cv.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2, cv.LINE_AA)

                    # Update saved images on disk with bounding box overlays
                    await asyncio.to_thread(_save_violation_images, snap_path, frame_copy, crop_path, crop_copy, quality)

                    # Update MinIO storage
                    if filename and frame_copy is not None:
                        ok_f, f_buf = cv.imencode(".jpg", frame_copy, [cv.IMWRITE_JPEG_QUALITY, quality])
                        if ok_f:
                            await minio_service.upload_snapshot_bytes(filename, f_buf.tobytes())
                    if crop_filename and crop_copy is not None and crop_copy.size > 0:
                        ok_c, c_buf = cv.imencode(".jpg", crop_copy, [cv.IMWRITE_JPEG_QUALITY, quality])
                        if ok_c:
                            await minio_service.upload_snapshot_bytes(crop_filename, c_buf.tobytes())

                # Notify UI via WebSocket that license plate is resolved
                from camera_manager import get_camera_manager
                cm = get_camera_manager()
                if cm:
                    await cm.broadcast_plate_update(camera_id, event_id, resolved_plate)
                    if resolved_plate != "NOT CLEAR":
                        await cm.broadcast_ocr_toast(f"Plate '{resolved_plate}' identified", toast_type="success", title="OCR Complete")

            except Exception as ocr_err:
                print(f"  [OCR Background] Error: {ocr_err}")
                await db.update_event_license_plate(event_id, "NOT CLEAR")
                from camera_manager import get_camera_manager
                cm = get_camera_manager()
                if cm:
                    await cm.broadcast_plate_update(camera_id, event_id, "NOT CLEAR")
            finally:
                _ocr_queue.task_done()
        except asyncio.CancelledError:
            break
        except Exception as q_err:
            print(f"  [OCR Queue] Consumer error: {q_err}")


def enqueue_ocr_job(job_tuple):
    """Enqueues an OCR task to the sequential background queue."""
    global _ocr_queue, _ocr_worker_task
    if _ocr_queue is None:
        _ocr_queue = asyncio.Queue()
    if _ocr_worker_task is None or _ocr_worker_task.done():
        _ocr_worker_task = asyncio.create_task(_ocr_queue_consumer())
    _ocr_queue.put_nowait(job_tuple)


def get_ocr_reader(preferred_backend: str = "easyocr"):
    """Lazy initializer supporting EasyOCR or PaddleOCR based on user setting."""
    global _ocr_readers
    backend = preferred_backend.strip().lower() if preferred_backend else "easyocr"
    if backend not in ("easyocr", "paddleocr"):
        backend = "easyocr"

    with _ocr_lock:
        if backend in _ocr_readers:
            return _ocr_readers[backend], backend

        if backend == "easyocr":
            try:
                # pyrefly: ignore [missing-import]
                import torch
                if hasattr(torch, 'set_num_threads'):
                    try:
                        torch.set_num_threads(2)
                    except Exception:
                        pass
                # pyrefly: ignore [missing-import]
                import easyocr
                use_gpu = torch.cuda.is_available()
                reader = easyocr.Reader(['en'], gpu=use_gpu)
                _ocr_readers["easyocr"] = reader
                print(f"  [OCR] [OK] Loaded EasyOCR reader (GPU: {use_gpu})")
                return reader, "easyocr"
            except Exception as e:
                print(f"  [OCR] EasyOCR init failed: {e}")

        elif backend == "paddleocr":
            try:
                import os
                os.environ["FLAGS_use_onednn"] = "0"
                os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
                # pyrefly: ignore [missing-import]
                from paddleocr import PaddleOCR
                reader = PaddleOCR(use_angle_cls=False, lang='en', show_log=False)
                _ocr_readers["paddleocr"] = reader
                print("  [OCR] [OK] Loaded PaddleOCR reader")
                return reader, "paddleocr"
            except Exception as e:
                print(f"  [OCR] PaddleOCR init failed: {e}")

        # Fallback to whichever is available
        for fallback_backend in ("easyocr", "paddleocr"):
            if fallback_backend in _ocr_readers:
                return _ocr_readers[fallback_backend], fallback_backend

        print(f"  [OCR] [WARN] Local OCR reader '{backend}' not available.")
        return None, "none"


def _call_ocr_space(image_bgr, api_key: str = "K89291931288957", engine: str = "2") -> list:
    """Calls OCR.space REST API with image bytes, returns raw_detections list [(bbox, text, conf)]."""
    import requests
    ok, buf = cv.imencode(".jpg", image_bgr, [cv.IMWRITE_JPEG_QUALITY, 95])
    if not ok:
        return []
    
    # Engine defaults: 1, 2, or 3
    engine_val = str(engine).strip()
    if engine_val not in ("1", "2", "3"):
        engine_val = "2"

    url = "https://api.ocr.space/parse/image"
    payload = {
        "apikey": api_key or "K89291931288957",
        "language": "eng",
        "isOverlayRequired": "true",
        "OCREngine": engine_val,
        "detectOrientation": "false",
        "scale": "true",
    }
    files = {
        "file": ("plate.jpg", buf.tobytes(), "image/jpeg")
    }

    try:
        resp = requests.post(url, data=payload, files=files, timeout=7)
        if resp.status_code != 200:
            raw_err = resp.text[:120]
            is_429 = resp.status_code == 429 or "rate limit" in raw_err.lower() or "limit exceeded" in raw_err.lower()
            err_title = "OCR.space Rate Limit Reached" if is_429 else f"OCR.space HTTP {resp.status_code}"
            toast_t = "warning" if is_429 else "error"
            toast_msg = "Rate limit reached for free plan (60 req/hr). Please switch engine or wait." if is_429 else f"HTTP {resp.status_code}: {raw_err}"
            print(f"  [OCR.space] HTTP Error {resp.status_code}: {raw_err}")
            from camera_manager import get_camera_manager
            cm = get_camera_manager()
            if cm and cm.loop:
                asyncio.run_coroutine_threadsafe(
                    cm.broadcast_ocr_toast(toast_msg, toast_type=toast_t, title=err_title),
                    cm.loop
                )
            return []

        data = resp.json()
        if data.get("IsErroredOnProcessing"):
            err_msg = data.get("ErrorMessage") or "Unknown processing error"
            print(f"  [OCR.space] API Error: {err_msg}")
            
            # Detect rate limit or quota exceeded
            is_limit = any(term in str(err_msg).lower() for term in ["rate limit", "quota", "limit reached", "maximum", "exceeded"])
            toast_t = "warning" if is_limit else "error"
            toast_title = "OCR.space Limit Reached" if is_limit else "OCR.space API Error"
            
            from camera_manager import get_camera_manager
            cm = get_camera_manager()
            if cm and cm.loop:
                asyncio.run_coroutine_threadsafe(
                    cm.broadcast_ocr_toast(str(err_msg), toast_type=toast_t, title=toast_title),
                    cm.loop
                )
            return []

        parsed_results = data.get("ParsedResults", [])
        if not parsed_results:
            return []

        raw_detections = []
        for pr in parsed_results:
            text_overlay = pr.get("TextOverlay") or {}
            lines = text_overlay.get("Lines", [])
            for line in lines:
                words = line.get("Words", [])
                if words:
                    # Provide word-level tokens so multi-tier plates can cluster digits and letters
                    for w in words:
                        w_text = (w.get("WordText") or "").strip()
                        if w_text:
                            wl = w.get("Left", 0)
                            wt = w.get("Top", 0)
                            ww = w.get("Width", 0)
                            wh = w.get("Height", 0)
                            w_bbox = [(wl, wt), (wl + ww, wt), (wl + ww, wt + wh), (wl, wt + wh)]
                            raw_detections.append((w_bbox, w_text, 0.95))
                else:
                    line_text = (line.get("LineText") or "").strip()
                    if line_text:
                        bbox = [(0, 0), (image_bgr.shape[1], 0), (image_bgr.shape[1], image_bgr.shape[0]), (0, image_bgr.shape[0])]
                        raw_detections.append((bbox, line_text, 0.90))

            # Fallback to plain ParsedText if TextOverlay didn't break down lines
            if not raw_detections and pr.get("ParsedText"):
                raw_text = pr["ParsedText"].strip()
                for line_s in raw_text.splitlines():
                    s = line_s.strip()
                    if s:
                        bbox = [(0, 0), (image_bgr.shape[1], 0), (image_bgr.shape[1], image_bgr.shape[0]), (0, image_bgr.shape[0])]
                        raw_detections.append((bbox, s, 0.85))

        print(f"  [OCR.space] Engine {engine_val} returned {len(raw_detections)} tokens")
        return raw_detections
    except Exception as e:
        print(f"  [OCR.space] Request failed: {e}")
        from camera_manager import get_camera_manager
        cm = get_camera_manager()
        if cm and cm.loop:
            asyncio.run_coroutine_threadsafe(
                cm.broadcast_ocr_toast(f"Connection error: {str(e)[:60]}", toast_type="error", title="OCR.space Timeout"),
                cm.loop
            )
        return []


def _call_gemma4_vision(image_bgr, endpoint: str = "http://host.docker.internal:11434", model: str = "gemma4:e2b") -> Optional[str]:
    """
    Calls local Ollama multimodal Gemma 4 Vision model to read license plate characters directly from crop.
    Returns cleaned alphanumeric plate string or None.
    """
    import base64
    import requests
    import re

    ok, buf = cv.imencode(".jpg", image_bgr, [cv.IMWRITE_JPEG_QUALITY, 92])
    if not ok:
        return None

    b64_img = base64.b64encode(buf.tobytes()).decode("utf-8")
    url = f"{endpoint.rstrip('/')}/api/generate"
    prompt = (
        "You are an expert Automatic License Plate Recognition (ALPR) system. "
        "Inspect this vehicle crop and extract ONLY the vehicle's license plate numbers and English letters. "
        "Do NOT include car brands, makes, or models (like FORD, GMC, TOYOTA, HYUNDAI). "
        "Respond strictly with the plate text only (e.g. '1234 ABC'), with no conversational filler or markdown."
    )

    payload = {
        "model": model or "gemma4:e2b",
        "prompt": prompt,
        "images": [b64_img],
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": 30,
        }
    }

    try:
        resp = requests.post(url, json=payload, timeout=25)
        if resp.status_code == 200:
            data = resp.json()
            raw_text = (data.get("response") or "").strip()
            # Clean up unwanted formatting or prefixes
            cleaned = re.sub(r'[^A-Za-z0-9\s]', '', raw_text).strip()
            # Filter out brand names
            brand_names = {"FORD", "TOYOTA", "HONDA", "HYUNDAI", "NISSAN", "GMC", "CHEVROLET", "ISUZU"}
            words = [w.upper() for w in cleaned.split() if w.upper() not in brand_names]
            final = " ".join(words).strip()
            if final and (any(c.isdigit() for c in final) or len(final) >= 3):
                print(f"  [Gemma4 Vision] Successfully extracted license plate: '{final}'")
                return final
        else:
            print(f"  [Gemma4 Vision] API returned HTTP {resp.status_code}: {resp.text[:80]}")
    except Exception as e:
        print(f"  [Gemma4 Vision] Request failed: {e}")
        from camera_manager import get_camera_manager
        cm = get_camera_manager()
        if cm and cm.loop:
            asyncio.run_coroutine_threadsafe(
                cm.broadcast_ocr_toast(f"Gemma 4 notice: {str(e)[:50]}", toast_type="warning", title="Gemma 4 AI"),
                cm.loop
            )
    return None


def _extract_license_plate(vehicle_crop) -> Tuple[Optional[str], Optional[str], Optional[Tuple[int, int, int, int]]]:
    """
    Extracts the license plate text (English only) from a vehicle crop.
    Supports OCR.space API (Engine 1, 2, 3) as configured in settings, with local EasyOCR/Paddle fallback.
    Clusters adjacent tokens (both horizontal and stacked lines) so full plate digits and letters
    are combined, and draws a generous bounding box wrapping the entire license plate.
    """
    if vehicle_crop is None or vehicle_crop.size == 0:
        return None, None, None

    try:
        h, w = vehicle_crop.shape[:2]
        
        # Bounding box crop: focus strictly on bumper plate mount area (48% to 98% height, 6% to 94% width)
        # Excludes upper radiator honeycomb grille, brand emblems (Ford, Hyundai) and windshield reflections
        y_start = int(h * 0.48)
        y_end = int(h * 0.98)
        x_start = int(w * 0.06)
        x_end = int(w * 0.94)
        
        lower_portion = vehicle_crop[y_start:y_end, x_start:x_end]
        if lower_portion.size == 0:
            return None, None, None

        # Check user runtime settings for OCR provider and engine
        settings = get_runtime_settings()
        ocr_provider = settings.get("ocr_provider", "ocr_space")
        ocr_engine = settings.get("ocr_engine", "2")
        ocr_api_key = settings.get("ocr_space_api_key", "K89291931288957")
        local_backend = settings.get("local_ocr_backend", "easyocr")
        gemma4_endpoint = settings.get("gemma4_endpoint", "http://host.docker.internal:11434")
        gemma4_model = settings.get("gemma4_model", "gemma4:e2b")

        # Gemma 4 Local Vision AI mode
        if ocr_provider == "gemma4":
            gemma_plate = _call_gemma4_vision(lower_portion, endpoint=gemma4_endpoint, model=gemma4_model)
            if not gemma_plate and h >= 80:
                wider_crop = vehicle_crop[int(h * 0.25):int(h * 1.0), 0:w]
                if wider_crop.size > 0:
                    gemma_plate = _call_gemma4_vision(wider_crop, endpoint=gemma4_endpoint, model=gemma4_model)
            if gemma_plate:
                coords = (int(w * 0.15), int(h * 0.55), int(w * 0.85), int(h * 0.95))
                return None, gemma_plate, coords
            return None, None, None

        # Resolution boost: upscale small plate regions to >=220px height for crisp edge clarity
        lh, lw = lower_portion.shape[:2]
        scale = max(2.0, 220.0 / max(1, lh))
        ocr_input = cv.resize(lower_portion, None, fx=scale, fy=scale, interpolation=cv.INTER_CUBIC)

        # First attempt: Detect high-contrast rectangular plate candidate in bumper area
        # This provides a focused, high-resolution badge crop directly to OCR.space
        plate_box_candidates = []
        try:
            gray = cv.cvtColor(lower_portion, cv.COLOR_BGR2GRAY)
            grad_x = cv.Sobel(gray, cv.CV_32F, 1, 0, ksize=3)
            grad_x = cv.convertScaleAbs(grad_x)
            _, thresh = cv.threshold(grad_x, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU)
            kernel = cv.getStructuringElement(cv.MORPH_RECT, (17, 3))
            morph = cv.morphologyEx(thresh, cv.MORPH_CLOSE, kernel)
            contours, _ = cv.findContours(morph, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
            for c in contours:
                cx, cy, cw, ch = cv.boundingRect(c)
                aspect = cw / float(max(1, ch))
                if 1.2 <= aspect <= 5.5 and (lw * 0.10) <= cw <= (lw * 0.70) and (lh * 0.08) <= ch <= (lh * 0.65):
                    plate_box_candidates.append((cx, cy, cw, ch))
            plate_box_candidates.sort(key=lambda b: -b[2] * b[3])
        except Exception:
            plate_box_candidates = []

        raw_detections = []

        # 1. Primary: OCR.space API with focused candidate crop or bumper crop
        if ocr_provider == "ocr_space":
            # If a high-probability plate candidate was localized, zoom in and send it first
            if plate_box_candidates:
                bx, by, bw_cand, bh_cand = plate_box_candidates[0]
                mx = int(bw_cand * 0.20)
                my = int(bh_cand * 0.25)
                cy1 = max(0, by - my)
                cy2 = min(lh, by + bh_cand + my)
                cx1 = max(0, bx - mx)
                cx2 = min(lw, bx + bw_cand + mx)
                cand_crop = lower_portion[cy1:cy2, cx1:cx2]
                if cand_crop.size > 0:
                    cand_scale = max(2.5, 180.0 / max(1, cand_crop.shape[0]))
                    cand_input = cv.resize(cand_crop, None, fx=cand_scale, fy=cand_scale, interpolation=cv.INTER_CUBIC)
                    cand_dets = _call_ocr_space(cand_input, api_key=ocr_api_key, engine=ocr_engine)
                    if cand_dets:
                        # Remap candidate detections to vehicle_crop space
                        for bbox, text, conf in cand_dets:
                            xs = [pt[0] / cand_scale for pt in bbox]
                            ys = [pt[1] / cand_scale for pt in bbox]
                            rbx1 = min(xs) + cx1
                            rby1 = min(ys) + cy1
                            rbx2 = max(xs) + cx1
                            rby2 = max(ys) + cy1
                            raw_detections.append(([(rbx1 * scale, rby1 * scale), (rbx2 * scale, rby1 * scale), (rbx2 * scale, rby2 * scale), (rbx1 * scale, rby2 * scale)], text, conf))

            # If targeted candidate wasn't detected or returned nothing, send the entire bumper crop
            if not raw_detections:
                raw_detections = _call_ocr_space(ocr_input, api_key=ocr_api_key, engine=ocr_engine)

            if not raw_detections and h >= 80:
                # Retry OCR.space with entire lower vehicle if initial crop was tight
                y_w_start = int(h * 0.25)
                y_w_end = int(h * 1.0)
                x_w_start = 0
                x_w_end = w
                wider_crop = vehicle_crop[y_w_start:y_w_end, x_w_start:x_w_end]
                if wider_crop.size > 0:
                    scale_w = max(2.0, 220.0 / max(1, wider_crop.shape[0]))
                    wider_input = cv.resize(wider_crop, None, fx=scale_w, fy=scale_w, interpolation=cv.INTER_CUBIC)
                    raw_detections = _call_ocr_space(wider_input, api_key=ocr_api_key, engine=ocr_engine)
                    if raw_detections:
                        x_start, y_start = x_w_start, y_w_start
                        scale = scale_w

        # 2. Local fallback ONLY if provider is explicitly set to 'local'
        if not raw_detections and ocr_provider == "local":
            reader, backend = get_ocr_reader(local_backend)
            if reader and backend == "easyocr":
                with _ocr_lock:
                    results = reader.readtext(ocr_input)
                for res in results:
                    if len(res) >= 3:
                        bbox, text, conf = res[0], res[1], float(res[2])
                        raw_detections.append((bbox, text, conf))
            elif reader and backend == "paddleocr":
                results = reader.ocr(ocr_input, cls=False)
                if results and results[0]:
                    for line in results[0]:
                        bbox = line[0]
                        text, conf = line[1][0], float(line[1][1])
                        raw_detections.append((bbox, text, conf))

        # Fallback to wider vertical crop if nothing was detected in the lower bumper section (local mode only)
        if not raw_detections and ocr_provider == "local" and h >= 80:
            y_start = int(h * 0.25)
            y_end = int(h * 1.0)
            x_start = 0
            x_end = w
            wider_crop = vehicle_crop[y_start:y_end, x_start:x_end]
            if wider_crop.size > 0:
                scale = max(2.0, 220.0 / max(1, wider_crop.shape[0]))
                wider_input = cv.resize(wider_crop, None, fx=scale, fy=scale, interpolation=cv.INTER_CUBIC)
                reader, backend = get_ocr_reader(local_backend)
                if reader and backend == "easyocr":
                    with _ocr_lock:
                        results = reader.readtext(wider_input)
                    for res in results:
                        if len(res) >= 3:
                            raw_detections.append((res[0], res[1], float(res[2])))
                elif reader and backend == "paddleocr":
                    results = reader.ocr(wider_input, cls=False)
                    if results and results[0]:
                        for line in results[0]:
                            raw_detections.append((line[0], line[1][0], float(line[1][1])))

        if not raw_detections:
            return None, None, None

        # Filter strictly for standard ASCII letters and numbers (no Arabic or math symbols)
        def clean_to_ascii_alnum(text_str):
            cleaned = []
            for char in str(text_str):
                if ('A' <= char <= 'Z') or ('a' <= char <= 'z') or ('0' <= char <= '9'):
                    cleaned.append(char.upper())
                elif char.isspace():
                    cleaned.append(' ')
            import re
            return re.sub(r'\s+', ' ', "".join(cleaned)).strip()

        # Parse detected tokens and filter out vehicle brand logos or empty text
        brand_names = {"ISUZU", "TOYOTA", "HONDA", "HYUNDAI", "NISSAN", "FORD", "MEBUS", "ME BUS", "GMC", "CHEVROLET"}
        valid_items = []
        for bbox, text, conf in raw_detections:
            if conf < 0.20:
                continue
            cleaned = clean_to_ascii_alnum(text)
            if not cleaned or cleaned in brand_names:
                continue

            # Resolve bbox into (bx1, by1, bx2, by2)
            if isinstance(bbox, (list, tuple)) and len(bbox) == 4 and isinstance(bbox[0], (list, tuple)):
                xs = [pt[0] for pt in bbox]
                ys = [pt[1] for pt in bbox]
                bx1, by1, bx2, by2 = min(xs), min(ys), max(xs), max(ys)
            elif len(bbox) == 4 and not isinstance(bbox[0], (list, tuple)):
                bx1, by1, bx2, by2 = bbox[0], bbox[1], bbox[2], bbox[3]
            else:
                continue

            valid_items.append({
                "text": cleaned,
                "box": (float(bx1), float(by1), float(bx2), float(by2)),
                "conf": float(conf),
                "has_digit": any(c.isdigit() for c in cleaned),
                "has_alpha": any(c.isalpha() for c in cleaned),
            })

        if not valid_items:
            return None, None, None

        # Plate clustering: Group nearby co-located items (e.g. '9079' stacked over '9569 UUD')
        # Seed clusters with items containing digits
        digit_items = [it for it in valid_items if it["has_digit"]]
        anchors = digit_items if digit_items else valid_items

        best_cluster = None
        best_score = -1.0

        for anchor in anchors:
            ax1, ay1, ax2, ay2 = anchor["box"]
            aw = max(20.0, ax2 - ax1)
            ah = max(15.0, ay2 - ay1)
            acx = (ax1 + ax2) / 2.0
            acy = (ay1 + ay2) / 2.0

            cluster = [anchor]
            for other in valid_items:
                if other is anchor:
                    continue
                ox1, oy1, ox2, oy2 = other["box"]
                ocx = (ox1 + ox2) / 2.0
                ocy = (oy1 + oy2) / 2.0
                dx = abs(ocx - acx)
                dy = abs(ocy - acy)

                # License plate aspect ratio and spatial proximity threshold:
                # Horizontally within 2.8x anchor width, vertically within 3.0x anchor height
                if dx <= max(aw, 50.0) * 2.8 and dy <= max(ah, 30.0) * 3.0:
                    cluster.append(other)

            # Score cluster: prioritize combinations having both numbers and letters
            has_d = any(c["has_digit"] for c in cluster)
            has_a = any(c["has_alpha"] for c in cluster)
            total_chars = sum(len(c["text"]) for c in cluster)
            score = (120.0 if (has_d and has_a) else 60.0 if has_d else 10.0) + min(total_chars, 20.0)

            if score > best_score:
                best_score = score
                best_cluster = cluster

        final_en = None
        coords = None

        if best_cluster:
            # Group tokens into lines based on vertical overlap to preserve true reading order
            avg_token_h = max(10.0, sum(it["box"][3] - it["box"][1] for it in best_cluster) / len(best_cluster))
            items_by_y = sorted(best_cluster, key=lambda it: it["box"][1])
            lines = []
            for it in items_by_y:
                placed = False
                for line in lines:
                    line_mean_y = sum(m["box"][1] for m in line) / len(line)
                    if abs(it["box"][1] - line_mean_y) < avg_token_h * 0.75:
                        line.append(it)
                        placed = True
                        break
                if not placed:
                    lines.append([it])

            # Sort tokens horizontally within each line
            ordered_tokens = []
            seen_tokens = set()
            for line in lines:
                line_sorted = sorted(line, key=lambda m: m["box"][0])
                for tok in line_sorted:
                    if tok["text"] not in seen_tokens:
                        seen_tokens.add(tok["text"])
                        ordered_tokens.append(tok["text"])

            final_en = " ".join(ordered_tokens).strip()

            # Calculate unified bounding box covering all clustered elements
            all_bx1 = min(it["box"][0] for it in best_cluster)
            all_by1 = min(it["box"][1] for it in best_cluster)
            all_bx2 = max(it["box"][2] for it in best_cluster)
            all_by2 = max(it["box"][3] for it in best_cluster)

            # Map coordinates back from scaled OCR image space to vehicle_crop space
            ux1 = all_bx1 / scale
            uy1 = all_by1 / scale
            ux2 = all_bx2 / scale
            uy2 = all_by2 / scale

            # Add generous outer padding to wrap the entire license plate border and badge
            pw = max(10.0, ux2 - ux1)
            ph = max(10.0, uy2 - uy1)
            pad_x = max(12, int(pw * 0.20))
            pad_y = max(10, int(ph * 0.25))

            px1 = max(0, int(x_start + ux1 - pad_x))
            py1 = max(0, int(y_start + uy1 - pad_y))
            px2 = min(w, int(x_start + ux2 + pad_x))
            py2 = min(h, int(y_start + uy2 + pad_y))
            coords = (px1, py1, px2, py2)

        if final_en:
            print(f"  [OCR] Detected plate via {ocr_provider.upper()} (Engine {ocr_engine}) - EN: '{final_en}'")
        else:
            print(f"  [OCR] No valid license plate detected via {ocr_provider.upper()} (Engine {ocr_engine})")

        return None, final_en, coords

    except Exception as e:
        print(f"  [OCR] Error extracting license plate: {e}")
        return None, None, None


async def handle_violation(
    camera_id: int,
    camera_name: str,
    vehicle_id: int,
    frame,
    box: Tuple[int, int, int, int],
    pedestrian_involved: bool,
    event_type: str = "Did Not Stop",
    crossed_line_idx: Optional[int] = None,
):
    """
    Called from the detection engine when a violation or DMS safety alert is triggered.
    Saves snapshots and registers the event inside the SQLite database.
    """
    settings = get_runtime_settings()
    save_enabled = settings.get("save_snapshots", "true") == "true"
    quality_map = {"full": 100, "high": 95, "medium": 75, "low": 50}
    quality = quality_map.get(settings.get("snapshot_quality", "high"), 90)

    filename = None
    crop_filename = None

    ts = datetime.now()
    ts_str = ts.strftime("%Y%m%d_%H%M%S")
    
    is_dms = event_type != "Did Not Stop"

    if save_enabled:
        if is_dms:
            safe_evt = event_type.replace(":", "").replace(" ", "_").lower()
            filename = f"dms_cam{camera_id}_{safe_evt}_{ts_str}.jpg"
        else:
            filename = f"violation_cam{camera_id}_vid{vehicle_id}_{ts_str}.jpg"
            
        snap_path = str(SNAPSHOTS_DIR / filename)

        # Save cropped area of interest (the face, phone, or vehicle)
        x1, y1, w, h = box
        # For vehicle, box is (x1, y1, x2, y2). For DMS, face/phone is (x, y, w, h). Let's resolve it defensively:
        if is_dms:
            # DMS box is (x, y, w, h)
            x2, y2 = x1 + w, y1 + h
        else:
            # Vehicle box is (x1, y1, x2, y2)
            x2, y2 = w, h
            
        img_h, img_w = frame.shape[:2]
        x1c, y1c = max(0, x1 - 15), max(0, y1 - 15)
        x2c, y2c = min(img_w, x2 + 15), min(img_h, y2 + 15)
        crop = frame[y1c:y2c, x1c:x2c]
        
        crop_path = None
        if crop.size > 0:
            if is_dms:
                safe_evt = event_type.replace(":", "").replace(" ", "_").lower()
                crop_filename = f"crop_dms_cam{camera_id}_{safe_evt}_{ts_str}.jpg"
            else:
                crop_filename = f"crop_cam{camera_id}_vid{vehicle_id}_{ts_str}.jpg"
            crop_path = str(SNAPSHOTS_DIR / crop_filename)

        # Offload file writing and image compression to local disk
        await asyncio.to_thread(_save_violation_images, snap_path, frame, crop_path, crop, quality)

        # Upload snapshot and crop to MinIO Object Storage asynchronously
        if filename:
            ok, buf = cv.imencode(".jpg", frame, [cv.IMWRITE_JPEG_QUALITY, quality])
            if ok:
                await minio_service.upload_snapshot_bytes(filename, buf.tobytes())
        if crop_filename and crop is not None and crop.size > 0:
            ok, cbuf = cv.imencode(".jpg", crop, [cv.IMWRITE_JPEG_QUALITY, quality])
            if ok:
                await minio_service.upload_snapshot_bytes(crop_filename, cbuf.tobytes())

    if event_type == "Did Not Stop":
        resolved_event = "Did Not Stop (Pedestrian Crossing)" if pedestrian_involved else "Did Not Stop"
    else:
        resolved_event = event_type

    # 1. Immediately insert event into database with PROCESSING status
    event_id = await db.insert_event(
        camera_id=camera_id,
        camera_name=camera_name,
        event_type=resolved_event,
        vehicle_id=vehicle_id if not is_dms else 0,
        snapshot_path=filename,
        metadata={
            "crop_path": crop_filename,
            "box": list(box),
            "pedestrian_involved": pedestrian_involved,
            "timestamp": ts.isoformat(),
            "is_dms": is_dms,
            "license_plate": None if is_dms else "PROCESSING",
            "plate_ar": None,
            "crossed_line_idx": crossed_line_idx,
        },
    )

    # 2. Immediately publish initial violation to Redis Pub/Sub so UI displays event in 0ms with Scanning/Processing badge
    await redis_service.publish_violation({
        "id": event_id,
        "camera_id": camera_id,
        "camera_name": camera_name,
        "event_type": resolved_event,
        "vehicle_id": vehicle_id if not is_dms else 0,
        "snapshot_path": filename,
        "crop_path": crop_filename,
        "license_plate": None if is_dms else "PROCESSING",
        "timestamp": ts.isoformat(),
        "pedestrian_involved": pedestrian_involved,
        "crossed_line_idx": crossed_line_idx,
    })

    # 3. Enqueue OCR in sequential background worker queue so cars are never skipped and API is never choked
    if not is_dms and crop is not None and crop.size > 0:
        crop_copy = crop.copy()
        frame_copy = frame.copy() if frame is not None else None
        job_data = (
            camera_id,
            event_id,
            crop_copy,
            frame_copy,
            box,
            snap_path,
            crop_path,
            filename,
            crop_filename,
            quality,
            x1c,
            y1c,
        )
        enqueue_ocr_job(job_data)


