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
  const redis = sysInfo?.redis || {}
  const minio = sysInfo?.minio || {}

  const metrics = [
    { label: 'CPU Usage', value: cpu, color: cpu > 80 ? '#ef4444' : cpu > 60 ? '#f59e0b' : '#10b981', icon: 'fa-microchip' },
    { label: 'Memory Usage', value: mem, color: mem > 80 ? '#ef4444' : mem > 60 ? '#f59e0b' : '#10b981', icon: 'fa-memory' },
    { label: 'Disk Usage', value: disk, color: disk > 80 ? '#ef4444' : disk > 60 ? '#f59e0b' : '#10b981', icon: 'fa-hard-drive' },
  ]

  return (
    <div className="page-wrap">
      <div className="page-header"><h1 className="page-title">System & Infrastructure</h1></div>
      <div className="sys-page-grid">
        {metrics.map(m => (
          <div key={m.label} className="card sys-metric-card">
            <div className="sys-metric-head">
              <div>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 2 }}>{m.label}</div>
                <div className="sys-metric-val" style={{ color: m.color }}>{m.value}%</div>
              </div>
              <div className="sys-metric-icon" style={{ background: `${m.color}18`, color: m.color }}>
                <i className={`fa-solid ${m.icon}`} />
              </div>
            </div>
            <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${m.value}%`, background: m.color, borderRadius: 3, transition: 'width .6s ease' }} />
            </div>
          </div>
        ))}
        {typeof sysInfo?.gpu_usage === 'number' ? (
          <div className="card sys-metric-card">
            <div className="sys-metric-head">
              <div>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 2 }}>GPU Usage</div>
                <div className="sys-metric-val" style={{ color: sysInfo.gpu_usage > 80 ? '#ef4444' : sysInfo.gpu_usage > 60 ? '#f59e0b' : '#8b5cf6' }}>
                  {Math.round(sysInfo.gpu_usage)}%
                </div>
              </div>
              <div className="sys-metric-icon" style={{ background: sysInfo.gpu_usage > 80 ? '#ef444418' : sysInfo.gpu_usage > 60 ? '#f59e0b18' : '#8b5cf618', color: sysInfo.gpu_usage > 80 ? '#ef4444' : sysInfo.gpu_usage > 60 ? '#f59e0b' : '#8b5cf6' }}>
                <i className="fa-solid fa-rocket" />
              </div>
            </div>
            <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${sysInfo.gpu_usage}%`, background: sysInfo.gpu_usage > 80 ? '#ef4444' : sysInfo.gpu_usage > 60 ? '#f59e0b' : '#8b5cf6', borderRadius: 3, transition: 'width .6s ease' }} />
            </div>
          </div>
        ) : (
          <div className="card sys-metric-card">
            <div className="sys-metric-head">
              <div>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 2 }}>System Status</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#10b981', fontWeight: 700, marginTop: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  Operational
                </div>
              </div>
              <div className="sys-metric-icon" style={{ background: '#10b98118', color: '#10b981' }}>
                <i className="fa-solid fa-shield-halved" />
              </div>
            </div>
            <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '100%', background: '#10b981', borderRadius: 3 }} />
            </div>
          </div>
        )}
      </div>

      {/* Redis & MinIO Infrastructure Status Cards */}
      <div className="sys-infra-grid">
        {/* Redis Card */}
        <div className="card sys-infra-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ef444418', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: 16 }}>
                <i className="fa-solid fa-bolt" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--t1)' }}>Redis Pub/Sub & Cache</div>
                <div style={{ fontSize: 10.5, color: 'var(--t3)' }}>Real-time telemetry event bus</div>
              </div>
            </div>
            <span style={{
              fontSize: '10px',
              padding: '2px 8px',
              borderRadius: '6px',
              fontWeight: 600,
              background: redis.status === 'online' ? '#10b98118' : '#6b728018',
              color: redis.status === 'online' ? '#10b981' : '#6b7280'
            }}>
              {redis.status === 'online' ? '● Connected' : '○ Fallback'}
            </span>
          </div>
          <div className="sys-infra-meta">
            <div><span style={{ color: 'var(--t3)' }}>Version:</span> <b style={{ color: 'var(--t1)' }}>{redis.version || '7.x'}</b></div>
            <div><span style={{ color: 'var(--t3)' }}>Memory:</span> <b style={{ color: 'var(--t1)' }}>{redis.used_memory_human || 'N/A'}</b></div>
            <div><span style={{ color: 'var(--t3)' }}>Clients:</span> <b style={{ color: 'var(--t1)' }}>{redis.connected_clients || 0}</b></div>
            <div><span style={{ color: 'var(--t3)' }}>Uptime:</span> <b style={{ color: 'var(--t1)' }}>{redis.uptime_in_seconds ? `${Math.round(redis.uptime_in_seconds / 60)}m` : 'N/A'}</b></div>
          </div>
        </div>

        {/* MinIO Card */}
        <div className="card sys-infra-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#c026d318', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c026d3', fontSize: 16 }}>
                <i className="fa-solid fa-box-archive" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--t1)' }}>MinIO Object Storage</div>
                <div style={{ fontSize: 10.5, color: 'var(--t3)' }}>S3 violation media & evidence storage</div>
              </div>
            </div>
            <span style={{
              fontSize: '10px',
              padding: '2px 8px',
              borderRadius: '6px',
              fontWeight: 600,
              background: minio.status === 'online' ? '#10b98118' : '#6b728018',
              color: minio.status === 'online' ? '#10b981' : '#6b7280'
            }}>
              {minio.status === 'online' ? '● S3 Connected' : '○ Local Disk'}
            </span>
          </div>
          <div className="sys-infra-meta">
            <div><span style={{ color: 'var(--t3)' }}>Bucket:</span> <b style={{ color: 'var(--t1)' }}>{minio.bucket || 'safety-violations'}</b></div>
            <div><span style={{ color: 'var(--t3)' }}>Objects:</span> <b style={{ color: 'var(--t1)' }}>{minio.object_count ?? 'N/A'}</b></div>
            <div><span style={{ color: 'var(--t3)' }}>Storage:</span> <b style={{ color: 'var(--t1)' }}>{minio.storage_used_mb ? `${minio.storage_used_mb} MB` : 'N/A'}</b></div>
            <div><span style={{ color: 'var(--t3)' }}>Endpoint:</span> <b style={{ color: 'var(--t1)' }}>{minio.endpoint || 'localhost:9000'}</b></div>
          </div>
        </div>
      </div>

      <div className="card sys-info-card">
        <div className="card-head"><span>System Information</span></div>
        <div className="sys-info-details">
          {[
            ['Application', 'VIGILIX AI v2.0'],
            ['Backend', 'FastAPI + Python + WebRTC'],
            ['ML Engine', 'YOLOv8 + MediaPipe + PaddleOCR'],
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
            ['Streaming Protocol', 'Direct MJPEG + WebRTC Dual Engine'],
            ['Event Bus', 'Redis Pub/Sub & In-Memory Cache'],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ color: 'var(--t3)', marginBottom: 2, fontSize: 10.5 }}>{k}</div>
              <div style={{ color: 'var(--t1)', fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
