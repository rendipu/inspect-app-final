import { useState, useMemo } from 'react'
import Badge from '../components/Badge'
import { api } from '../lib/api'

// ── helpers ────────────────────────────────────────────────────────────────────
function fmtDate(d) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
const getLocalYMD = (d = new Date()) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
const TODAY = getLocalYMD()
const WEEK  = getLocalYMD(new Date(Date.now() - 7  * 86400000))
const MONTH = getLocalYMD(new Date(Date.now() - 30 * 86400000))

function inRange(tanggal, from, to) {
  const d = (tanggal || '').slice(0, 10)
  if (from && d < from) return false
  if (to   && d > to)   return false
  return true
}

// Planner status — stored in work_status field
const PLANNER_STATUSES = [
  { v: 'belum_dikerjakan', l: '⏺ Pending',        c: '#dc2626', bg: '#fef2f2' },
  { v: 'sudah_diorder',    l: '🛒 Sudah Diorder',  c: '#2563eb', bg: '#eff6ff' },
  { v: 'full_supply',      l: '📦 Full Supply',     c: '#15803d', bg: '#f0fdf4' },
]

// ── DateFilter ─────────────────────────────────────────────────────────────────
function DateFilter({ from, to, setFrom, setTo }) {
  const [preset, setPreset] = useState('all')
  const apply = (p) => {
    setPreset(p)
    if (p === 'today') { setFrom(TODAY); setTo(TODAY) }
    if (p === 'week')  { setFrom(WEEK);  setTo(TODAY) }
    if (p === 'month') { setFrom(MONTH); setTo(TODAY) }
    if (p === 'all')   { setFrom('');    setTo('')    }
  }
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
      {[['all','Semua'],['today','Hari Ini'],['week','7 Hari'],['month','30 Hari']].map(([k, l]) => (
        <button key={k} onClick={() => apply(k)}
          style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', background: preset === k ? 'var(--p)' : 'transparent', color: preset === k ? '#1c1917' : 'var(--t3)', borderColor: preset === k ? 'var(--p)' : 'var(--bd)', transition: 'all .15s' }}>
          {l}
        </button>
      ))}
      <input type="date" value={from} max={to || TODAY}
        onChange={e => { setFrom(e.target.value); setPreset('custom') }}
        style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'var(--sf)', color: 'var(--t)' }} />
      <span style={{ fontSize: 12, color: 'var(--t3)' }}>–</span>
      <input type="date" value={to} min={from} max={TODAY}
        onChange={e => { setTo(e.target.value); setPreset('custom') }}
        style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1.5px solid var(--bd)', background: 'var(--sf)', color: 'var(--t)' }} />
      {(from || to) && (
        <button onClick={() => apply('all')} style={{ fontSize: 11, color: 'var(--err)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕ Reset</button>
      )}
    </div>
  )
}

// ── OrderCard ──────────────────────────────────────────────────────────────────
function OrderCard({ o, updating, onApprove, onPlannerStatus }) {
  const ws        = o.po.work_status || 'belum_dikerjakan'
  const isOrdered = ws === 'sudah_diorder'
  const isFull    = ws === 'full_supply'
  const isPending = o.po.status === 'pending'
  const isApproved= o.po.status === 'approved' || o.po.status === 'approved_planner'

  const borderColor = isFull ? '#4ade80' : isOrdered ? '#93c5fd' : isPending ? 'var(--wn)' : 'var(--ok)'

  return (
    <div className="card" style={{ borderLeft: `3px solid ${borderColor}`, borderRadius: '0 12px 12px 0', transition: 'border-color .2s' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontWeight: 700, color: 'var(--pd)', fontSize: 14 }}>{o.u?.nomor_unit || o.unit_nomor}</span>
            <span style={{ fontSize: 11, color: 'var(--t3)' }}>{o.u?.brand} {o.u?.tipe}</span>
            <Badge type={o.po.status === 'pending' ? 'pending' : 'approved'} />
            {isOrdered && <Badge type="sudah_diorder" />}
            {isFull    && <Badge type="full_supply" />}
          </div>
          <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 2 }}>{o.pertanyaan}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>
            {o.mechs} · {fmtDate(o.tanggal)} · HM: <strong style={{ color: 'var(--pd)' }}>{o.hm?.toLocaleString()} jam</strong>
          </div>
        </div>
      </div>

      {/* Part Info */}
      <div style={{ background: 'var(--bd2)', borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12, marginBottom: 12 }} className="g2c">
        <div><span style={{ color: 'var(--t3)' }}>Part Name: </span><strong style={{ color: 'var(--t)' }}>{o.po.part_name}</strong></div>
        <div><span style={{ color: 'var(--t3)' }}>Part No: </span><span className="mono">{o.po.part_number || '-'}</span></div>
        <div><span style={{ color: 'var(--t3)' }}>Qty: </span><strong>{o.po.quantity}</strong></div>
        <div><span style={{ color: 'var(--t3)' }}>Ket: </span>{o.po.keterangan || '-'}</div>
      </div>

      {/* Foto */}
      {o.po.foto_url && (
        <div style={{ marginBottom: 12 }}>
          <a href={o.po.foto_url} target="_blank" rel="noreferrer">
            <img src={o.po.foto_url} alt="Foto kondisi" style={{ maxWidth: 200, maxHeight: 130, borderRadius: 6, objectFit: 'cover', border: '1.5px solid var(--errbd)', cursor: 'pointer' }} />
          </a>
        </div>
      )}

      {/* Approve (jika masih pending) */}
      {isPending && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Persetujuan Planner
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onApprove(o.po.id, 'approved')}
              disabled={!!updating}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: updating ? 'var(--bd)' : '#16a34a', color: '#fff', fontSize: 13, fontWeight: 700, cursor: updating ? 'not-allowed' : 'pointer', transition: 'all .15s', opacity: updating ? 0.6 : 1 }}>
              {updating ? '⏳...' : '✓ Approve'}
            </button>
            <button
              onClick={() => onApprove(o.po.id, 'rejected')}
              disabled={!!updating}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: updating ? 'var(--bd)' : '#dc2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: updating ? 'not-allowed' : 'pointer', transition: 'all .15s', opacity: updating ? 0.6 : 1 }}>
              ✕ Tolak
            </button>
          </div>
        </div>
      )}

      {/* Planner Status Buttons */}
      {(isApproved || isOrdered || isFull) && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Status Pengadaan (Planner)
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PLANNER_STATUSES.filter(s => s.v !== 'belum_dikerjakan').map(st => {
              const isCurrent = ws === st.v
              const isDisabled = !!updating || isCurrent ||
                (st.v === 'sudah_diorder' && isFull) // tidak bisa mundur dari full_supply
              return (
                <button key={st.v}
                  onClick={() => !isDisabled && onPlannerStatus(o.po.id, st.v)}
                  disabled={isDisabled}
                  style={{
                    padding: '8px 18px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    border: `1.5px solid ${st.c}`,
                    background: isCurrent ? st.c : 'transparent',
                    color: isCurrent ? '#fff' : st.c,
                    opacity: isDisabled && !isCurrent ? 0.4 : 1,
                    transition: 'all .15s',
                  }}>
                  {updating === `ps-${o.po.id}` && !isCurrent ? '⏳' : st.l}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { k: 'all',            l: '📋 Semua'          },
  { k: 'pending',        l: '⏺ Menunggu'        },
  { k: 'approved',       l: '✓ Disetujui'       },
  { k: 'sudah_diorder',  l: '🛒 Sudah Diorder'  },
  { k: 'full_supply',    l: '📦 Full Supply'     },
]

export default function PlannerOrders({ data, user, refetch }) {
  const { units, inspections } = data
  const [tab,      setTab]      = useState('all')
  const [unitF,    setUnitF]    = useState('all')
  const [from,     setFrom]     = useState('')
  const [to,       setTo]       = useState('')
  const [updating, setUpdating] = useState(null)

  // Kumpulkan semua part_order dari semua inspeksi
  const allOrders = useMemo(() => {
    const rows = []
    inspections.forEach(ins => {
      const u     = ins.unit || units.find(x => x.id === ins.unit_id)
      const mechs = (ins.mekaniks || []).map(m => m.user_nama).filter(Boolean).join(', ')
      ;(ins.answers || []).forEach(a => {
        if (a.answer === 'bad' && a.part_order && a.part_order.id) {
          rows.push({
            u,
            hm:         ins.hour_meter,
            tanggal:    ins.tanggal,
            unit_nomor: ins.unit_nomor,
            mechs,
            pertanyaan: a.question_pertanyaan,
            po:         a.part_order,
          })
        }
        // Repair yang butuh part
        if (a.answer === 'repair' && a.repair?.needs_part && a.part_order && a.part_order.id) {
          rows.push({
            u,
            hm:         ins.hour_meter,
            tanggal:    ins.tanggal,
            unit_nomor: ins.unit_nomor,
            mechs,
            pertanyaan: `[Repair] ${a.question_pertanyaan}`,
            po:         a.part_order,
          })
        }
      })
    })
    return rows
  }, [inspections, units])

  const filtered = useMemo(() => {
    return allOrders.filter(o => {
      const matchUnit = unitF === 'all' || o.u?.id === parseInt(unitF)
      const matchDate = inRange(o.tanggal, from, to)
      const ws = o.po.work_status || 'belum_dikerjakan'
      const matchTab = tab === 'all' ? true
        : tab === 'pending'       ? o.po.status === 'pending'
        : tab === 'approved'      ? (o.po.status === 'approved' && ws !== 'sudah_dipesan' && ws !== 'full_supply')
        : tab === 'sudah_diorder' ? ws === 'sudah_diorder'
        : tab === 'full_supply'   ? ws === 'full_supply'
        : true
      return matchUnit && matchDate && matchTab
    }).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
  }, [allOrders, unitF, from, to, tab])

  // Counts for tabs
  const counts = useMemo(() => ({
    all:           allOrders.length,
    pending:       allOrders.filter(o => o.po.status === 'pending').length,
    approved:      allOrders.filter(o => o.po.status === 'approved' && !['sudah_dipesan','full_supply'].includes(o.po.work_status)).length,
    sudah_dipesan: allOrders.filter(o => o.po.work_status === 'sudah_diorder').length,
    full_supply:   allOrders.filter(o => o.po.work_status === 'full_supply').length,
  }), [allOrders])

  // Approve / reject
  const handleApprove = async (poId, status) => {
    if (!poId) return
    setUpdating(poId)
    try {
      await api.updateWorkStatus(poId, 'part_order', { order_status: status })
      await refetch()
    } catch (e) {
      alert('Gagal: ' + e.message)
    } finally {
      setUpdating(null)
    }
  }

  // Planner status update (stored in work_status)
  const handlePlannerStatus = async (poId, plannerStatus) => {
    if (!poId) return
    setUpdating(`ps-${poId}`)
    try {
      await api.updateWorkStatus(poId, 'part_order', { work_status: plannerStatus })
      await refetch()
    } catch (e) {
      alert('Gagal update status: ' + e.message)
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="fade">
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t)', marginBottom: 4 }}>Planner Orders</h1>
      <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 16 }}>
        Kelola semua order part mekanik — approve, tandai sudah diorder, dan konfirmasi barang datang
      </p>

      {/* Info Planner badge */}
      <div style={{ background: '#eef2ff', border: '1.5px solid #a5b4fc', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>🗂️</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5' }}>Mode Planner</div>
          <div style={{ fontSize: 11, color: '#6366f1' }}>Anda dapat menyetujui order tanpa perlu terdaftar sebagai Group Leader di inspeksi</div>
        </div>
      </div>

      {/* Status Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {STATUS_TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, border: '1.5px solid', background: tab === t.k ? 'var(--p)' : 'transparent', color: tab === t.k ? '#1c1917' : 'var(--t3)', borderColor: tab === t.k ? 'var(--p)' : 'var(--bd)', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 5 }}>
            {t.l}
            {counts[t.k] > 0 && (
              <span style={{ background: tab === t.k ? 'rgba(0,0,0,.15)' : 'var(--bd2)', borderRadius: 20, padding: '0 6px', fontSize: 10, fontWeight: 800 }}>
                {counts[t.k]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={unitF} onChange={e => setUnitF(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--bd)', background: 'var(--sf)', color: 'var(--t)', fontSize: 12, minWidth: 180 }}>
          <option value="all">— Semua Unit —</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.nomor_unit} — {u.brand} {u.tipe}</option>)}
        </select>
      </div>

      <DateFilter from={from} to={to} setFrom={setFrom} setTo={setTo} />

      {/* Count */}
      <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>
        {filtered.length} order ditemukan
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--t3)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Tidak ada order</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Coba ubah filter atau tab status</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((o, i) => (
            <OrderCard
              key={`${o.po.id}-${i}`}
              o={o}
              updating={updating === o.po.id ? o.po.id : updating === `ps-${o.po.id}` ? `ps-${o.po.id}` : null}
              onApprove={handleApprove}
              onPlannerStatus={handlePlannerStatus}
            />
          ))}
        </div>
      )}
    </div>
  )
}
