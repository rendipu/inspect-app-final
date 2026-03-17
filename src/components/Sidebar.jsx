import Badge from './Badge'

const MENUS = [
  { key: 'dashboard',  icon: '▦',  label: 'Dashboard',         roles: ['admin','group_leader','mekanik','warehouse'] },
  { key: 'inspection', icon: '📋', label: 'Form Inspeksi',      roles: ['mekanik','admin'] },
  { key: 'hourmeter',  icon: '⏱',  label: 'Update Hour Meter',  roles: ['admin','group_leader','mekanik'] },
  { key: 'stock',      icon: '📦', label: 'Stock Barang',       roles: ['admin','warehouse','group_leader','mekanik'] },
  { key: 'history',    icon: '🗂',  label: 'History',            roles: ['admin','group_leader','mekanik'] },
  { key: 'analytics',  icon: '📊', label: 'Analytics',          roles: ['admin','group_leader','mekanik'] },
  { key: 'approvals',  icon: '✅', label: 'Approval Order',     roles: ['group_leader'] },
  { key: 'admin',      icon: '⚙',  label: 'Manajemen Admin',    roles: ['admin'] },
]

export default function Sidebar({ user, page, setPage, onLogout, isMob }) {
  const menus = MENUS.filter(m => m.roles.includes(user.role))

  const style = {
    width:         isMob ? '100%' : 220,
    background:    'var(--sf)',
    borderRight:   isMob ? 'none' : '1.5px solid var(--bd)',
    display:       'flex',
    flexDirection: 'column',
    flexShrink:    0,
    position:      isMob ? 'static' : 'sticky',
    top:           0,
    height:        isMob ? 'auto' : '100vh',
    overflowY:     'auto',
  }

  return (
    <aside style={style}>
      {!isMob && (
        <div style={{ padding: '16px 14px', borderBottom: '1.5px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: 'var(--p)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 900, color: '#1c1917', flexShrink: 0, boxShadow: '0 2px 8px rgba(245,158,11,.3)' }}>⚙</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t)', letterSpacing: '.03em' }}>INSPECT</div>
            <div style={{ fontSize: 10, color: 'var(--t3)' }}>Heavy Equipment System</div>
          </div>
        </div>
      )}
      <div style={{ padding: '10px', borderBottom: '1.5px solid var(--bd)' }}>
        <div style={{ background: 'var(--sfy)', border: '1px solid var(--wnbd)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t)' }}>{user.nama}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 5 }}>{user.nrp} · {user.jabatan}</div>
          <Badge type={user.role} />
        </div>
      </div>
      <nav style={{ flex: 1, padding: '8px' }}>
        {menus.map(m => (
          <button key={m.key} className={`sl ${page === m.key ? 'active' : ''}`} onClick={() => setPage(m.key)}>
            <span style={{ fontSize: 15 }}>{m.icon}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </nav>
      <div style={{ padding: '8px', borderTop: '1.5px solid var(--bd)' }}>
        <button onClick={onLogout} style={{ width: '100%', background: 'transparent', border: '1.5px solid var(--bd)', color: 'var(--err)', padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .15s' }}>
          🚪 Logout
        </button>
      </div>
    </aside>
  )
}