import { useState, useEffect } from 'react'
import './TopBar.css'

export default function TopBar() {
  const [time, setTime] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark')

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme')
    } else {
      document.documentElement.classList.remove('light-theme')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

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

  useEffect(() => {
    if (!dropdownOpen) return
    const handleClose = () => setDropdownOpen(false)
    window.addEventListener('click', handleClose)
    return () => window.removeEventListener('click', handleClose)
  }, [dropdownOpen])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  return (
    <header className="topbar">
      <div className="tb-left">
        <span className="det-pill">
          <span className="det-dot" />
          DETECTION RUNNING
        </span>
      </div>
      <div className="tb-right" style={{ position: 'relative' }}>
        <span className="tb-clock">{time}</span>
        <div className="tb-user" onClick={(e) => { e.stopPropagation(); setDropdownOpen(!dropdownOpen); }}>
          <i className="fa-regular fa-circle-user" />
          <span>Admin</span>
          <i className={`fa-solid ${dropdownOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ fontSize: 9 }} />
        </div>

        {dropdownOpen && (
          <div className="tb-dropdown" onClick={(e) => e.stopPropagation()} style={{
            position: 'absolute',
            top: '38px',
            right: 0,
            background: 'var(--panel)',
            border: '1px solid var(--border2)',
            borderRadius: '6px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            padding: '8px',
            zIndex: 1000,
            minWidth: '150px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{
              fontSize: '10px',
              fontWeight: '600',
              color: 'var(--t2)',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '4px',
              marginBottom: '2px'
            }}>
              Control Panel
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              color: 'var(--t1)',
              cursor: 'pointer',
              padding: '6px 8px',
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.02)'
            }} onClick={toggleTheme}>
              <span>Theme: <b>{theme === 'light' ? 'Light' : 'Dark'}</b></span>
              <i className={`fa-solid ${theme === 'light' ? 'fa-sun' : 'fa-moon'}`} style={{ color: theme === 'light' ? '#f59e0b' : '#3b82f6' }}/>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
