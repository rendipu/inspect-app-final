import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { api } from '../lib/api'
import MultiUserInput from '../components/MultiUserInput'
import FotoUpload from '../components/FotoUpload'

const ANS_COLOR   = { good: 'var(--ok)', bad: 'var(--err)', repair: 'var(--wn)' }
const WORK_STATUS = [
  { v: 'belum_dikerjakan', l: '⏺ Belum Dikerjakan', c: 'var(--err)' },
  { v: 'sudah_selesai',    l: '✓ Sudah Dikerjakan',  c: 'var(--ok)'  },
]
const CAT_BG = {
  Engine: 'var(--infbg)',
  Hydraulic: 'var(--wnbg)',
  Undercarriage: 'var(--purbg)',
  Electrical: 'var(--sfy)',
  Body: 'var(--bd2)',
  Safety: 'var(--errbg)',
}

// FIX TIMEZONE: pakai tanggal LOKAL bukan UTC
// new Date().toISOString() selalu UTC → jam 00:00-06:59 WIB masih "kemarin" UTC
// sehingga inspeksi kemarin malam terdeteksi sebagai "hari ini" atau sebaliknya
function getLocalDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isSameLocalDay(isoDateStr) {
  return getLocalDateStr(new Date(isoDateStr)) === getLocalDateStr()
}

export default function InspectionForm({ user, data, selUnit, setPage, refetch }) {
  const { units, users, inspections } = data
  const mechs = users.filter(u => u.role === 'mekanik')
  const gls   = users.filter(u => u.role === 'group_leader')

  const TODAY = useMemo(() => getLocalDateStr(), [])

  const currentUser = users.find(u => u.id === user.id)

  const [unitId,    setUnitId]    = useState(selUnit ? String(selUnit.id) : '')
  const [hm,        setHm]        = useState('')
  const [hmError,   setHmError]   = useState('')
  const [selMechs,  setSelMechs]  = useState(user.role === 'mekanik' && currentUser ? [currentUser] : [])
  const [start,     setStart]     = useState('')
  const [finish,    setFinish]    = useState('')
  const [glId,      setGlId]      = useState('')
  const [ans,       setAns]       = useState({})
  const [questions, setQuestions] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [saving,    setSaving]    = useState(false)

  // stockInfo: { [qid]: { found, jumlah, satuan, part_number, minimum } | { found: false } }
  const [stockInfo, setStockInfo] = useState({})
  const stockTimers = useRef({})

  const selectedUnit = units.find(u => String(u.id) === unitId)

  // FIX: isSameLocalDay pakai tanggal lokal — tidak salah di timezone WIB
  const todayInspection = unitId
    ? inspections.find(i => i.unit_id === parseInt(unitId, 10) && isSameLocalDay(i.tanggal))
    : null
  const alreadyDone = !!todayInspection

  // Load pertanyaan saat unit dipilih
  useEffect(() => {
    if (!unitId || alreadyDone) { setQuestions([]); return }
    const unit = units.find(u => String(u.id) === unitId)
    if (!unit) return
    let cancelled = false
    api.getQuestions({ unit_tipe: unit.tipe, brand: unit.brand })
      .then(res => { if (!cancelled) setQuestions(res) })
      .catch(() => { if (!cancelled) setQuestions([]) })
    return () => { cancelled = true }
  }, [unitId, units, alreadyDone])

  // Reset saat unit berubah
  useEffect(() => {
    if (selectedUnit) { setHm(selectedUnit.hm.toString()); setHmError('') }
    else { setHm(''); setHmError('') }
    setAns({})
    setStockInfo({})
  }, [unitId])

  const handleHmChange = (val) => {
    setHm(val)
    if (!selectedUnit) return
    const n = parseFloat(val)
    if (isNaN(n))             setHmError('Nilai HM tidak valid')
    else if (n < selectedUnit.hm) setHmError(`HM tidak boleh kurang dari HM saat ini (${selectedUnit.hm.toLocaleString()} jam)`)
    else                      setHmError('')
  }

  const grouped = questions.reduce((acc, q) => {
    if (!acc[q.kategori]) acc[q.kategori] = []
    acc[q.kategori].push(q)
    return acc
  }, {})

  const setA = useCallback((qid, key, val) =>
    setAns(prev => ({ ...prev, [qid]: { ...prev[qid], [key]: val } })), [])

  // Cek stok saat part_number diketik — debounce 600ms, exact match by part_number
  const checkStock = useCallback((qid, partNumber) => {
    clearTimeout(stockTimers.current[qid])
    const pn = partNumber?.trim()
    if (!pn) {
      setStockInfo(prev => { const n = { ...prev }; delete n[qid]; return n })
      return
    }
    stockTimers.current[qid] = setTimeout(async () => {
      try {
        const res   = await api.getStocks({ search: pn })
        const found = res.find(s => s.part_number.toLowerCase() === pn.toLowerCase())
        setStockInfo(prev => ({
          ...prev,
          [qid]: found
            ? { found: true, jumlah: found.jumlah_stock, satuan: found.satuan, minimum: found.minimum_stock }
            : { found: false },
        }))
      } catch {
        setStockInfo(prev => { const n = { ...prev }; delete n[qid]; return n })
      }
    }, 600)
  }, [])

  const handleSubmit = async () => {
    if (!unitId || !hm || selMechs.length === 0 || !start || !finish || !glId) {
      alert('Lengkapi semua data header!'); return
    }
    if (hmError) { alert(hmError); return }
    if (questions.length > 0 && !questions.every(q => ans[q.id]?.answer)) {
      alert('Semua pertanyaan harus dijawab!'); return
    }
    for (const q of questions) {
      const a = ans[q.id]
      if (a?.answer === 'bad') {
        if (!a.part_name?.trim()) { alert(`Pertanyaan "${q.pertanyaan}": Part Name wajib diisi!`); return }
        if (!a.qty || parseInt(a.qty) < 1) { alert(`Pertanyaan "${q.pertanyaan}": Quantity wajib diisi (min. 1)!`); return }
      }
      if (a?.answer === 'repair' && a.needs_part) {
        if (!a.rep_part_name?.trim()) { alert(`Pertanyaan "${q.pertanyaan}": Part Name untuk order wajib diisi!`); return }
        if (!a.rep_qty || parseInt(a.rep_qty) < 1) { alert(`Pertanyaan "${q.pertanyaan}": Quantity order wajib diisi (min. 1)!`); return }
      }
    }

    const answers = questions.map(q => {
      const a    = ans[q.id]
      const item = { question_id: q.id, answer: a.answer }
      if (a.answer === 'bad') {
        const si = stockInfo[q.id]
        // auto_approve: true jika part_number ada di stok DAN stok > 0
        const autoApprove = !!(si?.found && si.jumlah > 0 && a.part_number?.trim())
        item.part_order = {
          part_name:    a.part_name   || '',
          part_number:  a.part_number || '',
          quantity:     parseInt(a.qty) || 1,
          keterangan:   a.ket         || '',
          foto_url:     a.foto_url    || null,
          auto_approve: autoApprove,
          work_status:  a.work_status || 'belum_dikerjakan',
        }
      }
      if (a.answer === 'repair') {
        const needsPart = !!a.needs_part
        item.repair = {
          keterangan:  a.rep_ket || '',
          foto_url:    a.foto_url || null,
          work_status: a.work_status || 'belum_dikerjakan',
          needs_part:  needsPart,
          part_order: needsPart ? {
            part_name:    a.rep_part_name   || '',
            part_number:  a.rep_part_number || '',
            quantity:     parseInt(a.rep_qty) || 1,
            keterangan:   a.rep_part_ket    || '',
            foto_url:     a.rep_part_foto   || null,
            auto_approve: !!(stockInfo[q.id]?.found && stockInfo[q.id]?.jumlah > 0 && a.rep_part_number?.trim()),
          } : null,
        }
      }
      return item
    })

    setSaving(true)
    try {
      await api.createInspection({
        unit_id:         parseInt(unitId, 10),
        hour_meter:      parseFloat(hm),
        jam_start:       start,
        jam_finish:      finish,
        group_leader_id: parseInt(glId),
        mekanik_ids:     selMechs.map(m => m.id),
        answers,
        tanggal:         TODAY,
      })
      await refetch()
      setSubmitted(true)
    } catch (e) {
      alert('Gagal menyimpan: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Sukses ───────────────────────────────────────────────────────────
  if (submitted) return (
    <div className="fade" style={{ textAlign: 'center', paddingTop: 60 }}>
      <div style={{ width: 80, height: 80, background: 'var(--okbg)', border: '2px solid var(--okbd)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 16px' }}>✓</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t)', marginBottom: 8 }}>Inspeksi Tersimpan!</h2>
      <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 24 }}>Data inspeksi berhasil disimpan ke sistem</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn-g" onClick={() => setPage('dashboard')}>← Dashboard</button>
        <button className="btn-y" onClick={() => {
          setSubmitted(false); setAns({}); setUnitId('')
          setHm(''); setStart(''); setFinish(''); setGlId(''); setStockInfo({})
        }}>Inspeksi Baru</button>
      </div>
    </div>
  )

  const IS = { width: '100%' }

  return (
    <div className="fade">
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t)', marginBottom: 4 }}>Form Inspeksi</h1>
      <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 18 }}>Isi semua data dengan lengkap dan benar</p>

      {/* ── FORM HEADER ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pd)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 14 }}>
          Informasi Inspeksi
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="g2">

          <div style={{ gridColumn: '1 / -1' }}>
            <label className="lbl" htmlFor="unit-id">Unit *</label>
            <select
              id="unit-id" name="unitId"
              value={unitId}
              onChange={e => { setUnitId(e.target.value ? String(parseInt(e.target.value, 10)) : ''); setAns({}); setStockInfo({}) }}
              style={{ ...IS, borderColor: alreadyDone ? 'var(--err)' : undefined }}
            >
              <option value="">-- Pilih Unit --</option>
              {units.map(u => {
                const done = inspections.find(i => i.unit_id === u.id && isSameLocalDay(i.tanggal))
                return (
                  <option key={u.id} value={String(u.id)}>
                    {u.nomor_unit} — {u.brand} {u.tipe}{done ? ' ✓ (sudah diinspeksi)' : ''}
                  </option>
                )
              })}
            </select>

            {selectedUnit && !alreadyDone && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--t3)' }}>
                Brand: <strong style={{ color: 'var(--t2)' }}>{selectedUnit.brand}</strong> ·
                Model: {selectedUnit.model} ·
                HM: <strong style={{ color: 'var(--pd)' }}>{selectedUnit.hm.toLocaleString()} jam</strong>
              </div>
            )}

            {alreadyDone && selectedUnit && (() => {
              const mechNames = (todayInspection.mekaniks || []).map(m => m.user_nama).filter(Boolean).join(', ')
              const gl = todayInspection.group_leader_nama || '-'
              return (
                <div style={{ marginTop: 8, background: 'var(--errbg)', border: '1.5px solid var(--errbd)', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>🚫</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--err)', marginBottom: 6 }}>
                        {selectedUnit.nomor_unit} sudah diinspeksi hari ini
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ fontSize: 12, color: 'var(--t2)' }}>⏰ Waktu: <strong>{todayInspection.jam_start} – {todayInspection.jam_finish}</strong></div>
                        <div style={{ fontSize: 12, color: 'var(--t2)' }}>👤 Mekanik: <strong>{mechNames || '-'}</strong></div>
                        <div style={{ fontSize: 12, color: 'var(--t2)' }}>👨‍💼 GL: <strong>{gl}</strong></div>
                        <div style={{ fontSize: 12, color: 'var(--t2)' }}>📊 HM: <strong className="mono">{todayInspection.hour_meter?.toLocaleString()} jam</strong></div>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--t3)', background: 'var(--sf)', border: '1px solid var(--errbd)', borderRadius: 6, padding: '5px 10px' }}>
                        Setiap unit hanya boleh diinspeksi 1 kali per hari. Silakan pilih unit lain.
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>

          {!alreadyDone && unitId && (
            <>
              <div>
                <label className="lbl" htmlFor="hm">Hour Meter *</label>
                <input id="hm" name="hm" type="number" value={hm} onChange={e => handleHmChange(e.target.value)}
                  placeholder={selectedUnit ? `Min. ${selectedUnit.hm}` : 'e.g. 4523'}
                  min={selectedUnit?.hm || 0} step="0.1"
                  style={{ ...IS, borderColor: hmError ? 'var(--err)' : undefined }} />
                {hmError ? (
                  <div style={{ marginTop: 5, fontSize: 11, color: 'var(--err)', fontWeight: 600 }}>⚠ {hmError}</div>
                ) : hm && selectedUnit && parseFloat(hm) > selectedUnit.hm ? (
                  <div style={{ marginTop: 5, fontSize: 11, color: 'var(--ok)', fontWeight: 600 }}>
                    ✓ +{(parseFloat(hm) - selectedUnit.hm).toLocaleString()} jam dari HM sebelumnya
                  </div>
                ) : hm && selectedUnit && parseFloat(hm) === selectedUnit.hm ? (
                  <div style={{ marginTop: 5, fontSize: 11, color: 'var(--t3)' }}>ℹ Sama dengan HM saat ini</div>
                ) : null}
              </div>

              <div>
                <label className="lbl" htmlFor="jam-start">Jam Start *</label>
                <input id="jam-start" name="jamStart" type="time" value={start} onChange={e => setStart(e.target.value)} style={IS} />
              </div>

              <div>
                <label className="lbl" htmlFor="jam-finish">Jam Finish *</label>
                <input id="jam-finish" name="jamFinish" type="time" value={finish} onChange={e => setFinish(e.target.value)} style={IS} />
              </div>

              <div>
                <label className="lbl" htmlFor="gl-id">Group Leader *</label>
                <select id="gl-id" name="glId" value={glId} onChange={e => setGlId(e.target.value)} style={IS}>
                  <option value="">-- Pilih GL --</option>
                  {gls.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label className="lbl" htmlFor="mekanik-pelaksana">Mekanik Pelaksana *</label>
                <MultiUserInput inputId="mekanik-pelaksana" users={mechs} selected={selMechs} onChange={setSelMechs} placeholder="Ketik nama mekanik..." />
              </div>
            </>
          )}
        </div>
      </div>

      {unitId && !alreadyDone && questions.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--t3)', padding: 32, marginBottom: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
          <div>Memuat pertanyaan inspeksi...</div>
        </div>
      )}
      {unitId && !alreadyDone && questions.length > 0 && selectedUnit && (
        <div style={{ background: 'var(--infbg)', border: '1px solid var(--infbd)', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 12, color: 'var(--inf)' }}>
          ℹ {questions.length} pertanyaan untuk <strong>{selectedUnit.brand} {selectedUnit.tipe}</strong>
        </div>
      )}

      {/* ── PERTANYAAN ── */}
      {!alreadyDone && Object.entries(grouped).map(([kat, qs]) => (
        <div key={kat} className="card" style={{ marginBottom: 14 }}>
          <div style={{ background: CAT_BG[kat] || 'var(--bd2)', borderRadius: 6, padding: '5px 12px', marginBottom: 14, display: 'inline-block', fontSize: 12, fontWeight: 700, color: 'var(--t2)', border: '1px solid var(--bd)' }}>
            {kat}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {qs.map(q => {
              const a  = ans[q.id] || {}
              const si = stockInfo[q.id]
              return (
                <div key={q.id} style={{ background: 'var(--bd2)', borderRadius: 8, padding: 14, border: a.answer ? `1.5px solid ${ANS_COLOR[a.answer]}26` : '1.5px solid transparent', transition: 'border-color .2s' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t)', marginBottom: 4 }}>
                    {q.urutan}. {q.pertanyaan}
                  </div>
                  {/* {(Array.isArray(q.unit_tipe) ? q.unit_tipe.length > 0 : q.unit_tipe) || (Array.isArray(q.brand) ? q.brand.length > 0 : q.brand) ? (
                    <div style={{ fontSize: 10, color: 'var(--inf)', marginBottom: 8 }}>
                      Khusus: {[...(Array.isArray(q.brand) ? q.brand : (q.brand ? [q.brand] : [])), ...(Array.isArray(q.unit_tipe) ? q.unit_tipe : (q.unit_tipe ? [q.unit_tipe] : []))].join(', ')}
                    </div>
                  ) : null} */}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: (a.answer === 'bad' || a.answer === 'repair') ? 12 : 0 }}>
                    {['good', 'bad', 'repair'].map(opt => {
                      const c = ANS_COLOR[opt]; const sel = a.answer === opt
                      return (
                        <button key={opt} onClick={() => setA(q.id, 'answer', opt)}
                          style={{ padding: '6px 18px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${c}`, background: sel ? c : 'transparent', color: sel ? '#fff' : c, transition: 'all .15s' }}>
                          {opt === 'good' ? '✓ Good' : opt === 'bad' ? '✕ Bad / Order' : '🔧 Repair'}
                        </button>
                      )
                    })}
                  </div>

                  {/* BAD */}
                  {a.answer === 'bad' && (
                    <div style={{ background: 'var(--errbg)', border: '1.5px solid var(--errbd)', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--err)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>⚠ Data Order Part</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} className="g2">
                        <div>
                          <label className="lbl" htmlFor={`part-name-${q.id}`}>Part Name *</label>
                          <input id={`part-name-${q.id}`} name={`part_name_${q.id}`} value={a.part_name || ''} onChange={e => setA(q.id, 'part_name', e.target.value)}
                            placeholder="e.g. Air Filter"
                            style={{ ...IS, borderColor: a.part_name === '' ? 'var(--err)' : undefined }} />
                        </div>
                        <div>
                          <label className="lbl" htmlFor={`part-num-${q.id}`}>Part Number</label>
                          <input
                            id={`part-num-${q.id}`} name={`part_num_${q.id}`}
                            value={a.part_number || ''}
                            onChange={e => {
                              setA(q.id, 'part_number', e.target.value)
                              checkStock(q.id, e.target.value)
                            }}
                            placeholder="e.g. AF-1234" style={IS} />
                        </div>
                        <div>
                          <label className="lbl" htmlFor={`qty-${q.id}`}>Quantity *</label>
                          <input id={`qty-${q.id}`} name={`qty_${q.id}`} type="number" value={a.qty ?? 1} onChange={e => setA(q.id, 'qty', e.target.value)} placeholder="1" min="1" style={IS} />
                        </div>
                        <div>
                          <label className="lbl" htmlFor={`ket-${q.id}`}>Keterangan</label>
                          <input id={`ket-${q.id}`} name={`ket_${q.id}`} value={a.ket || ''} onChange={e => setA(q.id, 'ket', e.target.value)} placeholder="Detail kondisi..." style={IS} />
                        </div>
                      </div>

                      {/* CAUTION STOK — muncul setelah part_number diisi */}
                      {si && a.part_number?.trim() && (
                        si.found ? (
                          <div style={{ marginTop: 10, background: si.jumlah > 0 ? 'var(--okbg)' : 'var(--wnbg)', border: `1.5px solid ${si.jumlah > 0 ? 'var(--okbd)' : 'var(--wnbd)'}`, borderRadius: 7, padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{si.jumlah > 0 ? '✅' : '⚠️'}</span>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: si.jumlah > 0 ? 'var(--ok)' : 'var(--wn)' }}>
                                {si.jumlah > 0
                                  ? `Tersedia di stock — ${si.jumlah} ${si.satuan}`
                                  : `Stock habis — 0 ${si.satuan}`}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                                {si.jumlah > 0
                                  ? 'Order akan di-approve otomatis tanpa perlu approval GL'
                                  : 'Stok ada di database tapi kosong, order tetap perlu approval GL'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginTop: 10, background: 'var(--bd2)', border: '1.5px solid var(--bd)', borderRadius: 7, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 16 }}>📦</span>
                            <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                              Part number tidak ditemukan di stock — order perlu approval GL
                            </div>
                          </div>
                        )
                      )}

                      {/* Status Pengerjaan */}
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                          Status Pengerjaan
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {WORK_STATUS.map(ws => {
                            const isSel = (a.work_status || 'belum_dikerjakan') === ws.v
                            return (
                              <button key={ws.v} type="button" onClick={() => setA(q.id, 'work_status', ws.v)}
                                style={{ padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${ws.c}`, background: isSel ? ws.c : 'transparent', color: isSel ? '#fff' : ws.c, transition: 'all .15s' }}>
                                {ws.l}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <FotoUpload value={a.foto_url || null} onChange={val => setA(q.id, 'foto_url', val)} label="📷 Upload Foto Kondisi" color="var(--err)" />
                    </div>
                  )}

                  {/* REPAIR */}
                  {a.answer === 'repair' && (
                    <div style={{ background: 'var(--wnbg)', border: '1.5px solid var(--wnbd)', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--wn)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>🔧 Detail Perbaikan</div>
                      <textarea aria-label={`Detail perbaikan ${q.pertanyaan}`} id={`rep-ket-${q.id}`} name={`rep_ket_${q.id}`} value={a.rep_ket || ''} onChange={e => setA(q.id, 'rep_ket', e.target.value)}
                        placeholder="Jelaskan perbaikan yang dilakukan..." rows={2} style={{ ...IS, resize: 'none', marginBottom: 10 }} />

                      {/* Status Pengerjaan */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                          Status Pengerjaan
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {WORK_STATUS.map(ws => {
                            const isSel = (a.work_status || 'belum_dikerjakan') === ws.v
                            return (
                              <button key={ws.v} type="button" onClick={() => setA(q.id, 'work_status', ws.v)}
                                style={{ padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${ws.c}`, background: isSel ? ws.c : 'transparent', color: isSel ? '#fff' : ws.c, transition: 'all .15s' }}>
                                {ws.l}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Toggle perlu order barang */}
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', marginBottom: 6, display: 'block' }}>
                          Perlu Order Barang?
                        </label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {[{ v: false, l: 'Tidak' }, { v: true, l: 'Ya, perlu order' }].map(opt => (
                            <button key={String(opt.v)} type="button"
                              onClick={() => setA(q.id, 'needs_part', opt.v)}
                              style={{ padding: '5px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', background: (a.needs_part === opt.v || (!opt.v && !a.needs_part)) ? 'var(--wn)' : 'transparent', color: (a.needs_part === opt.v || (!opt.v && !a.needs_part)) ? '#fff' : 'var(--wn)', borderColor: 'var(--wn)', transition: 'all .15s' }}>
                              {opt.l}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Form order barang jika perlu */}
                      {a.needs_part && (
                        <div style={{ background: 'var(--errbg)', border: '1.5px solid var(--errbd)', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--err)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>⚠ Data Order Part</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} className="g2">
                            <div>
                              <label className="lbl" htmlFor={`rep-part-name-${q.id}`}>Part Name *</label>
                              <input id={`rep-part-name-${q.id}`} name={`rep_part_name_${q.id}`} value={a.rep_part_name || ''} onChange={e => setA(q.id, 'rep_part_name', e.target.value)}
                                placeholder="e.g. Air Filter" style={{ ...IS, borderColor: a.rep_part_name === '' ? 'var(--err)' : undefined }} />
                            </div>
                            <div>
                              <label className="lbl" htmlFor={`rep-part-num-${q.id}`}>Part Number</label>
                              <input id={`rep-part-num-${q.id}`} name={`rep_part_num_${q.id}`} value={a.rep_part_number || ''}
                                onChange={e => { setA(q.id, 'rep_part_number', e.target.value); checkStock(q.id + '_rep', e.target.value) }}
                                placeholder="e.g. AF-1234" style={IS} />
                            </div>
                            <div>
                              <label className="lbl" htmlFor={`rep-qty-${q.id}`}>Quantity *</label>
                              <input id={`rep-qty-${q.id}`} name={`rep_qty_${q.id}`} type="number" value={a.rep_qty ?? 1} onChange={e => setA(q.id, 'rep_qty', e.target.value)} placeholder="1" min="1" style={IS} />
                            </div>
                            <div>
                              <label className="lbl" htmlFor={`rep-ket-${q.id}`}>Keterangan</label>
                              <input id={`rep-ket-${q.id}`} name={`rep_part_ket_${q.id}`} value={a.rep_part_ket || ''} onChange={e => setA(q.id, 'rep_part_ket', e.target.value)} placeholder="Detail kebutuhan..." style={IS} />
                            </div>
                          </div>
                          {/* Caution stok untuk repair order */}
                          {stockInfo[q.id + '_rep'] && a.rep_part_number?.trim() && (
                            stockInfo[q.id + '_rep'].found ? (
                              <div style={{ marginTop: 8, background: stockInfo[q.id + '_rep'].jumlah > 0 ? 'var(--okbg)' : 'var(--wnbg)', border: `1.5px solid ${stockInfo[q.id + '_rep'].jumlah > 0 ? 'var(--okbd)' : 'var(--wnbd)'}`, borderRadius: 7, padding: '7px 10px', display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                                <span style={{ fontSize: 15 }}>{stockInfo[q.id + '_rep'].jumlah > 0 ? '✅' : '⚠️'}</span>
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: stockInfo[q.id + '_rep'].jumlah > 0 ? 'var(--ok)' : 'var(--wn)' }}>
                                    {stockInfo[q.id + '_rep'].jumlah > 0 ? `Tersedia — ${stockInfo[q.id + '_rep'].jumlah} ${stockInfo[q.id + '_rep'].satuan}, order auto-approve` : `Stock habis, perlu approval GL`}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ marginTop: 8, background: 'var(--bd2)', border: '1.5px solid var(--bd)', borderRadius: 7, padding: '7px 10px', fontSize: 11, color: 'var(--t3)' }}>
                                📦 Part tidak ditemukan di stock — perlu approval GL
                              </div>
                            )
                          )}
                          <div style={{ marginTop: 8 }}>
                            <FotoUpload value={a.rep_part_foto || null} onChange={val => setA(q.id, 'rep_part_foto', val)} label="📷 Upload Foto Part" color="var(--err)" />
                          </div>
                        </div>
                      )}

                      <FotoUpload value={a.foto_url || null} onChange={val => setA(q.id, 'foto_url', val)} label="📷 Upload Foto Perbaikan" color="var(--wn)" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {!alreadyDone && questions.length > 0 && (
        <button className="btn-y" onClick={handleSubmit} disabled={saving || !!hmError}
          style={{ width: '100%', padding: 13, fontSize: 14, letterSpacing: '.06em', marginBottom: 24, boxShadow: '0 2px 10px rgba(245,158,11,.28)', opacity: (saving || !!hmError) ? 0.5 : 1, cursor: hmError ? 'not-allowed' : 'pointer' }}>
          {saving ? '⏳ Menyimpan...' : '💾 SIMPAN HASIL INSPEKSI'}
        </button>
      )}
    </div>
  )
}