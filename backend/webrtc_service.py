"""
Safety Stop AI — WebRTC Streaming Service
Ultra-low latency (<200ms) peer-to-peer video streaming using aiortc.
Allows browsers to receive smooth real-time video without MJPEG HTTP stream overhead.
"""

import asyncio
import fractions
import logging
import time
from typing import Dict, Set, Optional, Any

# pyrefly: ignore [missing-import]
import numpy as np

logger = logging.getLogger("safety_stop.webrtc")

_peer_connections: Dict[int, Set[Any]] = {}  # camera_id -> Set[RTCPeerConnection]
_camera_manager_ref = None


def set_camera_manager_ref(cam_manager):
    global _camera_manager_ref
    _camera_manager_ref = cam_manager


def _get_aiortc():
    try:
        # pyrefly: ignore [missing-import]
        import av
        # pyrefly: ignore [missing-import]
        from aiortc import MediaStreamTrack, RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
        return av, MediaStreamTrack, RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
    except ImportError as e:
        logger.warning(f"WebRTC dependencies (aiortc / av) not installed: {e}")
        return None, None, None, None, None, None


class CameraVideoTrack:
    """
    Video track that serves live frames from a CameraStream instance.
    """
    def __init__(self, camera_id: int):
        av, MediaStreamTrack, _, _, _, _ = _get_aiortc()
        super().__init__()
        self.camera_id = camera_id
        self.kind = "video"
        self._start_time = time.monotonic()
        self._time_base = fractions.Fraction(1, 90000)

    async def recv(self):
        """Called by aiortc to pull the next video frame."""
        av, _, _, _, _, _ = _get_aiortc()
        if not av:
            await asyncio.sleep(0.04)
            return None

        stream = None
        if _camera_manager_ref is not None:
            stream = _camera_manager_ref.get_stream(self.camera_id)

        target_fps = getattr(stream, "target_fps", 25) if stream else 25
        frame_interval = 1.0 / max(1, target_fps)
        await asyncio.sleep(frame_interval)

        raw_frame = None
        if stream and hasattr(stream, "_latest_annotated_frame"):
            raw_frame = stream._latest_annotated_frame

        if raw_frame is None or getattr(raw_frame, 'size', 0) == 0:
            raw_frame = np.zeros((480, 640, 3), dtype=np.uint8)
            import cv2 as cv
            cv.putText(raw_frame, "Initializing WebRTC...", (140, 240),
                       cv.FONT_HERSHEY_SIMPLEX, 0.8, (180, 180, 180), 2, cv.LINE_AA)
        elif raw_frame.shape[1] > 960:
            import cv2 as cv
            scale = 720.0 / raw_frame.shape[1]
            raw_frame = cv.resize(raw_frame, (0, 0), fx=scale, fy=scale, interpolation=cv.INTER_AREA)

        # Convert OpenCV BGR to PyAV VideoFrame
        video_frame = av.VideoFrame.from_ndarray(raw_frame, format="bgr24")
        elapsed = time.monotonic() - self._start_time
        video_frame.pts = int(elapsed * 90000)
        video_frame.time_base = self._time_base

        return video_frame


def create_camera_track(camera_id: int):
    av, MediaStreamTrack, _, _, _, _ = _get_aiortc()
    if not MediaStreamTrack:
        return None

    class DynamicCameraTrack(MediaStreamTrack):
        kind = "video"

        def __init__(self, cam_id: int):
            super().__init__()
            self.cam_id = cam_id
            self._start_time = time.monotonic()
            self._time_base = fractions.Fraction(1, 90000)

        async def recv(self):
            stream = None
            if _camera_manager_ref is not None:
                stream = _camera_manager_ref.get_stream(self.cam_id)

            target_fps = getattr(stream, "target_fps", 25) if stream else 25
            frame_interval = 1.0 / max(1, target_fps)
            await asyncio.sleep(frame_interval)

            raw_frame = None
            if stream and hasattr(stream, "_latest_annotated_frame"):
                raw_frame = stream._latest_annotated_frame

            if raw_frame is None or getattr(raw_frame, 'size', 0) == 0:
                raw_frame = np.zeros((480, 640, 3), dtype=np.uint8)
                import cv2 as cv
                cv.putText(raw_frame, "Initializing WebRTC...", (140, 240),
                           cv.FONT_HERSHEY_SIMPLEX, 0.8, (180, 180, 180), 2, cv.LINE_AA)
            elif raw_frame.shape[1] > 960:
                import cv2 as cv
                scale = 720.0 / raw_frame.shape[1]
                raw_frame = cv.resize(raw_frame, (0, 0), fx=scale, fy=scale, interpolation=cv.INTER_AREA)

            video_frame = av.VideoFrame.from_ndarray(raw_frame, format="bgr24")
            elapsed = time.monotonic() - self._start_time
            video_frame.pts = int(elapsed * 90000)
            video_frame.time_base = self._time_base

            return video_frame

    return DynamicCameraTrack(camera_id)


async def handle_webrtc_offer(camera_id: int, offer_sdp: str, offer_type: str = "offer") -> Optional[dict]:
    """
    Handles SDP offer from browser client and returns SDP answer.
    """
    av, MediaStreamTrack, RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer = _get_aiortc()
    if not RTCPeerConnection:
        logger.error("Cannot handle WebRTC offer: aiortc not available.")
        return None

    from config import ICE_SERVERS
    ice_servers_list = []
    for s in ICE_SERVERS:
        if isinstance(s, dict) and "urls" in s:
            urls = s["urls"] if isinstance(s["urls"], list) else [s["urls"]]
            for u in urls:
                ice_servers_list.append(RTCIceServer(urls=u))

    config = RTCConfiguration(iceServers=ice_servers_list) if ice_servers_list else None
    pc = RTCPeerConnection(configuration=config)

    if camera_id not in _peer_connections:
        _peer_connections[camera_id] = set()
    _peer_connections[camera_id].add(pc)

    # Register viewer with camera manager
    if _camera_manager_ref:
        _camera_manager_ref.increment_mjpeg_viewers(camera_id)

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        logger.info(f"WebRTC connection state for cam {camera_id}: {pc.connectionState}")
        if pc.connectionState in ("failed", "closed", "disconnected"):
            await _cleanup_peer_connection(camera_id, pc)

    # Add camera video track
    track = create_camera_track(camera_id)
    if track:
        pc.addTrack(track)

    offer = RTCSessionDescription(sdp=offer_sdp, type=offer_type)
    await pc.setRemoteDescription(offer)

    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return {
        "sdp": pc.localDescription.sdp,
        "type": pc.localDescription.type,
    }


async def _cleanup_peer_connection(camera_id: int, pc):
    if camera_id in _peer_connections:
        _peer_connections[camera_id].discard(pc)
    try:
        await pc.close()
    except Exception:
        pass
    if _camera_manager_ref:
        _camera_manager_ref.decrement_mjpeg_viewers(camera_id)


async def close_camera_webrtc_connections(camera_id: int):
    """Clean up active peer connections for a specific camera when stopped."""
    pcs = _peer_connections.pop(camera_id, set())
    for pc in list(pcs):
        try:
            await pc.close()
        except Exception:
            pass


async def close_all_webrtc_connections():
    """Clean up all active peer connections on server shutdown."""
    for cam_id, pcs in list(_peer_connections.items()):
        for pc in list(pcs):
            try:
                await pc.close()
            except Exception:
                pass
    _peer_connections.clear()
