"""
Safety Stop AI — Violation Detector
Handles snapshot saving and database insertion for violations.
"""

import asyncio
import json
import os
from datetime import datetime
from typing import Tuple, Optional

# pyrefly: ignore [missing-import]
import cv2 as cv

from config import SNAPSHOTS_DIR
from settings_loader import get_runtime_settings
import database as db


def _save_violation_images(snap_path: Optional[str], frame, crop_path: Optional[str], crop, quality: int):
    """Synchronous file-writing helper to run in a separate thread pool."""
    if snap_path:
        cv.imwrite(snap_path, frame, [cv.IMWRITE_JPEG_QUALITY, quality])
    if crop_path and crop is not None and crop.size > 0:
        cv.imwrite(crop_path, crop, [cv.IMWRITE_JPEG_QUALITY, quality])


_ocr_reader = None

def get_ocr_reader():
    """Lazy initializer for PaddleOCR reader to save startup memory/time."""
    global _ocr_reader
    if _ocr_reader is None:
        import os
        # Disable oneDNN to avoid instruction execution path bugs on CPU
        os.environ["FLAGS_use_onednn"] = "0"
        os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
        
        # Import torch first on Windows to avoid DLL load order conflicts
        # pyrefly: ignore [missing-import]
        import torch
        # pyrefly: ignore [missing-import]
        from paddleocr import PaddleOCR
        _ocr_reader = PaddleOCR(use_angle_cls=False, lang='en', show_log=False)
    return _ocr_reader


def _extract_license_plate(vehicle_crop) -> Tuple[Optional[str], Optional[str]]:
    """
    Extracts the license plate text (English only) from a vehicle crop.
    Optimized to search only the lower-middle region where plates are located.
    """
    if vehicle_crop is None or vehicle_crop.size == 0:
        return None, None

    try:
        h, w = vehicle_crop.shape[:2]
        
        # Bounding box crop: focus on bottom-middle to isolate the plate
        # Excludes rear windows, roof, side wheels, and high-mounted logos (like "ISUZU")
        y_start = int(h * 0.60)
        y_end = int(h * 0.95)
        x_start = int(w * 0.15)
        x_end = int(w * 0.85)
        
        lower_portion = vehicle_crop[y_start:y_end, x_start:x_end]
        if lower_portion.size == 0:
            return None, None

        reader = get_ocr_reader()
        results = reader.ocr(lower_portion, cls=False)

        if not results or not results[0]:
            return None, None

        # Filter strictly for standard ASCII letters and numbers (no Arabic or math symbols)
        def clean_to_ascii_alnum(text_str):
            cleaned = []
            for char in text_str:
                if ('A' <= char <= 'Z') or ('a' <= char <= 'z') or ('0' <= char <= '9'):
                    cleaned.append(char.upper())
                elif char.isspace():
                    cleaned.append(' ')
            # Join and collapse multiple spaces
            import re
            return re.sub(r'\s+', ' ', "".join(cleaned)).strip()

        # Evaluate each detected text line individually to prevent grille decals
        # (e.g. model names, dealer text) from contaminating the plate text.
        candidates = []
        for line in results[0]:
            text = line[1][0]
            conf = line[1][1]
            if conf < 0.25:
                continue
            cleaned = clean_to_ascii_alnum(text)
            if not cleaned:
                continue
                
            # Apply strict license plate validation heuristics on the individual segment:
            # 1. Plate must contain at least one digit (to exclude pure text decals like brand names 'ISUZU')
            # 2. Length must be between 3 and 12 characters
            # 3. Must not be a known vehicle brand name
            has_digit = any(c.isdigit() for c in cleaned)
            is_valid_len = 3 <= len(cleaned) <= 12
            is_brand = cleaned in {"ISUZU", "TOYOTA", "HONDA", "HYUNDAI", "NISSAN", "FORD", "MEBUS", "ME BUS"}
            
            if has_digit and is_valid_len and not is_brand:
                candidates.append((cleaned, conf, line[0]))

        final_en = None
        coords = None
        if candidates:
            # Select the candidate with the highest confidence
            best_candidate = max(candidates, key=lambda x: x[1])
            final_en = best_candidate[0]
            pts = best_candidate[2]
            
            # Map coords to vehicle_crop
            xs = [pt[0] for pt in pts]
            ys = [pt[1] for pt in pts]
            bx1, by1 = min(xs), min(ys)
            bx2, by2 = max(xs), max(ys)
            
            px1 = int(x_start + bx1)
            py1 = int(y_start + by1)
            px2 = int(x_start + bx2)
            py2 = int(y_start + by2)
            coords = (px1, py1, px2, py2)
        else:
            # Fallback to previous behavior (highest confidence line) if no line passed validation
            best_line = max(results[0], key=lambda x: x[1][1])
            final_en = clean_to_ascii_alnum(best_line[1][0])
            
            # Final validation check on fallback
            has_digit = any(c.isdigit() for c in final_en)
            is_valid_len = 3 <= len(final_en) <= 12
            is_brand = final_en in {"ISUZU", "TOYOTA", "HONDA", "HYUNDAI", "NISSAN", "FORD", "MEBUS", "ME BUS"}
            if not has_digit or not is_valid_len or is_brand:
                final_en = None
            else:
                pts = best_line[0]
                xs = [pt[0] for pt in pts]
                ys = [pt[1] for pt in pts]
                bx1, by1 = min(xs), min(ys)
                bx2, by2 = max(xs), max(ys)
                px1 = int(x_start + bx1)
                py1 = int(y_start + by1)
                px2 = int(x_start + bx2)
                py2 = int(y_start + by2)
                coords = (px1, py1, px2, py2)

        if final_en:
            print(f"  [OCR] Detected plate — EN: '{final_en}'")
        else:
            print("  [OCR] No valid license plate detected (failed plate verification)")

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

        # Perform license plate extraction (OCR) BEFORE saving the images
        plate_ar = None
        plate_en = None
        if not is_dms and crop is not None and crop.size > 0:
            # pyrefly: ignore [bad-unpacking]
            plate_ar, plate_en, plate_coords = await asyncio.to_thread(_extract_license_plate, crop)

            # Draw the license plate overlay on both crop and full frame if detected
            if plate_en and plate_coords:
                px1, py1, px2, py2 = plate_coords
                
                # Draw on vehicle crop
                cv.rectangle(crop, (px1, py1), (px2, py2), (0, 220, 60), 3)
                cv.rectangle(crop, (px1, py1 - 22), (px1 + len(plate_en) * 11 + 10, py1), (0, 220, 60), cv.FILLED)
                cv.putText(crop, plate_en, (px1 + 5, py1 - 6), cv.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 2, cv.LINE_AA)
                
                # Draw on full frame (map coords using vehicle box start coordinates)
                fx1 = x1c + px1
                fy1 = y1c + py1
                fx2 = x1c + px2
                fy2 = y1c + py2
                cv.rectangle(frame, (fx1, fy1), (fx2, fy2), (0, 220, 60), 3)
                cv.rectangle(frame, (fx1, fy1 - 25), (fx1 + len(plate_en) * 14 + 10, fy1), (0, 220, 60), cv.FILLED)
                cv.putText(frame, plate_en, (fx1 + 5, fy1 - 8), cv.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2, cv.LINE_AA)

        # Offload file writing and image compression to a background thread pool so it does not block the FastAPI main event loop!
        await asyncio.to_thread(_save_violation_images, snap_path, frame, crop_path, crop, quality)



    if event_type == "Did Not Stop":
        resolved_event = "Did Not Stop (Pedestrian Crossing)" if pedestrian_involved else "Did Not Stop"
    else:
        resolved_event = event_type

    await db.insert_event(
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
            "license_plate": plate_en,
            "plate_ar": plate_ar,
            "crossed_line_idx": crossed_line_idx,
        },
    )

