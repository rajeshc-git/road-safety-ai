const BASE = ''  // Vite proxy handles /api → http://localhost:8000

const fetchWithTimeout = (url, options = {}, timeoutMs = 8000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

export const api = {
  get: (u, timeoutMs = 8000) =>
    fetchWithTimeout(BASE + u, {}, timeoutMs).then(r => { if (!r.ok) throw r; return r.json() }),
  post: (u, d, timeoutMs = 8000) =>
    fetchWithTimeout(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d ?? {}) }, timeoutMs).then(r => { if (!r.ok) throw r; return r.json() }),
  put: (u, d, timeoutMs = 8000) =>
    fetchWithTimeout(BASE + u, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d ?? {}) }, timeoutMs).then(r => { if (!r.ok) throw r; return r.json() }),
  del: (u, timeoutMs = 8000) =>
    fetchWithTimeout(BASE + u, { method: 'DELETE' }, timeoutMs).then(r => { if (!r.ok) throw r; return r.json() }),
}

export const streamUrl = (camId) => `/api/cameras/${camId}/stream`
export const snapshotUrl = (filename) => `/api/snapshots/${filename}`

export async function startWebRTCStream(camId, videoElement, onStateChange) {
  try {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })

    pc.addTransceiver('video', { direction: 'recvonly' })

    pc.ontrack = (event) => {
      if (videoElement && event.streams[0]) {
        videoElement.srcObject = event.streams[0]
        videoElement.play().catch(() => { })
        if (onStateChange) onStateChange('connected')
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        if (onStateChange) onStateChange('connected')
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        if (onStateChange) onStateChange('failed')
      }
    }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    const answer = await api.post(`/api/cameras/${camId}/webrtc/offer`, {
      sdp: pc.localDescription.sdp,
      type: pc.localDescription.type,
    })

    if (!answer || !answer.sdp) {
      throw new Error('Invalid SDP answer')
    }

    await pc.setRemoteDescription(new RTCSessionDescription(answer))
    return pc
  } catch (err) {
    if (onStateChange) onStateChange('failed')
    return null
  }
}

