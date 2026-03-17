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
  const [deferredPrompt, setDeferredPrompt] = useState(null)
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

    // Chrome/Edge/Opera — tangkap beforeinstallprompt
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => {
      setShow(false)
      setDeferredPrompt(null)
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
    }
  }

  const handleDismiss = () => {
    setShow(false)
    if (onDismiss) onDismiss()
  }

  // Banner khusus iOS
  if (showIOSGuide) {
    return (
      <div className="pwa-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚙</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Pasang sebagai Aplikasi</div>
            <div style={{ color: '#a8a29e', fontSize: 11 }}>
              Tap <strong style={{ color: '#fff' }}>Share</strong> lalu pilih{' '}
              <strong style={{ color: '#fff' }}>"Add to Home Screen"</strong>
            </div>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          style={{ background: 'transparent', color: '#a8a29e', border: 'none', fontSize: 18, cursor: 'pointer', padding: '4px 6px', flexShrink: 0 }}
        >
          ✕
        </button>
      </div>
    )
  }

  // Banner Chrome/Edge/Opera
  return (
    <div className="pwa-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>⚙</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Pasang sebagai Aplikasi</div>
          <div style={{ color: '#a8a29e', fontSize: 11 }}>
            Akses cepat dari home screen perangkat Anda
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={handleInstall}
          style={{ background: 'var(--p)', color: '#1c1917', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          Pasang
        </button>
        <button
          onClick={handleDismiss}
          style={{ background: 'transparent', color: '#a8a29e', border: 'none', fontSize: 18, cursor: 'pointer', padding: '4px 6px' }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}