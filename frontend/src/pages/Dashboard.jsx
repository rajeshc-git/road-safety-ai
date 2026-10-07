import { useState, useRef, useEffect, useCallback } from 'react'
import { streamUrl, snapshotUrl, api, startWebRTCStream } from '../api'
import './Dashboard.css'
import './Pages.css'
import SkeuomorphicPlayer, { PLAYER_SKINS } from '../components/SkeuomorphicPlayer'

/* ─────────────────────────── AUDIO ALARM SYNTHESIZER ─────────────────────────── */
function playDmsBeep(alertType, beeperType = 'default') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    if (beeperType === 'high_intensity') {
      // High Intensity Horn: Loud, high-pitched sawtooth blasts to awaken the driver
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
      // Truck Air Horn: Resonant dual low-frequency sawtooth waves
      const playHorn = (time) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(175, time); // Fundamental

        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(225, time); // Discordant fifth

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
      // Pulsing Siren: Pitch sweeps rapidly
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
      // Industrial Klaxon Sweep: Low pitch sweeps up
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
      // DEFAULT (Standard Alert-Specific Beep)
      let freq = 880;
      let duration = 0.22;
      let beeps = 1;
      let type = 'sine';

      if (alertType.includes("Sleep") || alertType.includes("Drowsy")) {
        freq = 360;
        duration = 0.45;
        beeps = 3;
        type = 'sawtooth';
      } else if (alertType.includes("Phone")) {
        freq = 780;
        duration = 0.25;
        beeps = 3;
        type = 'sawtooth';
      } else if (alertType.includes("Smoking")) {
        freq = 520;
        duration = 0.3;
        beeps = 2;
        type = 'sawtooth';
      } else if (alertType.includes("Seatbelt")) {
        freq = 440;
        duration = 0.35;
        beeps = 2;
        type = 'triangle';
      } else if (alertType.includes("Yawning") || alertType.includes("Eating") || alertType.includes("Drinking") || alertType.includes("Looking Away") || alertType.includes("Distraction") || alertType.includes("Distracted")) {
        freq = 640;
        duration = 0.28;
        beeps = 2;
        type = 'triangle';
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
    return ctx;
  } catch (e) {
    console.error("DMS WebAudio synthesis failed", e);
  }
}

/* ─────────────────────────── STAT CARD ─────────────────────────── */
function StatCard({ title, value, trend, trendUp, icon, iconClass }) {
  return (
    <div className={`stat-card ${iconClass}`}>
      <div className="sc-info">
        <div className="sc-title">{title}</div>
        <div className="sc-num">{value}</div>
        {trend && <div className={`sc-trend ${trendUp ? 'up' : trendUp === false ? 'down' : 'neutral'}`}>{trend}</div>}
      </div>
      <div className="sc-icon"><i className={`fa-solid ${icon}`} /></div>
    </div>
  )
}

/* ─────────────────────────── EVENT CARD ─────────────────────────── */
function EventCard({ ev, onImageClick }) {
  const t = (ev.timestamp || '').split(' ')
  const vid = ev.vehicle_id || 0
  const isDms = ev.event_type && ev.event_type !== 'Did Not Stop' && ev.event_type !== 'Did Not Stop (Pedestrian Crossing)'

  let metadata = {}
  try {
    if (ev.metadata_json) {
      metadata = typeof ev.metadata_json === 'string' ? JSON.parse(ev.metadata_json) : ev.metadata_json
    }
  } catch (e) {
    console.error("Failed to parse metadata_json", e)
  }

  const detectedPlate = ev.license_plate || metadata.license_plate || metadata.number_plate || ev.number_plate || null
  const plateAr = metadata.plate_ar || metadata.license_plate_ar || null

  return (
    <div className="ev-card" style={{ width: '145px', minWidth: '145px' }}>
      <div className="ev-thumb" style={{ height: '82px', cursor: 'pointer', position: 'relative' }} onClick={() => onImageClick && onImageClick({
        src: snapshotUrl(ev.snapshot_path),
        licensePlate: detectedPlate,
        plateAr: plateAr,
        cameraName: ev.camera_name,
        eventType: ev.event_type || 'Did Not Stop',
        timestamp: ev.timestamp,
        crossedLineIdx: metadata.crossed_line_idx
      })}>
        <img src={snapshotUrl(ev.snapshot_path)} alt="snap"
          onError={e => { e.target.style.display = 'none' }} />
        {metadata.crossed_line_idx !== undefined && metadata.crossed_line_idx !== null && (
          <span style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            background: 'rgba(59, 130, 246, 0.85)',
            color: '#fff',
            fontSize: '7px',
            fontWeight: '700',
            padding: '2px 5px',
            borderRadius: '3px',
            backdropFilter: 'blur(3px)',
            letterSpacing: '0.3px',
            lineHeight: '1.2',
            zIndex: 2
          }}>
            Line {metadata.crossed_line_idx + 1}
          </span>
        )}
      </div>
      <div className="ev-body" style={{ padding: '8px' }}>
        <div className="ev-time" style={{ fontSize: '8.5px' }}>{t[1] || ev.timestamp || '--'}</div>
        <div className="ev-cam" style={{ fontWeight: '600' }}>{ev.camera_name}</div>
        <span className="ev-badge" style={{
          backgroundColor: isDms ? 'rgba(235, 120, 10, 0.15)' : '#7f1d1d',
          color: isDms ? '#ff9d43' : '#fca5a5',
          border: isDms ? '1px solid rgba(235, 120, 10, 0.3)' : 'none',
          padding: '2px 6px',
          borderRadius: '3px',
          fontWeight: '700'
        }}>
          {ev.event_type || 'Did Not Stop'}
        </span>
        {isDms ? (
          <div className="ev-vid" style={{ marginTop: '5px', fontSize: '8.5px', color: '#64748b' }}>
            <i className="fa-solid fa-user-shield" style={{ marginRight: '4px' }} /> DMS Cabin Event
          </div>
        ) : (
          <>
            <div className="ev-vid">ID: {vid}</div>
            {detectedPlate ? (
              <div className="plate">
                {plateAr && <div className="plate-ar">{plateAr}</div>}
                <div className="plate-en">{detectedPlate}</div>
              </div>
            ) : (
              <div className="plate" style={{
                background: 'rgba(255, 255, 255, 0.03)',
                color: 'var(--t3)',
                border: '1px dashed rgba(255, 255, 255, 0.15)',
                borderRadius: '3px',
                padding: '4px 6px',
                textAlign: 'center'
              }}>
                <div className="plate-en" style={{ fontSize: '8px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Not Clear</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────── STOP LINE CANVAS ─────────────────────────── */
function StopLineCanvas({ camId, onLineSaved }) {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [start, setStart] = useState(null)
  const [line, setLine] = useState(null)

  const draw = useCallback(() => {
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')
    ctx.clearRect(0, 0, cv.width, cv.height)
    if (line) {
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3
      ctx.setLineDash([8, 4]); ctx.beginPath()
      ctx.moveTo(line.x1, line.y1); ctx.lineTo(line.x2, line.y2); ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#ef4444'; ctx.font = 'bold 11px Inter'
      ctx.fillText('STOP LINE', line.x1 + 4, line.y1 - 6)
      // endpoints
      [[line.x1, line.y1], [line.x2, line.y2]].forEach(([x, y]) => {
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#fff'; ctx.fill()
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.stroke()
      })
    }
  }, [line])

  useEffect(() => { draw() }, [draw])

  const pt = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: Math.round((e.clientX - r.left) * (canvasRef.current.width / r.width)), y: Math.round((e.clientY - r.top) * (canvasRef.current.height / r.height)) }
  }

  const onMouseDown = (e) => { setDrawing(true); const p = pt(e); setStart(p); setLine(null) }
  const onMouseMove = (e) => {
    if (!drawing || !start) return
    const p = pt(e)
    const cv = canvasRef.current; const ctx = cv.getContext('2d')
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3; ctx.setLineDash([8, 4])
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(p.x, p.y); ctx.stroke()
    ctx.setLineDash([])
  }
  const onMouseUp = (e) => {
    if (!drawing || !start) return
    const p = pt(e)
    const l = { x1: start.x, y1: start.y, x2: p.x, y2: p.y }
    setLine(l); setDrawing(false); setStart(null)
  }

  const saveLine = async () => {
    if (!line || !camId) return
    // Scale to actual camera resolution (canvas is 280x157, assume 1920x1080)
    const scaleX = 1920 / 280, scaleY = 1080 / 157
    const scaledLine = { x1: Math.round(line.x1 * scaleX), y1: Math.round(line.y1 * scaleY), x2: Math.round(line.x2 * scaleX), y2: Math.round(line.y2 * scaleY) }
    await api.put(`/api/cameras/${camId}/config`, { stop_line: scaledLine })
    onLineSaved && onLineSaved(scaledLine)
    alert('Stop line saved!')
  }

  const clearLine = () => {
    setLine(null); setStart(null); setDrawing(false)
    const cv = canvasRef.current; if (cv) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height)
  }

  return {
    canvasRef, onMouseDown, onMouseMove, onMouseUp, saveLine, clearLine, hasLine: !!line,
    linePos: line ? `Y: ${line.y1}–${line.y2}` : 'Not set'
  }
}

/* ─────────────────────────── SETTINGS PANEL ─────────────────────────── */
function SettingsPanel({ settings: initSettings, onSaveSettings }) {
  const [tab, setTab] = useState('detection')
  const [vals, setVals] = useState({
    stop_duration: initSettings?.stop_duration || '0.6',
    detection_confidence: initSettings?.detection_confidence || '0.5',
    processing_fps: initSettings?.processing_fps || '25',
    snapshot_quality: initSettings?.snapshot_quality || 'high',
    save_snapshots: initSettings?.save_snapshots || 'true',
    auto_start_detection: initSettings?.auto_start_detection || 'false',
    processing_mode: initSettings?.processing_mode || 'AUTO',
    dms_eye_close_threshold: initSettings?.dms_eye_close_threshold || '1.5',
    dms_yawn_threshold: initSettings?.dms_yawn_threshold || '2.0',
    dms_phone_distraction_threshold: initSettings?.dms_phone_distraction_threshold || '1.0',
    dms_look_away_threshold: initSettings?.dms_look_away_threshold || '3.0',
    dms_alert_beep: initSettings?.dms_alert_beep || 'true',
  })

  const [saved, setSaved] = useState(false)

  useEffect(() => { if (initSettings && Object.keys(initSettings).length) setVals(v => ({ ...v, ...initSettings })) }, [initSettings])

  const sl = (key) => (e) => setVals(v => ({ ...v, [key]: e.target.value }))
  const tog = (key) => () => setVals(v => ({ ...v, [key]: v[key] === 'true' ? 'false' : 'true' }))

  const handleSave = async () => {
    await onSaveSettings(vals)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const resetDetectionDefaults = async () => {
    const defaults = {
      ...vals,
      stop_duration: '0.6',
      detection_confidence: '0.5',
      processing_fps: '25',
      dms_eye_close_threshold: '1.5',
      dms_yawn_threshold: '2.0',
      dms_phone_distraction_threshold: '1.0',
      dms_look_away_threshold: '3.0',
    }
    setVals(defaults)
    await onSaveSettings(defaults)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }


  const TABS = ['detection', 'storage', 'system', 'others']

  return (
    <div className="card settings-card">
      <div className="card-head"><span>Settings</span></div>
      <div className="s-tabs">
        {TABS.map(t => <button key={t} className={`s-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>)}
      </div>
      <div className="s-body">
        {tab === 'detection' && <>
          <div className="s-group-title">Detection Parameters</div>

          <Slider label="Stop Duration" value={vals.stop_duration || '0.6'} min={0.2} max={3.0} step={0.1} unit="seconds" onChange={sl('stop_duration')} desc="How long a vehicle must remain still inside the zone to count as a valid stop" />
          <Slider label="Detection Confidence" value={vals.detection_confidence} min={0} max={1} step={0.05} onChange={sl('detection_confidence')} desc="Minimum confidence for detections" />
          <Slider label="Processing FPS" value={vals.processing_fps} min={1} max={60} step={1} unit="FPS" onChange={sl('processing_fps')} desc="Frames per second for analysis" />

          <div className="s-group-title" style={{ marginTop: 15 }}>DMS Sensitivity Parameters</div>
          <Slider label="Drowsiness Eye-Close Trigger" value={vals.dms_eye_close_threshold || '1.5'} min={0.2} max={5.0} step={0.1} unit="seconds" onChange={sl('dms_eye_close_threshold')} desc="Time eyes must be closed continuously to trigger sleep warning" />
          <Slider label="Drowsiness Yawn Trigger" value={vals.dms_yawn_threshold || '2.0'} min={0.5} max={5.0} step={0.1} unit="seconds" onChange={sl('dms_yawn_threshold')} desc="Time mouth must be open continuously to trigger yawn warning" />
          <Slider label="Look Away Trigger" value={vals.dms_look_away_threshold || '3.0'} min={0.5} max={10.0} step={0.5} unit="seconds" onChange={sl('dms_look_away_threshold')} desc="Time driver is not looking at the road continuously to trigger warning" />
          <Slider label="Phone Distraction Trigger" value={vals.dms_phone_distraction_threshold || '1.0'} min={0.2} max={5.0} step={0.1} unit="seconds" onChange={sl('dms_phone_distraction_threshold')} desc="Time driver is holding a phone continuously to trigger warning" />
        </>}
        {tab === 'storage' && <>
          <div className="s-group-title">Storage Settings</div>
          <div className="s-option"><span>Snapshot Quality</span>
            <select className="f-sel" value={vals.snapshot_quality} onChange={sl('snapshot_quality')}>
              <option value="full">Full Resolution (100%)</option>
              <option value="high">High (95%)</option>
              <option value="medium">Medium (75%)</option>
              <option value="low">Low (50%)</option>
            </select>
          </div>
          <div className="s-option"><span>Save Violation Snapshots</span><Toggle value={vals.save_snapshots === 'true'} onChange={tog('save_snapshots')} /></div>
        </>}
        {tab === 'system' && <>
          <div className="s-group-title">System Settings</div>
          <div className="s-option"><span>Auto Boot Detection</span><Toggle value={vals.auto_start_detection === 'true'} onChange={tog('auto_start_detection')} /></div>
          <div className="s-option"><span>Processing Mode</span>
            <select className="f-sel" value={vals.processing_mode} onChange={sl('processing_mode')}>
              <option value="AUTO">Auto (Detect GPU)</option><option value="GPU">Force GPU</option><option value="CPU">Force CPU</option>
            </select>
          </div>
        </>}
        {tab === 'others' && <>
          <div className="s-group-title">Other Settings</div>
          <div className="s-option"><span>Alarm Sound On/Off</span><Toggle value={vals.dms_alert_beep === 'true'} onChange={tog('dms_alert_beep')} /></div>
        </>}

      </div>
      <div className="s-foot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {tab === 'detection' && (
            <button type="button" className="btn-secondary" onClick={resetDetectionDefaults}>
              <i className="fa-solid fa-arrow-rotate-left" /> Reset to Defaults
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: 8, color: '#10b981', fontWeight: 600, opacity: saved ? 1 : 0, transition: 'opacity 0.3s' }}>
            <i className="fa-solid fa-check" /> Settings Saved!
          </span>
          <button className="btn-accent" onClick={handleSave}><i className="fa-solid fa-floppy-disk" /> Save Settings</button>
        </div>
      </div>

    </div>
  )
}

function Slider({ label, value, min, max, step, unit = '', onChange, desc }) {
  return (
    <div className="s-slider">
      <div className="s-sl-head"><span>{label}</span><span><b>{Number(value).toFixed(step < 1 ? 1 : 0)}</b>{unit ? ' ' + unit : ''}</span></div>
      <input type="range" className="range" min={min} max={max} step={step} value={value} onChange={onChange} />
      {desc && <div className="s-desc">{desc}</div>}
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <label className="tog">
      <input type="checkbox" checked={value} onChange={onChange} />
      <span className="tog-sl" />
    </label>
  )
}

/* ─────────────────────────── EVENTS TABLE ─────────────────────────── */
function EventsTable({ cameras, onNavigate, onImageClick, eventTrigger }) {
  const [events, setEvents] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [camFilter, setCamFilter] = useState('all')
  const [statFilter, setStatFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const PER_PAGE = 10

  const loadEvents = async () => {
    try {
      let url = `/api/events?page=${page}&per_page=${PER_PAGE}`
      if (camFilter !== 'all') url += `&camera_id=${camFilter}`
      if (statFilter !== 'all') url += `&status=${statFilter}`
      if (categoryFilter !== 'all') url += `&event_category=${categoryFilter}`
      const d = await api.get(url)
      setEvents(d.items || [])
      setTotal(d.total || 0)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadEvents()
  }, [page, camFilter, statFilter, categoryFilter, eventTrigger])

  const toggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Reviewed' ? 'Pending' : 'Reviewed'
    await api.put(`/api/events/${id}/status`, { status: nextStatus })
    setEvents(ev => ev.map(e => e.id === id ? { ...e, status: nextStatus } : e))
  }

  const pages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <div className="card tbl-card">
      <div className="card-head">
        <span>All Safety Non-Compliance Events</span>
      </div>
      <div className="tbl-filters">
        <select className="f-sel" value={camFilter} onChange={e => { setCamFilter(e.target.value); setPage(1) }}>
          <option value="all">All Cameras</option>
          {(cameras || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="f-sel" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}>
          <option value="all">All Categories (Traffic + DMS)</option>
          <option value="traffic">Traffic Compliance Only</option>
          <option value="dms">DMS Cabin Monitor Only</option>
        </select>
        <select className="f-sel" value={statFilter} onChange={e => { setStatFilter(e.target.value); setPage(1) }}>
          <option value="all">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Reviewed">Reviewed</option>
        </select>
      </div>
      <div className="tbl-wrap">
        <table className="ev-tbl">
          <thead><tr><th>Time</th><th>Camera</th><th>Vehicle ID</th><th>Event Type</th><th>Status</th><th>Image</th></tr></thead>
          <tbody>
            {events.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No events found</td></tr>}
            {events.map(ev => {
              const t = (ev.timestamp || '').split(' ')
              let meta = {}
              try {
                if (ev.metadata_json) {
                  meta = typeof ev.metadata_json === 'string' ? JSON.parse(ev.metadata_json) : ev.metadata_json
                }
              } catch {}
              return (
                <tr key={ev.id}>
                  <td>{t[1] || ev.timestamp}</td>
                  <td>{ev.camera_name}</td>
                  <td>ID: {ev.vehicle_id}</td>
                  <td>
                    {(ev.event_type || '').replace(' (Pedestrian Crossing)', '')}
                    {meta.crossed_line_idx !== undefined && meta.crossed_line_idx !== null && (
                      <div style={{ fontSize: '9px', color: 'var(--t3)', marginTop: '2px' }}>
                        <i className="fa-solid fa-road" style={{ marginRight: '4px' }} />
                        Stop Line {meta.crossed_line_idx + 1}
                      </div>
                    )}
                  </td>
                  <td>
                    {ev.status === 'Pending' ? (
                      <span className="badge-p" style={{ cursor: 'pointer' }} onClick={() => toggleStatus(ev.id, ev.status)} title="Click to mark Reviewed">Pending</span>
                    ) : (
                      <span className="badge-r" style={{ cursor: 'pointer' }} onClick={() => toggleStatus(ev.id, ev.status)} title="Click to mark Pending">Reviewed</span>
                    )}
                  </td>
                  <td><img src={snapshotUrl(ev.snapshot_path)} className="tbl-img" alt="" style={{ cursor: 'pointer' }} onClick={() => {
                    const dp = ev.license_plate || meta.license_plate || meta.number_plate || ev.number_plate || null
                    const pa = meta.plate_ar || meta.license_plate_ar || null
                    onImageClick && onImageClick({
                      src: snapshotUrl(ev.snapshot_path),
                      licensePlate: dp,
                      plateAr: pa,
                      cameraName: ev.camera_name,
                      eventType: ev.event_type || 'Did Not Stop',
                      timestamp: ev.timestamp,
                      crossedLineIdx: meta.crossed_line_idx
                    })
                  }} onError={e => e.target.style.display = 'none'} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="tbl-pager">
        <span style={{ fontSize: '11px', color: 'var(--t3)', marginRight: '12px' }}>{total} total events</span>
        <button className="pg-btn" onClick={() => setPage(p => Math.max(1, p - 1))}><i className="fa-solid fa-chevron-left" /></button>
        {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map(n =>
          <button key={n} className={`pg-btn${page === n ? ' pg-active' : ''}`} onClick={() => setPage(n)}>{n}</button>
        )}
        {pages > 10 && <span style={{ color: 'var(--t3)', fontSize: 10 }}>...</span>}
        <button className="pg-btn" onClick={() => setPage(p => Math.min(pages, p + 1))}><i className="fa-solid fa-chevron-right" /></button>
      </div>
    </div>
  )
}

const STOP_LINE_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899']

/* ─────────────────────────── CAMERA CONFIG (REIMAGINED PRO HUB) ─────────────────────────── */
function CameraConfig({ activeCam, onStart, onStop, streamLoading, onSaveConfig, settings, streamKey, onSaveSettings, lines: zones, setLines: setZones, isDrawingZone, setIsDrawingZone }) {
  const [lineName, setLineName] = useState('Main Gate Stop Line')
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const previewCtxRef = useRef(null)
  const previewTimerRef = useRef(null)

  let vidW = 1920, vidH = 1080
  if (activeCam?.resolution) {
    const parts = activeCam.resolution.split('x')
    if (parts.length === 2) {
      vidW = parseInt(parts[0]) || 1920
      vidH = parseInt(parts[1]) || 1080
    }
  }

  const stopPreview = useCallback(() => {
    if (previewCtxRef.current) {
      try {
        previewCtxRef.current.close()
      } catch (e) {
        console.error("Failed to close preview AudioContext", e)
      }
      previewCtxRef.current = null
    }
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current)
      previewTimerRef.current = null
    }
    setPreviewPlaying(false)
  }, [])

  const startPreview = useCallback(() => {
    stopPreview()
    const beeperType = settings?.dms_beeper_type || 'default'
    const ctx = playDmsBeep('Drowsiness: Sleep', beeperType)
    if (!ctx) return

    previewCtxRef.current = ctx
    setPreviewPlaying(true)

    let durationSec = 1.0
    if (beeperType === 'high_intensity') durationSec = 2.4
    else if (beeperType === 'truck_horn') durationSec = 1.2
    else if (beeperType === 'pulsing_siren') durationSec = 1.5
    else if (beeperType === 'nuclear_meltdown') durationSec = 3.0
    else if (beeperType === 'klaxon') durationSec = 1.3
    else durationSec = 1.7

    previewTimerRef.current = setTimeout(() => {
      setPreviewPlaying(false)
      previewCtxRef.current = null
      previewTimerRef.current = null
    }, durationSec * 1000)
  }, [settings?.dms_beeper_type, stopPreview])

  const handleTogglePreview = () => {
    if (previewPlaying) stopPreview()
    else startPreview()
  }

  useEffect(() => {
    stopPreview()
  }, [settings?.dms_beeper_type, stopPreview])

  useEffect(() => {
    return () => {
      if (previewCtxRef.current) {
        try { previewCtxRef.current.close() } catch (e) {}
      }
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    }
  }, [])

  const camConfig = JSON.parse(activeCam?.config_json || '{}')
  const isDms = camConfig.mode === 'driver'

  const scaleAndSave = useCallback((allZones) => {
    if (!activeCam || !onSaveConfig) return
    onSaveConfig({
      stop_zones: allZones,
      stop_zone: allZones.length > 0 ? allZones[0] : null,
      stop_line_name: lineName
    })
  }, [activeCam, onSaveConfig, lineName])

  const handleAdd3DZone = () => {
    const offset = (zones.length % 5) * 35
    const newZone = [
      { x: Math.round(vidW * 0.35) + offset, y: Math.round(vidH * 0.52) + offset }, // P1: exit line left
      { x: Math.round(vidW * 0.65) + offset, y: Math.round(vidH * 0.52) + offset }, // P2: exit line right
      { x: Math.round(vidW * 0.78) + offset, y: Math.round(vidH * 0.84) + offset }, // P3: entrance right
      { x: Math.round(vidW * 0.22) + offset, y: Math.round(vidH * 0.84) + offset }  // P4: entrance left
    ]
    const updated = [...zones, newZone]
    setZones(updated)
    scaleAndSave(updated)
  }

  const deleteZone = (idx) => {
    const updated = zones.filter((_, i) => i !== idx)
    setZones(updated)
    scaleAndSave(updated)
  }

  const clearAll = async () => {
    if (zones.length === 0) return
    if (!confirm('Clear all safety stop zones for this camera?')) return
    setZones([])
    if (activeCam) {
      await onSaveConfig({ stop_zones: [], stop_zone: null, stop_line_name: '' })
    }
  }

  const handleToggleMode = async () => {
    if (!activeCam) return
    const targetMode = isDms ? 'traffic' : 'driver'
    if (confirm(`Switch this camera to ${targetMode === 'driver' ? 'Driver Monitoring (DMS Cabin Vision)' : 'Traffic Stop-Line Compliance'} mode?`)) {
      await onSaveConfig({ mode: targetMode })
    }
  }

  const handleStartDrawOnFeed = () => {
    if (setIsDrawingZone) {
      setIsDrawingZone(true)
      const feedEl = document.querySelector('.live-card')
      if (feedEl) feedEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const cam = activeCam

  return (
    <div className="card cfg-pro-card">
      {/* HEADER WITH PRO SEGMENTED SWITCHER (LIGHT + DARK THEME) */}
      <div className="cfg-pro-header">
        <div className="cfg-pro-title-wrap">
          <i className={`fa-solid ${isDms ? 'fa-user-shield' : 'fa-crosshairs'}`} style={{ color: isDms ? '#ea580c' : '#2563eb', fontSize: 13 }} />
          <span className="cfg-pro-title">Configuration — {cam?.name || 'No Camera'}</span>
        </div>

        {/* Pro Mode Segmented Switcher */}
        <div className="pro-mode-toggle" title="Switch camera analysis mode">
          <button
            type="button"
            className={`pro-mode-btn ${!isDms ? 'active traffic' : ''}`}
            onClick={() => !isDms ? null : handleToggleMode()}
          >
            <i className="fa-solid fa-road" />
            <div className="pro-mode-label">
              <span className="pro-mode-title">Traffic Stop-Line</span>
              <span className="pro-mode-sub">Road Perspective ROI</span>
            </div>
          </button>
          <button
            type="button"
            className={`pro-mode-btn ${isDms ? 'active dms' : ''}`}
            onClick={() => isDms ? null : handleToggleMode()}
          >
            <i className="fa-solid fa-user-shield" />
            <div className="pro-mode-label">
              <span className="pro-mode-title">DMS Cabin Vision</span>
              <span className="pro-mode-sub">Driver Inattention</span>
            </div>
          </button>
        </div>
      </div>

      {/* BODY CONTENT */}
      <div className="cfg-pro-body">
        {!isDms ? (
          <>
            {/* Toolbar Action Row */}
            <div className="cfg-traffic-toolbar">
              <div className="cfg-btn-group">
                <button
                  type="button"
                  onClick={handleStartDrawOnFeed}
                  className={`cfg-action-btn primary`}
                  title="Click 4 points on the live camera stream above to draw a 3D stop zone"
                >
                  <i className="fa-solid fa-pen-ruler" />
                  <span>{isDrawingZone ? 'Drawing Active...' : 'Draw 3D Zone on Feed'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAdd3DZone}
                  className="cfg-action-btn"
                  title="Add a 3D perspective quad stop zone"
                >
                  <i className="fa-solid fa-cube" />
                  <span>Add 3D Quad</span>
                </button>
                {zones.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="cfg-action-btn danger icon-only"
                    title="Clear All Zones"
                  >
                    <i className="fa-solid fa-trash-can" />
                  </button>
                )}
              </div>
            </div>

            {/* Zones Deck */}
            <div className="cfg-zones-deck">
              {zones.length > 0 ? (
                zones.map((zone, i) => (
                  <div key={i} className="cfg-zone-card">
                    <div className="cfg-zone-left">
                      <span className="cfg-zone-dot" style={{ background: STOP_LINE_COLORS[i % STOP_LINE_COLORS.length], color: STOP_LINE_COLORS[i % STOP_LINE_COLORS.length] }} />
                      <div className="cfg-zone-meta">
                        <span className="cfg-zone-name">Zone {i + 1} — 3D Perspective Stop Zone</span>
                        <span className="cfg-zone-coords">
                          Exit P1-P2: ({zone[0]?.x}, {zone[0]?.y}) → ({zone[1]?.x}, {zone[1]?.y}) · 4 Nodes
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="cfg-zone-del-btn"
                      onClick={() => deleteZone(i)}
                      title={`Delete Zone ${i + 1}`}
                    >×</button>
                  </div>
                ))
              ) : (
                <div style={{
                  padding: '16px',
                  textAlign: 'center',
                  background: 'var(--bg)',
                  border: '1px dashed var(--border2)',
                  borderRadius: '6px',
                  color: 'var(--t3)',
                  fontSize: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <i className="fa-solid fa-draw-polygon" style={{ fontSize: '18px', opacity: 0.5 }} />
                  <span>No Stop Zones defined yet. Click <b>"Draw 3D Zone on Feed"</b> or <b>"Add 3D Quad"</b> to begin.</span>
                </div>
              )}
            </div>

            {/* Pro Hint Banner */}
            <div className="cfg-pro-hint">
              <i className="fa-solid fa-lightbulb" />
              <div>
                <b>Live Interactive Calibration:</b> Calibrate directly on the Live Feed above! Click & drag any corner handle (1–4) to skew perspective to the road, or click inside any zone to drag the entire box.
              </div>
            </div>
          </>
        ) : (
          <div className="dms-pro-deck">
            <div className="dms-feature-grid">
              <div className="dms-feature-card">
                <span className="dms-feat-title"><i className="fa-solid fa-eye-slash" style={{ color: '#2563eb' }} /> Micro-Sleep / EAR</span>
                <span className="dms-feat-val">● Continuous 1.5s Threshold</span>
              </div>
              <div className="dms-feature-card">
                <span className="dms-feat-title"><i className="fa-solid fa-face-tired" style={{ color: '#ea580c' }} /> Yawning / MAR</span>
                <span className="dms-feat-val">● Continuous 2.0s Threshold</span>
              </div>
              <div className="dms-feature-card">
                <span className="dms-feat-title"><i className="fa-solid fa-mobile-screen-button" style={{ color: '#ef4444' }} /> Phone Distraction</span>
                <span className="dms-feat-val">● Hand-to-Ear AI Tracking</span>
              </div>
              <div className="dms-feature-card">
                <span className="dms-feat-title"><i className="fa-solid fa-smoking" style={{ color: '#7c3aed' }} /> Smoking & Gaze</span>
                <span className="dms-feat-val">● Head Pose Inattention</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--t1)' }}>In-Cabin Alarm Tone:</span>
                <button
                  type="button"
                  onClick={handleTogglePreview}
                  style={{
                    background: previewPlaying ? 'rgba(239, 68, 68, 0.15)' : 'rgba(37, 99, 235, 0.15)',
                    color: previewPlaying ? '#ef4444' : '#2563eb',
                    border: `1px solid ${previewPlaying ? 'rgba(239, 68, 68, 0.3)' : 'rgba(37, 99, 235, 0.3)'}`,
                    borderRadius: '4px',
                    padding: '3px 8px',
                    cursor: 'pointer',
                    fontSize: '9.5px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <i className={`fa-solid ${previewPlaying ? 'fa-volume-xmark' : 'fa-volume-high'}`} />
                  <span>{previewPlaying ? 'Stop Audio' : 'Test Tone'}</span>
                </button>
              </div>
              <select
                className="mini-sel"
                style={{ fontSize: '10px', padding: '6px 8px', background: 'var(--panel)', border: '1px solid var(--border2)', borderRadius: '4px', color: 'var(--t1)', width: '100%', outline: 'none' }}
                value={settings?.dms_beeper_type || 'default'}
                onChange={(e) => onSaveSettings && onSaveSettings({ dms_beeper_type: e.target.value })}
              >
                <option value="default">Default Alert Beep</option>
                <option value="high_intensity">🔊 High Intensity Awakening Horn</option>
                <option value="truck_horn">🚚 Dual Truck Air Horn</option>
                <option value="pulsing_siren">🚨 High Pitch Pulsing Siren</option>
                <option value="nuclear_meltdown">🚨 Industrial Warning Siren</option>
                <option value="klaxon">📢 Loud Klaxon Alarm</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* PINNED FIXED FOOTER ACTION ROW */}
      <div className="cfg-pro-footer">
        {(() => {
          const isOnline = cam?.status === 'online' || !!cam?.runtime_status?.running
          return (
            <button
              onClick={isOnline ? onStop : onStart}
              disabled={streamLoading}
              className={`cfg-start-btn ${isOnline ? 'stop' : 'start'} ${streamLoading ? 'loading' : ''}`}
            >
              {streamLoading ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin" />
                  <span>{isOnline ? 'Stopping Stream...' : 'Starting Stream...'}</span>
                </>
              ) : (
                <>
                  <i className={`fa-solid ${isOnline ? 'fa-stop' : 'fa-play'}`} />
                  <span>{isOnline ? 'Stop Stream Analysis' : 'Start Live Analysis'}</span>
                </>
              )}
            </button>
          )
        })()}
      </div>
    </div>
  )
}


/* ─────────────────────────── LIVE VIEW ─────────────────────────── */
function LiveView({ cameras, activeCam, onCamSwitch, telemetry, streamKey, lines: zones, setLines: setZones, onSaveConfig, onStart, onStop, streamLoading, isDrawingZone, setIsDrawingZone }) {
  const isDms = telemetry && telemetry.mode === 'driver'
  const activeViolations = isDms && telemetry.active_violations ? telemetry.active_violations : []

  const hasCritical = activeViolations.some(v => v.includes("Sleep") || v.includes("Phone") || v.includes("Smoking") || v.includes("Seatbelt") || v.includes("Drowsy"))
  const hasWarning = activeViolations.some(v => v.includes("Yawning") || v.includes("Eating") || v.includes("Drinking") || v.includes("Looking Away") || v.includes("Distracted"))

  const fallbackDrowsy = isDms && telemetry.drowsinessLevel > 40
  const fallbackDistracted = isDms && telemetry.attentionScore < 50 && !fallbackDrowsy

  const isDrowsy = activeViolations.length > 0 ? hasCritical : fallbackDrowsy
  const isDistracted = activeViolations.length > 0 ? hasWarning : fallbackDistracted

  const fps = telemetry ? telemetry.fps : 25

  let vidW = 1920, vidH = 1080
  if (activeCam?.resolution) {
    const parts = activeCam.resolution.split('x')
    if (parts.length === 2) {
      vidW = parseInt(parts[0]) || 1920
      vidH = parseInt(parts[1]) || 1080
    }
  }

  /* ── Stop-zone drawing on the live preview canvas ── */
  const liveCanvasRef = useRef(null)
  const liveDragRef = useRef(null) // { type: 'point'|'zone', zoneIdx, pointIdx, startX, startY, origPoints }
  const [liveCursor, setLiveCursor] = useState('default')
  const [streamProtocol, setStreamProtocol] = useState('mjpeg') // 'mjpeg' (smooth default) | 'webrtc'
  const videoRef = useRef(null)
  const [imgLoaded, setImgLoaded] = useState(false)

  const [playerSkin, setPlayerSkin] = useState(
    () => localStorage.getItem('vigilix_player_skin') || 'winamp-amber'
  )

  const handleSkinChange = (newSkin) => {
    setPlayerSkin(newSkin)
    localStorage.setItem('vigilix_player_skin', newSkin)
  }

  useEffect(() => {
    setImgLoaded(false)
    if (activeCam?.status === 'online' || activeCam?.runtime_status?.running) {
      const timer = setTimeout(() => setImgLoaded(true), 600)
      return () => clearTimeout(timer)
    } else {
      setImgLoaded(false)
    }
  }, [activeCam?.id, activeCam?.status, activeCam?.runtime_status?.running, streamKey])

  // 3D Perspective interactive click-to-draw state
  const [drawnPoints, setDrawnPoints] = useState([])
  const [mousePos, setMousePos] = useState(null)

  useEffect(() => {
    if (!activeCam || activeCam.status !== 'online' || streamProtocol !== 'webrtc') return
    let pc = null
    let active = true

    async function initWebRTC() {
      if (!videoRef.current) return
      try {
        pc = await startWebRTCStream(activeCam.id, videoRef.current, (state) => {
          if (!active) return
          if (state === 'connected') {
            setStreamProtocol('webrtc')
          } else if (state === 'failed') {
            setStreamProtocol('mjpeg')
          }
        })
        if (!pc && active) {
          setStreamProtocol('mjpeg')
        }
      } catch {
        if (active) setStreamProtocol('mjpeg')
      }
    }

    initWebRTC()

    return () => {
      active = false
      if (pc) pc.close()
    }
  }, [activeCam?.id, activeCam?.status, streamKey, streamProtocol])

  // ESC key cancels drawing mode
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && isDrawingZone) {
        setIsDrawingZone?.(false)
        setDrawnPoints([])
        setMousePos(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDrawingZone, setIsDrawingZone])

  // Ray-casting point-in-polygon helper
  const isPointInPoly = (pt, poly) => {
    if (!poly || poly.length < 3) return false
    let inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y
      const xj = poly[j].x, yj = poly[j].y
      const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)
      if (intersect) inside = !inside
    }
    return inside
  }

  const findLiveHit = (p) => {
    const cv = liveCanvasRef.current
    const hitRadius = 24 * (cv ? (cv.width / 800) : 1)
    // 1. Check corner vertices first (highest priority)
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i]
      for (let j = 0; j < zone.length; j++) {
        const pt = zone[j]
        const d = Math.hypot(p.x - pt.x, p.y - pt.y)
        if (d <= hitRadius) return { type: 'point', zoneIdx: i, pointIdx: j }
      }
    }
    // 2. Check if inside any polygon (to drag whole zone)
    for (let i = zones.length - 1; i >= 0; i--) {
      if (isPointInPoly(p, zones[i])) {
        return {
          type: 'zone',
          zoneIdx: i,
          startX: p.x,
          startY: p.y,
          origPoints: zones[i].map(pt => ({ ...pt }))
        }
      }
    }
    return null
  }

  const livePt = (e) => {
    const cv = liveCanvasRef.current; if (!cv) return { x: 0, y: 0 }
    const r = cv.getBoundingClientRect()
    return {
      x: Math.round((e.clientX - r.left) * (cv.width / r.width)),
      y: Math.round((e.clientY - r.top) * (cv.height / r.height))
    }
  }

  const liveScaleAndSave = useCallback((allZones) => {
    if (!activeCam || !onSaveConfig) return
    onSaveConfig({
      stop_zones: allZones,
      stop_zone: allZones[0] || null,
    })
  }, [activeCam, onSaveConfig])

  const drawLiveLines = useCallback((ctx, cv, zonesList, activeDrag, drawPts, curMouse) => {
    ctx.clearRect(0, 0, cv.width, cv.height)
    const scale = cv.width / 800

    // 1. Draw all configured 3D perspective zones
    zonesList.forEach((zone, idx) => {
      if (!zone || zone.length < 3) return
      const color = STOP_LINE_COLORS[idx % STOP_LINE_COLORS.length]

      // Translucent filled polygon
      ctx.fillStyle = color + '26' // ~15% opacity hex
      ctx.beginPath()
      ctx.moveTo(zone[0].x, zone[0].y)
      for (let i = 1; i < zone.length; i++) {
        ctx.lineTo(zone[i].x, zone[i].y)
      }
      ctx.closePath()
      ctx.fill()

      // Red dashed line for the Exit Stop Line (P1 -> P2)
      ctx.save()
      ctx.shadowColor = 'rgba(239, 68, 68, 0.7)'
      ctx.shadowBlur = 8 * scale
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 4 * scale
      ctx.setLineDash([12 * scale, 6 * scale])
      ctx.beginPath()
      ctx.moveTo(zone[0].x, zone[0].y)
      ctx.lineTo(zone[1].x, zone[1].y)
      ctx.stroke()
      ctx.restore()

      // Softer solid lines for other boundaries
      ctx.strokeStyle = color
      ctx.lineWidth = 2.5 * scale
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(zone[1].x, zone[1].y)
      for (let i = 2; i < zone.length; i++) {
        ctx.lineTo(zone[i].x, zone[i].y)
      }
      ctx.lineTo(zone[0].x, zone[0].y)
      ctx.stroke()

      // Centroid Zone Label pill
      let cx = 0, cy = 0
      zone.forEach(pt => { cx += pt.x; cy += pt.y })
      cx = Math.round(cx / zone.length)
      cy = Math.round(cy / zone.length)

      const isDraggingThisZone = activeDrag && activeDrag.zoneIdx === idx
      const zoneName = `Zone ${idx + 1}`

      ctx.save()
      ctx.font = `bold ${10 * scale}px sans-serif`
      const tw = ctx.measureText(zoneName).width
      const padX = 7 * scale
      const pillH = 18 * scale
      ctx.fillStyle = isDraggingThisZone && activeDrag.type === 'zone' ? color : 'rgba(15, 23, 42, 0.85)'
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5 * scale
      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(cx - tw / 2 - padX, cy - pillH / 2, tw + padX * 2, pillH, 5 * scale)
      } else {
        ctx.rect(cx - tw / 2 - padX, cy - pillH / 2, tw + padX * 2, pillH)
      }
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(zoneName, cx, cy)
      ctx.restore()

      // Corner handles (nodes 1 to 4)
      zone.forEach((pt, pIdx) => {
        const isDraggingPoint = isDraggingThisZone && activeDrag.type === 'point' && activeDrag.pointIdx === pIdx
        const r = isDraggingPoint ? 12 * scale : 9 * scale

        ctx.beginPath()
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2)
        ctx.fillStyle = isDraggingPoint ? color : '#ffffff'
        ctx.fill()
        ctx.strokeStyle = color
        ctx.lineWidth = 2.5 * scale
        ctx.stroke()

        ctx.fillStyle = isDraggingPoint ? '#ffffff' : (pIdx < 2 ? '#ef4444' : '#10b981')
        ctx.font = `bold ${10 * scale}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((pIdx + 1).toString(), pt.x, pt.y)
      })
    })

    // 2. Render in-progress drawing points & rubber-band guides
    if (drawPts && drawPts.length > 0) {
      const drawColor = '#3b82f6'
      drawPts.forEach((pt, i) => {
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 11 * scale, 0, Math.PI * 2)
        ctx.fillStyle = drawColor
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2.5 * scale
        ctx.stroke()

        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${11 * scale}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((i + 1).toString(), pt.x, pt.y)
      })

      if (drawPts.length > 1) {
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 3 * scale
        ctx.setLineDash([8 * scale, 4 * scale])
        ctx.beginPath()
        ctx.moveTo(drawPts[0].x, drawPts[0].y)
        for (let i = 1; i < drawPts.length; i++) {
          ctx.lineTo(drawPts[i].x, drawPts[i].y)
        }
        ctx.stroke()
        ctx.setLineDash([])
      }

      if (curMouse) {
        const lastPt = drawPts[drawPts.length - 1]
        ctx.strokeStyle = '#60a5fa'
        ctx.lineWidth = 2.5 * scale
        ctx.setLineDash([6 * scale, 6 * scale])
        ctx.beginPath()
        ctx.moveTo(lastPt.x, lastPt.y)
        ctx.lineTo(curMouse.x, curMouse.y)
        ctx.stroke()
        ctx.setLineDash([])

        ctx.beginPath()
        ctx.arc(curMouse.x, curMouse.y, 9 * scale, 0, Math.PI * 2)
        ctx.strokeStyle = '#60a5fa'
        ctx.lineWidth = 2 * scale
        ctx.stroke()

        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)'
        ctx.font = `bold ${10 * scale}px sans-serif`
        const msg = `Click: Point ${drawPts.length + 1}`
        const mw = ctx.measureText(msg).width
        ctx.fillRect(curMouse.x + 14 * scale, curMouse.y - 11 * scale, mw + 10 * scale, 22 * scale)
        ctx.fillStyle = '#93c5fd'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(msg, curMouse.x + 19 * scale, curMouse.y)
      }
    }
  }, [])

  const onLiveMD = (e) => {
    if (isDms) return
    e.preventDefault()
    const p = livePt(e)

    if (isDrawingZone) {
      if (drawnPoints.length < 3) {
        setDrawnPoints(prev => [...prev, p])
      } else {
        // 4th point: complete 3D quad!
        const newZone = [...drawnPoints, p]
        const updated = [...zones, newZone]
        setZones(updated)
        liveScaleAndSave(updated)
        setDrawnPoints([])
        setIsDrawingZone?.(false)
        setMousePos(null)
      }
      return
    }

    const hit = findLiveHit(p)
    if (hit) {
      liveDragRef.current = hit
    }
  }

  const onLiveMM = (e) => {
    if (isDms) return
    const p = livePt(e); const cv = liveCanvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')

    if (isDrawingZone) {
      setMousePos(p)
      drawLiveLines(ctx, cv, zones, null, drawnPoints, p)
      setLiveCursor('crosshair')
      return
    }

    // Dragging an endpoint or whole zone
    if (liveDragRef.current) {
      if (liveDragRef.current.type === 'point') {
        const { zoneIdx, pointIdx } = liveDragRef.current
        const updated = zones.map((z, zIdx) => {
          if (zIdx !== zoneIdx) return z
          return z.map((pt, pIdx) =>
            pIdx === pointIdx ? { x: Math.max(0, Math.min(vidW, p.x)), y: Math.max(0, Math.min(vidH, p.y)) } : pt
          )
        })
        drawLiveLines(ctx, cv, updated, liveDragRef.current, null, null)
      } else if (liveDragRef.current.type === 'zone') {
        const { zoneIdx, startX, startY, origPoints } = liveDragRef.current
        const dx = p.x - startX
        const dy = p.y - startY
        const updated = zones.map((z, zIdx) => {
          if (zIdx !== zoneIdx) return z
          return origPoints.map(pt => ({
            x: Math.max(0, Math.min(vidW, pt.x + dx)),
            y: Math.max(0, Math.min(vidH, pt.y + dy))
          }))
        })
        drawLiveLines(ctx, cv, updated, liveDragRef.current, null, null)
      }
      return
    }

    // Hover cursor
    const hit = findLiveHit(p)
    if (hit?.type === 'point') setLiveCursor('grab')
    else if (hit?.type === 'zone') setLiveCursor('move')
    else setLiveCursor('default')
  }

  const onLiveMU = (e) => {
    if (isDms || isDrawingZone) return
    const p = livePt(e)

    if (liveDragRef.current) {
      let updated = zones
      if (liveDragRef.current.type === 'point') {
        const { zoneIdx, pointIdx } = liveDragRef.current
        updated = zones.map((z, zIdx) => {
          if (zIdx !== zoneIdx) return z
          return z.map((pt, pIdx) =>
            pIdx === pointIdx ? { x: Math.max(0, Math.min(vidW, p.x)), y: Math.max(0, Math.min(vidH, p.y)) } : pt
          )
        })
      } else if (liveDragRef.current.type === 'zone') {
        const { zoneIdx, startX, startY, origPoints } = liveDragRef.current
        const dx = p.x - startX
        const dy = p.y - startY
        updated = zones.map((z, zIdx) => {
          if (zIdx !== zoneIdx) return z
          return origPoints.map(pt => ({
            x: Math.max(0, Math.min(vidW, pt.x + dx)),
            y: Math.max(0, Math.min(vidH, pt.y + dy))
          }))
        })
      }
      setZones(updated)
      liveDragRef.current = null
      liveScaleAndSave(updated)
    }
  }

  // Re-draw all lines on the live canvas whenever `zones`, `isDrawingZone`, or `drawnPoints` changes
  useEffect(() => {
    const cv = liveCanvasRef.current; if (!cv || isDms) return
    const ctx = cv.getContext('2d')
    drawLiveLines(ctx, cv, zones, null, drawnPoints, mousePos)
  }, [zones, isDms, isDrawingZone, drawnPoints, mousePos, drawLiveLines])

  const handleFullscreen = () => {
    const el = document.querySelector('.live-wrap')
    if (el) el.requestFullscreen?.()
  }

  return (
    <div className="card live-card">
      <div className="card-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span>Live View - <b>{activeCam?.name || 'No Camera'}</b></span>
          <span className="live-tag">LIVE</span>
          {activeCam && activeCam.status === 'online' && (
            <button
              onClick={() => setStreamProtocol(p => p === 'mjpeg' ? 'webrtc' : 'mjpeg')}
              title="Click to toggle between Direct MJPEG Stream (Ultra Smooth) and WebRTC Low Latency"
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '4px',
                background: streamProtocol === 'mjpeg' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: streamProtocol === 'mjpeg' ? '#3b82f6' : '#10b981',
                border: `1px solid ${streamProtocol === 'mjpeg' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <i className={streamProtocol === 'mjpeg' ? "fa-solid fa-bolt" : "fa-solid fa-satellite-dish"} />
              {streamProtocol === 'mjpeg' ? 'MJPEG Stream (Smooth)' : 'WebRTC Stream'}
            </button>
          )}

          {/* 3D Perspective Zone Drawing Mode Toggle */}
          {!isDms && activeCam?.status === 'online' && (
            <button
              type="button"
              onClick={() => {
                setIsDrawingZone?.(prev => !prev)
                setDrawnPoints([])
                setMousePos(null)
              }}
              className={`live-draw-btn ${isDrawingZone ? 'active' : ''}`}
              title="Draw a 4-point 3D stop zone directly on the live camera stream"
            >
              <i className={isDrawingZone ? "fa-solid fa-xmark" : "fa-solid fa-draw-polygon"} />
              <span>{isDrawingZone ? `Cancel Drawing (${drawnPoints.length}/4)` : '✏️ Draw 3D Zone'}</span>
            </button>
          )}
          {/* Skin Selector Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--bg)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border2)' }}>
            <i className="fa-solid fa-palette" style={{ fontSize: '10px', color: 'var(--accent)' }} />
            <select
              className="mini-sel"
              value={playerSkin}
              onChange={(e) => handleSkinChange(e.target.value)}
              title="Select Player Skin (Winamp Amber, Mahogany Wood & Brass, Cyber Obsidian, Vintage Hi-Fi, Modern)"
              style={{ border: 'none', background: 'var(--bg)', color: 'var(--t1)', padding: '1px 3px', fontSize: '9.5px', fontWeight: '600', cursor: 'pointer' }}
            >
              {PLAYER_SKINS.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button className="icon-btn" onClick={handleFullscreen} title="Fullscreen"><i className="fa-solid fa-expand" /></button>
      </div>

      <SkeuomorphicPlayer
        skin={playerSkin}
        onSkinChange={handleSkinChange}
        activeCam={activeCam}
        cameras={cameras}
        isActiveOnline={activeCam?.status === 'online' || !!activeCam?.runtime_status?.running}
        streamLoading={streamLoading}
        onStart={onStart}
        onStop={onStop}
        onCamSwitch={onCamSwitch}
        fps={fps}
        telemetry={telemetry}
        isDms={isDms}
        onFullscreen={handleFullscreen}
        onToggleDraw={() => setIsDrawingZone?.(prev => !prev)}
        isDrawingZone={isDrawingZone}
      >
      <div className={`live-wrap${isDrowsy ? ' alert-drowsy' : isDistracted ? ' alert-distracted' : ''}`}>
        {/* Active Drawing HUD Banner Overlay */}
        {isDrawingZone && (
          <div className="live-drawing-hud-bar">
            <span className="live-drawing-pulse-dot" />
            <span><b>DRAW 3D PERSPECTIVE ZONE:</b> Click Point {drawnPoints.length + 1} of 4 on Road Surface</span>
            <span className="live-drawing-hud-sub">[{drawnPoints.length === 0 ? 'P1: Exit Line Left' : drawnPoints.length === 1 ? 'P2: Exit Line Right' : drawnPoints.length === 2 ? 'P3: Entry Line Right' : 'P4: Entry Line Left'}] · ESC to cancel</span>
          </div>
        )}

        {activeCam && activeCam.status === 'online' ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="live-img"
              style={{
                display: streamProtocol === 'webrtc' ? 'block' : 'none',
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                pointerEvents: 'none'
              }}
            />
            <img
              key={`${activeCam.id}-${streamKey}`}
              src={`${streamUrl(activeCam.id)}?t=${streamKey}`}
              alt="Live Feed"
              className="live-img"
              style={{
                display: streamProtocol === 'mjpeg' ? 'block' : 'none',
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                pointerEvents: 'none'
              }}
              onLoad={() => setImgLoaded(true)}
              onError={(e) => {
                setTimeout(() => {
                  if (e.target) e.target.src = `${streamUrl(activeCam.id)}?t=${Date.now()}`
                }, 1200)
              }}
            />
            {activeCam?.status === 'online' && !imgLoaded && (
              <div className="live-ph live-connecting-hero" style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
                <div className="live-connecting-spinner-wrap">
                  <div className="live-connecting-radar-ring" />
                  <div className="live-connecting-radar-ring ring-2" />
                  <div className="live-connecting-spinner">
                    <i className="fa-solid fa-circle-notch fa-spin" />
                  </div>
                </div>
                <div className="live-paused-info">
                  <div className="live-paused-title">{activeCam.name}</div>
                  <div className="live-connecting-status-badge">
                    <span className="dot-connecting" /> CONNECTING TO STREAM...
                  </div>
                  <div className="live-paused-hint">Starting camera feed & AI inference pipeline...</div>
                </div>
              </div>
            )}
            {!isDms && (
              <canvas ref={liveCanvasRef} width={vidW} height={vidH}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  cursor: isDrawingZone ? 'crosshair' : (liveDragRef.current ? (liveDragRef.current.type === 'point' ? 'grabbing' : 'move') : liveCursor),
                  zIndex: 2
                }}
                onMouseDown={onLiveMD} onMouseMove={onLiveMM} onMouseUp={onLiveMU}
              />
            )}
          </>
        ) : activeCam ? (
          streamLoading ? (
            <div className="live-ph live-connecting-hero">
              <div className="live-connecting-spinner-wrap">
                <div className="live-connecting-radar-ring" />
                <div className="live-connecting-radar-ring ring-2" />
                <div className="live-connecting-spinner">
                  <i className="fa-solid fa-circle-notch fa-spin" />
                </div>
              </div>
              <div className="live-paused-info">
                <div className="live-paused-title">{activeCam.name}</div>
                <div className="live-connecting-status-badge">
                  <span className="dot-connecting" /> CONNECTING TO STREAM...
                </div>
                <div className="live-paused-hint">Initializing AI inference engine & frame buffer...</div>
              </div>
            </div>
          ) : (
            <div className="live-ph live-paused-hero" onClick={onStart}>
              <div className="live-play-glow-wrap">
                <div className="live-play-pulse-ring" />
                <button
                  className="live-big-play-btn"
                  onClick={(e) => { e.stopPropagation(); onStart(); }}
                  title="Start Live Analysis"
                >
                  <i className="fa-solid fa-play" />
                </button>
              </div>
              <div className="live-paused-info">
                <div className="live-paused-title">{activeCam.name}</div>
                <div className="live-paused-status-badge">
                  <span className="dot-idle" /> STREAM PAUSED
                </div>
                <div className="live-paused-hint">Click anywhere or press Play to resume live detection</div>
              </div>
            </div>
          )
        ) : (
          <div className="live-ph" style={{ background: 'var(--bg)' }}><i className="fa-solid fa-video-slash" /><p>No camera connected</p></div>
        )}

        {/* Flashing Urgency Headings */}
        {activeViolations.length > 0 ? (
          <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', zIndex: 10 }}>
            {activeViolations.map((v, i) => {
              const isCrit = v.includes("Sleep") || v.includes("Phone") || v.includes("Smoking") || v.includes("Seatbelt") || v.includes("Drowsy")
              const getViolationLabel = (val) => {
                if (val.includes("Sleep")) return "FATIGUE CRITICAL: SLEEP DETECTED!";
                if (val.includes("Yawning")) return "FATIGUE WARNING: YAWNING DETECTED!";
                if (val.includes("Drowsy")) return "FATIGUE WARNING: DROWSINESS DETECTED!";
                if (val.includes("Phone")) return "CRITICAL DISTRACTION: PHONE USE DETECTED!";
                if (val.includes("Smoking")) return "DMS VIOLATION: SMOKING DETECTED!";
                if (val.includes("Eating")) return "DMS WARNING: EATING DETECTED!";
                if (val.includes("Drinking")) return "DMS WARNING: DRINKING DETECTED!";
                if (val.includes("Seatbelt")) return "SAFETY VIOLATION: SEATBELT UNFASTENED!";
                if (val.includes("Looking Away")) return "DMS WARNING: LOOKING AWAY!";
                if (val.includes("Distracted") || val.includes("Distraction")) return "DMS WARNING: DISTRACTED DRIVING!";
                return val.toUpperCase();
              };
              return (
                <div key={i} className={`live-alert-overlay live-alert-list-item ${isCrit ? '' : 'caution'}`}>
                  <i className={`fa-solid ${isCrit ? 'fa-triangle-exclamation' : 'fa-circle-exclamation'}`} style={{ color: isCrit ? '#f87171' : '#fbbf24', marginRight: '6px' }} />
                  {getViolationLabel(v)}
                </div>
              )
            })}
          </div>
        ) : (
          <>
            {isDrowsy && (
              <div className="live-alert-overlay">
                <i className="fa-solid fa-triangle-exclamation" style={{ color: '#f87171' }} />
                FATIGUE CRITICAL: SLEEP WARNING!
              </div>
            )}
            {isDistracted && (
              <div className="live-alert-overlay caution">
                <i className="fa-solid fa-circle-exclamation" style={{ color: '#fbbf24' }} />
                DRIVER DISTRACTED: ATTENTION WARNING
              </div>
            )}
          </>
        )}

        {/* DMS Real-time Visual Telemetry Gauges inside Live Feed */}
        {isDms && (
          <div className="dms-telemetry-panel">
            <div className="dms-tel-item">
              <div className="dms-tel-head"><span>DRIVER ATTENTION</span><b>{telemetry.attentionScore.toFixed(0)}%</b></div>
              <div className="dms-tel-track">
                <div className="dms-tel-fill" style={{
                  width: `${telemetry.attentionScore}%`,
                  backgroundColor: telemetry.attentionScore > 50 ? '#2eed6e' : '#ff3b3b',
                  boxShadow: telemetry.attentionScore > 50 ? '0 0 8px rgba(46, 237, 110, 0.4)' : '0 0 8px rgba(255, 59, 59, 0.4)'
                }} />
              </div>
            </div>
            <div className="dms-tel-item">
              <div className="dms-tel-head"><span>FATIGUE SCORE</span><b>{telemetry.drowsinessLevel.toFixed(0)}%</b></div>
              <div className="dms-tel-track">
                <div className="dms-tel-fill" style={{
                  width: `${telemetry.drowsinessLevel}%`,
                  backgroundColor: telemetry.drowsinessLevel > 40 ? '#ff3b3b' : '#2eed6e',
                  boxShadow: telemetry.drowsinessLevel > 40 ? '0 0 8px rgba(255, 59, 59, 0.4)' : '0 0 8px rgba(46, 237, 110, 0.4)'
                }} />
              </div>
            </div>
          </div>
        )}
      </div>
      </SkeuomorphicPlayer>

      {playerSkin === 'standard' && (
      <div className="live-bar">
        {(() => {
          const isActiveOnline = activeCam?.status === 'online' || !!activeCam?.runtime_status?.running
          return (
            <>
              <button
                className={`live-stream-btn ${isActiveOnline ? 'is-playing' : 'is-paused'} ${streamLoading ? 'loading' : ''}`}
                onClick={isActiveOnline ? onStop : onStart}
                disabled={streamLoading}
                title={isActiveOnline ? 'Click to pause live analysis' : 'Click to start live analysis'}
              >
                {streamLoading ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin" />
                    <span>{isActiveOnline ? 'STOPPING...' : 'STARTING...'}</span>
                  </>
                ) : (
                  <>
                    <span className="live-btn-dot" />
                    <i className={`fa-solid ${isActiveOnline ? 'fa-pause' : 'fa-play'}`} />
                    <span>{isActiveOnline ? 'PAUSE' : 'PLAY'}</span>
                  </>
                )}
              </button>
              <span className="live-bar-divider" />
              <span>FPS: <b>{fps}</b></span>
              <span>Detection: <b className={isActiveOnline ? "txt-green" : "txt-muted"}>{isActiveOnline ? '● ON' : '○ OFF'}</b></span>
              <span>Tracking: <b className={isActiveOnline ? "txt-green" : "txt-muted"}>{isActiveOnline ? '● ON' : '○ OFF'}</b></span>
              <span className="bar-spacer" />
            </>
          )
        })()}
        <span>Camera:</span>
        <select className="mini-sel" value={activeCam?.id || ''} onChange={e => onCamSwitch(e.target.value)}>
          {cameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          {cameras.length === 0 && <option>No cameras</option>}
        </select>
        <button className="icon-btn-sm" title="Fullscreen" onClick={handleFullscreen}><i className="fa-solid fa-expand" /></button>
      </div>
      )}
    </div>
  )
}


/* ─────────────────────────── EVIDENCE IMAGE PREVIEW MODAL ─────────────────────────── */
function SaudiPlate({ licensePlate, plateAr }) {
  if (!licensePlate) return null;
  
  // Clean plate inputs (extract digits and letters)
  const numbers = (licensePlate || '').match(/\d+/)?.[0] || '';
  const letters = (licensePlate || '').replace(/\d+/g, '').replace(/[^a-zA-Z]/g, '').toUpperCase();
  
  // Translation maps (mapping English digits and characters to standard Saudi license symbols)
  const digitsMap = {
    '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
    '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩'
  };
  const lettersMap = {
    'A': 'أ', 'B': 'ب', 'J': 'ح', 'D': 'د', 'R': 'ر',
    'S': 'س', 'X': 'ص', 'T': 'ط', 'E': 'ع', 'G': 'ق',
    'K': 'ك', 'L': 'ل', 'M': 'م', 'N': 'ن', 'H': 'هـ',
    'V': 'و', 'Y': 'ى', 'Z': 'ز'
  };
  
  // Translate English plate to Arabic dynamically if plateAr is not set
  const translatedNum = numbers.split('').map(d => digitsMap[d] || d).join('');
  const translatedLetters = letters.split('').map(l => lettersMap[l] || l).join(' ');
  
  let cleanPlateAr = plateAr;
  if (!cleanPlateAr) {
    cleanPlateAr = translatedLetters;
  }
  const cleanNumAr = translatedNum;

  return (
    <div style={{
      width: '240px',
      height: '80px',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
      border: '4px solid #334155',
      borderRadius: '8px',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.6)',
      display: 'flex',
      position: 'relative',
      fontFamily: "'Inter', sans-serif",
      overflow: 'hidden',
      userSelect: 'none'
    }}>
      {/* English Part (Left) */}
      <div style={{
        flex: '1.2',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRight: '3px solid #334155',
        padding: '2px'
      }}>
        <div style={{
          fontSize: '22px',
          fontWeight: '900',
          letterSpacing: '1px',
          color: '#1e293b',
          lineHeight: '1.1'
        }}>
          {numbers}
        </div>
        <div style={{
          fontSize: '11px',
          fontWeight: '800',
          letterSpacing: '2px',
          color: '#475569',
          marginTop: '4px',
          textTransform: 'uppercase'
        }}>
          {letters.split('').join(' ')}
        </div>
      </div>
      
      {/* Vertical divider info (Middle) */}
      <div style={{
        width: '35px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 0',
        borderRight: '3px solid #334155',
        fontSize: '7px',
        fontWeight: '900',
        color: '#475569',
        backgroundColor: '#f1f5f9'
      }}>
        <div style={{ transform: 'scale(0.95)' }}>KSA</div>
        <div style={{ fontSize: '10px', color: '#1e293b', lineHeight: '1' }}>🇸🇦</div>
        <div style={{ fontSize: '6px' }}>السعودية</div>
      </div>
      
      {/* Arabic Part (Right) */}
      <div style={{
        flex: '1.2',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px'
      }}>
        <div style={{
          fontSize: '24px',
          fontWeight: '900',
          color: '#1e293b',
          lineHeight: '1.1'
        }}>
          {cleanNumAr}
        </div>
        <div style={{
          fontSize: '13px',
          fontWeight: '800',
          color: '#475569',
          marginTop: '2px',
          direction: 'rtl'
        }}>
          {cleanPlateAr}
        </div>
      </div>
    </div>
  );
}

function ImageModal({ preview, onClose }) {
  if (!preview) return null;
  const src = typeof preview === 'string' ? preview : preview.src;
  const licensePlate = typeof preview === 'object' ? preview.licensePlate : null;
  const plateAr = typeof preview === 'object' ? preview.plateAr : null;
  const cameraName = typeof preview === 'object' ? preview.cameraName : null;
  const eventType = typeof preview === 'object' ? preview.eventType : null;
  const timestamp = typeof preview === 'object' ? preview.timestamp : null;
  const crossedLineIdx = typeof preview === 'object' ? preview.crossedLineIdx : null;

  const cleanEventType = (eventType || '').replace(' (Pedestrian Crossing)', '');
  const isPedestrian = (eventType || '').includes('Pedestrian');

  return (
    <div className="modal-overlay" style={{
      zIndex: 9999,
      background: 'rgba(7, 10, 20, 0.82)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }} onClick={onClose}>
      <div className="modal" style={{
        width: 'min(92vw, 1080px)',
        height: '78vh',
        boxShadow: '0 30px 80px rgba(0, 0, 0, 0.65)',
        padding: '0',
        borderRadius: '16px',
        overflow: 'hidden',
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'row',
        position: 'relative'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Left Side: Snapshot viewer (70% width) */}
        <div style={{
          flex: '1.1',
          display: 'flex',
          flexDirection: 'column',
          background: '#070a13',
          position: 'relative',
          minWidth: 0
        }}>
          {/* Glass Header */}
          <div style={{
            padding: '16px 20px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#ef4444',
              display: 'inline-block',
              boxShadow: '0 0 10px #ef4444'
            }} />
            <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '1px', color: 'var(--t1)', textTransform: 'uppercase' }}>
              Violation Evidence Snapshot
            </span>
          </div>

          {/* Image Container with HUD decorations */}
          <div style={{
            flex: '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            padding: '10px'
          }}>
            {/* HUD Corner Accents */}
            <div style={{ position: 'absolute', top: 20, left: 20, width: 12, height: 12, borderLeft: '2px solid rgba(255, 255, 255, 0.25)', borderTop: '2px solid rgba(255, 255, 255, 0.25)' }} />
            <div style={{ position: 'absolute', top: 20, right: 20, width: 12, height: 12, borderRight: '2px solid rgba(255, 255, 255, 0.25)', borderTop: '2px solid rgba(255, 255, 255, 0.25)' }} />
            <div style={{ position: 'absolute', bottom: 20, left: 20, width: 12, height: 12, borderLeft: '2px solid rgba(255, 255, 255, 0.25)', borderBottom: '2px solid rgba(255, 255, 255, 0.25)' }} />
            <div style={{ position: 'absolute', bottom: 20, right: 20, width: 12, height: 12, borderRight: '2px solid rgba(255, 255, 255, 0.25)', borderBottom: '2px solid rgba(255, 255, 255, 0.25)' }} />
            
            <img src={src} alt="Evidence" style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: '4px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)'
            }} />
          </div>
        </div>

        {/* Right Side: High-Tech Detail Panel (320px) */}
        <div style={{
          width: '320px',
          background: 'rgba(255, 255, 255, 0.015)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          gap: '24px',
          boxSizing: 'border-box'
        }}>
          {/* Header Action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: 'var(--t3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Infraction Report
            </span>
            <button className="icon-btn" onClick={onClose} style={{ fontSize: '16px', color: 'var(--t3)', padding: '4px' }}>✕</button>
          </div>

          {/* Infraction Category Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{
              alignSelf: 'flex-start',
              background: isPedestrian ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: isPedestrian ? '#60a5fa' : '#f87171',
              border: `1px solid ${isPedestrian ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              borderRadius: '4px',
              padding: '4px 10px',
              fontSize: '9px',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '0.75px'
            }}>
              {cleanEventType}
            </div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--t1)' }}>
              {cameraName || 'Unknown Camera'}
            </div>
          </div>

          {/* License Plate Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '9px', color: 'var(--t3)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Identified Plate
            </span>
            {licensePlate ? (
              <SaudiPlate licensePlate={licensePlate} plateAr={plateAr} />
            ) : (
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px dashed rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                padding: '16px',
                textAlign: 'center',
                color: 'var(--t3)',
                fontSize: '10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px'
              }}>
                <i className="fa-solid fa-eye-slash" style={{ fontSize: '16px', opacity: 0.6 }} />
                <span>Plate text is not clear</span>
              </div>
            )}
          </div>

          {/* Metadata Grid */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: 'var(--bg)',
            border: '1px solid var(--border2)',
            borderRadius: '6px',
            padding: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
              <span style={{ color: 'var(--t3)' }}>Timestamp</span>
              <span style={{ color: 'var(--t1)', fontWeight: '600', fontFamily: 'monospace' }}>{timestamp || '--'}</span>
            </div>
            {crossedLineIdx !== undefined && crossedLineIdx !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: 'var(--t3)' }}>Infraction Line</span>
                <span style={{ color: '#ef4444', fontWeight: '800' }}>Line {crossedLineIdx + 1}</span>
              </div>
            )}
          </div>

          {/* Action Row */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={onClose}
              className="btn-accent"
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '10px',
                fontWeight: '700',
                justifyContent: 'center',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Dismiss Preview
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}


/* ─────────────────────────── MAIN DASHBOARD ─────────────────────────── */
export default function Dashboard({ cameras, activeCam, stats, events, settings, onCamSwitch, onStart, onStop, streamLoading, onSaveSettings, onSaveConfig, onRefreshEvents, onNavigate, streamKey, telemetry, eventTrigger }) {
  const [previewImg, setPreviewImg] = useState(null)
  const [stopLines, setStopLines] = useState([])
  const [isDrawingZone, setIsDrawingZone] = useState(false)

  const camConfig = JSON.parse(activeCam?.config_json || '{}')
  const isDms = camConfig.mode === 'driver'

  // Load stop zones from camera config when mounting or switching cameras
  // Only depends on activeCam?.id — NOT config_json — to avoid a feedback loop
  useEffect(() => {
    if (!activeCam) { setStopLines([]); return }
    try {
      const cfg = JSON.parse(activeCam.config_json || '{}')
      let saved = cfg.stop_zones
      if (!saved && cfg.stop_zone) {
        saved = [cfg.stop_zone]
      }
      
      // Backward compatibility fallback: convert stop lines to 4-point zones
      if (!saved || saved.length === 0) {
        const legacyLines = cfg.stop_lines || (cfg.stop_line ? [cfg.stop_line] : [])
        if (legacyLines.length > 0) {
          saved = legacyLines.map(line => [
            { x: line.x1, y: line.y1 },
            { x: line.x2, y: line.y2 },
            { x: line.x2, y: line.y2 + 150 },
            { x: line.x1, y: line.y1 + 150 }
          ])
        }
      }
      
      setStopLines(saved || [])
    } catch (e) {
      console.error("Error loading camera zones:", e)
      setStopLines([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCam?.id])

  // Compute stats today specifically for DMS alerts in active camera
  const dmsEventsToday = events.filter(e => {
    if (e.camera_id !== activeCam?.id) return false
    const today = new Date().toISOString().slice(0, 10)
    const isToday = e.timestamp && e.timestamp.startsWith(today)
    const isDmsEvent = e.event_type && e.event_type !== 'Did Not Stop' && e.event_type !== 'Did Not Stop (Pedestrian Crossing)'
    return isToday && isDmsEvent
  }).length

  return (
    <div className="dashboard">
      {/* TOP ROW */}
      <div className="dash-top">
        <LiveView
          cameras={cameras}
          activeCam={activeCam}
          onCamSwitch={onCamSwitch}
          telemetry={telemetry}
          streamKey={streamKey}
          lines={stopLines}
          setLines={setStopLines}
          onSaveConfig={onSaveConfig}
          onStart={onStart}
          onStop={onStop}
          streamLoading={streamLoading}
          isDrawingZone={isDrawingZone}
          setIsDrawingZone={setIsDrawingZone}
        />
        <div className="dash-right">
          {/* STATS */}
          <div className="stats-row">
            {!isDms ? (
              <>
                <StatCard title="Events Today" value={stats.events_today} trend="↑ 20% vs yesterday" trendUp={true} icon="fa-calendar" iconClass="sc-blue" />
                <StatCard title="Events This Week" value={stats.events_week} trend="↑ 15% vs last week" trendUp={true} icon="fa-chart-column" iconClass="sc-purple" />
                <StatCard title="Pending Review" value={stats.pending_review} trend="Require attention" trendUp={null} icon="fa-triangle-exclamation" iconClass="sc-red" />
                <StatCard title="Active Cameras" value={stats.active_cameras} trend="All cameras online" trendUp={true} icon="fa-video" iconClass="sc-teal" />
              </>
            ) : (
              <>
                <StatCard title="Driver Attention" value={`${telemetry.attentionScore.toFixed(0)}%`} trend={telemetry.attentionScore > 75 ? "● Driver Focused" : "● Attention Warning"} trendUp={telemetry.attentionScore > 75} icon="fa-brain" iconClass={telemetry.attentionScore > 75 ? "sc-teal" : "sc-red"} />
                <StatCard title="Fatigue Score" value={`${telemetry.drowsinessLevel.toFixed(0)}%`} trend={telemetry.drowsinessLevel < 40 ? "● Normal Fatigue" : "● Sleep Warning"} trendUp={telemetry.drowsinessLevel < 40} icon="fa-eye-slash" iconClass={telemetry.drowsinessLevel < 40 ? "sc-blue" : "sc-red"} />
                <StatCard title="DMS Alerts Today" value={dmsEventsToday} trend="DMS safety triggers" trendUp={null} icon="fa-triangle-exclamation" iconClass="sc-purple" />
                <StatCard title="Safety Profile" value="Active" trend="DMS Cabin Active" trendUp={true} icon="fa-user-shield" iconClass="sc-teal" />
              </>
            )}
          </div>
          {/* RECENT EVENTS */}
          <div className="card recent-card">
            <div className="card-head">
              <span>Recent Safety Non-Compliance Events</span>
              <button className="view-all-btn" onClick={() => onNavigate('events')}>View All</button>
            </div>
            <div className="ev-carousel">
              {events.length === 0
                ? <div className="ev-empty">No violation events yet.</div>
                : events.slice(0, 6).map(ev => <EventCard key={ev.id} ev={ev} onImageClick={setPreviewImg} />)}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ROW */}
      <div className="dash-bottom">
        <CameraConfig
          activeCam={activeCam}
          onStart={onStart}
          onStop={onStop}
          streamLoading={streamLoading}
          onSaveConfig={onSaveConfig}
          settings={settings}
          streamKey={streamKey}
          onSaveSettings={onSaveSettings}
          lines={stopLines}
          setLines={setStopLines}
          isDrawingZone={isDrawingZone}
          setIsDrawingZone={setIsDrawingZone}
        />

        <EventsTable cameras={cameras} onNavigate={onNavigate} onImageClick={setPreviewImg} eventTrigger={eventTrigger} />
        <SettingsPanel settings={settings} onSaveSettings={onSaveSettings} />
      </div>

      {/* Image zoom modal popup */}
      <ImageModal preview={previewImg} onClose={() => setPreviewImg(null)} />
    </div>
  )
}

