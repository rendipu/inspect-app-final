import { useState, useEffect } from 'react'

// Deteksi iOS
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

// Deteksi sudah dalam mode standalone (sudah diinstall)S
function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

export default function PwaBanner({ onDismiss }) {
  const [deferredPrompt, setDeferredPrompt] = useState(window.deferredPwaPrompt || null)
  const [show, setShow] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)

  useEffect(() => {
    // Jangan tampil jika sudah diinstall
    if (isInStandaloneMode()) return

    // iOS — tampilkan panduan manual
    if (isIOS()) {
      setShowIOSGuide(true)
      setShow(true)
      return
    }

    if (window.deferredPwaPrompt) {
      setDeferredPrompt(window.deferredPwaPrompt)
      setShow(true)
    }

    // Chrome/Edge/Opera — tangkap beforeinstallprompt
    const handler = (e) => {
      e.preventDefault()
      window.deferredPwaPrompt = e
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => {
      setShow(false)
      setDeferredPrompt(null)
      window.deferredPwaPrompt = null
    })

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!show) return null

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
      setDeferredPrompt(null)
      window.deferredPwaPrompt = null
    }
  }

  const handleDismiss = () => {
    setShow(false)
    if (onDismiss) onDismiss()
  }

  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  }

  const modalStyle = {
    background: '#fff',
    border: '1px solid var(--bd)',
    borderRadius: 16,
    padding: 24,
    maxWidth: 340,
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
    position: 'relative'
  }

  // Modal khusus iOS
  if (showIOSGuide) {
    return (
      <div style={overlayStyle}>
        <div style={modalStyle} className="fade">
          <button
            onClick={handleDismiss}
            style={{ position: 'absolute', top: 12, right: 12, background: '#fff', color: '#272727ff', border: 'none', fontSize: 20, cursor: 'pointer', padding: 4 }}
          >
            ✕
          </button>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
          <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, color: 'var(--t)' }}>Install Aplikasi</div>
          <div style={{ color: 'var(--t3)', fontSize: 13, lineHeight: 1.5 }}>
            Untuk pengalaman terbaik, pasang aplikasi ini ke layar utama Anda.
          </div>
          <div style={{ marginTop: 20, background: '#fff', padding: 12, borderRadius: 8, fontSize: 12, color: 'var(--t2)', border: '1px solid var(--bd)' }}>
            Tap icon <strong style={{ color: 'var(--t)' }}>Share</strong> di browser Safari Anda lalu pilih <strong style={{ color: 'var(--t)' }}>"Add to Home Screen"</strong>
          </div>
          <button
            onClick={handleDismiss}
            style={{ marginTop: 20, background: '#c4c4c4ff', color: '#4a4a4aff', border: 'none', padding: '10px 0', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}
          >
            Nanti Saja
          </button>
        </div>
      </div>
    )
  }

  // Modal Chrome/Edge/Opera
  return (
    <div style={overlayStyle}>
      <div style={modalStyle} className="fade">
        <button
          onClick={handleDismiss}
          style={{ position: 'absolute', top: 12, right: 12, background: '#fff', color: '#181818ff', border: 'none', fontSize: 20, cursor: 'pointer', padding: 4 }}
        >
          ✕
        </button>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🚀</div>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, color: 'var(--t)' }}>Install Aplikasi</div>
        <div style={{ color: 'var(--t3)', fontSize: 13, lineHeight: 1.5 }}>
          Pasang aplikasi ini ke Home Screen perangkat Anda untuk akses lebih cepat dan penggunaan tanpa batas.
        </div>
        <button
          onClick={handleInstall}
          style={{ marginTop: 20, background: 'var(--p)', color: '#1c1917', border: 'none', padding: '12px 0', borderRadius: 8, fontSize: 14, fontWeight: 800, cursor: 'pointer', width: '100%' }}
        >
          Install Sekarang
        </button>
        <button
          onClick={handleDismiss}
          style={{ marginTop: 10, background: '#c4c4c4ff', color: '#4a4a4aff', border: 'none', padding: '10px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%' }}
        >
          Mungkin Nanti
        </button>
      </div>
    </div>
  )
}