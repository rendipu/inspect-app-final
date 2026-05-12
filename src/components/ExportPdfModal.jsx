import { useState, useMemo } from 'react'
import { api } from '../lib/api'
import { exportInspectionPdf } from '../lib/exportPdf'

function fmtDateID(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
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
const getLocalYMD = (d = new Date()) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0]
const TODAY = getLocalYMD()

// ── Loading Spinner ─────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ width: 20, height: 20, border: '3px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'pdfSpin .7s linear infinite', display: 'inline-block', verticalAlign: 'middle' }} />
  )
}

// ── Main Modal ──────────────────────────────────────────────────────────────
export default function ExportPdfModal({ units, inspections, onClose, defaultUnitId = '', defaultDate = '' }) {
  const [unitId,   setUnitId]   = useState(defaultUnitId)
  const [dateFrom, setDateFrom] = useState(defaultDate || TODAY)
  const [dateTo,   setDateTo]   = useState(defaultDate || TODAY)
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState([])   // exported inspection ids

  // Filter inspeksi berdasarkan unit + rentang tanggal
  const filtered = useMemo(() => {
    return inspections.filter(i => {
      const d = (i.tanggal || '').slice(0, 10)
      const matchUnit = !unitId || i.unit_id === parseInt(unitId)
      const matchFrom = !dateFrom || d >= dateFrom
      const matchTo   = !dateTo   || d <= dateTo
      return matchUnit && matchFrom && matchTo
    }).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal))
  }, [inspections, unitId, dateFrom, dateTo])

  // Export semua inspeksi yang terfilter (satu per satu jadi satu PDF)
  const handleExport = async () => {
    if (filtered.length === 0) return
    setLoading(true)
    try {
      for (const ins of filtered) {
        // fetch detail lengkap (answers, mekaniks, etc.)
        let detail = ins
        try {
          detail = await api.getInspection(ins._id)
        } catch { /* gunakan data cache jika gagal */ }

        const unit = units.find(u => u.id === (detail.unit_id || ins.unit_id))
        exportInspectionPdf(detail, unit)
        setDone(prev => [...prev, ins._id])

        // small delay agar browser tidak block multi-download
        if (filtered.length > 1) await new Promise(r => setTimeout(r, 400))
      }
    } catch (e) {
      alert('Gagal export: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={!loading ? onClose : undefined}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}
      >
        {/* Card */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--sf, #fff)', borderRadius: 18,
            padding: '28px 28px 24px',
            width: '100%', maxWidth: 480,
            boxShadow: '0 24px 80px rgba(0,0,0,.35)',
            border: '1px solid var(--bd, #e2e8f0)',
            position: 'relative',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{ width: 40, height: 40, background: 'var(--errbg, #fef2f2)', border: '1.5px solid var(--errbd, #fca5a5)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  📄
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t, #0f172a)' }}>Export PDF Inspeksi</div>
                  <div style={{ fontSize: 12, color: 'var(--t3, #94a3b8)' }}>Pilih unit dan rentang tanggal</div>
                </div>
              </div>
            </div>
            {!loading && (
              <button
                onClick={onClose}
                style={{ background: 'var(--bd2, #f1f5f9)', border: 'none', cursor: 'pointer', width: 32, height: 32, borderRadius: 8, fontSize: 16, color: 'var(--t2, #334155)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >✕</button>
            )}
          </div>

          {/* Unit selector */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2, #334155)', display: 'block', marginBottom: 6 }}>
              Unit
            </label>
            <select
              id="pdf-unit-select"
              value={unitId}
              onChange={e => setUnitId(e.target.value)}
              disabled={loading}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid var(--bd, #e2e8f0)', background: 'var(--bg, #fff)', fontSize: 13, color: 'var(--t, #0f172a)', outline: 'none' }}
            >
              <option value="">— Semua Unit —</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.nomor_unit} — {u.brand} {u.tipe}</option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2, #334155)', display: 'block', marginBottom: 6 }}>
                Dari Tanggal
              </label>
              <input
                id="pdf-date-from"
                type="date"
                value={dateFrom}
                max={dateTo || TODAY}
                onChange={e => setDateFrom(e.target.value)}
                disabled={loading}
                style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1.5px solid var(--bd, #e2e8f0)', background: 'var(--bg, #fff)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2, #334155)', display: 'block', marginBottom: 6 }}>
                Sampai Tanggal
              </label>
              <input
                id="pdf-date-to"
                type="date"
                value={dateTo}
                min={dateFrom}
                max={TODAY}
                onChange={e => setDateTo(e.target.value)}
                disabled={loading}
                style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1.5px solid var(--bd, #e2e8f0)', background: 'var(--bg, #fff)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Preview count */}
          <div style={{
            background: filtered.length > 0 ? 'var(--infbg, #eff6ff)' : 'var(--bd2, #f1f5f9)',
            border: `1.5px solid ${filtered.length > 0 ? 'var(--infbd, #bfdbfe)' : 'var(--bd, #e2e8f0)'}`,
            borderRadius: 10, padding: '10px 14px', marginBottom: 18,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>{filtered.length > 0 ? '📋' : '📭'}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t, #0f172a)' }}>
                {filtered.length} inspeksi ditemukan
              </div>
              {filtered.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--t3, #94a3b8)', marginTop: 2 }}>
                  {filtered.length} file PDF akan di-download
                </div>
              )}
            </div>
          </div>

          {/* Inspection list preview (max 5) */}
          {filtered.length > 0 && (
            <div style={{ marginBottom: 18, maxHeight: 170, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.slice(0, 8).map(ins => {
                const u = units.find(x => x.id === ins.unit_id)
                const isDone = done.includes(ins._id)
                return (
                  <div key={ins._id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: isDone ? 'var(--okbg, #f0fdf4)' : 'var(--bd2, #f8fafc)',
                    border: `1px solid ${isDone ? 'var(--okbd, #86efac)' : 'var(--bd, #e2e8f0)'}`,
                    borderRadius: 8, padding: '7px 10px', fontSize: 12,
                    transition: 'all .2s',
                  }}>
                    <span style={{ fontSize: 14 }}>{isDone ? '✅' : '📄'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, color: 'var(--t, #0f172a)' }}>{u?.nomor_unit || ins.unit_nomor}</span>
                      <span style={{ color: 'var(--t3)', marginLeft: 6 }}>{u?.brand} {u?.tipe}</span>
                    </div>
                    <div style={{ color: 'var(--t3, #94a3b8)', whiteSpace: 'nowrap' }}>{fmtDateID(ins.tanggal)}</div>
                    <div style={{ color: 'var(--t3, #94a3b8)', whiteSpace: 'nowrap', minWidth: 60 }}>
                      {fmtDuration(ins.jam_start, ins.jam_finish)}
                    </div>
                  </div>
                )
              })}
              {filtered.length > 8 && (
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--t3)', padding: '4px 0' }}>
                  + {filtered.length - 8} inspeksi lainnya
                </div>
              )}
            </div>
          )}

          {/* Progress saat loading */}
          {loading && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: 'var(--t2)' }}>
                <span>Mengexport...</span>
                <span>{done.length} / {filtered.length}</span>
              </div>
              <div style={{ height: 6, background: 'var(--bd2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, background: 'var(--ok, #22c55e)', width: `${filtered.length > 0 ? (done.length / filtered.length) * 100 : 0}%`, transition: 'width .3s' }} />
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              disabled={loading}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                border: '1.5px solid var(--bd, #e2e8f0)', background: 'transparent', color: 'var(--t2, #334155)',
                opacity: loading ? 0.5 : 1, transition: 'all .15s',
              }}
            >
              Batal
            </button>
            <button
              id="pdf-export-confirm-btn"
              onClick={handleExport}
              disabled={loading || filtered.length === 0}
              style={{
                flex: 2, padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: (loading || filtered.length === 0) ? 'not-allowed' : 'pointer',
                border: 'none',
                background: filtered.length > 0 ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'var(--bd)',
                color: filtered.length > 0 ? '#fff' : 'var(--t3)',
                opacity: (loading || filtered.length === 0) ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all .15s',
              }}
            >
              {loading ? (
                <><Spinner /> Mengexport PDF...</>
              ) : (
                <>📥 Export {filtered.length > 0 ? `${filtered.length} PDF` : 'PDF'}</>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pdfSpin { to { transform: rotate(360deg) } }
      `}</style>
    </>
  )
}
