import { useState, useEffect, useCallback, useMemo } from 'react'
import Badge from '../components/Badge'

const getLocalYMD = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
const TODAY = getLocalYMD()

const HERO_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBACSwWqs8LWCoGhlW6BM39p9zzMRHNtjRJdLbkTTcSCgdGxRyk7YEZRAYrrV8QSV2i1qp8cU90CJgoqCtHjTXnzmXcoeBwxAlO3rzZJvPVyhkKKVu_AReUdsqx85GjpaZFghY5oW-nstVMKLvdrJfZDDo4No3iyqolZqObHWLDLxITOmJsrzYU5OGDBrWmqTY_mYitw-W_Q2dcw6wTiH6GWEzgqPq-2HbWyznbGIOxGfAJa8b7n81-Z3FzOovNYk9rbN_5eWjOG3g'

// ── Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard({ user, data, setPage, setSelUnit, syncing, pendingScanCode, onConsumePendingScan, onOpenScanner }) {
  const { units, schedules, inspections } = data
  const [scan, setScan] = useState('')
  const [scanRes, setScanRes] = useState(null)

  const todaySch = schedules.filter(s => s.tanggal === TODAY)
  const done     = todaySch.filter(s => s.status === 'done').length
  const total    = todaySch.length
  const pct      = total > 0 ? Math.round(done / total * 100) : 0
  const pctColor = pct >= 100 ? 'var(--ok)' : pct >= 60 ? 'var(--p)' : 'var(--err)'

  // ── Notifikasi order planner untuk mekanik ──────────────────────────
  const plannerNotifs = useMemo(() => {
    if (!user) return []
    const notifs = []
    inspections.forEach(ins => {
      // Hanya tampilkan notifikasi untuk inspeksi yang melibatkan user ini
      const isMine = user.role === 'mekanik'
        ? (ins.mekaniks || []).some(m => m.user_id === user.id || m.user_nama === user.nama)
        : true // admin/GL/planner lihat semua
      if (!isMine) return
      ;(ins.answers || []).forEach(a => {
        if (a.answer === 'bad' && a.part_order) {
          const ws = a.part_order.work_status
          if (ws === 'sudah_diorder' || ws === 'full_supply') {
            const u = ins.unit || units.find(x => x.id === ins.unit_id)
            notifs.push({
              id:        a.part_order.id,
              unit:      u?.nomor_unit || ins.unit_nomor,
              brand:     u?.brand,
              tipe:      u?.tipe,
              partName:  a.part_order.part_name,
              partNo:    a.part_order.part_number,
              qty:       a.part_order.quantity,
              status:    ws,
              tanggal:   ins.tanggal,
            })
          }
        }
      })
    })
    return notifs
  }, [inspections, units, user])

  const findUnit = useCallback((query) => {
    if (!query?.trim()) return
    const clean = query.trim()
    const fromUrl = clean.match(/\/u\/([^?#\s]+)$/)
    const code = fromUrl ? decodeURIComponent(fromUrl[1]) : clean
    const u = units.find(x =>
      x.nomor_unit === code ||
      x.qr_code === code ||
      x.nomor_unit.toLowerCase() === code.toLowerCase()
    )
    setScan(code)
    setScanRes(u ?? 'notfound')
  }, [units])

  useEffect(() => {
    if (!pendingScanCode) return
    findUnit(pendingScanCode)
    onConsumePendingScan?.()
  }, [pendingScanCode, findUnit, onConsumePendingScan])

  const canInspect = user.role === 'mekanik' || user.role === 'admin'
  const canAnalytics = ['admin', 'group_leader', 'mekanik', 'planner'].includes(user.role)
  const canHourmeter = ['admin', 'group_leader', 'mekanik', 'planner'].includes(user.role)
  const canHistory = ['admin', 'group_leader', 'mekanik', 'planner'].includes(user.role)

  const soon = () => alert('Fitur ini akan hadir segera.')

  return (
    <div className="fade">
      <p className="dsk" style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 14 }}>
        {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      <section className="dash-hero mob" aria-label="Status update">
        <img className="dash-hero-img" alt="" decoding="async" src="/logo/tadano.png" />
        <div className="dash-hero-overlay">
          <span className="dash-hero-kicker">Status update</span>
          <h1 className="dash-hero-title">Optimalkan Performa Unit Anda Hari Ini</h1>
        </div>
      </section>

      <div className="dash-stat-strip mob">
        <span className="dash-stat-pill">Jadwal: <strong>{total}</strong> unit</span>
        <span className="dash-stat-pill">Selesai: <strong>{done}</strong></span>
        <span className="dash-stat-pill" style={{ borderColor: pctColor, color: pctColor }}>Capai: <strong>{pct}%</strong></span>
      </div>

      <div className="dsk g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Jadwal Hari Ini', val: total, sub: 'unit dijadwalkan', border: 'var(--p)' },
          { label: 'Sudah Diinspeksi', val: done, sub: 'unit selesai', border: 'var(--ok)' },
          { label: 'Pencapaian', val: `${pct}%`, sub: `${done}/${total} unit`, border: pctColor },
        ].map(c => (
          <div key={c.label} className="card" style={{ borderTop: `3px solid ${c.border}`, padding: 16 }}>
            <div className="lbl" style={{ marginBottom: 6 }}>{c.label}</div>
            <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--t)', letterSpacing: '-.02em' }}>{c.val}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>{c.sub}</div>
            {c.label === 'Pencapaian' && (
              <div style={{ height: 4, background: 'var(--bd2)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: c.border, borderRadius: 2, width: `${pct}%`, transition: 'width .5s' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <section className="dash-grid mob" aria-label="Menu cepat">
        <button type="button" className="dash-tile" disabled={!canInspect} onClick={() => canInspect && setPage('inspection')} title={!canInspect ? 'Tidak tersedia untuk role Anda' : 'Form inspeksi'}>
          <span className="dash-tile-ico dash-tile-ico--peach" aria-hidden>📝</span>
          <span className="dash-tile-lbl">Inspeksi</span>
        </button>
        <button type="button" className="dash-tile" disabled={!canAnalytics} onClick={() => canAnalytics && setPage('analytics')}>
          <span className="dash-tile-ico" aria-hidden>📊</span>
          <span className="dash-tile-lbl">Analytic</span>
        </button>
        <button type="button" className="dash-tile" onClick={() => setPage('shopmanual')}>
          <span className="dash-tile-ico" aria-hidden>📖</span>
          <span className="dash-tile-lbl">Shop Manual</span>
        </button>
        <button type="button" className="dash-tile" onClick={() => setPage('partbook')}>
          <span className="dash-tile-ico" aria-hidden>📁</span>
          <span className="dash-tile-lbl">Partbook</span>
        </button>
        <button type="button" className="dash-tile" onClick={soon}>
          <span className="dash-tile-ico" aria-hidden>🔧</span>
          <span className="dash-tile-lbl">Backlog</span>
        </button>
        <button type="button" className="dash-tile" onClick={soon}>
          <span className="dash-tile-ico" aria-hidden>🚜</span>
          <span className="dash-tile-lbl">Unschedule</span>
        </button>
        <button type="button" className="dash-tile" disabled={!canHourmeter} onClick={() => canHourmeter && setPage('hourmeter')}>
          <span className="dash-tile-ico" aria-hidden>⏱</span>
          <span className="dash-tile-lbl">Hourmeter</span>
        </button>
        <button type="button" className="dash-tile" disabled={!canHistory} onClick={() => canHistory && setPage('history')}>
          <span className="dash-tile-ico" aria-hidden>📈</span>
          <span className="dash-tile-lbl">Reporting</span>
        </button>
      </section>

      <div className="dsk" style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t)' }}>Dashboard</h1>
      </div>

      <section className="dsk justify-center" aria-label="Status update desktop" style={{ marginBottom: 16 }}>
        <div className="dash-hero justify-center">
          <img className="dash-hero-img" alt="" decoding="async" src='/logo/tadano.png' />
          <div className="dash-hero-overlay">
            <span className="dash-hero-kicker">Status update</span>
            <div className="dash-hero-title" style={{ fontSize: 24 }}>Optimalkan Performa Unit Anda Hari Ini</div>
          </div>
        </div>
      </section>

      <section className="dsk g4" aria-label="Menu cepat desktop" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <button type="button" className="dash-tile" disabled={!canInspect} onClick={() => canInspect && setPage('inspection')} title={!canInspect ? 'Tidak tersedia untuk role Anda' : 'Form inspeksi'}>
          <span className="dash-tile-ico dash-tile-ico--peach" aria-hidden>📝</span>
          <span className="dash-tile-lbl">Inspeksi</span>
        </button>
        <button type="button" className="dash-tile" disabled={!canAnalytics} onClick={() => canAnalytics && setPage('analytics')}>
          <span className="dash-tile-ico" aria-hidden>📊</span>
          <span className="dash-tile-lbl">Analytic</span>
        </button>
        <button type="button" className="dash-tile" onClick={() => setPage('shopmanual')}>
          <span className="dash-tile-ico" aria-hidden>📖</span>
          <span className="dash-tile-lbl">Shop Manual</span>
        </button>
        <button type="button" className="dash-tile" onClick={() => setPage('partbook')}>
          <span className="dash-tile-ico" aria-hidden>📁</span>
          <span className="dash-tile-lbl">Partbook</span>
        </button>
        <button type="button" className="dash-tile" onClick={soon}>
          <span className="dash-tile-ico" aria-hidden>🔧</span>
          <span className="dash-tile-lbl">Backlog</span>
        </button>
        <button type="button" className="dash-tile" onClick={soon}>
          <span className="dash-tile-ico" aria-hidden>🚜</span>
          <span className="dash-tile-lbl">Unschedule</span>
        </button>
        <button type="button" className="dash-tile" disabled={!canHourmeter} onClick={() => canHourmeter && setPage('hourmeter')}>
          <span className="dash-tile-ico" aria-hidden>⏱</span>
          <span className="dash-tile-lbl">Hourmeter</span>
        </button>
        <button type="button" className="dash-tile" disabled={!canHistory} onClick={() => canHistory && setPage('history')}>
          <span className="dash-tile-ico" aria-hidden>📈</span>
          <span className="dash-tile-lbl">Reporting</span>
        </button>
      </section>

      {plannerNotifs.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            🔔 Notifikasi Order Part
            <span style={{ background: '#2563eb', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 800 }}>
              {plannerNotifs.length}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {plannerNotifs.map((n, i) => {
              const isFull    = n.status === 'full_supply'
              const bg     = isFull ? '#f0fdf4' : '#eff6ff'
              const bd     = isFull ? '#4ade80' : '#93c5fd'
              const c      = isFull ? '#15803d' : '#2563eb'
              const icon   = isFull ? '📦' : '🛒'
              const label  = isFull ? 'Barang Sudah Datang / Full Supply' : 'Sudah Diorder ke Supplier'
              return (
                <div key={`${n.id}-${i}`} style={{ background: bg, border: `1.5px solid ${bd}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 24, flexShrink: 0, lineHeight: 1.2 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: c, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t)', marginBottom: 2 }}>
                      {n.partName}
                      {n.partNo && <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 400, marginLeft: 6 }}>({n.partNo})</span>}
                      <span style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 400, marginLeft: 6 }}>× {n.qty}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                      Unit: <strong style={{ color: 'var(--t2)' }}>{n.unit}</strong>
                      {(n.brand || n.tipe) && <span> · {n.brand} {n.tipe}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <section style={{ marginBottom: 14 }}>
        <div className="mob dash-section-title">
          <h2>Jadwal inspeksi hari ini</h2>
          <span>{total} Units</span>
        </div>

        <div className="mob dash-schedule-card">
          <div className="dash-schedule-head">
            <span>Code unit</span>
            <span>Action</span>
          </div>
          {todaySch.map((s) => {
            const u = units.find((x) => x.id === s.unit_id)
            if (!u) return null
            const aria = `Unit ${u.nomor_unit}, status ${s.status}`
            return (
              <div key={s.id} className="dash-schedule-row" aria-label={aria}>
                <div>
                  <div className="dash-schedule-code">{u.nomor_unit}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {s.status === 'scheduled' && canInspect && (
                    <button type="button" className="dash-btn-inspect" onClick={() => { setSelUnit(u); setPage('inspection') }}>
                      Inspeksi <span aria-hidden>→</span>
                    </button>
                  )}
                  {s.status === 'done' && <span style={{ color: 'var(--ok)', fontSize: 12, fontWeight: 700 }}>✓ Selesai</span>}
                  {s.status === 'scheduled' && !canInspect && <span style={{ fontSize: 11, color: 'var(--t3)' }}>—</span>}
                </div>
              </div>
            )
          })}
          {todaySch.length === 0 && (
            <div style={{ textAlign: 'center', padding: 28, color: 'var(--t3)', fontSize: 14 }}>Tidak ada jadwal hari ini</div>
          )}
        </div>

        <div className="dsk card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div className="lbl" style={{ marginBottom: 0 }}>📅 Jadwal Inspeksi Hari Ini</div>
            {syncing && <span className="spin" style={{ fontSize: 14, color: 'var(--t3)' }}>↻</span>}
          </div>
          <div className="ptbl">
            <table className="tbl">
              <thead><tr><th>Code Unit</th><th>Action</th></tr></thead>
              <tbody>
                {todaySch.map((s) => {
                  const u = units.find((x) => x.id === s.unit_id)
                  if (!u) return null
                  return (
                    <tr key={s.id}>
                      <td><span className="mono" style={{ color: 'var(--pd)', fontWeight: 700, fontSize: 13 }}>{u.nomor_unit}</span></td>
                      
                      <td>
                        {s.status === 'scheduled' && canInspect && (
                          <button type="button" className="btn-y btn-sm" onClick={() => { setSelUnit(u); setPage('inspection') }}>Inspeksi →</button>
                        )}
                        {s.status === 'done' && <span style={{ color: 'var(--ok)', fontSize: 12, fontWeight: 700 }}>✓ Selesai</span>}
                      </td>
                    </tr>
                  )
                })}
                {todaySch.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: 28, color: 'var(--t3)' }}>Tidak ada jadwal hari ini</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="mob dash-qr-compact">
        <div className="lbl" style={{ marginBottom: 4 }}>Cari unit</div>
        <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 0 }}>Kode unit, QR, atau pakai tombol SCAN di bawah.</p>
        <div className="dash-qr-row">
          <input
            id="scan-input"
            name="scan"
            aria-label="No. Unit atau kode QR"
            value={scan}
            onChange={(e) => { setScan(e.target.value); setScanRes(null) }}
            onKeyDown={(e) => e.key === 'Enter' && findUnit(scan)}
            placeholder="No. unit…"
          />
          <button
            type="button"
            onClick={() => onOpenScanner?.()}
            title="Buka kamera"
            className="btn-g"
            style={{ padding: '0 12px', minWidth: 48 }}
          >
            📷
          </button>
          <button type="button" className="btn-y" style={{ padding: '0 14px' }} onClick={() => findUnit(scan)}>OK</button>
        </div>
        {scanRes === 'notfound' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, background: 'var(--errbg)', border: '1px solid var(--errbd)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--err)', fontWeight: 600 }}>
            Unit &quot;<strong>{scan}</strong>&quot; tidak ditemukan
          </div>
        )}
        {scanRes && scanRes !== 'notfound' && (
          <div style={{ background: 'var(--sfy)', border: '1.5px solid var(--wnbd)', borderRadius: 10, padding: 12, marginTop: 10 }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: 'var(--pd)' }}>{scanRes.nomor_unit}</span>
                <span style={{ fontSize: 12, color: 'var(--t3)' }}>{scanRes.brand} {scanRes.tipe}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>
                HM: <strong className="mono" style={{ color: 'var(--pd)' }}>{(units.find(u => u.id === scanRes.id)?.hm ?? scanRes.hm)?.toLocaleString()} jam</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn-g btn-sm" onClick={() => window.open(`/u/${encodeURIComponent(scanRes.qr_code || scanRes.nomor_unit)}`, '_blank')}>History</button>
              {schedules.find(sch => sch.unit_id === scanRes.id && sch.tanggal === TODAY && sch.status === 'scheduled') && canInspect && (
                <button type="button" className="btn-y btn-sm" onClick={() => { setSelUnit(scanRes); setPage('inspection') }}>Inspeksi</button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="dsk card">
        <div className="lbl" style={{ marginBottom: 4 }}>📷 QR Code Scanner</div>
        <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>
          Scan QR code untuk melihat history atau mulai inspeksi unit
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="scan-input-dsk"
            name="scan-dsk"
            aria-label="No. Unit atau kode QR..."
            value={scan}
            onChange={(e) => { setScan(e.target.value); setScanRes(null) }}
            onKeyDown={(e) => e.key === 'Enter' && findUnit(scan)}
            placeholder="No. Unit atau kode QR..."
            style={{ flex: 1 }}
          />
          <button
            type="button"
            onClick={() => onOpenScanner?.()}
            title="Buka kamera"
            style={{ padding: '0 14px', borderRadius: 8, border: '1.5px solid var(--bd)', background: 'var(--sf)', color: 'var(--t)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 44, transition: 'all .15s' }}
          >
            📷
          </button>
          <button type="button" className="btn-y" onClick={() => findUnit(scan)}>SCAN</button>
        </div>

        {scanRes === 'notfound' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, background: 'var(--errbg)', border: '1px solid var(--errbd)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--err)', fontWeight: 600 }}>
            ⚠ Unit &quot;<strong>{scan}</strong>&quot; tidak ditemukan
          </div>
        )}

        {scanRes && scanRes !== 'notfound' && (
          <div style={{ background: 'var(--sfy)', border: '1.5px solid var(--wnbd)', borderRadius: 10, padding: 14, marginTop: 10 }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--pd)' }}>{scanRes.nomor_unit}</span>
                <span style={{ fontSize: 12, color: 'var(--t3)' }}>{scanRes.brand} {scanRes.tipe}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                {scanRes.model} · Tahun {scanRes.tahun} · HM:{' '}
                <strong className="mono" style={{ color: 'var(--pd)' }}>
                  {(units.find(u => u.id === scanRes.id)?.hm ?? scanRes.hm)?.toLocaleString()} jam
                </strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>
                Total inspeksi: <strong style={{ color: 'var(--t)' }}>{inspections.filter(i => i.unit_id === scanRes.id).length}x</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn-g btn-sm" onClick={() => window.open(`/u/${encodeURIComponent(scanRes.qr_code || scanRes.nomor_unit)}`, '_blank')}>
                📋 Lihat History
              </button>
              {schedules.find(sch => sch.unit_id === scanRes.id && sch.tanggal === TODAY && sch.status === 'scheduled') && canInspect && (
                <button type="button" className="btn-y btn-sm" onClick={() => { setSelUnit(scanRes); setPage('inspection') }}>
                  ⚡ Mulai Inspeksi
                </button>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}