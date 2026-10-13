import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from './api'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './pages/Dashboard'
import CamerasPage from './pages/Cameras'
import EventsPage from './pages/Events'
import SettingsPage from './pages/Settings'
import SystemPage from './pages/System'
import './App.css'

/* ─────────────────────────── AUDIO ALARM SYNTHESIZER ─────────────────────────── */
function playDmsBeep(alertType, beeperType = 'default') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    if (beeperType === 'high_intensity') {
      const playBlast = (time) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(1200, time);
        gain.gain.setValueAtTime(0.22, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.75);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.75);
      };
      playBlast(now);
      playBlast(now + 0.8);
      playBlast(now + 1.6);
    } else if (beeperType === 'truck_horn') {
      const playHorn = (time) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(175, time);
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(225, time);
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 1.2);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + 1.2);
        osc2.stop(time + 1.2);
      };
      playHorn(now);
    } else if (beeperType === 'pulsing_siren') {
      const playSiren = (time) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(500, time);
        osc.frequency.linearRampToValueAtTime(1200, time + 0.35);
        osc.frequency.linearRampToValueAtTime(500, time + 0.7);
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.7);
      };
      playSiren(now);
      playSiren(now + 0.75);
    } else if (beeperType === 'nuclear_meltdown') {
      // Long Siren: Continuous wailing air-raid pitch sweep (3 seconds)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(650, now + 0.8);
      osc.frequency.linearRampToValueAtTime(350, now + 1.6);
      osc.frequency.linearRampToValueAtTime(650, now + 2.4);
      osc.frequency.linearRampToValueAtTime(300, now + 3.0);
      
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.2);
      gain.gain.setValueAtTime(0.25, now + 2.6);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 3.0);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 3.0);
    } else if (beeperType === 'klaxon') {
      const playKlaxon = (time) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(250, time);
        osc.frequency.linearRampToValueAtTime(480, time + 0.55);
        gain.gain.setValueAtTime(0.25, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.6);
      };
      playKlaxon(now);
      playKlaxon(now + 0.7);
    } else {
      let freq = 880;
      let duration = 0.22;
      let beeps = 1;
      let type = 'sine';

      if (alertType.includes("Sleep") || alertType.includes("Drowsy")) {
        freq = 360; duration = 0.45; beeps = 3; type = 'sawtooth';
      } else if (alertType.includes("Phone")) {
        freq = 780; duration = 0.25; beeps = 3; type = 'sawtooth';
      } else if (alertType.includes("Smoking")) {
        freq = 520; duration = 0.3; beeps = 2; type = 'sawtooth';
      } else if (alertType.includes("Seatbelt")) {
        freq = 440; duration = 0.35; beeps = 2; type = 'triangle';
      } else if (alertType.includes("Yawning") || alertType.includes("Eating") || alertType.includes("Drinking") || alertType.includes("Looking Away") || alertType.includes("Distraction") || alertType.includes("Distracted")) {
        freq = 640; duration = 0.28; beeps = 2; type = 'triangle';
      }

      const playTone = (time) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.12, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + duration);
      };

      for (let i = 0; i < beeps; i++) {
        playTone(now + i * (duration + 0.12));
      }
    }
  } catch (e) {
    console.error("DMS WebAudio synthesis failed", e);
  }
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true'
  })
  const [cameras, setCameras] = useState([])
  const [activeCam, setActiveCam] = useState(null)
  const [stats, setStats] = useState({ events_today: 0, events_week: 0, pending_review: 0, active_cameras: 0 })
  const [events, setEvents] = useState([])
  const [sysInfo, setSysInfo] = useState({ cpu_usage: 0, memory_usage: 0, disk_usage: 0 })
  const [settings, setSettings] = useState({})
  const [streamKey, setStreamKey] = useState(Date.now())
  const [telemetry, setTelemetry] = useState({ attentionScore: 100.0, drowsinessLevel: 0.0, mode: 'traffic', fps: 25, width: 0, height: 0, active_violations: [] })
  const [eventTrigger, setEventTrigger] = useState(0)
  const [ocrToast, setOcrToast] = useState(null)
  const ocrToastTimerRef = useRef(null)

  const showOcrToast = useCallback((toastData) => {
    if (ocrToastTimerRef.current) clearTimeout(ocrToastTimerRef.current)
    setOcrToast(toastData)
    // Auto-hide latest toast after 4.5 seconds
    ocrToastTimerRef.current = setTimeout(() => {
      setOcrToast(null)
    }, 4500)
  }, [])

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar_collapsed', String(next))
      return next
    })
  }, [])

  const loadCameras = useCallback(async () => {
    try {
      let cams = await api.get('/api/cameras')
      if (cams.length === 0) {
        // Trigger detection non-blockingly if no cameras are configured yet
        api.post('/api/cameras/detect').then(() => api.get('/api/cameras')).then(c => {
          if (c && c.length) {
            setCameras(c)
            setActiveCam(prev => prev || c[0])
          }
        }).catch(() => {})
      } else {
        setCameras(cams)
        
        // Perform smart activeCam state update without stale closure
        setActiveCam(current => {
          if (!cams.length) return null
          if (!current) return cams[0]
          const fresh = cams.find(c => c.id === current.id)
          return fresh || cams[0]
        })
      }
    } catch(e) {
      // Backend not yet ready; startup auto-sync will retry seamlessly
    }
  }, [])

  const loadStats = useCallback(async () => {
    try { setStats(await api.get('/api/events/stats')) } catch {}
  }, [])

  const loadEvents = useCallback(async () => {
    try { const d = await api.get('/api/events?per_page=10'); setEvents(d.items || []) } catch {}
  }, [])

  const loadSystem = useCallback(async () => {
    try { setSysInfo(await api.get('/api/system/status')) } catch {}
  }, [])

  const loadSettings = useCallback(async () => {
    try { setSettings(await api.get('/api/settings')) } catch {}
  }, [])

  useEffect(() => {
    // 1. Initial immediate batch load
    loadCameras(); loadStats(); loadEvents(); loadSystem(); loadSettings()

    // 2. Startup auto-sync retry: if backend wasn't ready on first millisecond, retry every 1.5s until loaded
    const startupRetry = setInterval(() => {
      setCameras(current => {
        if (current.length === 0) {
          loadCameras()
          loadStats()
          loadEvents()
          loadSystem()
          loadSettings()
        } else {
          clearInterval(startupRetry)
        }
        return current
      })
    }, 1500)

    // 3. Steady-state background polling
    const timers = [
      setInterval(loadCameras, 5000),
      setInterval(loadStats, 10000),
      setInterval(loadEvents, 15000),
      setInterval(loadSystem, 8000),
    ]

    return () => {
      clearInterval(startupRetry)
      timers.forEach(clearInterval)
    }
  }, [loadCameras, loadStats, loadEvents, loadSystem, loadSettings])

  useEffect(() => {
    setTelemetry({ attentionScore: 100.0, drowsinessLevel: 0.0, mode: 'traffic', fps: 25, width: 0, height: 0, active_violations: [] })
  }, [activeCam?.id])

  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const loadEventsRef = useRef(loadEvents)
  loadEventsRef.current = loadEvents
  const loadStatsRef = useRef(loadStats)
  loadStatsRef.current = loadStats

  useEffect(() => {
    if (!activeCam?.id) return
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host
    const ws = new WebSocket(`${protocol}//${host}/ws/camera/${activeCam.id}`)

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'frame') {
          if (msg.meta) {
            setTelemetry({
              attentionScore: msg.meta.attention_score ?? 100.0,
              drowsinessLevel: msg.meta.drowsiness_level ?? 0.0,
              mode: msg.meta.mode || 'traffic',
              fps: msg.meta.fps || 25,
              width: msg.meta.width || 0,
              height: msg.meta.height || 0,
              active_violations: msg.meta.active_violations || [],
            })
          }
        } else if (msg.type === 'violation') {
          // Sync state and notify pages immediately
          setEventTrigger(prev => prev + 1)
          loadEventsRef.current()
          loadStatsRef.current()

          // Sound alarm beep
          if (msg.event_type && msg.event_type !== 'Did Not Stop') {
            const curSettings = settingsRef.current
            if (curSettings.dms_alert_beep !== 'false') {
              playDmsBeep(msg.event_type, curSettings.dms_beeper_type || 'default')
            }
          }
        } else if (msg.type === 'plate_updated') {
          // Immediately update events list in state for instant UI response (0ms)
          if (msg.event_id && msg.license_plate) {
            setEvents(prev => prev.map(e => e.id === msg.event_id ? {
              ...e,
              license_plate: msg.license_plate,
              metadata_json: typeof e.metadata_json === 'string'
                ? JSON.stringify({ ...(() => { try { return JSON.parse(e.metadata_json) } catch { return {} } })(), license_plate: msg.license_plate, plate_ar: msg.plate_ar })
                : { ...(e.metadata_json || {}), license_plate: msg.license_plate, plate_ar: msg.plate_ar }
            } : e))
          }
          setEventTrigger(prev => prev + 1)
          loadEventsRef.current()
        } else if (msg.type === 'ocr_toast') {
          // Display OCR.space response or rate-limit toast in header left
          showOcrToast({
            title: msg.title || 'OCR.space',
            message: msg.message,
            toast_type: msg.toast_type || 'info',
            timestamp: msg.timestamp || Date.now()
          })
        }
      } catch (e) {
        console.error("DMS WS event error", e)
      }
    }

    return () => {
      ws.close()
    }
  }, [activeCam?.id])

  const [streamLoading, setStreamLoading] = useState(false)

  // Hard safety watchdog: streamLoading can NEVER remain true for > 3.5s under any circumstance
  useEffect(() => {
    if (streamLoading) {
      const timer = setTimeout(() => setStreamLoading(false), 3500)
      return () => clearTimeout(timer)
    }
  }, [streamLoading])

  const handleCamSwitch = useCallback(async (id) => {
    const targetCam = cameras.find(c => c.id === Number(id))
    if (!targetCam) return
    setActiveCam(targetCam)
    setStreamKey(Date.now())
    setStreamLoading(true)

    // Optimistically activate target camera
    setActiveCam(prev => prev && prev.id === targetCam.id ? { ...prev, status: 'online', runtime_status: { running: true } } : prev)
    setCameras(prev => prev.map(c => c.id === targetCam.id ? { ...c, status: 'online', runtime_status: { running: true } } : c))

    try {
      // Focus 100% CPU on the active camera by stopping previous background cameras
      await api.post(`/api/cameras/${targetCam.id}/detection/switch`, {}, 5000)
    } catch (e) {
      console.error("Auto-play on camera switch failed", e)
    } finally {
      setStreamLoading(false)
      setTimeout(() => loadCameras().catch(() => {}), 300)
    }
  }, [cameras, loadCameras])

  const handleStartDetection = async () => {
    if (!activeCam || streamLoading) return
    const camId = activeCam.id
    setStreamLoading(true)

    // 1. Optimistic UI update: immediately mark camera as online so UI responds in 0ms
    setActiveCam(prev => prev && prev.id === camId ? { ...prev, status: 'online', runtime_status: { running: true } } : prev)
    setCameras(prev => prev.map(c => c.id === camId ? { ...c, status: 'online', runtime_status: { running: true } } : c))

    try {
      await api.post(`/api/cameras/${camId}/detection/start`, {}, 5000)
    } catch (e) {
      console.error("Start detection failed", e)
    } finally {
      setStreamKey(Date.now())
      setStreamLoading(false)
      setTimeout(() => loadCameras().catch(() => {}), 300)
    }
  }

  const handleStopDetection = async () => {
    if (!activeCam || streamLoading) return
    const camId = activeCam.id
    setStreamLoading(true)

    // 1. Optimistic UI update: immediately mark camera as offline so UI updates in 0ms
    // and live stream socket cleanly disconnects without leaving user stuck
    setActiveCam(prev => prev && prev.id === camId ? { ...prev, status: 'offline', runtime_status: { running: false } } : prev)
    setCameras(prev => prev.map(c => c.id === camId ? { ...c, status: 'offline', runtime_status: { running: false } } : c))

    try {
      await api.post(`/api/cameras/${camId}/detection/stop`, {}, 5000)
    } catch (e) {
      console.warn("Stop detection request notice:", e)
    } finally {
      setStreamLoading(false)
      setTimeout(() => loadCameras().catch(() => {}), 300)
    }
  }

  const handleSaveSettings = async (newSettings) => {
    await api.put('/api/settings', newSettings)
    setSettings(newSettings)
  }

  const handleSaveConfig = async (config) => {
    if (activeCam) {
      await api.put(`/api/cameras/${activeCam.id}/config`, config)
      loadCameras() // Fetch fresh record to propagate view instantly
    }
  }


  const refreshEvents = () => { loadEvents(); loadStats() }

  const pages = { dashboard: Dashboard, cameras: CamerasPage, events: EventsPage, settings: SettingsPage, system: SystemPage }
  const PageComponent = pages[page] || Dashboard

  return (
    <div className="app-shell">
      <Sidebar
        currentPage={page}
        onNavigate={setPage}
        sysInfo={sysInfo}
        collapsed={sidebarCollapsed}
        onToggle={handleToggleSidebar}
      />
      <main className="main-area">
        <TopBar
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={handleToggleSidebar}
          ocrToast={ocrToast}
          onDismissToast={() => setOcrToast(null)}
        />
        <PageComponent
          cameras={cameras}
          activeCam={activeCam}
          stats={stats}
          events={events}
          settings={settings}
          onCamSwitch={handleCamSwitch}
          onStart={handleStartDetection}
          onStop={handleStopDetection}
          streamLoading={streamLoading}
          onSaveSettings={handleSaveSettings}
          onSaveConfig={handleSaveConfig}
          onRefreshEvents={refreshEvents}
          onRefreshCameras={loadCameras}
          onNavigate={setPage}
          sysInfo={sysInfo}
          streamKey={streamKey}
          telemetry={telemetry}
          setTelemetry={setTelemetry}
          eventTrigger={eventTrigger}
        />
      </main>
    </div>

  )
}
