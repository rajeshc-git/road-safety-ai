import { useState, useEffect } from 'react'
import { snapshotUrl, api } from '../api'
import './Pages.css'

/* ─────────────────────────── EVIDENCE IMAGE PREVIEW MODAL ─────────────────────────── */
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
  const lineSuffix = crossedLineIdx !== undefined && crossedLineIdx !== null ? ` [Line ${crossedLineIdx + 1}]` : '';
  const titleText = cameraName && cleanEventType && timestamp
    ? `${cameraName} — ${cleanEventType}${lineSuffix} [${timestamp}]`
    : 'Evidentiary Infraction Snapshot Preview';

  return (
    <div className="modal-overlay" style={{ zIndex: 9999, background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div className="modal" style={{
        maxWidth: '85vw',
        width: 'auto',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4)',
        padding: '0',
        borderRadius: '8px',
        overflow: 'hidden'
      }} onClick={e => e.stopPropagation()}>
        <div className="modal-head" style={{ padding: '12px 18px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', color: '#ff9d43' }}>
              <i className="fa-solid fa-file-image" style={{ marginRight: '6px' }} /> {titleText}
            </span>
            {licensePlate && (
              <div style={{
                background: '#fff',
                color: '#000',
                borderRadius: '3px',
                padding: '3px 6px',
                fontFamily: "'Courier New', monospace",
                fontWeight: '700',
                fontSize: '9px',
                textAlign: 'center',
                display: 'inline-block',
                lineHeight: '1.1',
                border: '1px solid #ccc',
                marginLeft: '12px'
              }}>
                {plateAr && (
                  <div style={{
                    borderBottom: '1px solid #bbb',
                    fontSize: '8px',
                    marginBottom: '1px',
                    color: '#222',
                    direction: 'rtl'
                  }}>
                    {plateAr}
                  </div>
                )}
                <div style={{ letterSpacing: '1px' }}>
                  {licensePlate}
                </div>
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={onClose} style={{ fontSize: '15px', color: 'var(--t3)', background: 'transparent', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: '0', display: 'flex', justifyContent: 'center', background: '#000' }}>
          <img src={src} alt="Evidence" style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', display: 'block' }} />
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

  const deleteSelected = async () => {
    if (selectAllAvailable) {
      // Delete ALL matching events
      await api.del('/api/events')
    } else {
      await api.post('/api/events/bulk-delete', { ids: [...selected] })
    }
    setSelected(new Set())
    setSelectAllAvailable(false)
    setPage(1)
    loadEvents()
  }

  const deleteAllEvents = async () => {
    await api.del('/api/events')
    setSelected(new Set())
    setSelectAllAvailable(false)
    setPage(1)
    loadEvents()
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
            <button className="btn-danger" onClick={() => askConfirm(
              selectAllAvailable
                ? `This will permanently delete ALL ${total} events across all pages. This cannot be undone.`
                : `This will permanently delete ${selCount} selected event${selCount > 1 ? 's' : ''}. This cannot be undone.`,
              deleteSelected
            )}>
              <i className="fa-solid fa-trash" /> Delete {selCount > 0 ? `(${selCount})` : ''}
            </button>
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
                  let meta = {}
                  try {
                    if (ev.metadata_json) {
                      meta = typeof ev.metadata_json === 'string' ? JSON.parse(ev.metadata_json) : ev.metadata_json
                    }
                  } catch { }
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
                      <td>ID: {ev.vehicle_id}</td>
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
                        <img
                          src={snapshotUrl(ev.snapshot_path)}
                          style={{ height: 28, borderRadius: 2, cursor: 'pointer' }}
                          alt=""
                          onClick={() => {
                            const dp = ev.license_plate || meta.license_plate || meta.number_plate || ev.number_plate || null
                            const pa = meta.plate_ar || meta.license_plate_ar || null
                            setPreviewImg({
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
                      </td>
                      <td>
                        <button className="act-btn act-del" style={{ padding: '3px 8px', fontSize: 9 }} onClick={() => askConfirm(
                          `Delete event #${ev.id}? This cannot be undone.`,
                          () => deleteSingle(ev.id)
                        )} title="Delete event"><i className="fa-solid fa-trash" style={{ fontSize: 9 }} /></button>
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
                      style={{ height: '124px', background: '#000', cursor: 'pointer' }}
                      onClick={() => setPreviewImg({
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
                            color: '#3b82f6',
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
                            {dp ? (
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

                        <button className="act-btn act-del" style={{ padding: '4px 8px', fontSize: 9 }} onClick={() => askConfirm(
                          `Delete event #${ev.id}? This cannot be undone.`,
                          () => deleteSingle(ev.id)
                        )} title="Delete event">
                          <i className="fa-solid fa-trash" style={{ fontSize: 10 }} />
                        </button>
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
      <ImageModal preview={previewImg} onClose={() => setPreviewImg(null)} />

      {/* Confirm delete modal */}
      <ConfirmModal message={confirmMsg} onConfirm={onConfirm} onCancel={onCancelConfirm} />
    </div>
  )
}
