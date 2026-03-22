import LiveIndicator from './LiveIndicator'

export default function TopBar({ user, page, pageTitle, syncing, lastSync, online, onLogout, rtStatus }) {
  const PAGE_TITLES = {
    dashboard: 'Dashboard',
    inspection: 'Form Inspeksi',
    history: 'History Kerusakan',
    analytics: 'Analytics',
    approvals: 'Approval Order',
    admin: 'Manajemen Admin',
  }

  return (
    <div className="mobile-topbar">
      {/* Kiri: Logo + Judul halaman */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img
          src="/logo/mineinspect-crane.png"
          alt="MineInspect Logo"
          style={{ width: 60, height: 60, objectFit: 'fill', flexShrink: 0 }}
        />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t)', lineHeight: 1.2 }}>
            {PAGE_TITLES[page] || 'INSPECT'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', lineHeight: 1 }}>{user?.nama}</div>
        </div>
      </div>

      {/* Kanan: status online + live indicator + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {!online && (
          <span style={{ background: 'var(--errbg)', border: '1px solid var(--errbd)', color: 'var(--err)', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
            Offline
          </span>
        )}
        <LiveIndicator syncing={syncing} lastSync={lastSync} rtStatus={rtStatus} compact />
        <button
          onClick={onLogout}
          className="touch-target"
          style={{ background: 'transparent', border: 'none', color: 'var(--err)', fontSize: 12, cursor: 'pointer', borderRadius: 8 }}
          title="Logout"
        >
          ↪️Logout
        </button>
      </div>
    </div>
  )
}