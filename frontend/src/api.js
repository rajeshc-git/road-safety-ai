const BASE = ''  // Vite proxy handles /api → http://localhost:8000

export const api = {
  get: (u) => fetch(BASE + u).then(r => { if (!r.ok) throw r; return r.json() }),
  post: (u, d) => fetch(BASE + u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d ?? {}) }).then(r => r.json()),
  put: (u, d) => fetch(BASE + u, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d ?? {}) }).then(r => r.json()),
  del: (u) => fetch(BASE + u, { method: 'DELETE' }).then(r => r.json()),
}

export const streamUrl = (camId) => `/api/cameras/${camId}/stream`
export const snapshotUrl = (filename) => `/api/snapshots/${filename}`
