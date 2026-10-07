import { useState, useEffect } from 'react'
import './TopBar.css'

export default function TopBar({ sidebarCollapsed, onToggleSidebar }) {
  const [time, setTime] = useState('')
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark')
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme')
    } else {
      document.documentElement.classList.remove('light-theme')
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
