import { useState, useRef, useEffect, useCallback } from 'react'
import jsQR from 'jsqr'

export default function QRCameraScanner({ onResult, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cameras, setCameras] = useState([])
  const [activeCam, setActiveCam] = useState(null)

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
  }, [])

  const startCamera = useCallback(async (deviceId = null) => {
    stopCamera()
    setLoading(true)
    setError(null)

    try {
      const constraints = deviceId
        ? { video: { deviceId: { exact: deviceId } } }
        : { video: { facingMode: { ideal: 'environment' } } }

      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      }

      streamRef.current = stream

      if (cameras.length === 0) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const cams = devices.filter(d => d.kind === 'videoinput')
          setCameras(cams)
          if (cams.length > 0) setActiveCam(cams[cams.length - 1].deviceId)
        } catch { /* ignore */ }
      }

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream

      await new Promise((res) => {
        video.onloadedmetadata = res
        setTimeout(res, 3000)
      })
      await video.play()
      setLoading(false)

      const scan = () => {
        if (!videoRef.current || !canvasRef.current) return
        const v = videoRef.current
        const c = canvasRef.current
        if (v.readyState >= v.HAVE_ENOUGH_DATA && v.videoWidth > 0) {
          c.width = v.videoWidth
          c.height = v.videoHeight
          const ctx = c.getContext('2d', { willReadFrequently: true })
          ctx.drawImage(v, 0, 0)
          const img = ctx.getImageData(0, 0, c.width, c.height)
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
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Akses kamera ditolak. Klik ikon 🔒 di address bar → Camera → Allow, lalu refresh.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('Kamera tidak ditemukan. Pastikan kamera terhubung dan tidak dipakai aplikasi lain.')
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Kamera sedang dipakai aplikasi lain. Tutup aplikasi lain yang menggunakan kamera.')
      } else if (!navigator.mediaDevices || !window.isSecureContext) {
        setError('Kamera hanya bisa diakses lewat HTTPS atau localhost.')
      } else {
        setError(`Error: ${err.message || err.name}`)
      }
    }
  }, [cameras.length, onResult, stopCamera])

  useEffect(() => {
    startCamera()
    return stopCamera
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchCamera = () => {
    if (cameras.length < 2) return
    const idx = cameras.findIndex(c => c.deviceId === activeCam)
    const next = cameras[(idx + 1) % cameras.length]
    setActiveCam(next.deviceId)
    startCamera(next.deviceId)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(8px)', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>📷 Scan QR Code</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>Arahkan ke QR code unit</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {cameras.length > 1 && (
            <button type="button" onClick={switchCamera}
              style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              🔄 Ganti Kamera
            </button>
          )}
          <button type="button" onClick={() => { stopCamera(); onClose() }}
            style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', width: 36, height: 36, borderRadius: 8, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', minHeight: 0 }}>
        <video ref={videoRef} playsInline muted autoPlay
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: loading || error ? 'none' : 'block' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {!loading && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)' }} />
            <div style={{ position: 'relative', width: 240, height: 240, zIndex: 1 }}>
              <div style={{ position: 'absolute', inset: 0, boxShadow: '0 0 0 9999px rgba(0,0,0,.4)' }} />
              {[
                { top: 0, left: 0, borderTop: '3px solid #f59e0b', borderLeft: '3px solid #f59e0b', borderRadius: '8px 0 0 0' },
                { top: 0, right: 0, borderTop: '3px solid #f59e0b', borderRight: '3px solid #f59e0b', borderRadius: '0 8px 0 0' },
                { bottom: 0, left: 0, borderBottom: '3px solid #f59e0b', borderLeft: '3px solid #f59e0b', borderRadius: '0 0 0 8px' },
                { bottom: 0, right: 0, borderBottom: '3px solid #f59e0b', borderRight: '3px solid #f59e0b', borderRadius: '0 0 8px 0' },
              ].map((s, i) => <div key={i} style={{ position: 'absolute', width: 32, height: 32, ...s }} />)}
              <div style={{ position: 'absolute', left: 4, right: 4, height: 2, background: 'linear-gradient(90deg,transparent,#f59e0b,transparent)', borderRadius: 2, animation: 'qrScanLine 2s ease-in-out infinite' }} />
            </div>
            <div style={{ position: 'absolute', bottom: '15%', left: 0, right: 0, textAlign: 'center' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,.85)', background: 'rgba(0,0,0,.5)', padding: '6px 16px', borderRadius: 20 }}>
                Posisikan QR code di dalam frame
              </span>
            </div>
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, border: '3px solid rgba(255,255,255,.15)', borderTopColor: '#f59e0b', borderRadius: '50%', animation: 'qrSpin 0.8s linear infinite' }} />
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,.8)', fontWeight: 600 }}>Membuka kamera...</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>Izinkan akses kamera jika diminta</div>
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '24px 28px', maxWidth: 320 }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>📵</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 10 }}>Kamera Tidak Dapat Dibuka</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.65)', marginBottom: 22, lineHeight: 1.7 }}>{error}</div>
            <button type="button" onClick={() => startCamera()}
              style={{ background: '#f59e0b', color: '#1c1917', border: 'none', padding: '11px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10, display: 'block', width: '100%' }}>
              🔄 Coba Lagi
            </button>
            <button type="button" onClick={() => { stopCamera(); onClose() }}
              style={{ background: 'transparent', color: 'rgba(255,255,255,.5)', border: '1px solid rgba(255,255,255,.2)', padding: '10px 28px', borderRadius: 10, fontSize: 13, cursor: 'pointer', width: '100%' }}>
              Tutup
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes qrScanLine {
          0%  { top:4px;  opacity:1 }
          48% { top:calc(100% - 6px); opacity:1 }
          50% { top:calc(100% - 6px); opacity:0 }
          52% { top:4px;  opacity:0 }
          54% { top:4px;  opacity:1 }
          100%{ top:4px;  opacity:1 }
        }
        @keyframes qrSpin { to { transform:rotate(360deg) } }
      `}</style>
    </div>
  )
}
