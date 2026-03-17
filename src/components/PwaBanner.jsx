export default function PwaBanner({ onInstall, onDismiss }) {
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
          onClick={onInstall}
          style={{ background: 'var(--p)', color: '#1c1917', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
        >
          Pasang
        </button>
        <button
          onClick={onDismiss}
          style={{ background: 'transparent', color: '#a8a29e', border: 'none', fontSize: 18, cursor: 'pointer', padding: '4px 6px' }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
