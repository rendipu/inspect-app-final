import { useState, useEffect } from 'react'

const BASE = import.meta.env.VITE_API_URL || ''

function fmtDate(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

function fmtDateTime(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function fmtDuration(start, finish) {
  if (!start || !finish) return '-'
  const [sh, sm] = start.split(':').map(Number)
  const [fh, fm] = finish.split(':').map(Number)
  const diff = (fh * 60 + fm) - (sh * 60 + sm)
  if (diff <= 0) return '-'
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return h > 0 ? `${h}j ${m}m` : `${m}m`
}

// Badge status
function StatusBadge({ answer }) {
  const cfg = {
    good:   { bg: '#f0fdf4', c: '#16a34a', bd: '#bbf7d0', l: 'Good'   },
    bad:    { bg: '#fef2f2', c: '#dc2626', bd: '#fecaca', l: 'Order'  },
    repair: { bg: '#fffbeb', c: '#d97706', bd: '#fde68a', l: 'Repair' },
  }[answer] || { bg: '#f5f5f4', c: '#78716c', bd: '#e7e5e4', l: answer }
  return (
    <span style={{ background: cfg.bg, color: cfg.c, border: `1px solid ${cfg.bd}`, padding: '1px 7px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
      {cfg.l}
    </span>
  )
}

export default function PublicUnitPage({ qrCode }) {
  const [state, setState] = useState({ loading: true, error: null, unit: null, inspections: [], hmLogs: [] })
  const [expandedId, setExpandedId] = useState(null)
  const [tab, setTab] = useState('inspeksi') // inspeksi | hm

  useEffect(() => {
  fetch(`${BASE}/api/public/unit/${encodeURIComponent(qrCode)}`)
    .then(async r => {
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Unit tidak ditemukan')
      setState({ loading: false, error: null, ...d })
    })
    .catch(e => setState(s => ({ ...s, loading: false, error: e.message })))
}, [qrCode])

  if (state.loading) return (
    <div style={{ minHeight: '100vh', background: '#fafaf7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 44, height: 44, border: '3px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <div style={{ fontSize: 13, color: '#78716c' }}>Memuat data unit...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (state.error) return (
    <div style={{ minHeight: '100vh', background: '#fafaf7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 20, textAlign: 'center' }}>
      <div style={{ fontSize: 48 }}>🚫</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1c1917' }}>Unit Tidak Ditemukan</div>
      <div style={{ fontSize: 13, color: '#78716c' }}>{state.error}</div>
    </div>
  )

  const { unit, inspections, hmLogs } = state

  // Summary stats
  const totalInsp    = inspections.length
  const totalBad     = inspections.reduce((s, i) => s + (i.answers || []).filter(a => a.answer === 'bad').length, 0)
  const totalRepair  = inspections.reduce((s, i) => s + (i.answers || []).filter(a => a.answer === 'repair').length, 0)
  const lastInsp     = inspections[0]

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf7', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 14, color: '#1c1917' }}>

      {/* Header */}
      <div style={{ background: '#1c1917', padding: '20px 20px 0' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {/* Logo + App name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, background: '#f59e0b', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#1c1917', flexShrink: 0 }}>⚙</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '.05em' }}>MINEINSPECT</div>
              <div style={{ fontSize: 10, color: '#78716c' }}>Heavy Equipment Inspection</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 10, color: '#57534e', background: '#292524', padding: '3px 8px', borderRadius: 20 }}>
              Public View
            </div>
          </div>

          {/* Unit info card */}
          <div style={{ background: '#292524', borderRadius: '12px 12px 0 0', padding: '20px 20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace', letterSpacing: '.03em' }}>{unit.nomor_unit}</div>
                <div style={{ fontSize: 14, color: '#d4d4d4', marginTop: 2 }}>{unit.brand} {unit.tipe} {unit.model && `· ${unit.model}`}</div>
                <div style={{ fontSize: 12, color: '#78716c', marginTop: 4 }}>Tahun {unit.tahun || '-'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#78716c', textTransform: 'uppercase', letterSpacing: '.06em' }}>Hour Meter</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{unit.hm?.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: '#78716c' }}>jam</div>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 16 }}>
              {[
                { l: 'Total Inspeksi', v: totalInsp,   c: '#f59e0b' },
                { l: 'Order Part',     v: totalBad,    c: '#ef4444' },
                { l: 'Repair',         v: totalRepair, c: '#f97316' },
              ].map(s => (
                <div key={s.l} style={{ background: '#1c1917', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#78716c', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{s.l}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.c, fontFamily: 'monospace' }}>{s.v}</div>
                </div>
              ))}
            </div>

            {lastInsp && (
              <div style={{ marginTop: 12, fontSize: 11, color: '#78716c', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🕐</span>
                <span>Inspeksi terakhir: <strong style={{ color: '#a8a29e' }}>{fmtDate(lastInsp.tanggal)}</strong> oleh {lastInsp.mekaniks?.map(m => m.user_nama).join(', ') || '-'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 40px' }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid #e7e5e4', marginTop: 0 }}>
          {[
            { k: 'inspeksi', l: '📋 History Inspeksi' },
            { k: 'hm',       l: '⏱ Hour Meter' },
          ].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              style={{ padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === t.k ? '#f59e0b' : 'transparent'}`, marginBottom: -2, fontSize: 13, fontWeight: tab === t.k ? 700 : 500, color: tab === t.k ? '#f59e0b' : '#78716c', cursor: 'pointer', transition: 'all .15s' }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* ── Tab: Inspeksi ── */}
        {tab === 'inspeksi' && (
          <div>
            {inspections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: '#78716c' }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
                <div style={{ fontWeight: 600 }}>Belum ada data inspeksi</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {inspections.map(ins => {
                  const bad    = (ins.answers || []).filter(a => a.answer === 'bad').length
                  const repair = (ins.answers || []).filter(a => a.answer === 'repair').length
                  const good   = (ins.answers || []).filter(a => a.answer === 'good').length
                  const isOpen = expandedId === ins.id

                  return (
                    <div key={ins.id} style={{ background: '#fff', border: '1.5px solid #e7e5e4', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                      {/* Card header — klik untuk expand */}
                      <button onClick={() => setExpandedId(isOpen ? null : ins.id)}
                        style={{ width: '100%', background: 'transparent', border: 'none', padding: '14px 16px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1917' }}>{fmtDate(ins.tanggal)}</span>
                            <span style={{ fontSize: 11, color: '#78716c' }}>{ins.jam_start} – {ins.jam_finish} · {fmtDuration(ins.jam_start, ins.jam_finish)}</span>
                          </div>
                          <div style={{ fontSize: 12, color: '#57534e' }}>
                            GL: <strong>{ins.group_leader_nama}</strong> ·
                            Mekanik: <strong>{(ins.mekaniks || []).map(m => m.user_nama).join(', ') || '-'}</strong>
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                            <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
                              HM {ins.hour_meter?.toLocaleString()}
                            </span>
                            {good   > 0 && <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>✓ {good} Good</span>}
                            {bad    > 0 && <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>⚠ {bad} Order</span>}
                            {repair > 0 && <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a', padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>🔧 {repair} Repair</span>}
                          </div>
                        </div>
                        <span style={{ fontSize: 18, color: '#a8a29e', flexShrink: 0, marginLeft: 8, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>⌄</span>
                      </button>

                      {/* Detail answers — hanya tampil jika di-expand */}
                      {isOpen && (
                        <div style={{ borderTop: '1.5px solid #f5f5f4', padding: '12px 16px', background: '#fafaf7' }}>
                          {(ins.answers || []).filter(a => a.answer !== 'good').length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '12px 0', color: '#16a34a', fontWeight: 600, fontSize: 13 }}>
                              ✓ Semua kondisi Good
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ fontSize: 11, color: '#78716c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
                                Temuan Kerusakan
                              </div>
                              {(ins.answers || []).filter(a => a.answer !== 'good').map((a, i) => (
                                <div key={i} style={{ background: '#fff', border: '1.5px solid #e7e5e4', borderRadius: 8, padding: '10px 12px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: a.part_order || a.repair ? 8 : 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1917' }}>{a.question_pertanyaan}</div>
                                    <StatusBadge answer={a.answer} />
                                  </div>
                                  {a.part_order && (
                                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '7px 10px', fontSize: 12 }}>
                                      <div style={{ color: '#dc2626', fontWeight: 700, marginBottom: 4 }}>📦 Order Part</div>
                                      <div style={{ color: '#57534e', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                        <span>Part: <strong>{a.part_order.part_name}</strong></span>
                                        {a.part_order.part_number && <span>P/N: <strong style={{ fontFamily: 'monospace' }}>{a.part_order.part_number}</strong></span>}
                                        <span>Qty: <strong>{a.part_order.quantity}</strong></span>
                                        <span style={{ background: a.part_order.status === 'approved' ? '#f0fdf4' : a.part_order.status === 'rejected' ? '#fef2f2' : '#fffbeb', color: a.part_order.status === 'approved' ? '#16a34a' : a.part_order.status === 'rejected' ? '#dc2626' : '#d97706', padding: '1px 7px', borderRadius: 20, fontWeight: 700 }}>
                                          {a.part_order.status}
                                        </span>
                                      </div>
                                      {a.part_order.keterangan && <div style={{ color: '#78716c', marginTop: 4 }}>{a.part_order.keterangan}</div>}
                                    </div>
                                  )}
                                  {a.repair && (
                                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '7px 10px', fontSize: 12 }}>
                                      <div style={{ color: '#d97706', fontWeight: 700, marginBottom: 2 }}>🔧 Repair</div>
                                      <div style={{ color: '#57534e' }}>{a.repair.keterangan || '-'}</div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Hour Meter ── */}
        {tab === 'hm' && (
          <div>
            <div style={{ background: '#fff', border: '1.5px solid #e7e5e4', borderRadius: 12, padding: '16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, color: '#78716c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>HM Terkini</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#1c1917', fontFamily: 'monospace', lineHeight: 1.2 }}>{unit.hm?.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: '#78716c' }}>jam operasional</div>
              </div>
              <div style={{ fontSize: 40 }}>⏱</div>
            </div>

            {hmLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 20px', color: '#78716c' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div>Belum ada riwayat update HM</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, color: '#78716c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Riwayat Update</div>
                {hmLogs.map(log => (
                  <div key={log.id} style={{ background: '#fff', border: '1.5px solid #e7e5e4', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16 }}>{log.hm_before?.toLocaleString()}</span>
                        <span style={{ color: '#78716c' }}>→</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: '#16a34a' }}>{log.hm_after?.toLocaleString()}</span>
                        <span style={{ fontSize: 11, color: '#78716c' }}>jam</span>
                        <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>+{(log.hm_after - log.hm_before)?.toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#78716c', marginTop: 3 }}>
                        {fmtDateTime(log.createdAt)} · oleh {log.user_nama}
                      </div>
                      {log.catatan && <div style={{ fontSize: 11, color: '#57534e', marginTop: 3 }}>📝 {log.catatan}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 32, textAlign: 'center', color: '#a8a29e', fontSize: 11, paddingTop: 16, borderTop: '1px solid #e7e5e4' }}>
          <div style={{ marginBottom: 4 }}>⚙ MineInspect — Heavy Equipment Inspection System</div>
          <div>Data diperbarui secara real-time</div>
        </div>
      </div>
    </div>
  )
}