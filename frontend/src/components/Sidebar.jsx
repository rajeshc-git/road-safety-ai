import './Sidebar.css'

const NAV = [
  { id: 'dashboard', icon: 'fa-gauge-high', label: 'Dashboard' },
  { id: 'cameras',   icon: 'fa-video',      label: 'Cameras' },
  { id: 'events',    icon: 'fa-list',       label: 'Events' },
  { id: 'settings',  icon: 'fa-sliders',    label: 'Settings' },
  { id: 'system',    icon: 'fa-server',     label: 'Info' },
]

export default function Sidebar({ currentPage, onNavigate, sysInfo, collapsed, onToggle }) {
  const cpu  = Math.round(sysInfo?.cpu_usage    || 0)
  const mem  = Math.round(sysInfo?.memory_usage || 0)
  const disk = Math.round(sysInfo?.disk_usage   || 0)

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sb-brand">
        <div className="sb-brand-icon">
          <svg className="sb-logo-svg" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="vgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
              <linearGradient id="vgInner" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            <path d="M16 2.5L27 7.5V17.5C27 23.5 22.2 27.8 16 29.5C9.8 27.8 5 23.5 5 17.5V7.5L16 2.5Z" 
                  stroke="url(#vgGrad)" strokeWidth="2" strokeLinejoin="round" fill="rgba(37, 99, 235, 0.14)" />
            <circle cx="16" cy="16" r="4.8" stroke="url(#vgInner)" strokeWidth="1.6" fill="rgba(6, 182, 212, 0.22)" />
            <circle cx="16" cy="16" r="2" fill="#38bdf8" />
            <path d="M16 8V10.5M16 21.5V24M8 16H10.5M21.5 16H24" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
          </svg>
        </div>
        <div className="sb-brand-info">
          <div className="sb-brand-name">VIGILIX AI</div>
          <div className="sb-brand-sub">Traffic & Cabin Compliance</div>
        </div>
        {onToggle && (
          <button 
            className="sb-collapse-btn" 
            onClick={onToggle}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <i className="fa-solid fa-angles-left" />
          </button>
        )}
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

      <div className="sb-footer">© 2026 VIGILIX AI · v2.0</div>
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
