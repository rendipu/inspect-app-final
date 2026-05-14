import { useState, useMemo, useCallback, useEffect } from 'react'
import { MENUS, menusForRole } from '../navMenus'

const PRIORITY = ['history', 'stock', 'hourmeter', 'shopmanual', 'partbook', 'inspection', 'analytics', 'plannerorders', 'approvals', 'admin']

function SvgHome({ active }) {
  const c = active ? 'var(--nav-active, #964900)' : 'var(--nav-muted, #57534e)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" stroke={c} strokeWidth="1.8" strokeLinejoin="round" fill={active ? c : 'none'} fillOpacity={active ? 0.15 : 0} />
    </svg>
  )
}

function SvgHistory({ active }) {
  const c = active ? 'var(--nav-active, #964900)' : 'var(--nav-muted, #57534e)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke={c} strokeWidth="1.8" />
      <path d="M12 8v4.5l3 1.7" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SvgStock({ active }) {
  const c = active ? 'var(--nav-active, #964900)' : 'var(--nav-muted, #57534e)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 8h14v10a1 1 0 01-1 1H6a1 1 0 01-1-1V8z" stroke={c} strokeWidth="1.8" />
      <path d="M5 8l2-3h10l2 3" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SvgHourmeter({ active }) {
  const c = active ? 'var(--nav-active, #964900)' : 'var(--nav-muted, #57534e)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8" stroke={c} strokeWidth="1.8" />
      <path d="M12 8v5l3 2" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SvgChart({ active }) {
  const c = active ? 'var(--nav-active, #964900)' : 'var(--nav-muted, #57534e)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 19V5M9 19v-6M13 19V9M17 19v-9" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SvgClipboard({ active }) {
  const c = active ? 'var(--nav-active, #964900)' : 'var(--nav-muted, #57534e)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 4h6l1 2h3v14H5V6h3l1-2z" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 12h6M9 16h4" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function SvgCheck({ active }) {
  const c = active ? 'var(--nav-active, #964900)' : 'var(--nav-muted, #57534e)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12l5 5L20 7" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SvgGear({ active }) {
  const c = active ? 'var(--nav-active, #964900)' : 'var(--nav-muted, #57534e)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" stroke={c} strokeWidth="1.6" />
      <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 01-4 0v-.09a1.7 1.7 0 00-1-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.55-1H3a2 2 0 010-4h.09a1.7 1.7 0 001.55-1 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 012.83-2.83l.06.06a1.7 1.7 0 001.87.34H9a1.7 1.7 0 001-1.55V3a2 2 0 014 0v.09a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 012.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87V9c0 .66.37 1.26.95 1.55H21a2 2 0 010 4h-.09a1.7 1.7 0 00-1.55 1z" stroke={c} strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  )
}

function SvgMore({ active }) {
  const c = active ? 'var(--nav-active, #964900)' : 'var(--nav-muted, #57534e)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="12" r="1.8" fill={c} />
      <circle cx="12" cy="12" r="1.8" fill={c} />
      <circle cx="18" cy="12" r="1.8" fill={c} />
    </svg>
  )
}

function SvgBookNav({ active }) {
  const c = active ? 'var(--nav-active, #964900)' : 'var(--nav-muted, #57534e)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 19V5a2 2 0 012-2h11v16H6a2 2 0 100 4h13v-2H6" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SvgFolderNav({ active }) {
  const c = active ? 'var(--nav-active, #964900)' : 'var(--nav-muted, #57534e)'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 7h6l2 2h10v10H3V7z" stroke={c} strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  )
}

function SvgQrFab() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" stroke="#fff" strokeWidth="1.6" />
      <path d="M7 7h0M17 7h0M7 17h0M14 14h6v6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function iconForKey(key, active) {
  switch (key) {
    case 'dashboard': return <SvgHome active={active} />
    case 'history': return <SvgHistory active={active} />
    case 'stock': return <SvgStock active={active} />
    case 'hourmeter': return <SvgHourmeter active={active} />
    case 'analytics': return <SvgChart active={active} />
    case 'inspection': return <SvgClipboard active={active} />
    case 'plannerorders': return <SvgClipboard active={active} />
    case 'approvals': return <SvgCheck active={active} />
    case 'admin': return <SvgGear active={active} />
    case 'shopmanual': return <SvgBookNav active={active} />
    case 'partbook': return <SvgFolderNav active={active} />
    case 'more': return <SvgMore active={active} />
    default: return <SvgMore active={active} />
  }
}

function buildSlots(role) {
  const poolKeys = new Set(menusForRole(role).map(m => m.key))
  poolKeys.delete('dashboard')
  const available = PRIORITY.filter(k => poolKeys.has(k))
  let slots
  let overflowKeys = []
  if (available.length <= 3) {
    slots = [...available, null, null, null].slice(0, 3)
  } else {
    slots = [available[0], available[1], 'more']
    overflowKeys = available.slice(2)
  }
  return { slots, overflowKeys }
}

export default function BottomNav({ user, page, setPage, onScanClick }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const { slots, overflowKeys } = useMemo(() => buildSlots(user.role), [user.role])

  const closeMore = useCallback(() => setMoreOpen(false), [])

  useEffect(() => {
    setMoreOpen(false)
  }, [page])

  const menuByKey = useMemo(() => Object.fromEntries(MENUS.map(m => [m.key, m])), [])

  return (
    <>
      <nav className="bottom-nav bottom-nav--fab" aria-label="Navigasi utama">
        <button
          type="button"
          className={`bottom-nav-item bottom-nav-item--slot ${page === 'dashboard' ? 'active' : ''}`}
          onClick={() => setPage('dashboard')}
        >
          <span className="bn-icon" aria-hidden>{iconForKey('dashboard', page === 'dashboard')}</span>
          <span className="bn-label">Home</span>
        </button>

        <NavSlot
          slotKey={slots[0]}
          page={page}
          setPage={setPage}
          menuByKey={menuByKey}
        />

        <div className="bottom-nav-fab-wrap">
          <button
            type="button"
            className="bottom-nav-fab"
            onClick={() => onScanClick?.()}
            aria-label="Scan QR code"
          >
            <SvgQrFab />
            <span className="bottom-nav-fab-text">SCAN</span>
          </button>
        </div>

        <NavSlot
          slotKey={slots[1]}
          page={page}
          setPage={setPage}
          menuByKey={menuByKey}
        />

        <NavSlot
          slotKey={slots[2]}
          page={page}
          setPage={setPage}
          menuByKey={menuByKey}
          onMoreClick={() => setMoreOpen(true)}
          moreActive={moreOpen}
          overflowCount={overflowKeys.length}
        />
      </nav>

      {moreOpen && overflowKeys.length > 0 && (
        <div className="bottom-nav-sheet-backdrop" role="presentation" onClick={closeMore} />
      )}
      {moreOpen && overflowKeys.length > 0 && (
        <div className="bottom-nav-sheet" role="dialog" aria-label="Menu lainnya">
          <div className="bottom-nav-sheet-title">Menu lainnya</div>
          <div className="bottom-nav-sheet-list">
            {overflowKeys.map((key) => {
              const m = menuByKey[key]
              if (!m) return null
              return (
                <button
                  key={key}
                  type="button"
                  className="bottom-nav-sheet-item"
                  onClick={() => { setPage(key); closeMore() }}
                >
                  {m.icon && <span className="bottom-nav-sheet-ico">{m.icon}</span>}
                  <span>{m.label}</span>
                </button>
              )
            })}
          </div>
          <button type="button" className="bottom-nav-sheet-close" onClick={closeMore}>Tutup</button>
        </div>
      )}
    </>
  )
}

const SHORT_LABELS = {
  history: 'History',
  stock: 'Stock',
  hourmeter: 'Hourmeter',
  inspection: 'Inspeksi',
  analytics: 'Analytic',
  plannerorders: 'Orders',
  approvals: 'Approval',
  admin: 'Admin',
  shopmanual: 'Manual',
  partbook: 'Partbook',
  more: 'Lainnya',
}

function NavSlot({ slotKey, page, setPage, menuByKey, onMoreClick, moreActive, overflowCount }) {
  if (slotKey === 'more') {
    return (
      <button
        type="button"
        className={`bottom-nav-item bottom-nav-item--slot ${moreActive ? 'active' : ''}`}
        onClick={() => onMoreClick?.()}
        aria-label={overflowCount ? `Lainnya, ${overflowCount} menu` : 'Lainnya'}
      >
        <span className="bn-icon" aria-hidden>{iconForKey('more', !!moreActive)}</span>
        <span className="bn-label">{SHORT_LABELS.more}</span>
      </button>
    )
  }
  if (!slotKey) {
    return <div className="bottom-nav-item bottom-nav-item--slot bottom-nav-item--placeholder" aria-hidden />
  }
  const m = menuByKey[slotKey]
  const label = SHORT_LABELS[slotKey] || (m?.label?.split(' ').slice(0, 2).join(' ') ?? slotKey)
  const active = page === slotKey
  return (
    <button
      type="button"
      className={`bottom-nav-item bottom-nav-item--slot ${active ? 'active' : ''}`}
      onClick={() => setPage(slotKey)}
    >
      <span className="bn-icon" aria-hidden>{iconForKey(slotKey, active)}</span>
      <span className="bn-label">{label}</span>
    </button>
  )
}
