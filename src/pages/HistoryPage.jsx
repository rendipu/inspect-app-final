import { useState, useMemo } from 'react'
import Badge from '../components/Badge'
import WorkStatusBadge from '../components/WorkStatusBadge'
import Pagination, { PAGE_SIZE } from '../components/Pagination'
import { exportCsv } from '../lib/exportCsv'
import { api } from '../lib/api'

// ─── Lightbox untuk lihat foto fullscreen ────────────────────────────
function FotoLightbox({ src, onClose }) {
  if (!src) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, cursor: 'zoom-out',
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '95vw', maxHeight: '90vh' }}>
        <img
          src={src}
          alt="Foto"
          style={{ display: 'block', maxWidth: '90vw', maxHeight: '85vh', borderRadius: 10, objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,.5)' }}
        />
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: -14, right: -14,
            width: 32, height: 32, borderRadius: '50%',
            background: '#fff', border: 'none', cursor: 'pointer',
            fontSize: 18, fontWeight: 700, color: '#333',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,.3)',
          }}
        >✕</button>
      </div>
    </div>
  )
}

// ─── Thumbnail foto yang bisa diklik ─────────────────────────────────
function FotoThumb({ src, border, alt = 'Foto' }) {
  const [open, setOpen] = useState(false)
  if (!src) return null
  return (
    <>
      <img
        src={src}
        alt={alt}
        onClick={() => setOpen(true)}
        style={{
          maxWidth: 120, maxHeight: 90, borderRadius: 6,
          objectFit: 'cover', border: `1.5px solid ${border}`,
          cursor: 'zoom-in', display: 'block', marginTop: 8,
          transition: 'opacity .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        title="Klik untuk perbesar"
      />
      {open && <FotoLightbox src={src} onClose={() => setOpen(false)} />}
    </>
  )
}

const WORK_OPTIONS = [
  { v: 'belum_dikerjakan', l: '⏺ Belum Dikerjakan', c: 'var(--err)' },
  { v: 'sudah_selesai',    l: '✓ Sudah Dikerjakan',  c: 'var(--ok)'  },
]

const getLocalYMD = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
const TODAY  = getLocalYMD()
const WEEK   = getLocalYMD(new Date(Date.now() - 7  * 86400000))
const MONTH  = getLocalYMD(new Date(Date.now() - 30 * 86400000))

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
  }

  return (
    <div style={{ background: 'var(--bd2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
        Filter Tanggal
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {[
          { k: 'all',    l: 'Semua'    },
          { k: 'today',  l: 'Hari Ini' },
          { k: 'week',   l: '7 Hari'   },
          { k: 'month',  l: '30 Hari'  },
          { k: 'custom', l: 'Custom'   },
        ].map(p => (
          <button key={p.k} onClick={() => applyPreset(p.k)}
            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', background: preset === p.k ? 'var(--p)' : 'transparent', color: preset === p.k ? '#1c1917' : 'var(--t3)', borderColor: preset === p.k ? 'var(--p)' : 'var(--bd)', transition: 'all .15s' }}>
            {p.l}
          </button>
        ))}
      </div>

      {(preset === 'custom' || (from && to)) && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--t3)', whiteSpace: 'nowrap' }}>Dari</span>
            <input id="filter-from" name="filter-from" aria-label="Tanggal Dari" type="date" value={from} max={to || TODAY}
              onChange={e => { setFrom(e.target.value); setPreset('custom') }}
              style={{ fontSize: 12, padding: '5px 8px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--t3)', whiteSpace: 'nowrap' }}>Sampai</span>
            <input id="filter-to" name="filter-to" aria-label="Tanggal Sampai" type="date" value={to} min={from} max={TODAY}
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

      {(from || to) && preset !== 'custom' && (
        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
          {from && to ? `${fmtDate(from)} — ${fmtDate(to)}` : from ? `Dari ${fmtDate(from)}` : `Sampai ${fmtDate(to)}`}
        </div>
      )}
    </div>
  )
}

// ─── WorkStatusButtons ───────────────────────────────────────────────
function WorkStatusButtons({ detail, detailType, user, updating, onWorkStatus }) {
  if (!detail) return null
  const updKey = `${detailType}-${detail.id}`

  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
        Status Pengerjaan
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {WORK_OPTIONS.map(opt => {
          const isCurrent   = detail.work_status === opt.v ||
            (opt.v === 'belum_dikerjakan' && !detail.work_status)
          const isSelesai   = detail.work_status === 'sudah_selesai'
          // Non-admin tidak bisa ubah balik ke Belum Dikerjakan jika sudah selesai
          const isLocked    = opt.v === 'belum_dikerjakan' && isSelesai && user.role !== 'admin'
          const isDisabled  = updating === updKey || isCurrent || isLocked
          return (
            <button key={opt.v}
              onClick={() => onWorkStatus(detail.id, detailType, opt.v, detail.work_status)}
              disabled={isDisabled}
              title={isLocked ? 'Hanya Admin yang bisa mengubah kembali ke Belum Dikerjakan' : ''}
              style={{
                padding: '7px 18px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                border: `1.5px solid ${opt.c}`,
                background: isCurrent ? opt.c : 'transparent',
                color: isCurrent ? '#fff' : opt.c,
                opacity: isDisabled && !isCurrent ? 0.35 : 1,
                transition: 'all .15s',
              }}>
              {updating === updKey && !isCurrent ? '⏳' : isLocked ? '🔒' : opt.l}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Shared: DamageCard ───────────────────────────────────────────────
function DamageCard({ r, user, updating, onWorkStatus }) {
  // repair bisa punya part_order juga (jika butuh order barang saat repair)
  const repairHasPart = r.type === 'repair' && !!r.part_order

  return (
    <div className="card" style={{ borderLeft: `3px solid ${r.type === 'bad' ? 'var(--err)' : 'var(--wn)'}`, borderRadius: '0 12px 12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--pd)' }}>{r.u?.nomor_unit || r.unit_nomor}</span>
            <span style={{ fontSize: 11, color: 'var(--t3)' }}>{r.u?.brand} {r.u?.tipe}</span>
            <Badge type={r.type === 'bad' ? 'bad' : 'repair'} />
            {r.detail?.work_status && <WorkStatusBadge status={r.detail.work_status} />}
            {(r.type === 'bad' || repairHasPart) && r.part_order?.status && (() => {
              const ws = r.part_order.work_status
              const st = r.part_order.status
              // Sembunyikan badge Pending jika sudah dikerjakan (tidak relevan lagi)
              // Selalu tampilkan jika Rejected agar terlihat jelas
              if (st === 'pending' && ws === 'sudah_selesai') return null
              if (st === 'approved') return null  // sudah jelas dari WorkStatusBadge
              return <Badge type={st} />
            })()}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t)' }}>{r.q_pertanyaan}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>{r.q_kategori} · {r.mechs}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>{fmtDate(r.tanggal)}</div>
          <div style={{ marginTop: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--t3)' }}>HM: </span>
            <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--pd)' }}>{r.hm?.toLocaleString()} jam</span>
          </div>
        </div>
      </div>

      {/* BAD / ORDER PART detail */}
      {r.type === 'bad' && r.detail && (
        <div style={{ background: 'var(--errbg)', border: '1px solid var(--errbd)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, fontSize: 12, marginBottom: r.detail.keterangan ? 6 : 0 }} className="g3">
            <div><span style={{ color: 'var(--t3)' }}>Part: </span><strong style={{ color: 'var(--t)' }}>{r.detail.part_name}</strong></div>
            <div><span style={{ color: 'var(--t3)' }}>P/N: </span><span className="mono">{r.detail.part_number || '-'}</span></div>
            <div><span style={{ color: 'var(--t3)' }}>Qty: </span><strong>{r.detail.quantity}</strong></div>
          </div>
          {r.detail.keterangan && <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 4 }}>{r.detail.keterangan}</div>}
          <FotoThumb src={r.detail.foto_url} border="var(--errbd)" alt="Foto kondisi" />
        </div>
      )}

      {/* REPAIR detail */}
      {r.type === 'repair' && r.detail && (
        <div style={{ background: 'var(--wnbg)', border: '1px solid var(--wnbd)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: r.detail.foto_url ? 8 : 0 }}>
            🔧 {r.detail.keterangan || '-'}
          </div>
          <FotoThumb src={r.detail.foto_url} border="var(--wnbd)" alt="Foto perbaikan" />
          {/* Part order dari repair (jika ada) */}
          {repairHasPart && (
            <div style={{ marginTop: 8, background: 'var(--errbg)', border: '1px solid var(--errbd)', borderRadius: 6, padding: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--err)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                ⚠ Order Part (dari Repair)
              {r.part_order.status === 'rejected' && <> <Badge type={r.part_order.status} /></>}
              {r.part_order.status === 'pending' && r.part_order.work_status !== 'sudah_selesai' && <> <Badge type={r.part_order.status} /></>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, fontSize: 11 }} className="g3">
                <div><span style={{ color: 'var(--t3)' }}>Part: </span><strong>{r.part_order.part_name}</strong></div>
                <div><span style={{ color: 'var(--t3)' }}>P/N: </span><span className="mono">{r.part_order.part_number || '-'}</span></div>
                <div><span style={{ color: 'var(--t3)' }}>Qty: </span><strong>{r.part_order.quantity}</strong></div>
              </div>
              {r.part_order.keterangan && <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 4 }}>{r.part_order.keterangan}</div>}
            </div>
          )}
        </div>
      )}

      {/* Status Pengerjaan — REPAIR */}
      {r.type === 'repair' && r.detail && (
        <div style={{ marginBottom: repairHasPart ? 10 : 0 }}>
          <WorkStatusButtons detail={r.detail} detailType="repair" user={user} updating={updating} onWorkStatus={onWorkStatus} />
        </div>
      )}

      {/* Status Pengerjaan — BAD order part */}
      {(r.type === 'bad' || repairHasPart) && r.part_order && (
        <div>
          {repairHasPart && (
            <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>
              Status Order Part
            </div>
          )}
          <WorkStatusButtons detail={r.part_order} detailType="part_order" user={user} updating={updating} onWorkStatus={onWorkStatus} />
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
  const [page,  setPage]  = useState(1)

  const filtered = useMemo(() => {
    return inspections
      .filter(i =>
        (unitF === 'all' || i.unit_id === parseInt(unitF)) &&
        inRange(i.tanggal, from, to)
      )
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
  }, [inspections, unitF, from, to])

  const paginated = useMemo(() => {
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  }, [filtered, page])

  const resetPage = () => setPage(1)

  const handleExport = () => {
    const unitName = unitF !== 'all' ? units.find(u => u.id === parseInt(unitF))?.nomor_unit : ''
    const dateRange = from && to ? `_${from}_sd_${to}` : from ? `_dari_${from}` : to ? `_sd_${to}` : ''
    const unitSuffix = unitName ? `_${unitName}` : ''
    const headers = ['Tanggal','No Unit','Tipe','Brand','Group Leader','Mekanik','HM','Jam Start','Jam Finish','Durasi','Good','Bad','Repair']
    const rows = filtered.map(ins => {
      const u = ins.unit || units.find(x => x.id === ins.unit_id)
      const mechs = (ins.mekaniks || []).map(m => m.user_nama).filter(Boolean).join(', ')
      const good = (ins.answers || []).filter(a => a.answer === 'good').length
      const bad = (ins.answers || []).filter(a => a.answer === 'bad').length
      const repair = (ins.answers || []).filter(a => a.answer === 'repair').length
      return [fmtDate(ins.tanggal), u?.nomor_unit || ins.unit_nomor, u?.tipe, u?.brand, ins.group_leader_nama || '-', mechs, ins.hour_meter, ins.jam_start, ins.jam_finish, fmtDuration(ins.jam_start, ins.jam_finish), good, bad, repair]
    })
    exportCsv(`History_Inspeksi${unitSuffix}${dateRange}.csv`, headers, rows)
  }

  return (
    <div>
      <DateFilter from={from} to={to} setFrom={(v) => { setFrom(v); resetPage() }} setTo={(v) => { setTo(v); resetPage() }} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select id="filter-unit-inspeksi" name="unitF" aria-label="Filter Unit" value={unitF} onChange={e => { setUnitF(e.target.value); resetPage() }} style={{ minWidth: 200 }}>
          <option value="all">Semua Unit</option>
          {units.map(u => <option key={u._id} value={u.id}>{u.nomor_unit} — {u.tipe}</option>)}
        </select>
        {filtered.length > 0 && (
          <button onClick={handleExport} className="btn-oy btn-sm" style={{ marginLeft: 'auto' }}>📥 Export CSV</button>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>{filtered.length} inspeksi</div>
      {filtered.length === 0 && <EmptyState />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {paginated.map(ins => {
          const u      = ins.unit || units.find(x => x.id === ins.unit_id)
          const mechs  = (ins.mekaniks || []).map(m => m.user_nama).filter(Boolean).join(', ')
          const gl     = ins.group_leader_nama || '-'
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

      <Pagination total={filtered.length} page={page} setPage={setPage} />
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
  const [page,     setPage]     = useState(1)

  const badRecords = useMemo(() => {
    const rows = []
    inspections.forEach(ins => {
      const u     = ins.unit || units.find(x => x.id === ins.unit_id)
      const mechs = (ins.mekaniks || []).map(m => m.user_nama).filter(Boolean).join(', ')
      ;(ins.answers || []).forEach(a => {
        if ((a.answer === 'bad' || a.answer === 'repair')) {
          rows.push({
            key:          `${ins._id}-${a._id}`,
            tanggal:      ins.tanggal,
            hm:           ins.hour_meter,
            u,
            unit_id:      ins.unit_id,
            unit_nomor:   ins.unit_nomor,
            mechs,
            group_leader: ins.group_leader_nama || '-',
            q_pertanyaan: a.question_pertanyaan,
            q_kategori:   a.question_kategori,
            type:         a.answer,
            detail:       a.answer === 'bad' ? a.part_order : a.repair,
            part_order:   a.part_order || null,
          })
        }
      })
    })
    return rows
  }, [inspections, units])

  const filtered = useMemo(() => {
    return badRecords
      .filter(r => 
        (unitF === 'all' || r.unit_id === parseInt(unitF)) && 
        (typeF === 'all' || r.type === typeF) &&
        inRange(r.tanggal, from, to)
      )
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
  }, [badRecords, unitF, typeF, from, to])

  const paginated = useMemo(() => {
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  }, [filtered, page])

  const resetPage = () => setPage(1)

  const handleWorkStatus = async (detailId, type, newStatus, currentStatus) => {
    if (currentStatus === 'sudah_selesai' && newStatus === 'belum_dikerjakan' && user.role !== 'admin') {
      alert('Hanya Admin yang bisa mengubah status kembali ke Belum Dikerjakan.')
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

  const handleExport = () => {
    const unitName = unitF !== 'all' ? units.find(u => u.id === parseInt(unitF))?.nomor_unit : ''
    const dateRange = from && to ? `_${from}_sd_${to}` : from ? `_dari_${from}` : to ? `_sd_${to}` : ''
    const unitSuffix = unitName ? `_${unitName}` : ''
    const headers = ['Tanggal','No Unit','Tipe','Kategori','Item Inspeksi','Jenis','Part Name','Part Number','Qty','Keterangan','Group Leader','Mekanik','Work Status','HM']
    const csvRows = filtered.map(r => [
      fmtDate(r.tanggal), r.u?.nomor_unit || r.unit_nomor, r.u?.tipe || '', r.q_kategori, r.q_pertanyaan,
      r.type === 'bad' ? 'Order Part' : 'Repair',
      r.detail?.part_name || r.part_order?.part_name || '', r.detail?.part_number || r.part_order?.part_number || '',
      r.detail?.quantity || r.part_order?.quantity || '', r.detail?.keterangan || '',
      r.group_leader, r.mechs,
      r.detail?.work_status || 'belum_dikerjakan', r.hm
    ])
    exportCsv(`History_Kerusakan${unitSuffix}${dateRange}.csv`, headers, csvRows)
  }

  return (
    <div>
      <DateFilter from={from} to={to} setFrom={(v) => { setFrom(v); resetPage() }} setTo={(v) => { setTo(v); resetPage() }} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select id="filter-unit-kerusakan" name="unitF" aria-label="Filter Unit" value={unitF} onChange={e => { setUnitF(e.target.value); resetPage() }} style={{ minWidth: 180 }}>
          <option value="all">Semua Unit</option>
          {units.map(u => <option key={u._id} value={u.id}>{u.nomor_unit} — {u.tipe}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['all','Semua'],['bad','Order Part'],['repair','Repair']].map(([f,l]) => (
            <button key={f} onClick={() => { setTypeF(f); resetPage() }}
              style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', background: typeF === f ? 'var(--p)' : 'transparent', color: typeF === f ? '#1c1917' : 'var(--t3)', borderColor: typeF === f ? 'var(--p)' : 'var(--bd)', transition: 'all .15s' }}>
              {l}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 'auto' }}>{filtered.length} record</span>
        {filtered.length > 0 && (
          <button onClick={handleExport} className="btn-oy btn-sm">📥 Export CSV</button>
        )}
      </div>

      {filtered.length === 0 && <EmptyState />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {paginated.map(r => (
          <DamageCard key={r.key} r={r} user={user} updating={updating} onWorkStatus={handleWorkStatus} />
        ))}
      </div>

      <Pagination total={filtered.length} page={page} setPage={setPage} />
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
  const [page,     setPage]     = useState(1)

  const allWorkRecords = useMemo(() => {
    const r = []
    inspections.forEach(ins => {
      const u     = ins.unit || units.find(x => x.id === ins.unit_id)
      const mechs = (ins.mekaniks || []).map(m => m.user_nama).filter(Boolean).join(', ')
      ;(ins.answers || []).forEach(a => {
        const detail = a.answer === 'bad' ? a.part_order : a.answer === 'repair' ? a.repair : null
        if (!detail) return
        r.push({
          key:          `${ins._id}-${a._id}`,
          tanggal:      ins.tanggal,
          hm:           ins.hour_meter,
          u,
          unit_id:      ins.unit_id,
          unit_nomor:   ins.unit_nomor,
          mechs,
          group_leader: ins.group_leader_nama || '-',
          q_pertanyaan: a.question_pertanyaan,
          q_kategori:   a.question_kategori,
          type:         a.answer,
          detail,
          part_order:   a.part_order || null,
        })
      })
    })
    return r
  }, [inspections, units])

  const filtered = useMemo(() => {
    return allWorkRecords
      .filter(r => {
        if (!inRange(r.tanggal, from, to)) return false
        if (unitF !== 'all' && r.unit_id !== parseInt(unitF)) return false
        const matchOrder = filterStatus === 'order_part' && r.type === 'bad' && r.detail.status === 'pending'
        const matchWork  = filterStatus !== 'order_part' && r.detail.work_status === filterStatus
        return matchOrder || matchWork
      })
      .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
  }, [allWorkRecords, from, to, unitF, filterStatus])

  const paginated = useMemo(() => {
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  }, [filtered, page])

  const resetPage = () => setPage(1)

  const handleWorkStatus = async (detailId, type, newStatus, currentStatus) => {
    if (currentStatus === 'sudah_selesai' && newStatus === 'belum_dikerjakan' && user.role !== 'admin') {
      alert('Hanya Admin yang bisa mengubah status kembali ke Belum Dikerjakan.')
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

  const statusLabel = { belum_dikerjakan: 'Belum_Dikerjakan', order_part: 'Sedang_Order', sudah_selesai: 'Sudah_Dikerjakan' }
  const handleExport = () => {
    const unitName = unitF !== 'all' ? units.find(u => u.id === parseInt(unitF))?.nomor_unit : ''
    const dateRange = from && to ? `_${from}_sd_${to}` : from ? `_dari_${from}` : to ? `_sd_${to}` : ''
    const unitSuffix = unitName ? `_${unitName}` : ''
    const headers = ['Tanggal','No Unit','Tipe','Kategori','Item Inspeksi','Jenis','Part Name','Part Number','Qty','Keterangan','Group Leader','Mekanik','Work Status','HM']
    const csvRows = filtered.map(r => [
      fmtDate(r.tanggal), r.u?.nomor_unit || r.unit_nomor, r.u?.tipe || '', r.q_kategori, r.q_pertanyaan,
      r.type === 'bad' ? 'Order Part' : 'Repair',
      r.detail?.part_name || r.part_order?.part_name || '', r.detail?.part_number || r.part_order?.part_number || '',
      r.detail?.quantity || r.part_order?.quantity || '', r.detail?.keterangan || '',
      r.group_leader, r.mechs,
      r.detail?.work_status || filterStatus, r.hm
    ])
    exportCsv(`History_${statusLabel[filterStatus] || filterStatus}${unitSuffix}${dateRange}.csv`, headers, csvRows)
  }

  return (
    <div>
      <DateFilter from={from} to={to} setFrom={(v) => { setFrom(v); resetPage() }} setTo={(v) => { setTo(v); resetPage() }} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select id="filter-unit-status" name="unitF" aria-label="Filter Unit" value={unitF} onChange={e => { setUnitF(e.target.value); resetPage() }} style={{ minWidth: 180 }}>
          <option value="all">Semua Unit</option>
          {units.map(u => <option key={u._id} value={u.id}>{u.nomor_unit} — {u.tipe}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--t3)', marginLeft: 'auto' }}>{filtered.length} item</span>
        {filtered.length > 0 && (
          <button onClick={handleExport} className="btn-oy btn-sm">📥 Export CSV</button>
        )}
      </div>

      {filtered.length === 0 && <EmptyState />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {paginated.map(r => (
          <DamageCard key={r.key} r={r} user={user} updating={updating} onWorkStatus={handleWorkStatus} />
        ))}
      </div>

      <Pagination total={filtered.length} page={page} setPage={setPage} />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────
const TABS = [
  { k: 'kerusakan',        l: '🔴 Kerusakan'       },
  { k: 'inspeksi',         l: '📋 Inspeksi'         },
  { k: 'belum_dikerjakan', l: '⏳ Belum Dikerjakan' },
  { k: 'order_part',       l: '📦 Sedang Order'     },
  { k: 'sudah_selesai',    l: '✅ Sudah Dikerjakan' },
]

export default function HistoryPage({ data, user, refetch }) {
  const [tab, setTab] = useState('kerusakan')

  return (
    <div className="fade">
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t)', marginBottom: 4 }}>History</h1>
      <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 14 }}>Riwayat inspeksi & kerusakan unit alat berat</p>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 6, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', whiteSpace: 'nowrap', flexShrink: 0, background: tab === t.k ? 'var(--p)' : 'transparent', color: tab === t.k ? '#1c1917' : 'var(--t3)', borderColor: tab === t.k ? 'var(--p)' : 'var(--bd)', transition: 'all .15s' }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'kerusakan'        && <TabKerusakan  data={data} user={user} refetch={refetch} />}
      {tab === 'inspeksi'         && <TabInspeksi   data={data} />}
      {tab === 'belum_dikerjakan' && <TabWorkStatus data={data} user={user} refetch={refetch} filterStatus="belum_dikerjakan" />}
      {tab === 'order_part'       && <TabWorkStatus data={data} user={user} refetch={refetch} filterStatus="order_part"       />}
      {tab === 'sudah_selesai'    && <TabWorkStatus data={data} user={user} refetch={refetch} filterStatus="sudah_selesai"    />}
    </div>
  )
}