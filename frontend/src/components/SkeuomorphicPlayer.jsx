import { useState, useEffect, useRef } from 'react'
import './SkeuomorphicPlayer.css'

export const PLAYER_SKINS = [
  { id: 'standard', name: 'Standard Modern', icon: 'fa-display' },
  { id: 'winamp-amber', name: 'Winamp 3 Amber Titanium', icon: 'fa-radio' },
  { id: 'wood-brass', name: 'Mahogany Wood & Brass', icon: 'fa-tree' },
  { id: 'cyber-obsidian', name: 'Cyber Obsidian & Cyan', icon: 'fa-bolt' },
  { id: 'vintage-hifi', name: '1980s Vintage Hi-Fi', icon: 'fa-sliders' },
]

export default function SkeuomorphicPlayer({
  skin,
  onSkinChange,
  activeCam,
  cameras,
  isActiveOnline,
  streamLoading,
  onStart,
  onStop,
  onCamSwitch,
  fps,
  telemetry,
  isDms,
  onFullscreen,
  onToggleDraw,
  isDrawingZone,
  children
}) {
  const [knobAngle, setKnobAngle] = useState(45)
  const [trebAngle, setTrebAngle] = useState(20)
  const [bassAngle, setBassAngle] = useState(-30)

  // Find previous and next cameras for the tactile hardware buttons
  const currentIdx = (cameras || []).findIndex(c => c.id === activeCam?.id)
  const prevCam = currentIdx > 0 ? cameras[currentIdx - 1] : cameras[(cameras || []).length - 1]
  const nextCam = currentIdx < (cameras || []).length - 1 ? cameras[currentIdx + 1] : cameras[0]

  const handlePrevCam = () => {
    if (prevCam && onCamSwitch) onCamSwitch(prevCam.id)
  }

  const handleNextCam = () => {
    if (nextCam && onCamSwitch) onCamSwitch(nextCam.id)
  }

  const handleMainKnobClick = () => {
    setKnobAngle(prev => (prev + 35 > 140 ? -140 : prev + 35))
  }

  const handleTrebClick = () => {
    setTrebAngle(prev => (prev + 40 > 130 ? -130 : prev + 40))
  }

  const handleBassClick = () => {
    setBassAngle(prev => (prev + 40 > 130 ? -130 : prev + 40))
  }

  if (skin === 'standard') {
    return <div className="player-skin-wrap standard-skin">{children}</div>
  }

  return (
    <div className={`skeuo-chassis ${skin}`}>
      {/* Outer Hardware Faceplate Bevel */}
      <div className="skeuo-body">
        
        {/* Left Tactile Grip / Hardware Controls */}
        <div className="skeuo-left-grip">
          <div className="skeuo-screw top" />
          <div className="skeuo-led-cluster">
            <div className={`skeuo-led amber ${isActiveOnline ? 'lit' : ''}`} title="Signal Power" />
            <div className={`skeuo-led cyan ${!streamLoading ? 'lit' : 'blink'}`} title="AI Neural Sync" />
            <div className={`skeuo-led red ${isDms ? 'lit' : ''}`} title="Cabin Sensor" />
          </div>
          <div className="skeuo-recessed-grooves">
            <div className="groove" />
            <div className="groove" />
            <div className="groove" />
          </div>
          <button 
            type="button" 
            className="skeuo-tactile-round-btn"
            onClick={onFullscreen}
            title="Eject / Fullscreen Theater"
          >
            <i className="fa-solid fa-eject" />
          </button>
        </div>

        {/* Central Display & Bezel Section */}
        <div className="skeuo-center-unit">
          
          {/* Top Brand & Status Plaque */}
          <div className="skeuo-top-plaque">
            <div className="plaque-emboss">
              <span className="brand-dot" />
              <span className="plaque-title">HIGH-FIDELITY VISION</span>
              <span className="brand-dot" />
            </div>
            
            {/* Camera Feed Selector */}
            <div className="skeuo-skin-selector" title="Switch Active Camera">
              <i className="fa-solid fa-video skin-icon" />
              <select 
                value={activeCam?.id || ''} 
                onChange={(e) => onCamSwitch && onCamSwitch(e.target.value)}
                className="skeuo-skin-dropdown"
              >
                {(cameras || []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                {(cameras || []).length === 0 && <option value="">No cameras</option>}
              </select>
            </div>
          </div>

          {/* Glowing Cockpit LCD Display Viewport */}
          <div className="skeuo-screen-housing">
            <div className="skeuo-screen-glass">
              
              {/* Retro HUD Header inside Amber/Green Glass */}
              <div className="skeuo-hud-header">
                <div className="hud-left-tags">
                  <span className={`hud-badge ${isActiveOnline ? 'active' : ''}`}>
                    {isActiveOnline ? '● LIVE FEED' : '○ STANDBY'}
                  </span>
                  <span className="hud-track-name">{activeCam?.name || 'NO CAMERA'}</span>
                </div>
                <div className="hud-right-telemetry">
                  <span className="hud-metric">FPS: <b>{fps}</b></span>
                  <span className="hud-vol-bars">
                    <span className="vol-bar filled" />
                    <span className="vol-bar filled" />
                    <span className="vol-bar filled" />
                    <span className="vol-bar filled" />
                    <span className="vol-bar" />
                  </span>
                  <span className="hud-digital-clock">
                    {isActiveOnline ? '00:32' : '--:--'}
                  </span>
                </div>
              </div>

              {/* The Actual Video / Camera Feed Canvas & Overlays */}
              <div className="skeuo-viewport-content">
                {children}

                {/* Oscilloscope Audio / Frequency Wireframe Overlay */}
                {isActiveOnline && (
                  <div className="skeuo-oscilloscope-overlay">
                    <svg viewBox="0 0 400 60" className="oscilloscope-svg" preserveAspectRatio="none">
                      <path 
                        d="M0 30 Q 30 10, 60 30 T 120 30 T 180 15 T 240 45 T 300 30 T 360 20 T 400 30" 
                        fill="none" 
                        className="osc-wave-1" 
                      />
                      <path 
                        d="M0 30 Q 40 45, 80 30 T 160 30 T 220 50 T 280 10 T 340 30 T 400 30" 
                        fill="none" 
                        className="osc-wave-2" 
                      />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Lower Mechanical Cockpit Control Deck */}
          <div className="skeuo-bottom-deck">
            
            {/* Left Circular Convex Skip Module */}
            <div className="skeuo-convex-btn-module">
              <button 
                type="button" 
                className="skeuo-convex-dual-btn"
                onClick={handlePrevCam}
                title={`Previous Camera (${prevCam?.name || 'Prev'})`}
              >
                <i className="fa-solid fa-backward-step" />
              </button>
              <button 
                type="button" 
                className="skeuo-convex-dual-btn"
                onClick={handleNextCam}
                title={`Next Camera (${nextCam?.name || 'Next'})`}
              >
                <i className="fa-solid fa-forward-step" />
              </button>
            </div>

            {/* Middle Tactile Micro-Knobs (SENS / GAIN) */}
            <div className="skeuo-rotary-sub-group">
              <div className="skeuo-micro-dial-wrap" onClick={handleTrebClick} title="Sensitivity / High Pass (Click to rotate)">
                <div 
                  className="skeuo-micro-knob" 
                  style={{ transform: `rotate(${trebAngle}deg)` }}
                >
                  <div className="knob-notch" />
                </div>
                <span className="micro-knob-label">SENS</span>
              </div>
              
              <div className="skeuo-micro-dial-wrap" onClick={handleBassClick} title="Gain / Frame Buffer (Click to rotate)">
                <div 
                  className="skeuo-micro-knob" 
                  style={{ transform: `rotate(${bassAngle}deg)` }}
                >
                  <div className="knob-notch" />
                </div>
                <span className="micro-knob-label">GAIN</span>
              </div>
            </div>

            {/* Master Machined Metallic Volume / Rate Rotary Knob */}
            <div className="skeuo-master-dial-wrap" onClick={handleMainKnobClick} title="Master AI Precision & Frame Rate Dial (Click to rotate)">
              <div 
                className="skeuo-master-knob" 
                style={{ transform: `rotate(${knobAngle}deg)` }}
              >
                <div className="master-radial-shimmer" />
                <div className="master-knob-tick" />
              </div>
              <div className="master-dial-graduations">
                <span className="grad-dot" />
                <span className="grad-dot" />
                <span className="grad-dot active" />
                <span className="grad-dot" />
                <span className="grad-dot" />
              </div>
            </div>

            {/* Right Large Circular Convex Play / Pause Button */}
            <div className="skeuo-convex-play-module">
              <button 
                type="button" 
                className={`skeuo-convex-main-btn ${isActiveOnline ? 'playing' : 'paused'} ${streamLoading ? 'loading' : ''}`}
                onClick={isActiveOnline ? onStop : onStart}
                disabled={streamLoading}
                title={isActiveOnline ? 'Click to Pause Live Stream' : 'Click to Play Live Stream'}
              >
                <div className="convex-btn-shimmer" />
                {streamLoading ? (
                  <i className="fa-solid fa-circle-notch fa-spin" />
                ) : (
                  <i className={`fa-solid ${isActiveOnline ? 'fa-pause' : 'fa-play'}`} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Tactile Grip / Equalizer Plate */}
        <div className="skeuo-right-grip">
          <div className="skeuo-screw top" />

          <div 
            className={`skeuo-vertical-plate ${isDrawingZone ? 'active' : ''}`}
            onClick={onToggleDraw}
            title="3D Zone Calibration HUD"
          >
            <span className="plate-text">CALIBRATE</span>
            <div className="plate-leds">
              <span className={`plate-led ${isDrawingZone ? 'on' : ''}`} />
              <span className="plate-led" />
            </div>
          </div>

          <div className="skeuo-recessed-grooves right">
            <div className="groove" />
            <div className="groove" />
          </div>
          <div className="skeuo-screw bottom" />
        </div>

      </div>
    </div>
  )
}
