import { useState, useRef, useEffect, useCallback } from 'react'
import { streamUrl, snapshotUrl, api } from '../api'
import './Dashboard.css'
import './Pages.css'

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

/* ─────────────────────────── CAMERA CONFIG ─────────────────────────── */
function CameraConfig({ activeCam, onStart, onStop, onSaveConfig, settings, streamKey, onSaveSettings, lines: zones, setLines: setZones }) {
  const canvasRef = useRef(null)
  const [lineName, setLineName] = useState('Main Gate Stop Line')
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const previewCtxRef = useRef(null)
  const previewTimerRef = useRef(null)
  // Corner handle dragging state
  const dragRef = useRef(null) // { zoneIdx, pointIdx }
  const [canvasCursor, setCanvasCursor] = useState('default')

  let vidW = 1920, vidH = 1080
  if (activeCam?.resolution) {
    const parts = activeCam.resolution.split('x')
    if (parts.length === 2) {
      vidW = parseInt(parts[0]) || 1920
      vidH = parseInt(parts[1]) || 1080
    }
  }

  const findEndpoint = (p) => {
    const cv = canvasRef.current
    const hitRadius = 22 * (cv ? (cv.width / 800) : 1)
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i]
      for (let j = 0; j < zone.length; j++) {
        const pt = zone[j]
        const d = Math.hypot(p.x - pt.x, p.y - pt.y)
        if (d <= hitRadius) return { zoneIdx: i, pointIdx: j }
      }
    }
    return null
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
    if (beeperType === 'high_intensity') {
      durationSec = 2.4
    } else if (beeperType === 'truck_horn') {
      durationSec = 1.2
    } else if (beeperType === 'pulsing_siren') {
      durationSec = 1.5
    } else if (beeperType === 'nuclear_meltdown') {
      durationSec = 3.0
    } else if (beeperType === 'klaxon') {
      durationSec = 1.3
    } else {
      durationSec = 1.7
    }

    previewTimerRef.current = setTimeout(() => {
      setPreviewPlaying(false)
      previewCtxRef.current = null
      previewTimerRef.current = null
    }, durationSec * 1000)
  }, [settings?.dms_beeper_type, stopPreview])

  const handleTogglePreview = () => {
    if (previewPlaying) {
      stopPreview()
    } else {
      startPreview()
    }
  }

  useEffect(() => {
    stopPreview()
  }, [settings?.dms_beeper_type, stopPreview])

  useEffect(() => {
    return () => {
      if (previewCtxRef.current) {
        try {
          previewCtxRef.current.close()
        } catch (e) {}
      }
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current)
      }
    }
  }, [])

  const camConfig = JSON.parse(activeCam?.config_json || '{}')
  const isDms = camConfig.mode === 'driver'

  const scaleAndSave = useCallback((allZones) => {
    if (!activeCam) return
    onSaveConfig({
      stop_zones: allZones,
      stop_zone: allZones.length > 0 ? allZones[0] : null,
      stop_line_name: lineName
    })
  }, [activeCam, onSaveConfig, lineName])

  const draw = useCallback(() => {
    if (isDms) return
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height)
    const scale = cv.width / 800
    
    zones.forEach((zone, idx) => {
      const color = STOP_LINE_COLORS[idx % STOP_LINE_COLORS.length]
      
      // 1. Draw the translucent filled polygon
      ctx.fillStyle = color + '26' // 15% opacity hex
      ctx.beginPath()
      ctx.moveTo(zone[0].x, zone[0].y)
      for (let i = 1; i < zone.length; i++) {
        ctx.lineTo(zone[i].x, zone[i].y)
      }
      ctx.closePath()
      ctx.fill()
      
      // 2. Draw boundaries
      // Red dashed line for the Exit Line (P1 -> P2)
      ctx.strokeStyle = '#ef4444' // Red
      ctx.lineWidth = 4 * scale
      ctx.setLineDash([12 * scale, 6 * scale])
      ctx.beginPath()
      ctx.moveTo(zone[0].x, zone[0].y)
      ctx.lineTo(zone[1].x, zone[1].y)
      ctx.stroke()
      ctx.setLineDash([])
      
      // Softer solid lines for other boundaries
      ctx.strokeStyle = color
      ctx.lineWidth = 2 * scale
      ctx.beginPath()
      ctx.moveTo(zone[1].x, zone[1].y)
      ctx.lineTo(zone[2].x, zone[2].y)
      ctx.lineTo(zone[3].x, zone[3].y)
      ctx.lineTo(zone[0].x, zone[0].y)
      ctx.stroke()
      
      // 3. Draw corner handles (nodes)
      zone.forEach((pt, pIdx) => {
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 8 * scale, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()
        ctx.strokeStyle = color
        ctx.lineWidth = 2 * scale
        ctx.stroke()
        
        ctx.fillStyle = pIdx < 2 ? '#ef4444' : '#10b981'
        ctx.font = `bold ${10 * scale}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((pIdx + 1).toString(), pt.x, pt.y)
      })
    })
  }, [zones, isDms])

  useEffect(() => { if (!isDms) draw() }, [draw, isDms])

  const pt = (e) => {
    const cv = canvasRef.current; const r = cv.getBoundingClientRect()
    return { x: Math.round((e.clientX - r.left) * (cv.width / r.width)), y: Math.round((e.clientY - r.top) * (cv.height / r.height)) }
  }

  const onMD = (e) => {
    if (isDms) return
    e.preventDefault()
    const p = pt(e)
    const hit = findEndpoint(p)
    if (hit) {
      dragRef.current = hit // { zoneIdx, pointIdx }
    }
  }

  const onMM = (e) => {
    if (isDms) return
    const p = pt(e)
    const cv = canvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')
    const scale = cv.width / 800

    if (dragRef.current) {
      const { zoneIdx, pointIdx } = dragRef.current
      const updated = zones.map((z, zIdx) => {
        if (zIdx !== zoneIdx) return z
        return z.map((pt, pIdx) => 
          pIdx === pointIdx ? { x: p.x, y: p.y } : pt
        )
      })
      
      // Live redraw with updated position
      ctx.clearRect(0, 0, cv.width, cv.height)
      updated.forEach((zone, idx) => {
        const color = STOP_LINE_COLORS[idx % STOP_LINE_COLORS.length]
        
        // Translucent fill
        ctx.fillStyle = color + '26'
        ctx.beginPath()
        ctx.moveTo(zone[0].x, zone[0].y)
        for (let i = 1; i < zone.length; i++) {
          ctx.lineTo(zone[i].x, zone[i].y)
        }
        ctx.closePath()
        ctx.fill()
        
        // Red dashed line for exit
        ctx.strokeStyle = '#ef4444'
        ctx.lineWidth = 4 * scale
        ctx.setLineDash([12 * scale, 6 * scale])
        ctx.beginPath()
        ctx.moveTo(zone[0].x, zone[0].y)
        ctx.lineTo(zone[1].x, zone[1].y)
        ctx.stroke()
        ctx.setLineDash([])
        
        // Softer solid boundaries
        ctx.strokeStyle = color
        ctx.lineWidth = 2 * scale
        ctx.beginPath()
        ctx.moveTo(zone[1].x, zone[1].y)
        ctx.lineTo(zone[2].x, zone[2].y)
        ctx.lineTo(zone[3].x, zone[3].y)
        ctx.lineTo(zone[0].x, zone[0].y)
        ctx.stroke()
        
        const isDraggingZone = idx === zoneIdx
        zone.forEach((pt, pIdx) => {
          const isDraggingPoint = isDraggingZone && pIdx === pointIdx
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, isDraggingPoint ? 11 * scale : 8 * scale, 0, Math.PI * 2)
          ctx.fillStyle = isDraggingPoint ? color : '#ffffff'
          ctx.fill()
          ctx.strokeStyle = color
          ctx.lineWidth = 2 * scale
          ctx.stroke()
          
          ctx.fillStyle = isDraggingPoint ? '#ffffff' : (pIdx < 2 ? '#ef4444' : '#10b981')
          ctx.font = `bold ${10 * scale}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText((pIdx + 1).toString(), pt.x, pt.y)
        })
      })
      return
    }

    const hit = findEndpoint(p)
    setCanvasCursor(hit ? 'grab' : 'default')
  }

  const onMU = (e) => {
    if (isDms) return
    const p = pt(e)

    if (dragRef.current) {
      const { zoneIdx, pointIdx } = dragRef.current
      const updated = zones.map((z, zIdx) => {
        if (zIdx !== zoneIdx) return z
        return z.map((pt, pIdx) => 
          pIdx === pointIdx ? { x: p.x, y: p.y } : pt
        )
      })
      setZones(updated)
      dragRef.current = null
      scaleAndSave(updated)
    }
  }

  const deleteLine = (idx) => {
    const updated = zones.filter((_, i) => i !== idx)
    setZones(updated)
    scaleAndSave(updated)
  }

  const clearAll = async () => {
    setZones([])
    const cv = canvasRef.current
    if (cv) {
      const ctx = cv.getContext('2d')
      ctx.clearRect(0, 0, cv.width, cv.height)
    }
    if (activeCam) {
      await onSaveConfig({ stop_zones: [], stop_zone: null, stop_line_name: '' })
    }
  }

  const handleToggleMode = async () => {
    if (!activeCam) return
    const targetMode = isDms ? 'traffic' : 'driver'
    if (confirm(`Switch this camera to ${targetMode === 'driver' ? 'Driver Monitoring (DMS)' : 'Traffic Stop-Line Compliance'} mode?`)) {
      await onSaveConfig({ mode: targetMode })
    }
  }

  const cam = activeCam

  return (
    <div className="card cfg-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '12px', background: 'var(--panel)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--t1)', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Camera Calibration — {cam?.name || '--'}</span>
        <span style={{
          fontSize: '9px',
          fontWeight: '700',
          padding: '3px 9px',
          borderRadius: '12px',
          background: isDms ? 'rgba(235, 120, 10, 0.12)' : 'rgba(37, 99, 235, 0.12)',
          color: isDms ? '#ff9d43' : '#3b82f6',
          border: `1px solid ${isDms ? 'rgba(235,120,10,0.25)' : 'rgba(37,99,235,0.25)'}`
        }}>
          {isDms ? 'Cabin Mode (DMS)' : 'Compliance Mode'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '12px', flex: '1', minHeight: '0', alignItems: 'stretch' }}>

        {/* LEFT Preview */}
        <div style={{ flex: '1', position: 'relative', background: 'var(--bg)', borderRadius: '6px', overflow: 'hidden', aspectRatio: '16 / 9', border: '1px solid var(--border)' }}>
          {cam && cam.status === 'online' ? (
            <>
              <img src={`${streamUrl(cam.id)}?t=${streamKey}`} alt="preview" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
              {!isDms ? (
                <canvas ref={canvasRef} width={vidW} height={vidH}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: dragRef.current ? 'grabbing' : canvasCursor, zIndex: 2 }}
                  onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU}
                />
              ) : (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  zIndex: 3,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(255, 157, 67, 0.3)',
                  borderRadius: '4px',
                  color: '#ff9d43',
                  fontSize: '8px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  backdropFilter: 'blur(4px)'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff9d43', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                  <span>DMS Face Mesh Tracking Active</span>
                </div>
              )}
            </>
          ) : (
            // Modern empty state placeholder
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: `radial-gradient(circle, var(--border2) 1px, transparent 1px), ${isDms ? 'rgba(255, 157, 67, 0.03)' : 'rgba(59, 130, 246, 0.03)'}`,
              backgroundSize: '16px 16px',
              color: 'var(--t1)',
              zIndex: 1,
              padding: '16px',
              userSelect: 'none'
            }}>
              {/* Laser scanner line sweep */}
              <div className="laser-line" style={{ 
                background: `linear-gradient(90deg, transparent, ${isDms ? '#ff9d43' : '#3b82f6'}, transparent)`, 
                boxShadow: `0 0 10px ${isDms ? '#ff9d43' : '#3b82f6'}` 
              }} />

              {/* HUD corners */}
              <div style={{ position: 'absolute', top: 10, left: 10, width: 10, height: 10, borderLeft: `2px solid ${isDms ? '#ff9d43' : '#3b82f6'}`, borderTop: `2px solid ${isDms ? '#ff9d43' : '#3b82f6'}`, opacity: 0.6 }} />
              <div style={{ position: 'absolute', top: 10, right: 10, width: 10, height: 10, borderRight: `2px solid ${isDms ? '#ff9d43' : '#3b82f6'}`, borderTop: `2px solid ${isDms ? '#ff9d43' : '#3b82f6'}`, opacity: 0.6 }} />
              <div style={{ position: 'absolute', bottom: 10, left: 10, width: 10, height: 10, borderLeft: `2px solid ${isDms ? '#ff9d43' : '#3b82f6'}`, borderBottom: `2px solid ${isDms ? '#ff9d43' : '#3b82f6'}`, opacity: 0.6 }} />
              <div style={{ position: 'absolute', bottom: 10, right: 10, width: 10, height: 10, borderRight: `2px solid ${isDms ? '#ff9d43' : '#3b82f6'}`, borderBottom: `2px solid ${isDms ? '#ff9d43' : '#3b82f6'}`, opacity: 0.6 }} />

              {/* HUD Graphics in center background */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.15 }}>
                {isDms ? (
                  <svg width="100%" height="100%" viewBox="0 0 400 225" style={{ color: 'var(--t1)' }}>
                    <path d="M150 70 C150 40, 250 40, 250 70 C250 110, 230 150, 200 170 C170 150, 150 110, 150 70 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
                    <circle cx="180" cy="80" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="220" cy="80" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="180" cy="80" r="1" fill="currentColor" />
                    <circle cx="220" cy="80" r="1" fill="currentColor" />
                    <path d="M200 80 L200 110 L205 115" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M185 130 Q200 140, 215 130 Q200 135, 185 130" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="200" y1="20" x2="200" y2="205" stroke="currentColor" strokeWidth="0.5" strokeDasharray="5 5" />
                    <line x1="50" y1="112" x2="350" y2="112" stroke="currentColor" strokeWidth="0.5" strokeDasharray="5 5" />
                    <circle cx="200" cy="112" r="60" fill="none" stroke="currentColor" strokeWidth="0.5" />
                    <circle cx="200" cy="112" r="90" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4" />
                  </svg>
                ) : (
                  <svg width="100%" height="100%" viewBox="0 0 400 225" style={{ color: 'var(--t1)' }}>
                    <path d="M50 225 L170 80 L230 80 L350 225" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" />
                    <line x1="20" y1="80" x2="380" y2="80" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
                    <line x1="100" y1="160" x2="300" y2="160" stroke="currentColor" strokeWidth="2" />
                    <line x1="120" y1="130" x2="280" y2="130" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" />
                    <circle cx="200" cy="120" r="30" fill="none" stroke="currentColor" strokeWidth="0.5" />
                    <circle cx="200" cy="120" r="6" fill="none" stroke="currentColor" strokeWidth="1" />
                    <line x1="200" y1="85" x2="200" y2="155" stroke="currentColor" strokeWidth="0.5" />
                    <line x1="165" y1="120" x2="235" y2="120" stroke="currentColor" strokeWidth="0.5" />
                  </svg>
                )}
              </div>

              {/* Central Display Card */}
              <div style={{
                textAlign: 'center',
                maxWidth: '85%',
                padding: '12px 18px',
                background: 'var(--panel)',
                border: '1px solid var(--border2)',
                borderRadius: '6px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.18)',
                backdropFilter: 'blur(6px)',
                zIndex: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '5px'
              }}>
                {isDms ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: '700', color: '#ff9d43', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      <i className="fa-solid fa-face-viewfinder" style={{ fontSize: '13px' }} />
                      <span>Cabin Monitor (DMS) Standby</span>
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--t2)', lineHeight: '1.4' }}>
                      Facial Keypoint Calibration maps driver fatigue and phone usage. Click "Start Camera" below to launch the video scan.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      <i className="fa-solid fa-road" style={{ fontSize: '13px' }} />
                      <span>Intersection Compliance Standby</span>
                    </div>
                    <div style={{ fontSize: '9px', color: 'var(--t2)', lineHeight: '1.4' }}>
                      Intersection Stop-Line Monitor tracks vehicle stop compliance. Draw your detection zones when the video feed is live.
                    </div>
                  </>
                )}
                <span style={{ fontSize: '8px', color: 'var(--t3)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', textTransform: 'uppercase' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#64748b', display: 'inline-block' }} />
                  Camera Feed Offline
                </span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT Configuration settings */}
        <div style={{ width: '155px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg)', border: '1px solid var(--border2)', padding: '10px', borderRadius: '6px' }}>
          {!isDms ? (
            <>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--t1)', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>Stop Zone Settings</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '9px', color: 'var(--t2)' }}>Zone Name</div>
                <input className="f-input" style={{ fontSize: '9px', padding: '4px 6px', background: 'var(--bg)' }} value={lineName} onChange={e => setLineName(e.target.value)} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '9px', color: 'var(--t2)' }}>Active Zones ({zones.length})</div>
                {zones.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {zones.map((zone, i) => (
                      <div key={i} style={{
                        fontSize: '9px',
                        background: 'var(--bg)',
                        padding: '4px 6px',
                        border: '1px solid var(--border2)',
                        borderRadius: '3px',
                        color: 'var(--t1)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STOP_LINE_COLORS[i % STOP_LINE_COLORS.length], flexShrink: 0 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: '600' }}>Zone {i + 1}</span>
                          <span style={{ fontSize: '7px', color: 'var(--t3)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            P1:({zone[0].x},{zone[0].y}) → P2:({zone[1].x},{zone[1].y})
                          </span>
                        </div>
                        <button
                          onClick={() => deleteLine(i)}
                          title={`Delete Zone ${i + 1}`}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--t3)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            padding: '0 2px',
                            lineHeight: '1',
                            transition: 'color 0.15s',
                            flexShrink: 0
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}
                        >×</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '9px', background: 'var(--bg)', padding: '4px 6px', border: '1px dashed var(--border2)', borderRadius: '3px', color: 'var(--t3)', textAlign: 'center' }}>
                    No zones configured
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  let w = 1920, h = 1080
                  if (activeCam?.resolution) {
                    const parts = activeCam.resolution.split('x')
                    if (parts.length === 2) {
                      w = parseInt(parts[0]) || 1920
                      h = parseInt(parts[1]) || 1080
                    }
                  }
                  const offset = zones.length * 40
                  const newZone = [
                    { x: Math.round(w * 0.35) + offset, y: Math.round(h * 0.55) + offset },
                    { x: Math.round(w * 0.65) + offset, y: Math.round(h * 0.55) + offset },
                    { x: Math.round(w * 0.8) + offset,  y: Math.round(h * 0.85) + offset },
                    { x: Math.round(w * 0.2) + offset,  y: Math.round(h * 0.85) + offset }
                  ]
                  const updated = [...zones, newZone]
                  setZones(updated)
                  scaleAndSave(updated)
                }}
                className="btn-accent"
                style={{ fontSize: '9px', padding: '5px 8px', marginTop: '5px', width: '100%', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-plus" style={{ marginRight: '4px' }} />
                Add Stop Zone
              </button>

              <div style={{ flex: '1' }}></div>
              {zones.length > 0 && (
                <div style={{ fontSize: '8px', color: '#10b981', fontWeight: '600', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <i className="fa-solid fa-check-circle" /> {zones.length} zone{zones.length !== 1 ? 's' : ''} auto-saved
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--t1)', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>DMS Configuration</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '9px', color: 'var(--t2)' }}>
                <span>Active Cabin Triggers</span>
                <div style={{ background: 'var(--panel)', padding: '6px 8px', border: '1px solid var(--border2)', borderRadius: '3px', color: 'var(--t2)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div>• Phone Proximity: <b style={{ color: '#ff9d43' }}>Active</b></div>
                  <div>• Smoking Monitor: <b style={{ color: '#ff9d43' }}>Active</b></div>
                  <div>• Eating & Drinking: <b style={{ color: '#ff9d43' }}>Active</b></div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '9px', color: 'var(--t2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Alarm Sound</span>
                  <button 
                    type="button"
                    title={previewPlaying ? "Stop sound preview" : "Play sound preview"}
                    onClick={handleTogglePreview}
                    style={{ background: 'none', border: 'none', color: previewPlaying ? '#ef4444' : 'var(--t2)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = previewPlaying ? '#ef4444' : 'var(--t1)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = previewPlaying ? '#ef4444' : 'var(--t2)'}
                  >
                    {previewPlaying ? (
                      <i className="fa-solid fa-volume-xmark" style={{ fontSize: '10px' }} />
                    ) : (
                      <i className="fa-solid fa-volume-high" style={{ fontSize: '10px' }} />
                    )}
                  </button>
                </div>
                <select
                  className="mini-sel"
                  style={{ fontSize: '9px', padding: '4px 6px', background: 'var(--panel)', border: '1px solid var(--border2)', borderRadius: '3px', color: 'var(--t1)', width: '100%', outline: 'none' }}
                  value={settings.dms_beeper_type || 'default'}
                  onChange={(e) => onSaveSettings && onSaveSettings({ dms_beeper_type: e.target.value })}
                >
                  <option value="default">Default Beep</option>
                  <option value="high_intensity">🔊 High Intensity Horn</option>
                  <option value="truck_horn">🚚 Truck Air Horn</option>
                  <option value="pulsing_siren">🚨 Pulsing Siren</option>
                  <option value="nuclear_meltdown">🚨 Long Siren</option>
                  <option value="klaxon">📢 Industrial Klaxon</option>
                </select>
              </div>

              <div style={{ flex: '1' }}></div>
              <div style={{ fontSize: '8px', color: '#475569', textAlign: 'center', lineHeight: '1.2' }}>
                Face templates calibrate in real-time. Switch profiles below.
              </div>
            </>
          )}

          <button onClick={handleToggleMode} className="btn-accent" style={{
            width: '100%',
            padding: '7px',
            fontSize: '9px',
            fontWeight: '700',
            background: 'transparent',
            border: `1px solid ${isDms ? 'rgba(37,99,235,0.4)' : 'rgba(235,120,10,0.4)'}`,
            color: isDms ? '#3b82f6' : '#ff9d43',
            marginTop: '2px'
          }}>
            <i className={`fa-solid ${isDms ? 'fa-car' : 'fa-user-shield'}`} style={{ marginRight: '4px' }} />
            {isDms ? 'Switch to Traffic' : 'Switch to DMS'}
          </button>
        </div>
      </div>

      {/* BOTTOM COMPONENT Action Row */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '12px', alignItems: 'stretch' }}>
        <button
          onClick={cam?.status === 'online' ? onStop : onStart}
          style={{
            flex: '2',
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            background: cam?.status === 'online'
              ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
              : 'linear-gradient(135deg, #059669, #047857)',
            color: '#fff',
            fontSize: '10px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: cam?.status === 'online'
              ? '0 4px 12px rgba(220, 38, 38, 0.25)'
              : '0 4px 12px rgba(5, 150, 105, 0.25)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            minHeight: '32px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = cam?.status === 'online'
              ? '0 6px 16px rgba(220, 38, 38, 0.35)'
              : '0 6px 16px rgba(5, 150, 105, 0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = cam?.status === 'online'
              ? '0 4px 12px rgba(220, 38, 38, 0.25)'
              : '0 4px 12px rgba(5, 150, 105, 0.25)';
          }}
        >
          <i className={`fa-solid ${cam?.status === 'online' ? 'fa-stop' : 'fa-play'}`} style={{ fontSize: '11px' }} />
          <span>{cam?.status === 'online' ? 'Stop Analysis' : 'Start Analysis'}</span>
        </button>
        {!isDms && (
          <button style={{ flex: '1', padding: '8px', border: 'none', borderRadius: '4px', background: 'var(--panel)', border: '1px solid var(--border2)', color: '#eab308', fontSize: '10px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }} onClick={clearAll}>
            <i className="fa-solid fa-gear" /> Reset Zones
          </button>
        )}
      </div>
    </div>
  )
}


/* ─────────────────────────── LIVE VIEW ─────────────────────────── */
function LiveView({ cameras, activeCam, onCamSwitch, telemetry, streamKey, lines: zones, setLines: setZones, onSaveConfig }) {
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
  const liveDragRef = useRef(null) // { zoneIdx, pointIdx }
  const [liveCursor, setLiveCursor] = useState('default')

  const findLiveEndpoint = (p) => {
    const cv = liveCanvasRef.current
    const hitRadius = 22 * (cv ? (cv.width / 800) : 1)
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i]
      for (let j = 0; j < zone.length; j++) {
        const pt = zone[j]
        const d = Math.hypot(p.x - pt.x, p.y - pt.y)
        if (d <= hitRadius) return { zoneIdx: i, pointIdx: j }
      }
    }
    return null
  }

  const livePt = (e) => {
    const cv = liveCanvasRef.current; if (!cv) return { x: 0, y: 0 }
    const r = cv.getBoundingClientRect()
    return { x: Math.round((e.clientX - r.left) * (cv.width / r.width)), y: Math.round((e.clientY - r.top) * (cv.height / r.height)) }
  }

  const liveScaleAndSave = useCallback((allZones) => {
    if (!activeCam || !onSaveConfig) return
    onSaveConfig({
      stop_zones: allZones,
      stop_zone: allZones[0] || null,
    })
  }, [activeCam, onSaveConfig])

  const drawLiveLines = useCallback((ctx, cv, zonesList, activeDrag) => {
    ctx.clearRect(0, 0, cv.width, cv.height)
    const scale = cv.width / 800
    zonesList.forEach((zone, idx) => {
      const color = STOP_LINE_COLORS[idx % STOP_LINE_COLORS.length]
      
      // 1. Draw the translucent filled polygon
      ctx.fillStyle = color + '26' // 15% opacity hex
      ctx.beginPath()
      ctx.moveTo(zone[0].x, zone[0].y)
      for (let i = 1; i < zone.length; i++) {
        ctx.lineTo(zone[i].x, zone[i].y)
      }
      ctx.closePath()
      ctx.fill()
      
      // 2. Draw boundaries
      // Red dashed line for the Exit Line (P1 -> P2)
      ctx.strokeStyle = '#ef4444' // Red
      ctx.lineWidth = 4 * scale
      ctx.setLineDash([12 * scale, 6 * scale])
      ctx.beginPath()
      ctx.moveTo(zone[0].x, zone[0].y)
      ctx.lineTo(zone[1].x, zone[1].y)
      ctx.stroke()
      ctx.setLineDash([])
      
      // Softer solid lines for other boundaries
      ctx.strokeStyle = color
      ctx.lineWidth = 2 * scale
      ctx.beginPath()
      ctx.moveTo(zone[1].x, zone[1].y)
      ctx.lineTo(zone[2].x, zone[2].y)
      ctx.lineTo(zone[3].x, zone[3].y)
      ctx.lineTo(zone[0].x, zone[0].y)
      ctx.stroke()
      
      // 3. Draw corner handles (nodes)
      const isDraggingZone = activeDrag && activeDrag.zoneIdx === idx
      zone.forEach((pt, pIdx) => {
        const isDraggingPoint = isDraggingZone && activeDrag.pointIdx === pIdx
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, isDraggingPoint ? 11 * scale : 8 * scale, 0, Math.PI * 2)
        ctx.fillStyle = isDraggingPoint ? color : '#ffffff'
        ctx.fill()
        ctx.strokeStyle = color
        ctx.lineWidth = 2 * scale
        ctx.stroke()
        
        ctx.fillStyle = isDraggingPoint ? '#ffffff' : (pIdx < 2 ? '#ef4444' : '#10b981')
        ctx.font = `bold ${10 * scale}px sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText((pIdx + 1).toString(), pt.x, pt.y)
      })
    })
  }, [])

  const onLiveMD = (e) => {
    if (isDms) return
    e.preventDefault()
    const p = livePt(e)
    const hit = findLiveEndpoint(p)
    if (hit) {
      liveDragRef.current = hit
    }
  }

  const onLiveMM = (e) => {
    if (isDms) return
    const p = livePt(e); const cv = liveCanvasRef.current; if (!cv) return
    const ctx = cv.getContext('2d')

    // Dragging an endpoint
    if (liveDragRef.current) {
      const { zoneIdx, pointIdx } = liveDragRef.current
      const updated = zones.map((z, zIdx) => {
        if (zIdx !== zoneIdx) return z
        return z.map((pt, pIdx) => 
          pIdx === pointIdx ? { x: p.x, y: p.y } : pt
        )
      })
      drawLiveLines(ctx, cv, updated, liveDragRef.current)
      return
    }

    // Hover cursor
    const hit = findLiveEndpoint(p)
    setLiveCursor(hit ? 'grab' : 'default')
  }

  const onLiveMU = (e) => {
    if (isDms) return
    const p = livePt(e)

    // Finishing an endpoint drag
    if (liveDragRef.current) {
      const { zoneIdx, pointIdx } = liveDragRef.current
      const updated = zones.map((z, zIdx) => {
        if (zIdx !== zoneIdx) return z
        return z.map((pt, pIdx) => 
          pIdx === pointIdx ? { x: p.x, y: p.y } : pt
        )
      })
      setZones(updated)
      liveDragRef.current = null
      liveScaleAndSave(updated)
    }
  }

  // Re-draw all lines on the live canvas whenever `zones` changes
  useEffect(() => {
    const cv = liveCanvasRef.current; if (!cv || isDms) return
    const ctx = cv.getContext('2d')
    drawLiveLines(ctx, cv, zones, null)
  }, [zones, isDms, drawLiveLines])

  const handleFullscreen = () => {
    const el = document.querySelector('.live-wrap')
    if (el) el.requestFullscreen?.()
  }

  return (
    <div className="card live-card">
      <div className="card-head">
        <span>Live View - <b>{activeCam?.name || 'No Camera'}</b> <span className="live-tag">LIVE</span></span>
        <button className="icon-btn" onClick={handleFullscreen} title="Fullscreen"><i className="fa-solid fa-expand" /></button>
      </div>
      <div className={`live-wrap${isDrowsy ? ' alert-drowsy' : isDistracted ? ' alert-distracted' : ''}`}>
        {activeCam && activeCam.status === 'online' ? (
          <>
            <img key={activeCam.id} src={`${streamUrl(activeCam.id)}?t=${streamKey}`} alt="Live Feed" className="live-img"
              style={{ pointerEvents: 'none' }}
              onError={e => { e.target.style.display = 'none' }} />
            {!isDms && (
              <canvas ref={liveCanvasRef} width={vidW} height={vidH}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: liveDragRef.current ? 'grabbing' : liveCursor, zIndex: 2 }}
                onMouseDown={onLiveMD} onMouseMove={onLiveMM} onMouseUp={onLiveMU}
              />
            )}
          </>
        ) : activeCam ? (
          <div className="live-ph" style={{ background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{
              textAlign: 'center',
              color: 'var(--t2)',
              padding: '28px',
              borderRadius: '12px',
              background: 'var(--panel)',
              border: '1px solid var(--border2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              backdropFilter: 'blur(8px)',
              maxWidth: '350px'
            }}>
              <i className="fa-solid fa-video-slash" style={{ fontSize: '42px', color: '#f87171', marginBottom: '16px', display: 'block' }} />
              <h3 style={{ color: 'var(--t1)', fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>Camera is Offline</h3>
              <p style={{ fontSize: '11px', lineHeight: '1.6', color: 'var(--t3)', marginBottom: '0px' }}>
                Real-time analysis is currently stopped. Click **Start Analysis** in the Calibration panel below to activate the live feed and detection engines.
              </p>
            </div>
          </div>
        ) : (
          <div className="live-ph" style={{ background: 'var(--bg)' }}><i className="fa-solid fa-video-slash" /><p>No camera connected</p></div>
        )}

        {/* Flashing Urgency Headings */}
        {activeViolations.length > 0 ? (
          <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', zIndex: 10 }}>
            {activeViolations.map((v, i) => {
              const isCrit = v.includes("Sleep") || v.includes("Phone") || v.includes("Smoking") || v.includes("Seatbelt") || v.includes("Drowsy")
              // Map backend violation names to clear details
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
      <div className="live-bar">
        <span>FPS: <b>{fps}</b></span>
        <span>Detection: <b className="txt-green">● ON</b></span>
        <span>Tracking: <b className="txt-green">● ON</b></span>
        <span className="bar-spacer" />
        <span>Camera:</span>
        <select className="mini-sel" value={activeCam?.id || ''} onChange={e => onCamSwitch(e.target.value)}>
          {cameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          {cameras.length === 0 && <option>No cameras</option>}
        </select>
        <button className="icon-btn-sm" title="Fullscreen" onClick={handleFullscreen}><i className="fa-solid fa-expand" /></button>
      </div>
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
export default function Dashboard({ cameras, activeCam, stats, events, settings, onCamSwitch, onStart, onStop, onSaveSettings, onSaveConfig, onRefreshEvents, onNavigate, streamKey, telemetry, eventTrigger }) {
  const [previewImg, setPreviewImg] = useState(null)
  const [stopLines, setStopLines] = useState([])

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
      
      // If still empty and in compliance (traffic) mode, initialize a default zone
      if ((!saved || saved.length === 0) && cfg.mode !== 'driver') {
        let w = 1920, h = 1080
        if (activeCam.resolution) {
          const parts = activeCam.resolution.split('x')
          if (parts.length === 2) {
            w = parseInt(parts[0]) || 1920
            h = parseInt(parts[1]) || 1080
          }
        }
        saved = [[
          { x: Math.round(w * 0.35), y: Math.round(h * 0.55) }, // P1
          { x: Math.round(w * 0.65), y: Math.round(h * 0.55) }, // P2
          { x: Math.round(w * 0.8),  y: Math.round(h * 0.85) }, // P3
          { x: Math.round(w * 0.2),  y: Math.round(h * 0.85) }  // P4
        ]]
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
    const t = (e.timestamp || '').split(' ')
    const today = new Date().toISOString().slice(0, 10)
    const isToday = e.timestamp && e.timestamp.startsWith(today)
    const isDmsEvent = e.event_type && e.event_type !== 'Did Not Stop' && e.event_type !== 'Did Not Stop (Pedestrian Crossing)'
    return isDmsEvent
  }).length

  return (
    <div className="dashboard">
      {/* TOP ROW */}
      <div className="dash-top">
        <LiveView cameras={cameras} activeCam={activeCam} onCamSwitch={onCamSwitch} telemetry={telemetry} streamKey={streamKey} lines={stopLines} setLines={setStopLines} onSaveConfig={onSaveConfig} />
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
        <CameraConfig activeCam={activeCam} onStart={onStart} onStop={onStop} onSaveConfig={onSaveConfig} settings={settings} streamKey={streamKey} onSaveSettings={onSaveSettings} lines={stopLines} setLines={setStopLines} />

        <EventsTable cameras={cameras} onNavigate={onNavigate} onImageClick={setPreviewImg} eventTrigger={eventTrigger} />
        <SettingsPanel settings={settings} onSaveSettings={onSaveSettings} />
      </div>

      {/* Image zoom modal popup */}
      <ImageModal preview={previewImg} onClose={() => setPreviewImg(null)} />
    </div>
  )
}
