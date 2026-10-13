import { useState, useEffect } from 'react'
import './TopBar.css'

export default function TopBar({ sidebarCollapsed, onToggleSidebar, ocrToast, onDismissToast }) {
  const [time, setTime] = useState('')
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light')
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.remove('light-theme')
      document.documentElement.classList.add('dark-theme')
    } else {
      document.documentElement.classList.add('light-theme')
      document.documentElement.classList.remove('dark-theme')
    }
    localStorage.setItem('theme', theme)
  }, [theme])


  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    const tick = () => {
      const d = new Date()
      setTime(
        d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
        '  ' +
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {})
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }

  // Toast theme styles based on toast_type
  const toastColors = {
    success: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.35)', color: '#10b981', icon: 'fa-check-circle' },
    warning: { bg: 'rgba(245, 158, 11, 0.14)', border: 'rgba(245, 158, 11, 0.45)', color: '#f59e0b', icon: 'fa-triangle-exclamation' },
    error: { bg: 'rgba(239, 68, 68, 0.14)', border: 'rgba(239, 68, 68, 0.45)', color: '#ef4444', icon: 'fa-circle-xmark' },
    info: { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.35)', color: '#38bdf8', icon: 'fa-info-circle' },
  }
  const currentToastTheme = ocrToast ? (toastColors[ocrToast.toast_type] || toastColors.info) : toastColors.info

  return (
    <header className="topbar">
      <div className="tb-left">
        {sidebarCollapsed && (
          <button
            className="tb-hamburger"
            onClick={onToggleSidebar}
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <i className="fa-solid fa-bars" />
          </button>
        )}

        {/* Live OCR.space real-time Toast in Header Left */}
        {ocrToast && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              borderRadius: '20px',
              background: currentToastTheme.bg,
              border: `1px solid ${currentToastTheme.border}`,
              color: currentToastTheme.color,
              fontSize: '11px',
              fontWeight: '600',
              backdropFilter: 'blur(8px)',
              animation: 'fadeIn 0.22s ease-out',
              maxWidth: '380px',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)'
            }}
          >
            <i className={`fa-solid ${currentToastTheme.icon}`} style={{ fontSize: '11px' }} />
            <span style={{ fontWeight: '800', letterSpacing: '0.3px' }}>{ocrToast.title || 'OCR.space'}:</span>
            <span style={{ color: 'var(--t1)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ocrToast.message}
            </span>
            {onDismissToast && (
              <button
                onClick={onDismissToast}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--t3)',
                  cursor: 'pointer',
                  padding: '0 2px',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '11px'
                }}
                title="Dismiss"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="tb-right">
        <span className="tb-clock">{time}</span>
        <button
          type="button"
          className="tb-icon-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          aria-label="Toggle theme"
        >
          <i className={`fa-solid ${theme === 'light' ? 'fa-moon' : 'fa-sun'}`} />
        </button>
        <button
          type="button"
          className="tb-icon-btn"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
          aria-label="Toggle full screen"
        >
          <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`} />
        </button>
        <div className="tb-user-static">
          <i className="fa-regular fa-circle-user" />
          <span>Admin</span>
        </div>
      </div>
    </header>
  )
}

