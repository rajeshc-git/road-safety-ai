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
    ocr_provider: 'ocr_space',
    ocr_space_api_key: 'K89291931288957',
    ocr_engine: '2',
    local_ocr_backend: 'easyocr',
    ai_runner_endpoint: 'http://host.docker.internal:12434',
    ai_runner_model: '',
  })
  const [saved, setSaved] = useState(false)
  const [quotaInfo, setQuotaInfo] = useState(null)
  const [loadingQuota, setLoadingQuota] = useState(false)
  const [availableAiModels, setAvailableAiModels] = useState([])
  const [loadingAiModels, setLoadingAiModels] = useState(false)

  const checkOcrQuota = async () => {
    setLoadingQuota(true)
    try {
      const data = await api.get('/api/ocr/quota')
      setQuotaInfo(data)
    } catch (e) {
      setQuotaInfo({ success: false, error: String(e) })
    } finally {
      setLoadingQuota(false)
    }
  }

  const loadAiModels = async (overrideEndpoint) => {
    setLoadingAiModels(true)
    try {
      const ep = overrideEndpoint || vals.ai_runner_endpoint
      const q = ep ? `?endpoint=${encodeURIComponent(ep)}` : ''
      const res = await api.get(`/api/ai-models${q}`)
      if (res && res.success && Array.isArray(res.models)) {
        setAvailableAiModels(res.models)
        if (res.models.length > 0 && !res.models.includes(vals.ai_runner_model)) {
          setVals(v => ({ ...v, ai_runner_model: res.models[0] }))
        }
      }
    } catch (e) {
      console.warn("Failed to load AI models", e)
    } finally {
      setLoadingAiModels(false)
    }
  }

  useEffect(() => {
    if (tab === 'detection') {
      checkOcrQuota()
      loadAiModels(vals.ai_runner_endpoint)
    }
  }, [tab])

  useEffect(() => {
    if (initSettings && Object.keys(initSettings).length) {
      setVals(v => ({ ...v, ...initSettings }))
      if (initSettings.ai_runner_endpoint) {
        loadAiModels(initSettings.ai_runner_endpoint)
      }
    }
  }, [initSettings])

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
                <div className="settings-section-title" style={{marginTop:20}}>License Plate OCR Configuration</div>
                <SettingRow label="OCR Service Provider">
                  <select className="f-sel" value={vals.ocr_provider || 'ocr_space'} onChange={sl('ocr_provider')}>
                    <option value="ocr_space">OCR.space Cloud API</option>
                    <option value="local">Local Traditional OCR (EasyOCR / PaddleOCR)</option>
                    <option value="docker_ai">Local AI Vision Model Runner (Docker / Ollama / Custom)</option>
                  </select>
                </SettingRow>

                {vals.ocr_provider === 'docker_ai' || vals.ocr_provider === 'gemma4' ? (
                  <>
                    <SettingRow label="AI Model Runner Base URL" desc="Base URL for any runner (e.g. http://host.docker.internal:12434 or :11434)">
                      <input
                        type="text"
                        className="f-input"
                        value={vals.ai_runner_endpoint}
                        onChange={sl('ai_runner_endpoint')}
                        placeholder="e.g. http://host.docker.internal:12434 or http://host.docker.internal:11434"
                        style={{width:'100%',padding:'6px 10px',borderRadius:'6px',border:'1px solid var(--border)',background:'var(--bg-card)',color:'var(--text)'}}
                      />
                    </SettingRow>
                    <SettingRow label="Selected AI Vision Model" desc="Dynamically loaded models from endpoint">
                      <div style={{display:'flex',gap:'8px',width:'100%'}}>
                        <select className="f-sel" style={{flex:1}} value={vals.ai_runner_model || (availableAiModels[0] || '')} onChange={sl('ai_runner_model')}>
                          {availableAiModels.length > 0 ? (
                            availableAiModels.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))
                          ) : vals.ai_runner_model ? (
                            <option value={vals.ai_runner_model}>{vals.ai_runner_model}</option>
                          ) : (
                            <option value="">No models detected - click Scan</option>
                          )}
                        </select>
                        <button
                          type="button"
                          onClick={() => loadAiModels(vals.ai_runner_endpoint)}
                          disabled={loadingAiModels}
                          className="btn-secondary"
                          style={{padding:'4px 10px',fontSize:'11px',whiteSpace:'nowrap'}}
                          title="Refresh model list from endpoint"
                        >
                          <i className={`fa-solid fa-arrows-rotate ${loadingAiModels ? 'fa-spin' : ''}`}/> Scan
                        </button>
                      </div>
                    </SettingRow>
                  </>
                ) : vals.ocr_provider === 'local' ? (
                  <SettingRow label="Local OCR Engine" desc="Select the locally hosted computer vision engine running inside the pipeline">
                    <select className="f-sel" value={vals.local_ocr_backend || 'easyocr'} onChange={sl('local_ocr_backend')}>
                      <option value="easyocr">EasyOCR (Fast CPU / PyTorch Deep Learning)</option>
                      <option value="paddleocr">PaddleOCR (PP-OCR Lightweight)</option>
                    </select>
                  </SettingRow>
                ) : (
                  <>
                    <SettingRow label="OCR.space Engine">
                      <select className="f-sel" value={vals.ocr_engine || '2'} onChange={sl('ocr_engine')}>
                        <option value="1">Engine 1 (Fast / Legacy)</option>
                        <option value="2">Engine 2 (Recommended - Optimal for Plates & Digits)</option>
                        <option value="3">Engine 3 (AI / LLM-Powered High Precision)</option>
                      </select>
                    </SettingRow>
                    <SettingRow label="OCR.space API Key">
                      <input
                        type="text"
                        className="f-input"
                        value={vals.ocr_space_api_key || 'K89291931288957'}
                        onChange={sl('ocr_space_api_key')}
                        placeholder="Enter OCR.space API Key"
                        style={{width:'100%',padding:'6px 10px',borderRadius:'6px',border:'1px solid var(--border)',background:'var(--bg-card)',color:'var(--text)'}}
                      />
                    </SettingRow>

                    {/* Live Quota & Usage Monitor */}
                    <div style={{
                      marginTop: '14px',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'11.5px',fontWeight:'700',color:'var(--t1)'}}>
                          <i className="fa-solid fa-chart-pie" style={{color:'#38bdf8'}}/>
                          <span>OCR.space Monthly Quota Tracker</span>
                        </div>
                        <button
                          type="button"
                          onClick={checkOcrQuota}
                          disabled={loadingQuota}
                          className="btn-secondary"
                          style={{padding:'3px 8px',fontSize:'10px',borderRadius:'4px'}}
                        >
                          <i className={`fa-solid fa-arrows-rotate ${loadingQuota ? 'fa-spin' : ''}`}/> Refresh Quota
                        </button>
                      </div>

                      {quotaInfo && quotaInfo.success ? (
                        <div>
                          <div style={{display:'flex',justifyContent:'space-between',fontSize:'11px',marginBottom:'5px'}}>
                            <span style={{color:'var(--t2)'}}>Free Tier Limit: <b>25,000 / month</b></span>
                            <span style={{color:'#10b981',fontWeight:'700'}}>
                              {quotaInfo.remaining?.toLocaleString()} Remaining ({quotaInfo.used_total?.toLocaleString()} used)
                            </span>
                          </div>
                          <div style={{width:'100%',height:'6px',background:'rgba(255,255,255,0.08)',borderRadius:'3px',overflow:'hidden'}}>
                            <div style={{
                              width: `${Math.min(100, Math.max(1, (quotaInfo.used_total / 25000) * 100))}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, #38bdf8, #10b981)'
                            }}/>
                          </div>
                          <div style={{display:'flex',gap:'12px',fontSize:'9.5px',color:'var(--t3)',marginTop:'6px'}}>
                            <span>Engine 1: <b>{quotaInfo.count_engine1 || 0}</b></span>
                            <span>Engine 2: <b>{quotaInfo.count_engine2 || 0}</b></span>
                            <span>Engine 3: <b>{quotaInfo.count_engine3 || 0}</b></span>
                          </div>
                          <div style={{fontSize:'9px',color:'var(--t3)',marginTop:'6px',fontStyle:'italic'}}>
                            * Direct response from <code>https://myapi.ocr.space/conversions</code>. Per OCR.space documentation, remote conversion counters update once daily (or remain 0 on non-PRO keys).
                          </div>
                        </div>
                      ) : quotaInfo && !quotaInfo.success ? (
                        <div style={{fontSize:'10.5px',color:'#f87171'}}>
                          <i className="fa-solid fa-triangle-exclamation"/> Unable to fetch remote quota: {quotaInfo.error || quotaInfo.status_code}
                        </div>
                      ) : (
                        <div style={{fontSize:'10px',color:'var(--t3)'}}>Checking live remaining quota with OCR.space...</div>
                      )}
                    </div>
                  </>
                )}

                <SettingSlider
                  label="AI OCR Processing Gap / Cooldown"
                  value={vals.ai_ocr_delay || '1.5'}
                  min={0.2}
                  max={5.0}
                  step={0.1}
                  unit="seconds"
                  onChange={sl('ai_ocr_delay')}
                  desc="Cooldown delay between consecutive OCR evaluations. Gives the offline AI vision model runner and local GPU time to release context, ensuring 100% of consecutive vehicles have their number plates accurately extracted without dropping to 'NOT CLEAR'."
                />
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
