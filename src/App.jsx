import { useState, useEffect, useMemo } from 'react'
import { usePolling }     from './hooks/usePolling'
import { useWindowWidth } from './hooks/useWindowWidth'
import { useOnline }      from './hooks/useOnline'

import Sidebar       from './components/Sidebar'
import TopBar        from './components/TopBar'
import BottomNav     from './components/BottomNav'
import PwaBanner     from './components/PwaBanner'
import LiveIndicator from './components/LiveIndicator'

import LoginPage      from './pages/LoginPage'
import Dashboard      from './pages/Dashboard'
import InspectionForm from './pages/InspectionForm'
import HistoryPage    from './pages/HistoryPage'
import Analytics      from './pages/Analytics'
import Approvals      from './pages/Approvals'
import AdminPanel     from './pages/AdminPanel'
import HourMeter      from './pages/HourMeter'
import StockPage      from './pages/stockPage'

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 56, height: 56, background: 'var(--p)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, boxShadow: '0 4px 20px rgba(245,158,11,.3)' }}>⚙</div>
      <div style={{ fontSize: 14, color: 'var(--t3)' }}>Memuat data...</div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('inspect_user')) } catch { return null }
  })
  const [page,    setPage]    = useState('dashboard')
  const [selUnit, setSelUnit] = useState(null)
  const [showPwa, setShowPwa] = useState(true)

  const { data, loading, error, syncing, lastSync, mutate, refetch } = usePolling(15000, !!user)
  const online = useOnline()
  const width  = useWindowWidth()
  const isMob  = width < 681

  const handleLogin = (u) => {
    localStorage.setItem('inspect_user', JSON.stringify(u))
    setUser(u)
    setPage('dashboard')
  }

  const handleLogout = () => {
    localStorage.removeItem('inspect_token')
    localStorage.removeItem('inspect_user')
    setUser(null)
    setPage('dashboard')
  }

  // Scroll ke atas saat ganti halaman di mobile
  useEffect(() => {
    if (isMob) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page, isMob])

  // FIX #8: safeData di-memo agar tidak buat objek baru setiap render
  const safeData = useMemo(
    () => data || { users: [], units: [], questions: [], schedules: [], inspections: [], recurring: [] },
    [data]
  )

  // FIX: useMemo pageMap HARUS di sini — sebelum semua early return
  // agar jumlah hooks konsisten setiap render (React Rules of Hooks)
  const pageMap = useMemo(() => ({
    dashboard:  <Dashboard      user={user} data={safeData} setPage={setPage} setSelUnit={setSelUnit} mutate={mutate} syncing={syncing} lastSync={lastSync} />,
    inspection: <InspectionForm user={user} data={safeData} selUnit={selUnit} mutate={mutate} setPage={setPage} refetch={refetch} />,
    history:    <HistoryPage    data={safeData} user={user} refetch={refetch} />,
    analytics:  <Analytics      data={safeData} syncing={syncing} />,
    approvals:  <Approvals      data={safeData} refetch={refetch} />,
    admin:      <AdminPanel     data={safeData} refetch={refetch} />,
    hourmeter:  <HourMeter      data={safeData} user={user} refetch={refetch} />,
    stock:      <StockPage      user={user} />,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [page, safeData, user, syncing, lastSync, selUnit, refetch, mutate])

  if (!user) return <LoginPage onLogin={handleLogin} />
  if (loading && !data) return <LoadingScreen />
  if (error && !data) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 20, textAlign: 'center' }}>
      <div style={{ fontSize: 36 }}>⚠</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t)' }}>Gagal memuat data</div>
      <div style={{ fontSize: 13, color: 'var(--t3)' }}>{error}</div>
      <button className="btn-y" style={{ marginTop: 8 }} onClick={refetch}>Coba Lagi</button>
    </div>
  )

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Offline banner */}
      {!online && (
        <div style={{ background: 'var(--err)', color: '#fff', textAlign: 'center', padding: '6px 16px', fontSize: 12, fontWeight: 700 }}>
          ⚠ Tidak ada koneksi — Mode Offline
        </div>
      )}

      {/* PWA banner */}
      {showPwa && online && (
        <PwaBanner
          onInstall={() => { alert('Buka di Chrome/Safari → menu → "Add to Home Screen" untuk install PWA.'); setShowPwa(false) }}
          onDismiss={() => setShowPwa(false)}
        />
      )}

      {/* Mobile layout */}
      {isMob ? (
        <>
          <TopBar
            user={user}
            page={page}
            syncing={syncing}
            lastSync={lastSync}
            online={online}
            onLogout={handleLogout}
          />
          <main className="main-with-bottom-nav" style={{ padding: '14px 14px 0' }}>
            {pageMap[page] ?? pageMap.dashboard}
          </main>
          <BottomNav user={user} page={page} setPage={setPage} />
        </>
      ) : (
        /* Desktop layout */
        <div style={{ display: 'flex' }}>
          <Sidebar user={user} page={page} setPage={setPage} onLogout={handleLogout} isMob={false} />
          <main style={{ flex: 1, minWidth: 0, padding: '24px 28px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <LiveIndicator syncing={syncing} lastSync={lastSync} />
            </div>
            {pageMap[page] ?? pageMap.dashboard}
          </main>
        </div>
      )}
    </div>
  )
}