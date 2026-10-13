import { useState, useEffect } from 'react'
import { snapshotUrl, api } from '../api'
import './Pages.css'

/* ─────────────────────────── EVIDENCE IMAGE PREVIEW MODAL ─────────────────────────── */
function SaudiPlate({ licensePlate }) {
  if (!licensePlate) return null;
  
  const raw = (licensePlate || '').trim().toUpperCase();
  // Extract digits and letters
  const numbers = raw.match(/\d+/g)?.join('') || '';
  const letters = raw.replace(/\d+/g, '').replace(/[^A-Z]/g, '').trim();

  // If both numbers and letters exist, display authentic two-tier plate (numbers on top, letters on bottom)
  const hasSplit = numbers.length > 0 && letters.length > 0;

  return (
    <div style={{
      width: '180px',
      height: '74px',
      background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 60%, #e2e8f0 100%)',
      border: '3.5px solid #1e293b',
      borderRadius: '10px',
      boxShadow: '0 8px 20px rgba(0, 0, 0, 0.25), inset 0 2px 4px rgba(255, 255, 255, 0.8)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      fontFamily: "'Inter', sans-serif",
      overflow: 'hidden',
      userSelect: 'none',
      padding: '4px 12px'
    }}>
      {hasSplit ? (
        <>
          <div style={{
            fontSize: numbers.length > 5 ? '20px' : '26px',
            fontWeight: '900',
            letterSpacing: '2px',
            color: '#0f172a',
            lineHeight: '1.1'
          }}>
            {numbers}
          </div>
          <div style={{
            fontSize: letters.length > 5 ? '12px' : '14px',
            fontWeight: '800',
            letterSpacing: '4px',
            color: '#334155',
            marginTop: '3px',
            textTransform: 'uppercase'
          }}>
            {letters.split('').join(' ')}
          </div>
        </>
      ) : (
        <div style={{
          fontSize: raw.length > 8 ? '18px' : '24px',
          fontWeight: '900',
          letterSpacing: '2px',
          color: '#0f172a',
          textAlign: 'center',
          whiteSpace: 'nowrap'
        }}>
          {raw}
        </div>
      )}
    </div>
  );
}

function ImageModal({ preview, onClose, onReprocess }) {
  if (!preview) return null;
  const src = typeof preview === 'string' ? preview : preview.src;
  const eventId = typeof preview === 'object' ? preview.id : null;
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

            {/* Live AI Scanner Loading Overlay on Evidence Image */}
            {licensePlate && licensePlate.toUpperCase() === 'PROCESSING' && (
              <div style={{
                position: 'absolute',
                inset: 16,
                borderRadius: '4px',
                background: 'rgba(7, 10, 20, 0.65)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                pointerEvents: 'none',
                zIndex: 10,
                border: '1px solid rgba(56, 189, 248, 0.45)',
                backdropFilter: 'blur(2px)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid #38bdf8',
                  color: '#38bdf8',
                  padding: '8px 16px',
                  borderRadius: '24px',
                  fontSize: '11px',
                  fontWeight: '700',
                  letterSpacing: '0.6px',
                  boxShadow: '0 0 25px rgba(56, 189, 248, 0.45)'
                }}>
                  <i className="fa-solid fa-spinner fa-spin" />
                  <span>AI SCANNING NUMBER PLATE...</span>
                </div>
                <span style={{ fontSize: '9px', color: '#94a3b8' }}>Model inference in progress</span>
              </div>
            )}
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
            {licensePlate && licensePlate.toUpperCase() === 'PROCESSING' ? (
              <div style={{
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '6px',
                padding: '16px',
                textAlign: 'center',
                color: '#38bdf8',
                fontSize: '11px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '18px', color: '#38bdf8' }} />
                <span style={{ fontWeight: '700', letterSpacing: '0.5px' }}>Scanning License Plate...</span>
              </div>
            ) : licensePlate && licensePlate.toUpperCase() !== 'NOT CLEAR' ? (
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

            {eventId && onReprocess && (!eventType || eventType === 'Did Not Stop' || eventType.includes('Pedestrian')) && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onReprocess(eventId)}
                disabled={licensePlate && licensePlate.toUpperCase() === 'PROCESSING'}
                style={{
                  marginTop: '8px',
                  width: '100%',
                  padding: '7px 12px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  borderColor: 'rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8',
                  borderRadius: '6px',
                  cursor: (licensePlate && licensePlate.toUpperCase() === 'PROCESSING') ? 'not-allowed' : 'pointer'
                }}
              >
                <i className={`fa-solid fa-rotate ${(licensePlate && licensePlate.toUpperCase() === 'PROCESSING') ? 'fa-spin' : ''}`} />
                <span>{licensePlate && licensePlate.toUpperCase() === 'PROCESSING' ? 'Processing...' : 'Post-Process / Re-Scan OCR'}</span>
              </button>
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

/* ─────────────────────────── BULK DELETE REALTIME PROGRESS MODAL ─────────────────────────── */
function BulkDeleteProgressModal({ progress }) {
  if (!progress || !progress.active) return null;
  const isDone = progress.done;

  return (
    <div className="modal-overlay" style={{
      zIndex: 10001,
      background: 'rgba(8, 12, 21, 0.82)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div className="modal" style={{
        maxWidth: '460px',
        width: '92%',
        background: 'linear-gradient(180deg, #131b2e 0%, #0c121e 100%)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        boxShadow: '0 25px 65px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.15)',
        borderRadius: '12px',
        overflow: 'hidden',
        padding: '24px'
      }}>
        {/* Header Icon & Title */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          {isDone ? (
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '12px', animation: 'pulse 1.5s infinite'
            }}>
              <i className="fa-solid fa-check" style={{ color: '#10b981', fontSize: '24px' }} />
            </div>
          ) : (
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '12px'
            }}>
              <i className="fa-solid fa-trash-can fa-bounce" style={{ color: '#ef4444', fontSize: '22px' }} />
            </div>
          )}
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--t1)', letterSpacing: '0.3px' }}>
            {isDone ? 'Bulk Purge Complete!' : 'Purging Violation Records...'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--t2)', marginTop: '4px' }}>
            {isDone ? `Successfully purged ${progress.total} event records and snapshots` : 'Real-time database index & evidence snapshot cleanup'}
          </div>
        </div>

        {/* Real-time Glowing Progress Bar */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '600', color: 'var(--t1)', marginBottom: '6px' }}>
            <span>Progress ({progress.processed} / {progress.total})</span>
            <span style={{ color: isDone ? '#10b981' : '#ef4444', fontWeight: '700' }}>{progress.percent}%</span>
          </div>
          <div style={{
            height: '10px',
            background: 'rgba(255, 255, 255, 0.06)',
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            position: 'relative'
          }}>
            <div style={{
              height: '100%',
              width: `${progress.percent}%`,
              background: isDone
                ? 'linear-gradient(90deg, #059669, #10b981)'
                : 'linear-gradient(90deg, #dc2626, #ef4444, #f87171)',
              borderRadius: '10px',
              transition: 'width 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isDone
                ? '0 0 12px rgba(16, 185, 129, 0.6)'
                : '0 0 12px rgba(239, 68, 68, 0.6)'
            }} />
          </div>
        </div>

        {/* Live Accurate Metrics Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          background: 'rgba(0, 0, 0, 0.25)',
          padding: '12px',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          fontSize: '10.5px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--t3)', fontSize: '9.5px', marginBottom: '2px' }}>ELAPSED</div>
            <div style={{ color: 'var(--t1)', fontWeight: '700', fontFamily: "'Courier New', monospace" }}>{progress.elapsed}</div>
          </div>
          <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)', borderRight: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ color: 'var(--t3)', fontSize: '9.5px', marginBottom: '2px' }}>THROUGHPUT</div>
            <div style={{ color: '#38bdf8', fontWeight: '700', fontFamily: "'Courier New', monospace" }}>{progress.speed}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--t3)', fontSize: '9.5px', marginBottom: '2px' }}>EST. REMAINING</div>
            <div style={{ color: isDone ? '#10b981' : '#f59e0b', fontWeight: '700', fontFamily: "'Courier New', monospace" }}>{progress.eta}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── CONFIRM MODAL ─────────────────────────── */
function ConfirmModal({ message, onConfirm, onCancel }) {
  if (!message) return null;
  return (
    <div className="modal-overlay" style={{ zIndex: 10000, background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div className="modal" style={{
        maxWidth: '420px', width: '100%',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4)',
        borderRadius: '10px', overflow: 'hidden'
      }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px 24px 12px', textAlign: 'center' }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '32px', color: '#f87171', marginBottom: '14px', display: 'block' }} />
          <div style={{ fontSize: '14px', color: 'var(--t1)', fontWeight: '600', marginBottom: '8px' }}>Confirm Deletion</div>
          <div style={{ fontSize: '12px', color: 'var(--t2)', lineHeight: '1.6' }}>{message}</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', padding: '16px 24px 20px', justifyContent: 'center' }}>
          <button className="act-btn act-out" onClick={onCancel} style={{ padding: '8px 22px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '8px 22px', borderRadius: '6px', border: 'none',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
          }}>Delete</button>
        </div>
      </div>
    </div>
  )
}


export default function EventsPage({ cameras, eventTrigger }) {
  const [events, setEvents] = useState([])
  const [camFilter, setCamFilter] = useState('all')
  const [statFilter, setStatFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [previewImg, setPreviewImg] = useState(null)
  const [viewMode, setViewMode] = useState('list')
  const PER = 15

  // Selection state
  const [selected, setSelected] = useState(new Set())
  const [selectAllAvailable, setSelectAllAvailable] = useState(false)
  const [confirmMsg, setConfirmMsg] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [progressState, setProgressState] = useState(null)
  const [reprocessingIds, setReprocessingIds] = useState(new Set())

  const loadEvents = async () => {
    try {
      let url = `/api/events?page=${page}&per_page=${PER}`
      if (camFilter !== 'all') url += `&camera_id=${camFilter}`
      if (statFilter !== 'all') url += `&status=${statFilter}`
      if (categoryFilter !== 'all') url += `&event_category=${categoryFilter}`
      if (dateFrom) url += `&date_from=${dateFrom}`
      if (dateTo) url += `&date_to=${dateTo}`
      const d = await api.get(url)
      setEvents(d.items || []); setTotal(d.total || 0)
    } catch { }
  }

  useEffect(() => { loadEvents() }, [page, camFilter, statFilter, categoryFilter, eventTrigger])

  // Sync open preview modal if its license plate was resolved asynchronously
  useEffect(() => {
    if (previewImg && events && events.length) {
      const match = events.find(e => e.id === previewImg.id)
      if (match) {
        let meta = {}
        try {
          meta = typeof match.metadata_json === 'string' ? JSON.parse(match.metadata_json) : (match.metadata_json || {})
        } catch {}
        const dp = match.license_plate || meta.license_plate || meta.number_plate || null
        const pa = meta.plate_ar || meta.license_plate_ar || null
        if (dp && dp !== previewImg.licensePlate) {
          setPreviewImg(prev => prev ? ({ ...prev, licensePlate: dp, plateAr: pa }) : null)
        }
      }
    }
  }, [events, previewImg?.id])

  // Clear selection when page/filters change
  useEffect(() => { setSelected(new Set()); setSelectAllAvailable(false) }, [page, camFilter, statFilter, categoryFilter])

  const toggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Reviewed' ? 'Pending' : 'Reviewed'
    await api.put(`/api/events/${id}/status`, { status: nextStatus })
    setEvents(ev => ev.map(e => e.id === id ? { ...e, status: nextStatus } : e))
  }

  // ── Selection Helpers ──
  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
    setSelectAllAvailable(false)
  }

  const allPageIds = events.map(e => e.id)
  const allPageSelected = allPageIds.length > 0 && allPageIds.every(id => selected.has(id))
  const somePageSelected = allPageIds.some(id => selected.has(id))

  const togglePageAll = () => {
    if (allPageSelected) {
      setSelected(new Set())
      setSelectAllAvailable(false)
    } else {
      setSelected(new Set(allPageIds))
    }
  }

  const handleSelectAllAvailable = () => {
    setSelectAllAvailable(true)
  }

  const clearSelection = () => {
    setSelected(new Set())
    setSelectAllAvailable(false)
  }

  // ── Delete Helpers ──
  const deleteSingle = async (id) => {
    await api.del(`/api/events/${id}`)
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    loadEvents()
  }

  const executeBulkDelete = async (targetIds) => {
    if (!targetIds || targetIds.length === 0) return
    const totalCount = targetIds.length
    const startTime = performance.now()

    setProgressState({
      active: true,
      total: totalCount,
      processed: 0,
      percent: 0,
      elapsed: '0.0s',
      eta: 'Calculating...',
      speed: '0 items/s',
      done: false
    })

    const BATCH_SIZE = 15
    let processedCount = 0

    for (let i = 0; i < totalCount; i += BATCH_SIZE) {
      const chunk = targetIds.slice(i, i + BATCH_SIZE)
      try {
        await api.post('/api/events/bulk-delete', { ids: chunk })
      } catch (err) {
        console.error("Bulk delete chunk failed", err)
      }

      processedCount += chunk.length
      const now = performance.now()
      const elapsedSec = (now - startTime) / 1000
      const speed = processedCount / Math.max(0.05, elapsedSec)
      const remainingItems = totalCount - processedCount
      const etaSec = speed > 0 ? (remainingItems / speed) : 0
      const percent = Math.min(100, Math.round((processedCount / totalCount) * 100))

      setProgressState({
        active: true,
        total: totalCount,
        processed: processedCount,
        percent: percent,
        elapsed: `${elapsedSec.toFixed(1)}s`,
        eta: remainingItems <= 0 ? '0.0s' : `${etaSec.toFixed(1)}s`,
        speed: `${Math.round(speed)} items/s`,
        done: processedCount >= totalCount
      })
    }

    // Auto-dismiss smoothly on completion
    setTimeout(() => {
      setProgressState(null)
      setSelected(new Set())
      setSelectAllAvailable(false)
      setPage(1)
      loadEvents()
    }, 600)
  }

  const deleteSelected = async () => {
    let targetIds = []
    if (selectAllAvailable) {
      try {
        let url = '/api/events/ids?'
        if (camFilter !== 'all') url += `&camera_id=${camFilter}`
        if (statFilter !== 'all') url += `&status=${statFilter}`
        if (categoryFilter !== 'all') url += `&event_category=${categoryFilter}`
        if (dateFrom) url += `&date_from=${dateFrom}`
        if (dateTo) url += `&date_to=${dateTo}`
        const res = await api.get(url)
        targetIds = res.ids || []
      } catch {
        targetIds = [...selected]
      }
    } else {
      targetIds = [...selected]
    }
    executeBulkDelete(targetIds)
  }

  const deleteAllEvents = async () => {
    let targetIds = []
    try {
      const res = await api.get('/api/events/ids')
      targetIds = res.ids || []
    } catch {}

    if (targetIds.length > 0) {
      executeBulkDelete(targetIds)
    } else {
      await api.del('/api/events')
      setSelected(new Set())
      setSelectAllAvailable(false)
      setPage(1)
      loadEvents()
    }
  }

  // ── Post-Processing OCR Helpers ──
  const reprocessSingle = async (id) => {
    setReprocessingIds(prev => new Set(prev).add(id))
    try {
      await api.post(`/api/events/${id}/reprocess-ocr`)
      setEvents(prev => prev.map(e => e.id === id ? { ...e, license_plate: 'PROCESSING' } : e))
      if (previewImg && previewImg.id === id) {
        setPreviewImg(prev => ({ ...prev, licensePlate: 'PROCESSING' }))
      }
    } catch (err) {
      console.error("Failed to reprocess OCR", err)
    } finally {
      setTimeout(() => {
        setReprocessingIds(prev => { const n = new Set(prev); n.delete(id); return n })
      }, 1200)
    }
  }

  const reprocessSelected = async () => {
    let targetIds = []
    if (selectAllAvailable) {
      try {
        let url = '/api/events/ids?'
        if (camFilter !== 'all') url += `&camera_id=${camFilter}`
        if (statFilter !== 'all') url += `&status=${statFilter}`
        if (categoryFilter !== 'all') url += `&event_category=${categoryFilter}`
        if (dateFrom) url += `&date_from=${dateFrom}`
        if (dateTo) url += `&date_to=${dateTo}`
        const res = await api.get(url)
        targetIds = res.ids || []
      } catch {
        targetIds = [...selected]
      }
    } else {
      targetIds = [...selected]
    }

    if (!targetIds || targetIds.length === 0) return
    try {
      await api.post('/api/events/reprocess-ocr', { ids: targetIds })
      const idSet = new Set(targetIds)
      setEvents(prev => prev.map(e => idSet.has(e.id) ? { ...e, license_plate: 'PROCESSING' } : e))
      clearSelection()
    } catch (err) {
      console.error("Failed to batch reprocess OCR", err)
    }
  }

  // Confirm wrappers
  const askConfirm = (msg, action) => { setConfirmMsg(msg); setConfirmAction(() => action) }
  const onConfirm = () => { if (confirmAction) confirmAction(); setConfirmMsg(null); setConfirmAction(null) }
  const onCancelConfirm = () => { setConfirmMsg(null); setConfirmAction(null) }

  const selCount = selectAllAvailable ? total : selected.size

  const pages = Math.max(1, Math.ceil(total / PER))

  return (
    <div className="page-wrap">
      <div className="page-header">
        <h1 className="page-title">All Events</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* View Toggle */}
          <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.02)', padding: '2px', borderRadius: '4px', border: '1px solid var(--border2)', marginRight: '8px' }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                background: viewMode === 'list' ? 'var(--border2)' : 'transparent',
                border: 'none',
                color: viewMode === 'list' ? 'var(--t1)' : 'var(--t3)',
                padding: '4px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="List View"
            >
              <i className="fa-solid fa-list" /> List
            </button>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? 'var(--border2)' : 'transparent',
                border: 'none',
                color: viewMode === 'grid' ? 'var(--t1)' : 'var(--t3)',
                padding: '4px 10px',
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Grid View"
            >
              <i className="fa-solid fa-table-cells" /> Grid
            </button>
          </div>

          {selCount > 0 && (
            <>
              <button
                className="btn-secondary"
                style={{
                  background: 'rgba(56, 189, 248, 0.12)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  fontSize: '11px',
                  padding: '6px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onClick={reprocessSelected}
                title="Post-process / Re-scan OCR on selected events"
              >
                <i className="fa-solid fa-rotate" />
                <span>Re-scan OCR ({selCount})</span>
              </button>
              <button className="btn-danger" onClick={() => askConfirm(
                selectAllAvailable
                  ? `This will permanently delete ALL ${total} events across all pages. This cannot be undone.`
                  : `This will permanently delete ${selCount} selected event${selCount > 1 ? 's' : ''}. This cannot be undone.`,
                deleteSelected
              )}>
                <i className="fa-solid fa-trash" /> Delete {selCount > 0 ? `(${selCount})` : ''}
              </button>
            </>
          )}
          <button className="btn-danger-outline" onClick={() => askConfirm(
            `This will permanently delete ALL ${total} events in the database and all snapshot files. This cannot be undone.`,
            deleteAllEvents
          )} title="Delete all events">
            <i className="fa-solid fa-trash-can" /> Delete All
          </button>
        </div>
      </div>

      <div className="filter-bar-full">
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
        <input type="date" className="f-date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span style={{ color: '#64748b', fontSize: 10 }}>→</span>
        <input type="date" className="f-date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <button className="btn-accent" onClick={() => { setPage(1); loadEvents() }}><i className="fa-solid fa-magnifying-glass" /></button>
      </div>

      {/* Gmail-style "Select All Available" banner */}
      {allPageSelected && !selectAllAvailable && total > PER && (
        <div className="select-all-banner">
          <span>All <b>{events.length}</b> events on this page are selected.</span>
          <button onClick={handleSelectAllAvailable}>Select all {total} events across all pages</button>
        </div>
      )}
      {selectAllAvailable && (
        <div className="select-all-banner active">
          <span>All <b>{total}</b> events are selected.</span>
          <button onClick={clearSelection}>Clear selection</button>
        </div>
      )}

      <div className="card" style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {viewMode === 'list' ? (
            <table className="ev-tbl-full">
              <thead><tr>
                <th style={{ width: '36px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    className="ev-checkbox"
                    checked={allPageSelected && allPageIds.length > 0}
                    ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected }}
                    onChange={togglePageAll}
                    title="Select all on this page"
                  />
                </th>
                <th>#</th><th>Time</th><th>Camera</th><th>Vehicle ID</th><th>Event Type</th><th>Status</th><th>Image</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {events.map((ev, i) => {
                  const t = (ev.timestamp || '').split(' ')
                  const isChecked = selectAllAvailable || selected.has(ev.id)
                  const isDms = ev.event_type && ev.event_type !== 'Did Not Stop' && ev.event_type !== 'Did Not Stop (Pedestrian Crossing)'
                  let meta = {}
                  try {
                    if (ev.metadata_json) {
                      meta = typeof ev.metadata_json === 'string' ? JSON.parse(ev.metadata_json) : ev.metadata_json
                    }
                  } catch { }
                  const dp = ev.license_plate || meta.license_plate || meta.number_plate || ev.number_plate || null
                  const pa = meta.plate_ar || meta.license_plate_ar || null
                  const isScanning = dp && dp.toUpperCase() === 'PROCESSING'

                  return (
                    <tr key={ev.id} className={isChecked ? 'row-selected' : ''}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          className="ev-checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(ev.id)}
                        />
                      </td>
                      <td style={{ color: 'var(--t3)' }}>{(page - 1) * PER + i + 1}</td>
                      <td style={{ fontFamily: 'monospace' }}>{t[1] || ev.timestamp}</td>
                      <td>{ev.camera_name}</td>
                      <td>
                        <div style={{ fontWeight: '600' }}>ID: {ev.vehicle_id}</div>
                        {!isDms && (
                          <div style={{ marginTop: '3px' }}>
                            {isScanning ? (
                              <span style={{
                                fontSize: '8px',
                                background: 'rgba(56, 189, 248, 0.12)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.4)',
                                borderRadius: '2px',
                                padding: '1px 5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontWeight: '700'
                              }}>
                                <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '7px' }} />
                                Scanning...
                              </span>
                            ) : dp && dp.toUpperCase() !== 'NOT CLEAR' ? (
                              <span style={{
                                background: '#fff',
                                color: '#000',
                                borderRadius: '2px',
                                padding: '1px 5px',
                                fontFamily: "'Courier New', monospace",
                                fontWeight: '700',
                                fontSize: '8.5px',
                                border: '1px solid #ccc',
                                letterSpacing: '0.4px'
                              }}>
                                {dp}
                              </span>
                            ) : (
                              <span style={{ fontSize: '7.5px', color: 'var(--t3)' }}>Plate N/A</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        {(ev.event_type || '').replace(' (Pedestrian Crossing)', '')}
                        {meta.crossed_line_idx !== undefined && meta.crossed_line_idx !== null && (
                          <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '2px' }}>
                            <i className="fa-solid fa-road" style={{ marginRight: '4px' }} />
                            Stop Line {meta.crossed_line_idx + 1}
                          </div>
                        )}
                      </td>
                      <td>
                        {ev.status === 'Pending' ? (
                          <span className="badge-p" onClick={() => toggleStatus(ev.id, ev.status)} style={{ cursor: 'pointer' }} title="Click to mark Reviewed">Pending</span>
                        ) : (
                          <span className="badge-r" onClick={() => toggleStatus(ev.id, ev.status)} style={{ cursor: 'pointer' }} title="Click to mark Pending">Reviewed</span>
                        )}
                      </td>
                      <td>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <img
                            src={snapshotUrl(ev.snapshot_path)}
                            style={{ height: 28, borderRadius: 2, cursor: 'pointer', display: 'block' }}
                            alt=""
                            onClick={() => {
                              setPreviewImg({
                                id: ev.id,
                                src: snapshotUrl(ev.snapshot_path),
                                licensePlate: dp,
                                plateAr: pa,
                                cameraName: ev.camera_name,
                                eventType: ev.event_type || 'Did Not Stop',
                                timestamp: ev.timestamp,
                                crossedLineIdx: meta.crossed_line_idx
                              })
                            }}
                            onError={e => e.target.style.display = 'none'}
                          />
                          {isScanning && (
                            <div
                              title="AI Scanning License Plate..."
                              onClick={() => {
                                setPreviewImg({
                                  id: ev.id,
                                  src: snapshotUrl(ev.snapshot_path),
                                  licensePlate: dp,
                                  plateAr: pa,
                                  cameraName: ev.camera_name,
                                  eventType: ev.event_type || 'Did Not Stop',
                                  timestamp: ev.timestamp,
                                  crossedLineIdx: meta.crossed_line_idx
                                })
                              }}
                              style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'rgba(7, 10, 20, 0.72)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 2,
                                cursor: 'pointer',
                                border: '1px solid #38bdf8'
                              }}
                            >
                              <i className="fa-solid fa-spinner fa-spin" style={{ color: '#38bdf8', fontSize: '9px' }} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {!isDms && (
                            <button
                              className="act-btn"
                              style={{ padding: '3px 7px', fontSize: 9, color: '#38bdf8' }}
                              onClick={() => reprocessSingle(ev.id)}
                              disabled={isScanning}
                              title="Post-process / Re-scan OCR"
                            >
                              <i className={`fa-solid fa-rotate ${reprocessingIds.has(ev.id) || isScanning ? 'fa-spin' : ''}`} style={{ fontSize: 9 }} />
                            </button>
                          )}
                          <button className="act-btn act-del" style={{ padding: '3px 7px', fontSize: 9 }} onClick={() => askConfirm(
                            `Delete event #${ev.id}? This cannot be undone.`,
                            () => deleteSingle(ev.id)
                          )} title="Delete event"><i className="fa-solid fa-trash" style={{ fontSize: 9 }} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {events.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30, color: 'var(--t3)' }}>No events match your filters</td></tr>}
              </tbody>
            </table>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '12px',
              padding: '12px',
              alignContent: 'start'
            }}>
              {events.map((ev) => {
                const t = (ev.timestamp || '').split(' ')
                const isChecked = selectAllAvailable || selected.has(ev.id)
                const isDms = ev.event_type && ev.event_type !== 'Did Not Stop' && ev.event_type !== 'Did Not Stop (Pedestrian Crossing)'

                let meta = {}
                try {
                  if (ev.metadata_json) {
                    meta = typeof ev.metadata_json === 'string' ? JSON.parse(ev.metadata_json) : ev.metadata_json
                  }
                } catch { }
                const dp = ev.license_plate || meta.license_plate || meta.number_plate || ev.number_plate || null
                const pa = meta.plate_ar || meta.license_plate_ar || null

                return (
                  <div
                    key={ev.id}
                    style={{
                      background: isChecked ? 'rgba(37, 99, 235, 0.05)' : 'var(--panel)',
                      border: isChecked ? '1px solid #2563eb' : '1px solid var(--border)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 10 }}>
                      <input
                        type="checkbox"
                        className="ev-checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(ev.id)}
                      />
                    </div>

                    <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '3px', backdropFilter: 'blur(3px)' }}>
                      #{ev.id}
                    </div>

                    <div
                      style={{ height: '124px', background: '#000', cursor: 'pointer', position: 'relative' }}
                      onClick={() => setPreviewImg({
                        id: ev.id,
                        src: snapshotUrl(ev.snapshot_path),
                        licensePlate: dp,
                        plateAr: pa,
                        cameraName: ev.camera_name,
                        eventType: ev.event_type || 'Did Not Stop',
                        timestamp: ev.timestamp,
                        crossedLineIdx: meta.crossed_line_idx
                      })}
                    >
                      <img
                        src={snapshotUrl(ev.snapshot_path)}
                        alt="Snapshot"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.target.style.display = 'none' }}
                      />
                      {/* Prominent high-tech loading / scanning overlay right over snapshot image */}
                      {dp && dp.toUpperCase() === 'PROCESSING' && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(7, 10, 20, 0.72)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          backdropFilter: 'blur(2px)',
                          border: '1px solid rgba(56, 189, 248, 0.5)'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(56, 189, 248, 0.2)',
                            border: '1px solid #38bdf8',
                            color: '#38bdf8',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            fontSize: '9.5px',
                            fontWeight: '700',
                            boxShadow: '0 0 12px rgba(56, 189, 248, 0.4)'
                          }}>
                            <i className="fa-solid fa-spinner fa-spin" />
                            <span>AI SCANNING...</span>
                          </div>
                          <span style={{ fontSize: '8px', color: '#94a3b8' }}>Reading license plate</span>
                        </div>
                      )}
                    </div>

                    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: 'var(--t3)' }}>
                        <span><i className="fa-solid fa-video" style={{ marginRight: '4px' }} /> {ev.camera_name}</span>
                        <span>{t[1] || ev.timestamp}</span>
                      </div>

                      <div style={{ margin: '2px 0' }}>
                        <span style={{
                          backgroundColor: isDms ? 'rgba(235, 120, 10, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: isDms ? '#ff9d43' : '#fca5a5',
                          border: `1px solid ${isDms ? 'rgba(235, 120, 10, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                          padding: '2px 6px',
                          borderRadius: '3px',
                          fontWeight: '700',
                          fontSize: '9px',
                          display: 'inline-block'
                        }}>
                          {(ev.event_type || '').replace(' (Pedestrian Crossing)', '')}
                        </span>
                        {meta.crossed_line_idx !== undefined && meta.crossed_line_idx !== null && (
                          <span style={{
                            backgroundColor: 'rgba(59, 130, 246, 0.12)',
                            color: '#38bdf8',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            padding: '2px 6px',
                            borderRadius: '3px',
                            fontWeight: '700',
                            fontSize: '9px',
                            display: 'inline-block',
                            marginLeft: '6px'
                          }}>
                            Line {meta.crossed_line_idx + 1}
                          </span>
                        )}
                      </div>

                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        {isDms ? (
                          <div style={{ fontSize: '9px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <i className="fa-solid fa-user-shield" /> DMS Cabin Event
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '9.5px', color: 'var(--t2)', fontWeight: '600' }}>ID: {ev.vehicle_id}</span>
                            {dp && dp.toUpperCase() === 'PROCESSING' ? (
                              <span style={{
                                fontSize: '8px',
                                background: 'rgba(56, 189, 248, 0.12)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.4)',
                                borderRadius: '2px',
                                padding: '2px 5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: '700'
                              }}>
                                <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '7.5px' }} />
                                Scanning...
                              </span>
                            ) : dp && dp.toUpperCase() !== 'NOT CLEAR' ? (
                              <div style={{
                                background: '#fff',
                                color: '#000',
                                borderRadius: '2px',
                                padding: '1px 4px',
                                fontFamily: "'Courier New', monospace",
                                fontWeight: '700',
                                fontSize: '8px',
                                textAlign: 'center',
                                border: '1px solid #ccc',
                                lineHeight: '1.1'
                              }}>
                                {pa && <div style={{ borderBottom: '1px solid #ddd', fontSize: '6.5px', color: '#333', marginBottom: '1px' }}>{pa}</div>}
                                <div style={{ letterSpacing: '0.5px' }}>{dp}</div>
                              </div>
                            ) : (
                              <span style={{ fontSize: '8px', background: 'rgba(255,255,255,0.03)', color: 'var(--t3)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '2px', padding: '2px 4px' }}>Plate N/A</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
                        {ev.status === 'Pending' ? (
                          <span className="badge-p" onClick={() => toggleStatus(ev.id, ev.status)} style={{ cursor: 'pointer', padding: '3px 8px', fontSize: '9px' }} title="Click to mark Reviewed">Pending</span>
                        ) : (
                          <span className="badge-r" onClick={() => toggleStatus(ev.id, ev.status)} style={{ cursor: 'pointer', padding: '3px 8px', fontSize: '9px' }} title="Click to mark Pending">Reviewed</span>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {!isDms && (
                            <button
                              className="act-btn"
                              style={{ padding: '4px 8px', fontSize: 9, color: '#38bdf8' }}
                              onClick={() => reprocessSingle(ev.id)}
                              disabled={dp && dp.toUpperCase() === 'PROCESSING'}
                              title="Post-process / Re-scan OCR"
                            >
                              <i className={`fa-solid fa-rotate ${reprocessingIds.has(ev.id) || (dp && dp.toUpperCase() === 'PROCESSING') ? 'fa-spin' : ''}`} style={{ fontSize: 10 }} />
                            </button>
                          )}
                          <button className="act-btn act-del" style={{ padding: '4px 8px', fontSize: 9 }} onClick={() => askConfirm(
                            `Delete event #${ev.id}? This cannot be undone.`,
                            () => deleteSingle(ev.id)
                          )} title="Delete event">
                            <i className="fa-solid fa-trash" style={{ fontSize: 10 }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {events.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--t3)' }}>
                  No events match your filters
                </div>
              )}
            </div>
          )}
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

      {/* Fullscreen zoom modal overlay */}
      <ImageModal preview={previewImg} onClose={() => setPreviewImg(null)} onReprocess={reprocessSingle} />

      {/* Confirm delete modal */}
      <ConfirmModal message={confirmMsg} onConfirm={onConfirm} onCancel={onCancelConfirm} />

      {/* Realtime bulk deletion progress modal */}
      <BulkDeleteProgressModal progress={progressState} />
    </div>
  )
}
