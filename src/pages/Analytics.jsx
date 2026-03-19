import { useState, useMemo } from 'react'
import {
  PieChart, Pie, Cell,
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const TOOLTIP_STYLE = {
  background: 'var(--sf)',
  border: '1px solid var(--bd)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--t)',
  padding: '6px 10px',
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

function fmtMonth(d) {
  return new Date(d).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' })
}

function getWeekKey(dateStr) {
  const d = new Date(dateStr)
  const startOfYear = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function getWeekLabel(dateStr) {
  const d = new Date(dateStr)
  const mon = new Date(d)
  mon.setDate(d.getDate() - d.getDay() + 1)
  return fmtDate(mon.toISOString())
}

function getMonthKey(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ─── Stat Card ────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <div className="card" style={{ borderTop: `3px solid ${color}`, padding: '14px 16px' }}>
      <div className="lbl" style={{ marginBottom: 5 }}>{label}</div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: 'var(--t)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="lbl" style={{ marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  )
}

// ─── Trend Chart (weekly / monthly) ─────────────────────────────────
function TrendChart({ inspections, units, period }) {
  const [unitF, setUnitF] = useState('all')

  const filtered = useMemo(() => {
    if (unitF === 'all') return inspections
    // FIX #2a: i.unit_id adalah integer, u.id juga integer — cocok
    return inspections.filter(i => i.unit_id === parseInt(unitF))
    // FIX #11: hapus 'period' dari deps — tidak dipakai di dalam fungsi ini
  }, [inspections, unitF])

  const rangeMap = {}
  const now = new Date()

  if (period === 'weekly') {
    for (let w = 7; w >= 0; w--) {
      const d = new Date(now)
      d.setDate(d.getDate() - w * 7)
      const key = getWeekKey(d.toISOString())
      const label = getWeekLabel(d.toISOString())
      if (!rangeMap[key]) rangeMap[key] = { key, label, inspeksi: 0, bad: 0, repair: 0 }
    }
  } else {
    for (let m = 5; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1)
      const key = getMonthKey(d.toISOString())
      const label = fmtMonth(d.toISOString())
      if (!rangeMap[key]) rangeMap[key] = { key, label, inspeksi: 0, bad: 0, repair: 0 }
    }
  }

  filtered.forEach(ins => {
    const key = period === 'weekly'
      ? getWeekKey(ins.tanggal)
      : getMonthKey(ins.tanggal)
    if (!rangeMap[key]) return
    rangeMap[key].inspeksi++
    ;(ins.answers || []).forEach(a => {
      if (a.answer === 'bad') rangeMap[key].bad++
      if (a.answer === 'repair') rangeMap[key].repair++
    })
  })

  const chartData = Object.values(rangeMap)

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        {/* FIX #2a: value={u.id} (integer) agar parseInt cocok dengan i.unit_id */}
        <select value={unitF} onChange={e => setUnitF(e.target.value)} style={{ minWidth: 180 }}>
          <option value="all">Semua Unit</option>
          {units.map(u => <option key={u._id} value={u.id}>{u.nomor_unit} — {u.tipe}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
          Jumlah Inspeksi
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bd2)" />
            <XAxis dataKey="label" tick={{ fill: 'var(--t3)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'var(--t3)', fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="inspeksi" name="Inspeksi" stroke="var(--p)" strokeWidth={2.5} dot={{ fill: 'var(--p)', r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
          Trend Kerusakan
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bd2)" />
            <XAxis dataKey="label" tick={{ fill: 'var(--t3)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'var(--t3)', fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="bad" name="Order Part" fill="#dc2626" radius={[3, 3, 0, 0]} />
            <Bar dataKey="repair" name="Repair" fill="#d97706" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── Top Kerusakan ────────────────────────────────────────────────────
function TopDamage({ inspections, questions }) {
  const counts = {}
  inspections.forEach(ins => {
    ;(ins.answers || []).forEach(a => {
      if (a.answer !== 'bad' && a.answer !== 'repair') return
      // Pakai question_pertanyaan dan question_kategori dari embed (bukan lookup)
      if (!a.question_pertanyaan) return
      const key = a.question_id
      if (!counts[key]) counts[key] = { pertanyaan: a.question_pertanyaan, kategori: a.question_kategori, bad: 0, repair: 0 }
      if (a.answer === 'bad') counts[key].bad++
      if (a.answer === 'repair') counts[key].repair++
    })
  })

  const sorted = Object.values(counts)
    .map(c => ({ ...c, total: c.bad + c.repair }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  if (sorted.length === 0) return <div style={{ color: 'var(--t3)', fontSize: 13, textAlign: 'center', padding: 20 }}>Belum ada data kerusakan</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map((item, i) => {
        const max = sorted[0].total
        return (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: i === 0 ? 'var(--p)' : 'var(--bd2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: i === 0 ? '#1c1917' : 'var(--t3)', flexShrink: 0 }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                  {item.pertanyaan}
                </div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--pd)', flexShrink: 0 }}>
                  {item.total}x
                </div>
              </div>
              <div style={{ height: 5, background: 'var(--bd2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: i === 0 ? 'var(--p)' : 'var(--bd)', borderRadius: 3, width: `${(item.total / max) * 100}%`, transition: 'width .5s' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                <span style={{ fontSize: 10, color: 'var(--t3)' }}>{item.kategori}</span>
                {item.bad > 0 && <span style={{ fontSize: 10, color: 'var(--err)', fontWeight: 700 }}>{item.bad} order</span>}
                {item.repair > 0 && <span style={{ fontSize: 10, color: 'var(--wn)', fontWeight: 700 }}>{item.repair} repair</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Top Unit Bermasalah ──────────────────────────────────────────────
function TopUnits({ inspections, units }) {
  const counts = {}
  inspections.forEach(ins => {
    const bad = (ins.answers || []).filter(a => a.answer === 'bad' || a.answer === 'repair').length
    if (bad === 0) return
    if (!counts[ins.unit_id]) counts[ins.unit_id] = { unit_id: ins.unit_id, total: 0, inspeksi: 0 }
    counts[ins.unit_id].total += bad
    counts[ins.unit_id].inspeksi++
  })

  const sorted = Object.values(counts)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  if (sorted.length === 0) return <div style={{ color: 'var(--t3)', fontSize: 13, textAlign: 'center', padding: 20 }}>Belum ada data</div>

  const max = sorted[0]?.total || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map((item, i) => {
        // FIX #2b: unit_id adalah integer, cocokkan dengan u.id (integer)
        const u = units.find(x => x.id === item.unit_id)
        return (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: i === 0 ? 'var(--err)' : 'var(--bd2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: i === 0 ? '#fff' : 'var(--t3)', flexShrink: 0 }}>
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <div>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--pd)' }}>{u?.nomor_unit}</span>
                  <span style={{ fontSize: 11, color: 'var(--t3)', marginLeft: 6 }}>{u?.brand} {u?.tipe}</span>
                </div>
                <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--err)', flexShrink: 0 }}>
                  {item.total}x
                </div>
              </div>
              <div style={{ height: 5, background: 'var(--bd2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: i === 0 ? 'var(--err)' : '#f09595', borderRadius: 3, width: `${(item.total / max) * 100}%`, transition: 'width .5s' }} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 3 }}>{item.inspeksi} kali inspeksi</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Performa Mekanik ─────────────────────────────────────────────────
function MekanikPerforma({ inspections, users }) {
  const mechs = users.filter(u => u.role === 'mekanik')

  const stats = mechs.map(m => {
    // FIX: mekaniks embed menyimpan user_id (integer), cocokkan dengan m.id (integer)
    const myIns = inspections.filter(i =>
      (i.mekaniks || []).some(mk => mk.user_id === m.id)
    )
    const totalBad = myIns.reduce((s, i) => s + (i.answers || []).filter(a => a.answer === 'bad').length, 0)
    const totalRep = myIns.reduce((s, i) => s + (i.answers || []).filter(a => a.answer === 'repair').length, 0)
    return {
      nama: m.nama,
      nrp: m.nrp,
      jabatan: m.jabatan,
      inspeksi: myIns.length,
      bad: totalBad,
      repair: totalRep,
      total: totalBad + totalRep,
    }
  }).filter(s => s.inspeksi > 0).sort((a, b) => b.inspeksi - a.inspeksi)

  if (stats.length === 0) return <div style={{ color: 'var(--t3)', fontSize: 13, textAlign: 'center', padding: 20 }}>Belum ada data inspeksi mekanik</div>

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl">
        <thead>
          <tr>
            <th>Mekanik</th>
            <th style={{ textAlign: 'center' }}>Inspeksi</th>
            <th style={{ textAlign: 'center' }}>Order Part</th>
            <th style={{ textAlign: 'center' }}>Repair</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <tr key={i}>
              <td>
                <div style={{ fontWeight: 600, color: 'var(--t)', fontSize: 13 }}>{s.nama}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)' }}>{s.nrp} · {s.jabatan}</div>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span className="mono" style={{ fontWeight: 700, color: 'var(--pd)', fontSize: 14 }}>{s.inspeksi}</span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span style={{ background: 'var(--errbg)', color: 'var(--err)', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{s.bad}</span>
              </td>
              <td style={{ textAlign: 'center' }}>
                <span style={{ background: 'var(--wnbg)', color: 'var(--wn)', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{s.repair}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Analytics ───────────────────────────────────────────────────
const TABS = [
  { k: 'overview', l: '📊 Overview' },
  { k: 'weekly',   l: '📅 Mingguan' },
  { k: 'monthly',  l: '🗓 Bulanan'  },
  { k: 'unit',     l: '🚜 Per Unit' },
  { k: 'mekanik',  l: '👤 Mekanik'  },
]

export default function Analytics({ data, syncing }) {
  const { units, inspections, questions, users } = data
  const [tab, setTab] = useState('overview')

  const tInspeksi = inspections.length
  const tBad  = inspections.reduce((s, i) => s + (i.answers || []).filter(a => a.answer === 'bad').length, 0)
  const tRep  = inspections.reduce((s, i) => s + (i.answers || []).filter(a => a.answer === 'repair').length, 0)
  const tGood = inspections.reduce((s, i) => s + (i.answers || []).filter(a => a.answer === 'good').length, 0)
  const tAll  = tBad + tRep + tGood || 1

  const donut = [
    { name: 'Good',       val: tGood, color: '#16a34a' },
    { name: 'Order Part', val: tBad,  color: '#dc2626' },
    { name: 'Repair',     val: tRep,  color: '#d97706' },
  ].filter(d => d.val > 0)

  const byCat = useMemo(() => {
    const kats = [...new Set(questions.map(q => q.kategori))]
    return kats.map(k => {
      // FIX: cocokkan berdasarkan question_kategori embed, bukan lookup question_id
      let bad = 0, rep = 0
      inspections.forEach(ins => ins.answers?.forEach(a => {
        if (a.question_kategori !== k) return
        if (a.answer === 'bad') bad++
        if (a.answer === 'repair') rep++
      }))
      return { name: k, 'Order Part': bad, Repair: rep, total: bad + rep }
    }).filter(d => d.total > 0)
  }, [inspections, questions])

  return (
    <div className="fade">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t)' }}>Analytics</h1>
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>Analisis performa & trend kerusakan unit</p>
        </div>
        {syncing && <span className="spin" style={{ fontSize: 14, color: 'var(--t3)' }}>↻</span>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', whiteSpace: 'nowrap', flexShrink: 0, background: tab === t.k ? 'var(--p)' : 'transparent', color: tab === t.k ? '#1c1917' : 'var(--t3)', borderColor: tab === t.k ? 'var(--p)' : 'var(--bd)', transition: 'all .15s' }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }} className="g4">
            <StatCard label="Total Inspeksi" value={tInspeksi} color="var(--p)" />
            <StatCard label="Good"       value={tGood} color="var(--ok)"  sub={`${Math.round(tGood / tAll * 100)}%`} />
            <StatCard label="Order Part" value={tBad}  color="var(--err)" sub={`${Math.round(tBad  / tAll * 100)}%`} />
            <StatCard label="Repair"     value={tRep}  color="var(--wn)"  sub={`${Math.round(tRep  / tAll * 100)}%`} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }} className="g2c">
            <Section title="Status keseluruhan">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={donut.map(d => ({ name: d.name, value: d.val }))} cx="50%" cy="50%" innerRadius={52} outerRadius={82} dataKey="value" paddingAngle={3}>
                    {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v} item`, '']} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </Section>

            <Section title="Per kategori">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byCat} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bd2)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--t3)', fontSize: 9 }} />
                  <YAxis tick={{ fill: 'var(--t3)', fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="Order Part" fill="#dc2626" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Repair" fill="#d97706" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>

          <Section title="🏆 Top 5 komponen sering rusak">
            <TopDamage inspections={inspections} questions={questions} />
          </Section>
        </>
      )}

      {/* ── MINGGUAN ── */}
      {tab === 'weekly' && (
        <Section title="Trend 8 Minggu Terakhir">
          <TrendChart inspections={inspections} units={units} period="weekly" />
        </Section>
      )}

      {/* ── BULANAN ── */}
      {tab === 'monthly' && (
        <Section title="Trend 6 Bulan Terakhir">
          <TrendChart inspections={inspections} units={units} period="monthly" />
        </Section>
      )}

      {/* ── PER UNIT ── */}
      {tab === 'unit' && (
        <>
          <Section title="🚜 Unit paling sering bermasalah">
            <TopUnits inspections={inspections} units={units} />
          </Section>

          <Section title="Kerusakan per unit">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={units.map(u => {
                  // FIX #2c: i.unit_id adalah integer, u.id juga integer
                  const ins = inspections.filter(i => i.unit_id === u.id)
                  return {
                    name: u.nomor_unit,
                    'Order Part': ins.reduce((s, i) => s + (i.answers || []).filter(a => a.answer === 'bad').length, 0),
                    Repair:       ins.reduce((s, i) => s + (i.answers || []).filter(a => a.answer === 'repair').length, 0),
                    Inspeksi:     ins.length,
                  }
                })}
                margin={{ top: 5, right: 5, bottom: 5, left: -20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bd2)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--t3)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--t3)', fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Order Part" fill="#dc2626" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Repair"     fill="#d97706" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Inspeksi"   fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        </>
      )}

      {/* ── MEKANIK ── */}
      {tab === 'mekanik' && (
        <Section title="👤 Performa mekanik">
          <MekanikPerforma inspections={inspections} users={users} />
        </Section>
      )}
    </div>
  )
}