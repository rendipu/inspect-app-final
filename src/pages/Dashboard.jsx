import { useState } from 'react'
import Badge from '../components/Badge'
import LiveIndicator from '../components/LiveIndicator'

const TODAY = new Date().toISOString().split('T')[0]

export default function Dashboard({ user, data, setPage, setSelUnit, syncing, lastSync }) {
  const { units, schedules, inspections } = data
  const [scan,    setScan]    = useState('')
  const [scanRes, setScanRes] = useState(null)

  const todaySch = schedules.filter(s => s.tanggal === TODAY)
  const done     = todaySch.filter(s => s.status === 'done').length
  const total    = todaySch.length
  const pct      = total > 0 ? Math.round(done / total * 100) : 0
  const pctColor = pct >= 100 ? 'var(--ok)' : pct >= 60 ? 'var(--p)' : 'var(--err)'

  const handleScan = () => {
    const u = units.find(x => x.nomor_unit === scan || x.qr === scan)
    setScanRes(u ?? 'notfound')
  }

  return (
    <div className="fade">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t)' }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <LiveIndicator syncing={syncing} lastSync={lastSync} />
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }} className="g3">
        {[
          { label: 'Jadwal Hari Ini',  val: total,   sub: 'unit dijadwalkan', border: 'var(--p)'   },
          { label: 'Sudah Diinspeksi', val: done,    sub: 'unit selesai',     border: 'var(--ok)'  },
          { label: 'Pencapaian',       val: pct+'%', sub: `${done}/${total} unit`, border: pctColor },
        ].map(c => (
          <div key={c.label} className="card" style={{ borderTop: `3px solid ${c.border}`, padding: '16px' }}>
            <div className="lbl" style={{ marginBottom: 6 }}>{c.label}</div>
            <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: 'var(--t)', letterSpacing: '-.02em' }}>{c.val}</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 3 }}>{c.sub}</div>
            {c.label === 'Pencapaian' && (
              <div style={{ height: 4, background: 'var(--bd2)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: c.border, borderRadius: 2, width: pct + '%', transition: 'width .5s' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Schedule Table */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="lbl" style={{ marginBottom: 0 }}>📅 Jadwal Inspeksi Hari Ini</div>
          {syncing && <span className="spin" style={{ fontSize: 14, color: 'var(--t3)' }}>↻</span>}
        </div>
        <div className="ptbl">
          <table className="tbl">
            <thead>
              <tr><th>No. Unit</th><th>Tipe</th><th>Model</th><th>Status</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {todaySch.map(s => {
                const u = units.find(x => x.id === s.unit_id)
                if (!u) return null
                return (
                  <tr key={s.id}>
                    <td><span className="mono" style={{ color: 'var(--pd)', fontWeight: 700, fontSize: 13 }}>{u.nomor_unit}</span></td>
                    <td>{u.tipe}</td>
                    <td style={{ color: 'var(--t3)' }}>{u.model}</td>
                    <td><Badge type={s.status} /></td>
                    <td>
  {s.status === 'scheduled' && (user.role === 'mekanik' || user.role === 'admin') && (
    <button className="btn-y btn-sm" onClick={() => { setSelUnit(u); setPage('inspection') }}>
      Inspeksi →
    </button>
  )}
  {s.status === 'done' && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ color: 'var(--ok)', fontSize: 12, fontWeight: 700 }}>✓ Selesai</span>
    </div>
  )}
</td>
                  </tr>
                )
              })}
              {todaySch.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 28, color: 'var(--t3)' }}>Tidak ada jadwal hari ini</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Scanner */}
      <div className="card">
        <div className="lbl" style={{ marginBottom: 6 }}>📷 QR Code Scanner</div>
        <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 12 }}>
          Scan QR code untuk lihat history atau mulai inspeksi unit terjadwal
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={scan}
            onChange={e => { setScan(e.target.value); setScanRes(null) }}
            onKeyDown={e => e.key === 'Enter' && handleScan()}
            placeholder="Ketik No. Unit (DZ-001) atau kode QR..."
            style={{ flex: 1 }}
          />
          <button className="btn-y" onClick={handleScan}>SCAN</button>
        </div>

        {scanRes === 'notfound' && <p style={{ fontSize: 12, color: 'var(--err)', marginTop: 8 }}>⚠ Unit tidak ditemukan</p>}

        {scanRes && scanRes !== 'notfound' && (
          <div style={{ background: 'var(--sfy)', border: '1.5px solid var(--wnbd)', borderRadius: 8, padding: 14, marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--pd)' }}>{scanRes.nomor_unit}</div>
                <div style={{ fontSize: 13, color: 'var(--t2)' }}>{scanRes.tipe} · {scanRes.model} · {scanRes.tahun}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>
  HM Terkini:{' '}
  <strong style={{ color: 'var(--t)' }}>
    {(data.units.find(u => u.id === scanRes.id)?.hm || scanRes.hm).toLocaleString()} jam
  </strong>{' '}
  · Inspeksi:{' '}
  <strong style={{ color: 'var(--pd)' }}>
    {inspections.filter(i => i.unit_id === scanRes.id).length}x
  </strong>
</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-oy btn-sm" onClick={() => setPage('history')}>History</button>
                {schedules.find(s => s.unit_id === scanRes.id && s.tanggal === TODAY && s.status === 'scheduled') &&
                  (user.role === 'mekanik' || user.role === 'admin') && (
                  <button className="btn-y btn-sm" onClick={() => { setSelUnit(scanRes); setPage('inspection') }}>
                    Mulai Inspeksi →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
