import { useState, useEffect } from 'react'
import { api } from '../api'
import './Pages.css'

export default function SettingsPage({ settings: initSettings, onSaveSettings }) {
  const [tab, setTab] = useState('detection')
  const [vals, setVals] = useState({
    speed_threshold: '0.1',
    detection_confidence: '0.5',
    processing_fps: '25',
    snapshot_quality: 'high',
    save_snapshots: 'true',
    auto_start_detection: 'false',
    processing_mode: 'AUTO',
    dms_eye_close_threshold: '1.5',
    dms_yawn_threshold: '2.0',
    dms_phone_distraction_threshold: '1.0',
    dms_look_away_threshold: '3.0',
    dms_alert_beep: 'true',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (initSettings && Object.keys(initSettings).length) setVals(v=>({...v,...initSettings})) }, [initSettings])

  const sl = (key) => (e) => setVals(v => ({...v, [key]: e.target.value}))
  const tog = (key) => () => setVals(v => ({...v, [key]: v[key]==='true'?'false':'true'}))

  const save = async () => { await onSaveSettings(vals); setSaved(true); setTimeout(()=>setSaved(false),2000) }
  const resetDetectionDefaults = async () => {
    const defaults = {
      ...vals,
      speed_threshold: '0.1',
      detection_confidence: '0.5',
      processing_fps: '25',
      dms_eye_close_threshold: '1.5',
      dms_yawn_threshold: '2.0',
      dms_phone_distraction_threshold: '1.0',
      dms_look_away_threshold: '3.0',
    }
    setVals(defaults)
    await onSaveSettings(defaults)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const TABS = [
    { id:'detection', label:'Detection' },
    { id:'storage', label:'Storage' },
    { id:'system', label:'System' },
    { id:'others', label:'Others' },
  ]

  return (
    <div className="page-wrap">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        {saved && <span style={{color:'#10b981',fontSize:12,fontWeight:600}}><i className="fa-solid fa-check"/> Settings saved!</span>}
      </div>
      <div className="settings-page-grid">
        {/* Tabs sidebar */}
        <div className="card" style={{padding:0}}>
          <div className="card-head"><span>Categories</span></div>
          <div style={{display:'flex',flexDirection:'column',padding:'8px 0'}}>
            {TABS.map(t=>(
              <button key={t.id} className={`sb-link${tab===t.id?' active':''}`} style={{borderRadius:0}} onClick={()=>setTab(t.id)}>
                <i className={`fa-solid ${t.id==='detection'?'fa-sliders':t.id==='storage'?'fa-hard-drive':t.id==='system'?'fa-server':'fa-gear'}`}/>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="card">
          <div className="card-head"><span>{TABS.find(t=>t.id===tab)?.label} Settings</span></div>
          <div style={{padding:'16px',flex:1,overflowY:'auto'}}>
            {tab==='detection' && <>
              <div className="settings-section">
                <div className="settings-section-title">Detection Parameters</div>

                <SettingSlider label="Speed Threshold (Complete Stop)" value={vals.speed_threshold} min={0} max={2} step={0.01} unit="m/s" onChange={sl('speed_threshold')} desc="Maximum speed considered as a complete stop"/>
                <SettingSlider label="Detection Confidence" value={vals.detection_confidence} min={0} max={1} step={0.05} onChange={sl('detection_confidence')} desc="Minimum confidence threshold for object detections"/>
                <SettingSlider label="Processing FPS" value={vals.processing_fps} min={1} max={60} step={1} unit="FPS" onChange={sl('processing_fps')} desc="Frames per second to process for analysis"/>

                <div className="settings-section-title" style={{marginTop:20}}>DMS Sensitivity Parameters</div>
                <SettingSlider label="Drowsiness Eye-Close Trigger" value={vals.dms_eye_close_threshold || '1.5'} min={0.2} max={5.0} step={0.1} unit="seconds" onChange={sl('dms_eye_close_threshold')} desc="Time driver's eyes must be closed continuously to trigger sleep warning"/>
                <SettingSlider label="Drowsiness Yawn Trigger" value={vals.dms_yawn_threshold || '2.0'} min={0.5} max={5.0} step={0.1} unit="seconds" onChange={sl('dms_yawn_threshold')} desc="Time driver's mouth must be open continuously to trigger yawn warning"/>
                <SettingSlider label="Look Away Trigger" value={vals.dms_look_away_threshold || '3.0'} min={0.5} max={10.0} step={0.5} unit="seconds" onChange={sl('dms_look_away_threshold')} desc="Time driver is not looking at the road continuously to trigger look away warning"/>
                <SettingSlider label="Phone Distraction Trigger" value={vals.dms_phone_distraction_threshold || '1.0'} min={0.2} max={5.0} step={0.1} unit="seconds" onChange={sl('dms_phone_distraction_threshold')} desc="Time driver is holding a phone continuously to trigger phone warning"/>
              </div>
            </>}
            {tab==='storage' && <>
              <div className="settings-section">
                <div className="settings-section-title">Storage Settings</div>
                <SettingRow label="Snapshot Quality">
                  <select className="f-sel" value={vals.snapshot_quality} onChange={sl('snapshot_quality')}>
                    <option value="full">Full Resolution (100%)</option>
                    <option value="high">High (95%)</option>
                    <option value="medium">Medium (75%)</option>
                    <option value="low">Low (50%)</option>
                  </select>
                </SettingRow>
                <SettingRow label="Save Violation Snapshots"><TogFull value={vals.save_snapshots==='true'} onChange={tog('save_snapshots')}/></SettingRow>
              </div>
            </>}
            {tab==='system' && <>
              <div className="settings-section">
                <div className="settings-section-title">System Settings</div>
                <SettingRow label="Auto Start Detection on Boot"><TogFull value={vals.auto_start_detection==='true'} onChange={tog('auto_start_detection')}/></SettingRow>
                <SettingRow label="Processing Mode">
                  <select className="f-sel" value={vals.processing_mode} onChange={sl('processing_mode')}>
                    <option value="AUTO">Auto (Detect GPU)</option>
                    <option value="GPU">Force GPU</option>
                    <option value="CPU">Force CPU</option>
                  </select>
                </SettingRow>
              </div>
            </>}
            {tab==='others' && <>
              <div className="settings-section">
                <div className="settings-section-title">Other Settings</div>
                <SettingRow label="Alarm Sound On/Off"><TogFull value={vals.dms_alert_beep==='true'} onChange={tog('dms_alert_beep')}/></SettingRow>
              </div>
            </>}

          </div>
          <div style={{padding:'12px 16px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              {tab === 'detection' && (
                <button type="button" className="btn-secondary" onClick={resetDetectionDefaults}>
                  <i className="fa-solid fa-arrow-rotate-left"/> Reset to Defaults
                </button>
              )}
            </div>
            <button className="btn-accent" onClick={save}><i className="fa-solid fa-floppy-disk"/> Save Settings</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingSlider({ label, value, min, max, step, unit='', onChange, desc }) {
  return (
    <div style={{marginBottom:16}}>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--t2)',marginBottom:6}}>
        <span>{label}</span><span><b style={{color:'var(--t1)'}}>{Number(value).toFixed(step<1?1:0)}</b>{unit?' '+unit:''}</span>
      </div>
      <input type="range" className="range" min={min} max={max} step={step} value={value} onChange={onChange} style={{width:'100%'}}/>
      {desc && <div style={{fontSize:10,color:'var(--t3)',marginTop:4}}>{desc}</div>}
    </div>
  )
}

function SettingRow({ label, children }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,fontSize:12,color:'var(--t2)'}}>
      <span>{label}</span>{children}
    </div>
  )
}

function TogFull({ value, onChange }) {
  return (
    <label className="tog">
      <input type="checkbox" checked={value} onChange={onChange}/>
      <span className="tog-sl"/>
    </label>
  )
}
