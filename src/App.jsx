import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/react';
import { usePolling }     from './hooks/usePolling'
import { useWindowWidth } from './hooks/useWindowWidth'
import { useOnline }      from './hooks/useOnline'



import Sidebar       from './components/Sidebar'
import TopBar        from './components/TopBar'
import BottomNav     from './components/BottomNav'
import PwaBanner     from './components/PwaBanner'
import LiveIndicator from './components/LiveIndicator'
import { SkeletonDashboard, SkeletonPage } from './components/SkeletonLoader'

// Eager — tampil pertama kali, harus instant
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'

// ✅ FIX: lazy load semua halaman berat
// Menghemat ~135 KiB dari initial bundle (JS tidak digunakan)
// recharts (Analytics) saja ~80 KiB — tidak perlu di-load saat login
const InspectionForm = lazy(() => import('./pages/InspectionForm'))
const HistoryPage    = lazy(() => import('./pages/HistoryPage'))
const Analytics      = lazy(() => import('./pages/Analytics'))
const Approvals      = lazy(() => import('./pages/Approvals'))
const AdminPanel     = lazy(() => import('./pages/AdminPanel'))
const HourMeter      = lazy(() => import('./pages/HourMeter'))
const StockPage      = lazy(() => import('./pages/stockPage'))
const PublicUnitPage = lazy(() => import('./pages/PublicUnitPage'))

function LoadingScreen() {
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <SkeletonDashboard />
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('inspect_user')) } catch { return null }
  })

  const [publicQr] = useState(() => {
    const m = window.location.pathname.match(/^\/u\/(.+)$/)
    return m ? decodeURIComponent(m[1]) : null
  })
  const [page,    setPage]    = useState('dashboard')
  const [selUnit, setSelUnit] = useState(null)
  const [showPwa, setShowPwa] = useState(true)
  const isDeviceOnline = useOnline()
  const { data, loading, error, syncing, lastSync, mutate, refetch, online, rtStatus } = usePolling(15000, !!user)
  const width  = useWindowWidth()
  const isMob  = width < 681

  // Public unit page — tidak butuh login
  if (publicQr) {
    return <PublicUnitPage qrCode={publicQr} />
  }

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

  useEffect(() => {
    if (isMob) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page, isMob])

  const safeData = useMemo(
    () => data || { users:[], units:[], questions:[], schedules:[], inspections:[], recurring:[] },
    [data]
  )

  // HARUS sebelum early return (Rules of Hooks)
  const pageMap = useMemo(() => ({
    dashboard: <Dashboard user={user} data={safeData} setPage={setPage} setSelUnit={setSelUnit}
              mutate={mutate} syncing={syncing} lastSync={lastSync} rtStatus={rtStatus} />,
    inspection: <InspectionForm user={user} data={safeData} selUnit={selUnit} mutate={mutate} setPage={setPage} refetch={refetch} />,
    history:    <HistoryPage    data={safeData} user={user} refetch={refetch} />,
    analytics:  <Analytics      data={safeData} syncing={syncing} />,
    approvals:  <Approvals      data={safeData} refetch={refetch} />,
    admin:      <AdminPanel     data={safeData} refetch={refetch} />,
    hourmeter:  <HourMeter      data={safeData} user={user} refetch={refetch} />,
    stock:      <StockPage      user={user} />,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [page, safeData, user, syncing, lastSync, selUnit, refetch, mutate, rtStatus])

  if (!user) return <LoginPage onLogin={handleLogin} />
  if (loading && !data) return <LoadingScreen />
  if (error && !data) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, padding:20, textAlign:'center' }}>
      <div style={{ fontSize:36 }}>⚠</div>
      <div style={{ fontSize:16, fontWeight:700, color:'var(--t)' }}>Gagal memuat data</div>
      <div style={{ fontSize:13, color:'var(--t3)' }}>{error}</div>
      <button className="btn-y" style={{ marginTop:8 }} onClick={refetch}>Coba Lagi</button>
    </div>
  )
  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh' }}>
      {!isDeviceOnline && (
        <div style={{ background:'var(--err)', color:'#fff', textAlign:'center', padding:'6px 16px', fontSize:12, fontWeight:700 }}>
          ⚠ Tidak ada koneksi — Mode Offline
        </div>
      )}
      {showPwa && isDeviceOnline && (
        <PwaBanner
          onInstall={() => { alert('Buka di Chrome/Safari → menu → "Add to Home Screen" untuk install PWA.'); setShowPwa(false) }}
          onDismiss={() => setShowPwa(false)}
        />
      )}

      {isMob ? (
        <>
          <TopBar user={user} page={page} syncing={syncing} lastSync={lastSync} online={online} onLogout={handleLogout} rtStatus={rtStatus} />
          <main className="main-with-bottom-nav" style={{ padding:'14px 14px 0' }}>
            <Suspense fallback={<SkeletonPage />}>
              {pageMap[page] ?? pageMap.dashboard}
            </Suspense>
          </main>
          <BottomNav user={user} page={page} setPage={setPage} />
        </>
      ) : (
        <div style={{ display:'flex' }}>
          <Sidebar user={user} page={page} setPage={setPage} onLogout={handleLogout} isMob={false} />
          <main style={{ flex:1, minWidth:0, padding:'24px 28px' }}>
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
              <LiveIndicator syncing={syncing} lastSync={lastSync} rtStatus={rtStatus} />
            </div>
            <Suspense fallback={<SkeletonPage />}>
              {pageMap[page] ?? pageMap.dashboard}
            </Suspense>
          </main>
        </div>
      )}
      <SpeedInsights />
    </div>
  )
}