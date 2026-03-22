import { useState, useRef, useEffect, useCallback } from 'react'
import Badge from '../components/Badge'
import LiveIndicator from '../components/LiveIndicator'

const TODAY = new Date().toISOString().split('T')[0]

// ── QR Camera Scanner Component ───────────────────────────────────────
function QRCameraScanner({ onResult, onClose }) {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)
  const rafRef     = useRef(null)
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [cameras,  setCameras]  = useState([])
  const [activeCam,setActiveCam]= useState(null)

  // Load jsQR library
  const loadJsQR = () => new Promise((resolve, reject) => {
    if (window.jsQR) { resolve(window.jsQR); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js'
    s.onload  = () => resolve(window.jsQR)
    s.onerror = () => reject(new Error('Gagal load jsQR library'))
    document.head.appendChild(s)
  })

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  const startCamera = useCallback(async (deviceId = null) => {
    stopCamera()
    setLoading(true)
    setError(null)
    try {
      const jsQR = await loadJsQR()
      const constraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      // Enum semua kamera (hanya sekali)
      if (cameras.length === 0) {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cams    = devices.filter(d => d.kind === 'videoinput')
        setCameras(cams)
        if (!deviceId && cams.length > 0) setActiveCam(cams[cams.length - 1].deviceId)
      }

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      setLoading(false)

      // Scan loop
      const scan = () => {
        if (!videoRef.current || !canvasRef.current) return
        const v = videoRef.current
        const c = canvasRef.current
        if (v.readyState === v.HAVE_ENOUGH_DATA) {
          c.width  = v.videoWidth
          c.height = v.videoHeight
          const ctx = c.getContext('2d', { willReadFrequently: true })
          ctx.drawImage(v, 0, 0, c.width, c.height)
          const img  = ctx.getImageData(0, 0, c.width, c.height)
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
          if (code?.data) {
            stopCamera()
            onResult(code.data)
            return
          }
        }
        rafRef.current = requestAnimationFrame(scan)
      }
      rafRef.current = requestAnimationFrame(scan)
    } catch (err) {
      setLoading(false)
      if (err.name === 'NotAllowedError') {
        setError('Akses kamera ditolak. Izinkan akses kamera di pengaturan browser.')
      } else if (err.name === 'NotFoundError') {
        setError('Kamera tidak ditemukan di perangkat ini.')
      } else {
        setError(err.message)
      }
    }
  }, [cameras.length, onResult, stopCamera])

  useEffect(() => {
    startCamera()
    return stopCamera
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchCamera = () => {
    const idx  = cameras.findIndex(c => c.deviceId === activeCam)
    const next = cameras[(idx + 1) % cameras.length]
    setActiveCam(next.deviceId)
    startCamera(next.deviceId)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(8px)' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>📷 Scan QR Code</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>Arahkan kamera ke QR code unit</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {cameras.length > 1 && (
            <button onClick={switchCamera}
              style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              🔄 Ganti Kamera
            </button>
          )}
          <button onClick={() => { stopCamera(); onClose() }}
            style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', width: 36, height: 36, borderRadius: 8, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>
      </div>

      {/* Camera view */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <video ref={videoRef} playsInline muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: loading || error ? 'none' : 'block' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Scan overlay — hanya tampil saat kamera aktif */}
        {!loading && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            {/* Dimmed overlay dengan lubang di tengah */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)' }} />

            {/* Scan frame */}
            <div style={{ position: 'relative', width: 240, height: 240, zIndex: 1 }}>
              {/* Clear area */}
              <div style={{ position: 'absolute', inset: 0, background: 'transparent', boxShadow: '0 0 0 9999px rgba(0,0,0,.45)' }} />
              {/* Corner markers */}
              {[
                { top: 0,    left: 0,    borderTop: '3px solid #f59e0b', borderLeft: '3px solid #f59e0b',   borderRadius: '8px 0 0 0'  },
                { top: 0,    right: 0,   borderTop: '3px solid #f59e0b', borderRight: '3px solid #f59e0b',  borderRadius: '0 8px 0 0'  },
                { bottom: 0, left: 0,    borderBottom: '3px solid #f59e0b', borderLeft: '3px solid #f59e0b', borderRadius: '0 0 0 8px'  },
                { bottom: 0, right: 0,   borderBottom: '3px solid #f59e0b', borderRight: '3px solid #f59e0b', borderRadius: '0 0 8px 0' },
              ].map((s, i) => (
                <div key={i} style={{ position: 'absolute', width: 32, height: 32, ...s }} />
              ))}
              {/* Scan line animation */}
              <div style={{ position: 'absolute', left: 4, right: 4, height: 2, background: 'linear-gradient(90deg, transparent, #f59e0b, transparent)', borderRadius: 2, animation: 'scanLine 2s ease-in-out infinite' }} />
            </div>

            <div style={{ position: 'absolute', bottom: '20%', left: 0, right: 0, textAlign: 'center', zIndex: 1 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,.8)', background: 'rgba(0,0,0,.4)', padding: '6px 16px', borderRadius: 20, display: 'inline-block' }}>
                Posisikan QR code di dalam frame
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,.2)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>Membuka kamera...</div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{ textAlign: 'center', padding: 32, maxWidth: 300 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📵</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Kamera Tidak Dapat Dibuka</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginBottom: 20, lineHeight: 1.6 }}>{error}</div>
            <button onClick={() => startCamera()}
              style={{ background: '#f59e0b', color: '#1c1917', border: 'none', padding: '10px 24px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Coba Lagi
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scanLine {
          0%   { top: 4px;   opacity: 1; }
          48%  { top: calc(100% - 6px); opacity: 1; }
          50%  { top: calc(100% - 6px); opacity: 0; }
          52%  { top: 4px;   opacity: 0; }
          54%  { top: 4px;   opacity: 1; }
          100% { top: 4px;   opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard({ user, data, setPage, setSelUnit, syncing, lastSync }) {
  const { units, schedules, inspections } = data
  const [scan,       setScan]       = useState('')
  const [scanRes,    setScanRes]    = useState(null)
  const [showCamera, setShowCamera] = useState(false)

  const todaySch = schedules.filter(s => s.tanggal === TODAY)
  const done  = todaySch.filter(s => s.status === 'done').length
  const total = todaySch.length
  const pct   = total > 0 ? Math.round(done / total * 100) : 0
  const pctColor = pct >= 100 ? 'var(--ok)' : pct >= 60 ? 'var(--p)' : 'var(--err)'

  const findUnit = (query) => {
    if (!query?.trim()) return
    // Coba cocokkan nomor_unit, qr_code, atau bagian dari URL (/u/QR-XXXX)
    const clean = query.trim()
    const fromUrl = clean.match(/\/u\/([^?#]+)$/)
    const code  = fromUrl ? decodeURIComponent(fromUrl[1]) : clean
    const u = units.find(x =>
      x.nomor_unit === code || x.qr_code === code ||
      x.nomor_unit.toLowerCase() === code.toLowerCase()
    )
    setScan(code)
    setScanRes(u ?? 'notfound')
  }

  const handleCameraResult = (result) => {
    setShowCamera(false)
    findUnit(result)
  }

  return (
    <div className="fade">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t)' }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <LiveIndicator syncing={syncing} lastSync={lastSync} />
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }} className="g3">
        {[
          { label: 'Jadwal Hari Ini',  val: total,  sub: 'unit dijadwalkan', border: 'var(--p)'   },
          { label: 'Sudah Diinspeksi', val: done,   sub: 'unit selesai',     border: 'var(--ok)'  },
          { label: 'Pencapaian',       val: pct+'%',sub: `${done}/${total} unit`, border: pctColor },
        ].map(c => (
          <div key={c.label} className="card" style={{ borderTop: `3px solid ${c.border}`, padding: '16px' }}>
            <div className="lbl" style={{ marginBottom: 6 }}>{c.label}</div>
            <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--t)', letterSpacing: '-.02em' }}>{c.val}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>{c.sub}</div>
            {c.label === 'Pencapaian' && (
              <div style={{ height: 4, background: 'var(--bd2)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: c.border, borderRadius: 2, width: pct + '%', transition: 'width .5s' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Schedule Table */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="lbl" style={{ marginBottom: 0 }}>📅 Jadwal Inspeksi Hari Ini</div>
          {syncing && <span className="spin" style={{ fontSize: 14, color: 'var(--t3)' }}>↻</span>}
        </div>
        <div className="ptbl">
          <table className="tbl">
            <thead>
              <tr><th>No. Unit</th><th>Tipe</th><th>Model</th><th>Status</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {todaySch.map(s => {
                const u = units.find(x => x.id === s.unit_id)
                if (!u) return null
                return (
                  <tr key={s.id}>
                    <td><span className="mono" style={{ color: 'var(--pd)', fontWeight: 700, fontSize: 13 }}>{u.nomor_unit}</span></td>
                    <td>{u.tipe}</td>
                    <td style={{ color: 'var(--t3)' }}>{u.model}</td>
                    <td><Badge type={s.status} /></td>
                    <td>
                      {s.status === 'scheduled' && (user.role === 'mekanik' || user.role === 'admin') && (
                        <button className="btn-y btn-sm" onClick={() => { setSelUnit(u); setPage('inspection') }}>
                          Inspeksi →
                        </button>
                      )}
                      {s.status === 'done' && (
                        <span style={{ color: 'var(--ok)', fontSize: 12, fontWeight: 700 }}>✓ Selesai</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {todaySch.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 28, color: 'var(--t3)' }}>Tidak ada jadwal hari ini</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Scanner */}
      <div className="card">
        <div className="lbl" style={{ marginBottom: 4 }}>📷 QR Code Scanner</div>
        <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>
          Scan QR code untuk melihat history atau mulai inspeksi unit
        </p>

        {/* Input + tombol kamera */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={scan}
            onChange={e => { setScan(e.target.value); setScanRes(null) }}
            onKeyDown={e => e.key === 'Enter' && findUnit(scan)}
            placeholder="No. Unit atau kode QR..."
            style={{ flex: 1 }}
          />
          {/* Tombol kamera */}
          <button
            onClick={() => setShowCamera(true)}
            style={{ padding: '0 14px', borderRadius: 8, border: '1.5px solid var(--bd)', background: 'var(--sf)', color: 'var(--t)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, transition: 'all .15s' }}
            title="Buka kamera scanner"
          >
            📷
          </button>
          <button className="btn-y" onClick={() => findUnit(scan)} style={{ whiteSpace: 'nowrap' }}>
            SCAN
          </button>
        </div>

        {scanRes === 'notfound' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, background: 'var(--errbg)', border: '1px solid var(--errbd)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--err)', fontWeight: 600 }}>
            <span>⚠</span>
            <span>Unit "<strong>{scan}</strong>" tidak ditemukan</span>
          </div>
        )}

        {scanRes && scanRes !== 'notfound' && (
          <div style={{ background: 'var(--sfy)', border: '1.5px solid var(--wnbd)', borderRadius: 10, padding: 14, marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--pd)' }}>{scanRes.nomor_unit}</span>
                  <span style={{ fontSize: 12, color: 'var(--t3)' }}>{scanRes.brand} {scanRes.tipe}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                  {scanRes.model} · Tahun {scanRes.tahun} · HM:{' '}
                  <strong style={{ color: 'var(--pd)' }} className="mono">
                    {(units.find(u => u.id === scanRes.id)?.hm ?? scanRes.hm)?.toLocaleString()} jam
                  </strong>
                </div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>
                  Total inspeksi:{' '}
                  <strong style={{ color: 'var(--t)' }}>
                    {inspections.filter(i => i.unit_id === scanRes.id).length}x
                  </strong>
                </div>
              </div>
            </div>

            {/* Tombol aksi */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* History public page — buka di tab baru */}
              <button
                className="btn-g btn-sm"
                onClick={() => window.open(`/u/${encodeURIComponent(scanRes.qr_code || scanRes.nomor_unit)}`, '_blank')}
              >
                📋 Lihat History
              </button>

              {/* Mulai inspeksi — hanya jika unit ada di jadwal hari ini */}
              {schedules.find(s => s.unit_id === scanRes.id && s.tanggal === TODAY && s.status === 'scheduled') &&
                (user.role === 'mekanik' || user.role === 'admin') && (
                  <button className="btn-y btn-sm" onClick={() => { setSelUnit(scanRes); setPage('inspection') }}>
                    ⚡ Mulai Inspeksi
                  </button>
                )
              }

              {/* Tombol history internal */}
              <button
                className="btn-sm"
                style={{ background: 'var(--infbg)', color: 'var(--inf)', border: '1.5px solid var(--infbd)' }}
                onClick={() => setPage('history')}
              >
                📊 Analytics
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Camera Scanner Fullscreen */}
      {showCamera && (
        <QRCameraScanner
          onResult={handleCameraResult}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}