import { useState, useEffect } from 'react'
import { streamUrl, api } from '../api'
import './Pages.css'

export default function CamerasPage({ cameras, activeCam, onCamSwitch, onNavigate, onRefreshCameras, streamKey }) {
  const [adding, setAdding] = useState(false)
  const [newCam, setNewCam] = useState({ name:'', source:'0', type:'webcam', config: { mode: 'traffic' } })
  const [testVideos, setTestVideos] = useState([])

  useEffect(() => {
    const loadTestVideos = async () => {
      try {
        const vids = await api.get('/api/test-videos')
        setTestVideos(vids || [])
        // If current default type is file, pre-populate first available video
        if (vids && vids.length > 0 && newCam.type === 'file' && !newCam.source) {
          setNewCam(c => ({...c, source: vids[0].path}))
        }
      } catch(e) { console.error("Failed to load test videos", e) }
    }
    loadTestVideos()
  }, [])

  const handleTypeChange = (e) => {
    const type = e.target.value
    let source = type === 'webcam' ? '0' : type === 'rtsp' ? 'rtsp://' : ''
    if (type === 'file' && testVideos.length > 0) {
      source = testVideos[0].path
    }
    setNewCam({...newCam, type, source})
  }

  const addCamera = async () => {
    if (!newCam.name) return alert('Enter a camera name')
    if (!newCam.source) return alert('Enter or select a source')
    try {
      const result = await api.post('/api/cameras', newCam)
      setAdding(false)
      setNewCam({ name:'', source:'0', type:'webcam', config: { mode: 'traffic' } })
      onRefreshCameras() // Fetch all streams via prop instead of reload
    } catch (e) { alert("Error adding camera") }
  }

  const removeCamera = async (id) => {
    if (!confirm('Are you sure you want to remove this camera?')) return
    try {
      await api.del(`/api/cameras/${id}`)
      onRefreshCameras()
    } catch (e) { alert("Error removing camera") }
  }

  const handleViewLive = (id) => {
    onCamSwitch(id)
    onNavigate('dashboard')
  }

  const toggleDetection = async (camId, currentStatus) => {
    try {
      const action = currentStatus === 'online' ? 'stop' : 'start'
      await api.post(`/api/cameras/${camId}/detection/${action}`)
      onRefreshCameras()
    } catch (e) { console.error(e) }
  }

  const handleFullscreen = (e, camId) => {
    e.stopPropagation()
    const container = document.getElementById(`cam-tile-video-${camId}`)
    if (container) {
      if (container.requestFullscreen) container.requestFullscreen()
      else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen()
    }
  }

  return (
    <div className="page-wrap">
      <div className="page-header">
        <h1 className="page-title">Cameras</h1>
        <button className="btn-accent" onClick={() => setAdding(true)}><i className="fa-solid fa-plus"/> Add Camera</button>
      </div>

      {adding && (
        <div className="modal-overlay" onClick={()=>setAdding(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-head"><span>Add New Camera</span><button className="icon-btn" onClick={()=>setAdding(false)}>✕</button></div>
            <div className="modal-body">
              <label>Camera Name</label>
              <input className="f-input" value={newCam.name} onChange={e=>setNewCam({...newCam,name:e.target.value})} placeholder="e.g. Main Gate Camera"/>
              
              <label>Type</label>
              <select className="f-sel" value={newCam.type} onChange={handleTypeChange}>
                <option value="webcam">Webcam</option>
                <option value="rtsp">RTSP</option>
                <option value="file">Video File (Local)</option>
              </select>

              <label>{newCam.type === 'file' ? 'Select Video File' : 'Source (webcam index or RTSP URL)'}</label>
              {newCam.type === 'file' ? (
                <select className="f-sel" value={newCam.source} onChange={e=>setNewCam({...newCam, source:e.target.value})}>
                  {testVideos.length === 0 ? (
                    <option value="">No test videos found in data/test_videos</option>
                  ) : (
                    testVideos.map(v => <option key={v.filename} value={v.path}>{v.filename} ({v.size_mb}MB)</option>)
                  )}
                </select>
              ) : (
                <input className="f-input" value={newCam.source} onChange={e=>setNewCam({...newCam,source:e.target.value})} placeholder={newCam.type==='webcam' ? "0" : "rtsp://..."}/>
              )}

              <label>Camera Profile / Mode</label>
              <select className="f-sel" value={newCam.config?.mode || 'traffic'} onChange={e=>setNewCam({...newCam, config: { ...newCam.config, mode: e.target.value }})}>
                <option value="traffic">Traffic Compliance (Speed & Stop Line)</option>
                <option value="driver">Driver Monitor DMS (Drowsiness & Distraction)</option>
              </select>
            </div>
            <div className="modal-foot">
              <button className="act-btn act-out" onClick={()=>setAdding(false)}>Cancel</button>
              <button className="btn-accent" onClick={addCamera}>Add Camera</button>
            </div>
          </div>
        </div>
      )}

      <div className="cam-grid">
        {cameras.map(cam => (
          <div key={cam.id} className={`cam-tile${activeCam?.id===cam.id?' active':''}`}>
            <div className="cam-tile-video" id={`cam-tile-video-${cam.id}`}>
              {cam.status === 'online' ? (
                <img src={`${streamUrl(cam.id)}?t=${streamKey}`} alt={cam.name} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>e.target.style.display='none'}/>
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--bg)',
                  color: 'var(--t3)',
                  fontSize: '11px',
                  gap: '8px'
                }}>
                  <i className="fa-solid fa-video-slash" style={{ fontSize: '20px', color: '#ef4444' }}/>
                  <span>Stream Offline</span>
                </div>
              )}
              <div className="cam-tile-badge" style={{backgroundColor: cam.status === 'online' ? '#065f46' : '#7f1d1d', color: '#fff'}}>{cam.status||'Offline'}</div>
              <button className="icon-btn" 
                      style={{position:'absolute', bottom: 8, right: 8, background:'rgba(0,0,0,0.5)', borderRadius:'4px', color:'#fff'}} 
                      onClick={(e)=>handleFullscreen(e, cam.id)} title="Fullscreen">
                <i className="fa-solid fa-expand" />
              </button>
            </div>
            <div className="cam-tile-info">
              <div className="cam-tile-name">{cam.name}</div>
              <div className="cam-tile-sub" style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>Source: {cam.source}</div>
              <div className="cam-tile-sub" style={{fontSize: '11px', color: '#10b981', marginTop: '2px', fontWeight: '500'}}>
                 Mode: {JSON.parse(cam.config_json || '{}').mode === 'driver' ? 'Driver Monitor (DMS)' : 'Traffic Compliance'}
              </div>
              <div className="cam-tile-actions" style={{marginTop: '12px'}}>
                <button className="act-btn act-green" onClick={()=>handleViewLive(cam.id)}>View Live</button>
                <button className={`act-btn ${cam.status === 'online' ? 'act-red' : 'act-out'}`} 
                        onClick={()=>toggleDetection(cam.id, cam.status)}>
                  <i className={`fa-solid ${cam.status === 'online' ? 'fa-stop' : 'fa-play'}`} style={{marginRight: '4px'}}/>
                  {cam.status === 'online' ? 'Stop' : 'Start'}
                </button>
                <button className="act-btn act-out" onClick={()=>removeCamera(cam.id)}><i className="fa-solid fa-trash"/></button>
              </div>
            </div>
          </div>
        ))}
        {cameras.length === 0 && <div className="empty-state"><i className="fa-solid fa-video-slash"/><p>No cameras found. Add one to get started.</p></div>}
      </div>
    </div>
  )
}
