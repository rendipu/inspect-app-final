/** Shared navigation definitions for Sidebar and BottomNav */
export const MENUS = [
  { key: 'dashboard', icon: '▦', label: 'Dashboard', roles: ['admin', 'group_leader', 'mekanik', 'warehouse', 'planner'] },
  { key: 'inspection', icon: '📋', label: 'Form Inspeksi', roles: ['mekanik', 'admin'] },
  { key: 'hourmeter', icon: '⏱', label: 'Update Hour Meter', roles: ['admin', 'group_leader', 'mekanik', 'planner'] },
  { key: 'stock', icon: '📦', label: 'Stock Barang', roles: ['admin', 'warehouse', 'group_leader', 'mekanik', 'planner'] },
  { key: 'history', icon: '🗂', label: 'History', roles: ['admin', 'group_leader', 'mekanik', 'planner'] },
  { key: 'analytics', icon: '📊', label: 'Analytics', roles: ['admin', 'group_leader', 'mekanik', 'planner'] },
  { key: 'shopmanual', icon: '📖', label: 'Shop Manual', roles: ['admin', 'group_leader', 'mekanik', 'warehouse', 'planner'] },
  { key: 'partbook', icon: '📁', label: 'Partbook', roles: ['admin', 'group_leader', 'mekanik', 'warehouse', 'planner'] },
  { key: 'approvals', icon: '✅', label: 'Approval Order', roles: ['group_leader'] },
  { key: 'plannerorders', icon: '📋', label: 'Planner Orders', roles: ['planner'] },
  { key: 'admin', icon: '⚙', label: 'Manajemen Admin', roles: ['admin'] },
]

export function menusForRole(role) {
  return MENUS.filter(m => m.roles.includes(role))
}
