import './Pages.css'
import { api } from '../api'

export default function SystemPage({ sysInfo }) {
  const handleReset = async () => {
    if (window.confirm("⚠️ WARNING: This will delete ALL cameras, delete ALL event logs, clear all snapshots, and restore all settings to default values. This action CANNOT BE UNDONE.\n\nAre you sure you want to proceed?")) {
      try {
        const res = await api.post('/api/system/reset')
        if (res.status === 'success') {
          alert("Database successfully reset. The application will reload.")
          window.location.reload()
        } else {
          alert("Failed to reset database: " + (res.message || "Unknown error"))
        }
      } catch (e) {
        console.error(e)
        alert("Error resetting database. Please check console.")
      }
    }
  }
  const cpu = Math.round(sysInfo?.cpu_usage || 0)
  const mem = Math.round(sysInfo?.memory_usage || 0)
  const disk = Math.round(sysInfo?.disk_usage || 0)

  const metrics = [
    { label: 'CPU Usage', value: cpu, color: cpu > 80 ? '#ef4444' : cpu > 60 ? '#f59e0b' : '#10b981', icon: 'fa-microchip' },
    { label: 'Memory Usage', value: mem, color: mem > 80 ? '#ef4444' : mem > 60 ? '#f59e0b' : '#10b981', icon: 'fa-memory' },
    { label: 'Disk Usage', value: disk, color: disk > 80 ? '#ef4444' : disk > 60 ? '#f59e0b' : '#10b981', icon: 'fa-hard-drive' },
  ]

  return (
    <div className="page-wrap">
      <div className="page-header"><h1 className="page-title">System</h1></div>
      <div className="sys-page-grid">
        {metrics.map(m => (
          <div key={m.label} className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: m.color }}>{m.value}%</div>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${m.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: m.color }}>
                <i className={`fa-solid ${m.icon}`} />
              </div>
            </div>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${m.value}%`, background: m.color, borderRadius: 3, transition: 'width .6s ease' }} />
            </div>
          </div>
        ))}
        {typeof sysInfo?.gpu_usage === 'number' ? (
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 4 }}>GPU Usage</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: sysInfo.gpu_usage > 80 ? '#ef4444' : sysInfo.gpu_usage > 60 ? '#f59e0b' : '#8b5cf6' }}>
                  {Math.round(sysInfo.gpu_usage)}%
                </div>
              </div>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: sysInfo.gpu_usage > 80 ? '#ef444418' : sysInfo.gpu_usage > 60 ? '#f59e0b18' : '#8b5cf618', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: sysInfo.gpu_usage > 80 ? '#ef4444' : sysInfo.gpu_usage > 60 ? '#f59e0b' : '#8b5cf6' }}>
                <i className="fa-solid fa-rocket" />
              </div>
            </div>
            <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${sysInfo.gpu_usage}%`, background: sysInfo.gpu_usage > 80 ? '#ef4444' : sysInfo.gpu_usage > 60 ? '#f59e0b' : '#8b5cf6', borderRadius: 3, transition: 'width .6s ease' }} />
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 4 }}>System Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#10b981', fontWeight: 700, marginTop: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              All Systems Operational
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-head"><span>System Information</span></div>
        <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px 24px', fontSize: 11 }}>
          {[
            ['Application', 'Safety Stop AI v1.0.0'],
            ['Backend', 'FastAPI + Python'],
            ['ML Engine', 'YOLO + Supervision'],
            [
              'Database',
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>SQLite (aiosqlite)</span>
                <button
                  onClick={handleReset}
                  className="btn-danger"
                  style={{ padding: '2px 8px', fontSize: '9px', borderRadius: '3px', height: '18px', display: 'flex', alignItems: 'center', boxShadow: 'none', cursor: 'pointer' }}
                >
                  <i className="fa-solid fa-trash" style={{ marginRight: '4px', fontSize: '8px' }} /> Reset DB
                </button>
              </div>
            ],
            ['Streaming', 'MJPEG / WebSocket'],
            ['Status', 'Running'],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ color: 'var(--t3)', marginBottom: 2 }}>{k}</div>
              <div style={{ color: 'var(--t1)', fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
