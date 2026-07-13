import './Sidebar.css'

const NAV = [
  { id: 'dashboard', icon: 'fa-gauge-high', label: 'Dashboard' },
  { id: 'cameras',   icon: 'fa-video',      label: 'Cameras' },
  { id: 'events',    icon: 'fa-list',       label: 'Events' },
  { id: 'settings',  icon: 'fa-sliders',    label: 'Settings' },
  { id: 'system',    icon: 'fa-server',     label: 'System' },
]

export default function Sidebar({ currentPage, onNavigate, sysInfo }) {
  const cpu  = Math.round(sysInfo?.cpu_usage    || 0)
  const mem  = Math.round(sysInfo?.memory_usage || 0)
  const disk = Math.round(sysInfo?.disk_usage   || 0)

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-brand-icon"><i className="fa-solid fa-shield-halved" /></div>
        <div>
          <div className="sb-brand-name">SAFETY MONITOR</div>
          <div className="sb-brand-sub">Stop Compliance System</div>
        </div>
      </div>

      <nav className="sb-nav">
        {NAV.map(n => (
          <button key={n.id} className={`sb-link${currentPage === n.id ? ' active' : ''}`} onClick={() => onNavigate(n.id)}>
            <i className={`fa-solid ${n.icon}`} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      <div className="sb-status">
        <div className="sb-status-row">
          <div className="sb-dot" />
          <div>
            <div className="sb-status-title">System Status</div>
            <div className="sb-status-ok">All Systems Operational</div>
          </div>
        </div>
        <SysBar label="CPU Usage"    value={cpu}  />
        <SysBar label="Memory Usage" value={mem}  />
        <SysBar label="Disk Usage"   value={disk} />
        {typeof sysInfo?.gpu_usage === 'number' && (
          <SysBar label="GPU Usage" value={Math.round(sysInfo.gpu_usage)} />
        )}
      </div>

      <div className="sb-footer">© 2026 Safety Stop AI<br />v1.0.0</div>
    </aside>
  )
}

function SysBar({ label, value }) {
  return (
    <div className="sb-bar">
      <span>{label}</span><span>{value}%</span>
      <div className="sb-bar-track"><div className="sb-bar-fill" style={{ width: `${value}%` }} /></div>
    </div>
  )
}
