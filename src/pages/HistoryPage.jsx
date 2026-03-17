import { useState } from 'react'
import Badge from '../components/Badge'
import WorkStatusBadge from '../components/WorkStatusBadge'
import { api } from '../lib/api'

const WORK_OPTIONS = [
  { v: 'belum_dikerjakan',  l: 'Belum Dikerjakan', c: 'var(--err)' },
  { v: 'sedang_dikerjakan', l: 'Sedang Dikerjakan', c: 'var(--wn)'  },
  { v: 'sudah_selesai',     l: 'Sudah Selesai',    c: 'var(--ok)'  },
]

const TODAY  = new Date().toISOString().split('T')[0]
const WEEK   = new Date(Date.now() - 7  * 86400000).toISOString().split('T')[0]
const MONTH  = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

function fmtDate(d) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDuration(start, finish) {
  if (!start || !finish) return '-'
  const [sh, sm] = start.split(':').map(Number)
  const [fh, fm] = finish.split(':').map(Number)
  const diff = (fh * 60 + fm) - (sh * 60 + sm)
  if (diff <= 0) return '-'
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return h > 0 ? `${h} jam ${m} menit` : `${m} menit`
}

function inRange(tanggal, from, to) {
  const d = new Date(tanggal).toISOString().split('T')[0]
  if (from && d < from) return false
  if (to   && d > to)   return false
  return true
}

// ─── Shared: DateFilter ───────────────────────────────────────────────
function DateFilter({ from, to, setFrom, setTo }) {
  const [preset, setPreset] = useState('all')

  const applyPreset = (p) => {
    setPreset(p)
    if (p === 'today')  { setFrom(TODAY); setTo(TODAY)  }
    if (p === 'week')   { setFrom(WEEK);  setTo(TODAY)  }
    if (p === 'month')  { setFrom(MONTH); setTo(TODAY)  }
    if (p === 'all')    { setFrom('');    setTo('')     }
    if (p === 'custom') { /* biarkan user isi manual */ }
  }

  return (
    <div style={{ background: 'var(--bd2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
        Filter Tanggal
      </div>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {[
          { k: 'all',    l: 'Semua'       },
          { k: 'today',  l: 'Hari Ini'    },
          { k: 'week',   l: '7 Hari'      },
          { k: 'month',  l: '30 Hari'     },
          { k: 'custom', l: 'Custom'      },
        ].map(p => (
          <button key={p.k} onClick={() => applyPreset(p.k)}
            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', background: preset === p.k ? 'var(--p)' : 'transparent', color: preset === p.k ? '#1c1917' : 'var(--t3)', borderColor: preset === p.k ? 'var(--p)' : 'var(--bd)', transition: 'all .15s' }}>
            {p.l}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {(preset === 'custom' || (from && to)) && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--t3)', whiteSpace: 'nowrap' }}>Dari</span>
            <input type="date" value={from} max={to || TODAY}
              onChange={e => { setFrom(e.target.value); setPreset('custom') }}
              style={{ fontSize: 12, padding: '5px 8px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--t3)', whiteSpace: 'nowrap' }}>Sampai</span>
            <input type="date" value={to} min={from} max={TODAY}
              onChange={e => { setTo(e.target.value); setPreset('custom') }}
              style={{ fontSize: 12, padding: '5px 8px' }} />
          </div>
          {(from || to) && (
            <button onClick={() => applyPreset('all')}
              style={{ fontSize: 11, color: 'var(--err)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', fontWeight: 700 }}>
              ✕ Reset
            </button>
          )}
        </div>
      )}

      {/* Tampilkan range aktif */}
      {(from || to) && preset !== 'custom' && (
        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
          {from && to ? `${fmtDate(from)} — ${fmtDate(to)}` : from ? `Dari ${fmtDate(from)}` : `Sampai ${fmtDate(to)}`}
        </div>
      )}
    </div>
  )
}

// ─── Shared: DamageCard ───────────────────────────────────────────────
function DamageCard({ r, user, updating, onWorkStatus }) {
  const isSelesai = r.detail?.work_status === 'sudah_selesai'
  const canEdit   = !isSelesai || user.role === 'admin'
  const detailType = r.type === 'bad' ? 'part_order' : 'repair'
  const updKey     = `${detailType}-${r.detail?._id}`

  return (
    <div className="card" style={{ borderLeft: `3px solid ${r.type === 'bad' ? 'var(--err)' : 'var(--wn)'}`, borderRadius: '0 12px 12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--pd)' }}>{r.u?.nomor_unit || ins.unit_nomor}</span>
            <span style={{ fontSize: 11, color: 'var(--t3)' }}>{r.u?.brand} {r.u?.tipe}</span>
            <Badge type={r.type === 'bad' ? 'bad' : 'repair'} />
            {r.detail?.work_status && <WorkStatusBadge status={r.detail.work_status} />}
            {r.type === 'bad' && r.detail?.status && <Badge type={r.detail.status} />}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t)' }}>{r.q?.pertanyaan}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>{r.q?.kategori} · {r.mechs}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>{fmtDate(r.tanggal)}</div>
          <div style={{ marginTop: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--t3)' }}>HM: </span>
            <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--pd)' }}>
              {r.hm?.toLocaleString()} jam
            </span>
          </div>
        </div>
      </div>

      {r.type === 'bad' && r.detail && (
        <div style={{ background: 'var(--errbg)', border: '1px solid var(--errbd)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, fontSize: 12, marginBottom: r.detail.keterangan ? 6 : 0 }} className="g3">
            <div><span style={{ color: 'var(--t3)' }}>Part: </span><strong style={{ color: 'var(--t)' }}>{r.detail.part_name}</strong></div>
            <div><span style={{ color: 'var(--t3)' }}>P/N: </span><span className="mono">{r.detail.part_number || '-'}</span></div>
            <div><span style={{ color: 'var(--t3)' }}>Qty: </span><strong>{r.detail.quantity}</strong></div>
          </div>
          {r.detail.keterangan && <div style={{ fontSize: 11, color: 'var(--t2)' }}>{r.detail.keterangan}</div>}
        </div>
      )}

      {r.type === 'repair' && r.detail && (
        <div style={{ background: 'var(--wnbg)', border: '1px solid var(--wnbd)', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 12, color: 'var(--t2)' }}>
          🔧 {r.detail.keterangan || '-'}
        </div>
      )}

      {r.detail && (
        <div>
          {isSelesai && user.role !== 'admin' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--ok)', background: 'var(--okbg)', border: '1px solid var(--okbd)', borderRadius: 8, padding: '6px 12px' }}>
              <span>✓</span>
              <span>Sudah selesai — hanya Admin yang dapat mengubah</span>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Status Pengerjaan
                {isSelesai && user.role === 'admin' && (
                  <span style={{ marginLeft: 8, color: 'var(--pur)', background: 'var(--purbg)', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>Admin Override</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {WORK_OPTIONS.map(opt => {
                  const isCurrent  = r.detail.work_status === opt.v
                  const isDisabled = updating === updKey || isCurrent
                  return (
                    <button key={opt.v}
                      onClick={() => onWorkStatus(r.detail._id, detailType, opt.v, r.detail.work_status)}
                      disabled={isDisabled}
                      style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: isDisabled ? 'not-allowed' : 'pointer', border: `1.5px solid ${opt.c}`, background: isCurrent ? opt.c : 'transparent', color: isCurrent ? '#fff' : opt.c, opacity: isDisabled && !isCurrent ? 0.4 : 1, transition: 'all .15s' }}>
                      {opt.l}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: 48, color: 'var(--t3)' }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>Tidak ada data</div>
    </div>
  )
}

// ─── Tab: History Inspeksi ────────────────────────────────────────────
function TabInspeksi({ data }) {
  const { units, inspections } = data
  const [unitF, setUnitF] = useState('all')
  const [from,  setFrom]  = useState('')
  const [to,    setTo]    = useState('')

  const filtered = inspections
    .filter(i =>
      (unitF === 'all' || i.unit_id === parseInt(unitF)) &&
      inRange(i.tanggal, from, to)
    )
    .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))

  return (
    <div>
      <DateFilter from={from} to={to} setFrom={setFrom} setTo={setTo} />

      <div style={{ marginBottom: 14 }}>
        <select value={unitF} onChange={e => setUnitF(e.target.value)} style={{ minWidth: 200 }}>
          <option value="all">Semua Unit</option>
          {units.map(u => <option key={u._id} value={u._id}>{u.nomor_unit} — {u.tipe}</option>)}
        </select>
      </div>

      <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>{filtered.length} inspeksi</div>

      {filtered.length === 0 && <EmptyState />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(ins => {
          const u      = ins.unit || units.find(x => x._id === ins.unit_id)
          const mechs  = (ins.mekaniks || []).map(m => m.user_nama).filter(Boolean).join(', ')
          const gl     = ins.group_leader?.nama || '-'
          const dur    = fmtDuration(ins.jam_start, ins.jam_finish)
          const good   = (ins.answers || []).filter(a => a.answer === 'good').length
          const bad    = (ins.answers || []).filter(a => a.answer === 'bad').length
          const repair = (ins.answers || []).filter(a => a.answer === 'repair').length

          return (
            <div key={ins._id} className="card" style={{ borderLeft: '3px solid var(--p)', borderRadius: '0 12px 12px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: 'var(--pd)' }}>{u?.nomor_unit || ins.unit_nomor}</span>
                    <span style={{ fontSize: 12, color: 'var(--t3)' }}>{u?.brand} {u?.tipe}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>GL: <strong style={{ color: 'var(--t2)' }}>{gl}</strong></div>
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>Mekanik: <strong style={{ color: 'var(--t2)' }}>{mechs || '-'}</strong></div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t)' }}>{fmtDate(ins.tanggal)}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{ins.jam_start} – {ins.jam_finish}</div>
                  <div style={{ marginTop: 2 }}>
                    <span style={{ background: 'var(--pl)', color: 'var(--pd)', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                      ⏱ {dur}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { l: 'HM',     v: `${ins.hour_meter?.toLocaleString()} jam`, c: 'var(--p)',   bg: 'var(--pl)'    },
                  { l: 'Good',   v: good,   c: 'var(--ok)',  bg: 'var(--okbg)'  },
                  { l: 'Bad',    v: bad,    c: 'var(--err)', bg: 'var(--errbg)' },
                  { l: 'Repair', v: repair, c: 'var(--wn)',  bg: 'var(--wnbg)'  },
                ].map(s => (
                  <div key={s.l} style={{ background: s.bg, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: s.c, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.l}</div>
                    <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab: History Kerusakan ───────────────────────────────────────────
function TabKerusakan({ data, user, refetch }) {
  const { units, inspections } = data
  const [unitF,    setUnitF]    = useState('all')
  const [typeF,    setTypeF]    = useState('all')
  const [from,     setFrom]     = useState('')
  const [to,       setTo]       = useState('')
  const [updating, setUpdating] = useState(null)

  const rows = []
  inspections.forEach(ins => {
    const u     = ins.unit || units.find(x => x._id === ins.unit_id)
    const mechs = (ins.mekaniks || []).map(m => m.user_nama).filter(Boolean).join(', ')
    ;(ins.answers || []).forEach(a => {
      if ((a.answer === 'bad' || a.answer === 'repair') && inRange(ins.tanggal, from, to)) {
        rows.push({
          key:    `${ins._id}-${a._id}`,
          tanggal: ins.tanggal,
          hm:     ins.hour_meter,
          u, mechs,
          q:      a.question,
          type:   a.answer,
          detail: a.answer === 'bad' ? a.part_order : a.repair,
        })
      }
    })
  })

  const filtered = rows
    .filter(r => (unitF === 'all' || r.u?._id === parseInt(unitF)) && (typeF === 'all' || r.type === typeF))
    .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))

  const handleWorkStatus = async (detailId, type, newStatus, currentStatus) => {
    if (currentStatus === 'sudah_selesai' && user.role !== 'admin') {
      alert('Hanya Admin yang bisa mengubah status yang sudah selesai.')
      return
    }
    setUpdating(`${type}-${detailId}`)
    try {
      await api.updateWorkStatus(detailId, type, { work_status: newStatus })
      await refetch()
    } catch (e) {
      alert('Gagal: ' + e.message)
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div>
      <DateFilter from={from} to={to} setFrom={setFrom} setTo={setTo} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={unitF} onChange={e => setUnitF(e.target.value)} style={{ minWidth: 180 }}>
          <option value="all">Semua Unit</option>
          {units.map(u => <option key={u._id} value={u._id}>{u.nomor_unit} — {u.tipe}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['all','Semua'],['bad','Order Part'],['repair','Repair']].map(([f,l]) => (
            <button key={f} onClick={() => setTypeF(f)}
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', background: typeF === f ? 'var(--p)' : 'transparent', color: typeF === f ? '#1c1917' : 'var(--t3)', borderColor: typeF === f ? 'var(--p)' : 'var(--bd)', transition: 'all .15s' }}>
              {l}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 'auto' }}>{filtered.length} record</span>
      </div>

      {filtered.length === 0 && <EmptyState />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(r => (
          <DamageCard key={r.key} r={r} user={user} updating={updating} onWorkStatus={handleWorkStatus} />
        ))}
      </div>
    </div>
  )
}

// ─── Tab: Filter by Work Status ───────────────────────────────────────
function TabWorkStatus({ data, user, refetch, filterStatus }) {
  const { units, inspections } = data
  const [unitF,    setUnitF]    = useState('all')
  const [from,     setFrom]     = useState('')
  const [to,       setTo]       = useState('')
  const [updating, setUpdating] = useState(null)

  const rows = []
  inspections.forEach(ins => {
    if (!inRange(ins.tanggal, from, to)) return
    const u     = ins.unit || units.find(x => x._id === ins.unit_id)
    const mechs = (ins.mekaniks || []).map(m => m.user_nama).filter(Boolean).join(', ')
    ;(ins.answers || []).forEach(a => {
      const detail = a.answer === 'bad' ? a.part_order : a.answer === 'repair' ? a.repair : null
      if (!detail) return
      const matchOrder = filterStatus === 'order_part'       && a.answer === 'bad' && detail.status === 'pending'
      const matchWork  = filterStatus !== 'order_part'       && detail.work_status === filterStatus
      if (matchOrder || matchWork) {
        rows.push({
          key: `${ins._id}-${a._id}`,
          tanggal: ins.tanggal, hm: ins.hour_meter,
          u, mechs, q: a.question, type: a.answer, detail,
        })
      }
    })
  })

  const filtered = rows
    .filter(r => unitF === 'all' || r.u?._id === parseInt(unitF))
    .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))

  const handleWorkStatus = async (detailId, type, newStatus, currentStatus) => {
    if (currentStatus === 'sudah_selesai' && user.role !== 'admin') {
      alert('Hanya Admin yang bisa mengubah status yang sudah selesai.')
      return
    }
    setUpdating(`${type}-${detailId}`)
    try {
      await api.updateWorkStatus(detailId, type, { work_status: newStatus })
      await refetch()
    } catch (e) {
      alert('Gagal: ' + e.message)
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div>
      <DateFilter from={from} to={to} setFrom={setFrom} setTo={setTo} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={unitF} onChange={e => setUnitF(e.target.value)} style={{ minWidth: 180 }}>
          <option value="all">Semua Unit</option>
          {units.map(u => <option key={u._id} value={u._id}>{u.nomor_unit} — {u.tipe}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 'auto' }}>{filtered.length} item</span>
      </div>

      {filtered.length === 0 && <EmptyState />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(r => (
          <DamageCard key={r.key} r={r} user={user} updating={updating} onWorkStatus={handleWorkStatus} />
        ))}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────
const TABS = [
  { k: 'kerusakan',         l: '🔴 Kerusakan'        },
  { k: 'inspeksi',          l: '📋 Inspeksi'          },
  { k: 'belum_dikerjakan',  l: '⏳ Belum Dikerjakan'  },
  { k: 'sedang_dikerjakan', l: '🔧 Sedang Dikerjakan' },
  { k: 'order_part',        l: '📦 Sedang Order'      },
  { k: 'sudah_selesai',     l: '✅ Selesai'           },
]

export default function HistoryPage({ data, user, refetch }) {
  const [tab, setTab] = useState('kerusakan')

  return (
    <div className="fade">
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t)', marginBottom: 4 }}>History</h1>
      <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 14 }}>Riwayat inspeksi & kerusakan unit alat berat</p>

      {/* Tab bar — horizontal scroll di mobile */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 6, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', whiteSpace: 'nowrap', flexShrink: 0, background: tab === t.k ? 'var(--p)' : 'transparent', color: tab === t.k ? '#1c1917' : 'var(--t3)', borderColor: tab === t.k ? 'var(--p)' : 'var(--bd)', transition: 'all .15s' }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'kerusakan'         && <TabKerusakan   data={data} user={user} refetch={refetch} />}
      {tab === 'inspeksi'          && <TabInspeksi    data={data} />}
      {tab === 'belum_dikerjakan'  && <TabWorkStatus  data={data} user={user} refetch={refetch} filterStatus="belum_dikerjakan"  />}
      {tab === 'sedang_dikerjakan' && <TabWorkStatus  data={data} user={user} refetch={refetch} filterStatus="sedang_dikerjakan" />}
      {tab === 'order_part'        && <TabWorkStatus  data={data} user={user} refetch={refetch} filterStatus="order_part"        />}
      {tab === 'sudah_selesai'     && <TabWorkStatus  data={data} user={user} refetch={refetch} filterStatus="sudah_selesai"     />}
    </div>
  )
}