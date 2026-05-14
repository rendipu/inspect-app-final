import { useState, useRef, useEffect, useMemo } from 'react'
import LiveIndicator from './LiveIndicator'

function greetingForNow() {
  const h = new Date().getHours()
  if (h < 11) return 'Semangat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 19) return 'Selamat sore'
  return 'Selamat malam'
}

export default function TopBar({ user, page, syncing, lastSync, online, onLogout, rtStatus }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const wrapRef = useRef(null)

  const PAGE_TITLES = useMemo(() => ({
    dashboard: 'Dashboard',
    inspection: 'Form Inspeksi',
    history: 'History Kerusakan',
    analytics: 'Analytics',
    approvals: 'Approval Order',
    admin: 'Manajemen Admin',
    hourmeter: 'Hour Meter',
    stock: 'Stock',
    plannerorders: 'Planner Orders',
    shopmanual: 'Shop Manual',
    partbook: 'Partbook',
  }), [])

  const subtitle = PAGE_TITLES[page] || 'MineInspect'

  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [menuOpen])

  return (
    <header className="mobile-topbar mobile-topbar--greeting" ref={wrapRef}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <div
          className="mobile-topbar-avatar"
          aria-hidden
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" fill="var(--t3)" />
            <path d="M4 20a8 8 0 0116 0" stroke="var(--t3)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="mobile-topbar-greet">
            {greetingForNow()}, <strong>{user?.nama || 'User'}</strong>!
          </div>
          {page !== 'dashboard' && (
            <div className="mobile-topbar-page">{subtitle}</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {!online && (
          <span style={{ background: 'var(--errbg)', border: '1px solid var(--errbd)', color: 'var(--err)', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
            Offline
          </span>
        )}
        <button
          type="button"
          className="mobile-topbar-bell touch-target"
          aria-expanded={menuOpen}
          aria-haspopup="true"
          aria-label="Menu notifikasi dan akun"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 22a2.5 2.5 0 002.45-2h-4.9A2.5 2.5 0 0012 22z" fill="var(--brown)" />
            <path d="M18 16v-5a6 6 0 10-12 0v5l-2 2h16l-2-2z" stroke="var(--brown)" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="mobile-topbar-dropdown" role="menu">
          <div style={{ padding: '4px 0 8px', borderBottom: '1px solid var(--bd)' }}>
            <LiveIndicator syncing={syncing} lastSync={lastSync} rtStatus={rtStatus} compact />
          </div>
          <button type="button" className="mobile-topbar-dropdown-item" role="menuitem" onClick={() => { onLogout(); setMenuOpen(false) }}>
            Logout
          </button>
        </div>
      )}
    </header>
  )
}
