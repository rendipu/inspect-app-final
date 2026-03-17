const MENUS = [
  { key: 'dashboard',  icon: '▦',  label: 'Dashboard', roles: ['admin','group_leader','mekanik'] },
  { key: 'inspection', icon: '📋', label: 'Inspeksi',   roles: ['mekanik','admin'] },
  { key: 'stock',      icon: '📦', label: 'Stock',      roles: ['admin','warehouse','group_leader','mekanik'] },
  { key: 'hourmeter',  icon: '⏱',  label: 'HM',        roles: ['admin','group_leader','mekanik'] },
  { key: 'history',    icon: '🗂',  label: 'History',   roles: ['admin','group_leader','mekanik'] },
  { key: 'analytics',  icon: '📊', label: 'Analitik',  roles: ['admin','group_leader','mekanik'] },
  { key: 'approvals',  icon: '✅', label: 'Approval',  roles: ['group_leader'] },
  { key: 'admin',      icon: '⚙',  label: 'Admin',     roles: ['admin'] },
]

export default function BottomNav({ user, page, setPage }) {
  const menus  = MENUS.filter(m => m.roles.includes(user.role))
  const visible = menus.slice(0, 6)

  return (
    <nav className="bottom-nav">
      {visible.map(m => (
        <button
          key={m.key}
          className={`bottom-nav-item ${page === m.key ? 'active' : ''}`}
          onClick={() => setPage(m.key)}
        >
          <span className="bn-icon">{m.icon}</span>
          <span className="bn-label">{m.label}</span>
        </button>
      ))}
    </nav>
  )
}