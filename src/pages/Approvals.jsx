import { useState } from 'react'
import Badge from '../components/Badge'
import WorkStatusBadge from '../components/WorkStatusBadge'
import { api } from '../lib/api'

const WORK_OPTIONS = [
  { v: 'belum_dikerjakan', l: 'Belum Dikerjakan', c: 'var(--err)' },
  { v: 'sedang_dikerjakan', l: 'Sedang Dikerjakan', c: 'var(--wn)' },
  { v: 'sudah_selesai', l: 'Sudah Selesai', c: 'var(--ok)' },
]

function OrderCard({ o, showApprove, onApprove, onReject, onWorkStatus, updating }) {
  const borderColor =
    o.po.status === 'pending' ? 'var(--wn)' :
      o.po.status === 'approved' ? 'var(--ok)' : 'var(--err)'

  return (
    <div className="card" style={{ borderLeft: `3px solid ${borderColor}`, borderRadius: '0 12px 12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontWeight: 700, color: 'var(--pd)' }}>{o.u?.nomor_unit}</span>
            <span style={{ fontSize: 11, color: 'var(--t3)' }}>{o.u?.brand} {o.u?.tipe}</span>
            <Badge type={o.po.status} />
            {o.po.status === 'approved' && <WorkStatusBadge status={o.po.work_status} />}
          </div>
          {/* BUG FIX #25: a.question adalah undefined — field embed di Inspection.answers
              adalah question_pertanyaan (string), bukan object question.
              Sebelumnya: q: a.question → selalu undefined → tidak ada teks pertanyaan tampil */}
          <div style={{ fontSize: 12, color: 'var(--t2)' }}>{o.pertanyaan}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)' }}>
            {o.mechs} · {new Date(o.tanggal).toLocaleDateString('id-ID')} ·
            HM: <strong style={{ color: 'var(--pd)' }}>{o.hm?.toLocaleString()} jam</strong>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bd2)', borderRadius: 8, padding: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 12, marginBottom: 10 }} className="g2c">
        <div><span style={{ color: 'var(--t3)' }}>Part Name: </span><strong style={{ color: 'var(--t)' }}>{o.po.part_name}</strong></div>
        <div><span style={{ color: 'var(--t3)' }}>Part No: </span><span className="mono">{o.po.part_number || '-'}</span></div>
        <div><span style={{ color: 'var(--t3)' }}>Qty: </span><strong>{o.po.quantity}</strong></div>
        <div><span style={{ color: 'var(--t3)' }}>Ket: </span>{o.po.keterangan || '-'}</div>
      </div>

      {showApprove && (
        <div style={{ display: 'flex', gap: 8, marginBottom: o.po.status === 'approved' ? 10 : 0 }}>
          <button className="btn-ok" style={{ flex: 1 }} onClick={onApprove} disabled={updating}>✓ Approve</button>
          <button className="btn-err" style={{ flex: 1 }} onClick={onReject} disabled={updating}>✕ Reject</button>
        </div>
      )}

      {o.po.status === 'approved' && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Status Pengerjaan
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {WORK_OPTIONS.map(opt => (
              <button key={opt.v}
                onClick={() => onWorkStatus(opt.v)}
                disabled={updating || o.po.work_status === opt.v}
                style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${opt.c}`, background: o.po.work_status === opt.v ? opt.c : 'transparent', color: o.po.work_status === opt.v ? '#fff' : opt.c, opacity: updating ? 0.6 : 1, transition: 'all .15s' }}>
                {opt.l}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Approvals({ data, refetch }) {
  const { units, inspections } = data
  const [updating, setUpdating] = useState(null)

  // Kumpulkan semua part order dari inspeksi
  const orders = []
  inspections.forEach(ins => {
    const u = ins.unit || units.find(x => x.id === ins.unit_id)
    const mechs = (ins.mekaniks || []).map(m => m.user_nama).filter(Boolean).join(', ')
    const hm = ins.hour_meter

      ; (ins.answers || []).forEach(a => {
        if (a.answer === 'bad' && a.part_order && a.part_order.id) {
          orders.push({
            u,
            hm,
            tanggal: ins.tanggal,
            mechs,
            // BUG FIX #25: simpan string pertanyaan langsung dari field embed
            pertanyaan: a.question_pertanyaan,
            po: a.part_order,
          })
        }
      })
  })

  const pending = orders.filter(o => o.po.status === 'pending')
  const approved = orders.filter(o => o.po.status === 'approved')
  const rejected = orders.filter(o => o.po.status === 'rejected')

  const handleOrderStatus = async (poId, status) => {
    if (!poId) { alert('ID order tidak valid'); return }
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

  const handleWorkStatus = async (poId, workStatus) => {
    if (!poId) { alert('ID order tidak valid'); return }
    setUpdating(poId)
    try {
      await api.updateWorkStatus(poId, 'part_order', { work_status: workStatus })
      await refetch()
    } catch (e) {
      alert('Gagal: ' + e.message)
    } finally {
      setUpdating(null)
    }
  }

  const CardList = ({ list, showApprove }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {list.map((o, i) => (
        <OrderCard
          key={`${o.po.id}-${i}`}
          o={o}
          showApprove={showApprove}
          updating={updating === o.po.id}
          onApprove={() => handleOrderStatus(o.po.id, 'approved')}
          onReject={() => handleOrderStatus(o.po.id, 'rejected')}
          onWorkStatus={ws => handleWorkStatus(o.po.id, ws)}
        />
      ))}
    </div>
  )

  return (
    <div className="fade">
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t)', marginBottom: 4 }}>Approval Order Part</h1>
      <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 20 }}>Review order part &amp; update status pengerjaan</p>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div className="lbl" style={{ marginBottom: 0 }}>Menunggu Persetujuan</div>
          {pending.length > 0 && (
            <span style={{ background: 'var(--errbg)', border: '1px solid var(--errbd)', color: 'var(--err)', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
              {pending.length}
            </span>
          )}
        </div>
        {pending.length === 0
          ? <div className="card" style={{ textAlign: 'center', color: 'var(--t3)', padding: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
            <div>Tidak ada order menunggu persetujuan</div>
          </div>
          : <CardList list={pending} showApprove />
        }
      </div>

      {approved.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div className="lbl" style={{ marginBottom: 0 }}>Sudah Disetujui</div>
            <span style={{ background: 'var(--okbg)', border: '1px solid var(--okbd)', color: 'var(--ok)', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
              {approved.length}
            </span>
          </div>
          <CardList list={approved} showApprove={false} />
        </div>
      )}

      {rejected.length > 0 && (
        <div>
          <div className="lbl" style={{ marginBottom: 10 }}>Ditolak ({rejected.length})</div>
          <CardList list={rejected} showApprove={false} />
        </div>
      )}
    </div>
  )
}