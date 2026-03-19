import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import MultiUserInput from '../components/MultiUserInput'

const TODAY = new Date().toISOString().split('T')[0]
const ANS_COLOR = { good: 'var(--ok)', bad: 'var(--err)', repair: 'var(--wn)' }
const CAT_BG = {
  Engine: 'var(--infbg)',
  Hydraulic: 'var(--wnbg)',
  Undercarriage: 'var(--purbg)',
  Electrical: 'var(--sfy)',
  Body: 'var(--bd2)',
  Safety: 'var(--errbg)',
}

export default function InspectionForm({ user, data, selUnit, setPage, refetch }) {
  const { units, users, inspections } = data
  const mechs = users.filter(u => u.role === 'mekanik')
  const gls = users.filter(u => u.role === 'group_leader')

  const currentUser = users.find(u => u.id === user.id)

  const [unitId, setUnitId] = useState(selUnit ? String(selUnit.id) : '')
  const [hm, setHm] = useState('')
  const [hmError, setHmError] = useState('')
  const [selMechs, setSelMechs] = useState(user.role === 'mekanik' && currentUser ? [currentUser] : [])
  const [start, setStart] = useState('')
  const [finish, setFinish] = useState('')
  const [glId, setGlId] = useState('')
  const [ans, setAns] = useState({})
  const [questions, setQuestions] = useState([])
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const selectedUnit = units.find(u => u._id === unitId)


  // Cek apakah unit sudah diinspeksi hari ini — dari data lokal
  const todayInspection = unitId
    ? inspections.find(i => {
      const tgl = new Date(i.tanggal).toISOString().split('T')[0]
      return i.unit_id === parseInt(unitId) && tgl === TODAY
    })
    : null

  const alreadyDone = !!todayInspection

  // Load pertanyaan saat unit dipilih
  useEffect(() => {
    if (!unitId || alreadyDone) { setQuestions([]); return }
    const unit = units.find(u => u._id === unitId)
    if (!unit) return
    api.getQuestions({ unit_tipe: unit.tipe, brand: unit.brand })
      .then(setQuestions)
      .catch(() => setQuestions([]))
  }, [unitId, units])

  // Set default HM dari unit yang dipilih
  useEffect(() => {
    if (selectedUnit) {
      setHm(selectedUnit.hm.toString())
      setHmError('')
    } else {
      setHm('')
      setHmError('')
    }
    setAns({})
  }, [unitId])

  const handleHmChange = (val) => {
    setHm(val)
    if (!selectedUnit) return
    const newHm = parseFloat(val)
    if (isNaN(newHm)) {
      setHmError('Nilai HM tidak valid')
    } else if (newHm < selectedUnit.hm) {
      setHmError(`HM tidak boleh kurang dari HM saat ini (${selectedUnit.hm.toLocaleString()} jam)`)
    } else {
      setHmError('')
    }
  }

  const grouped = questions.reduce((acc, q) => {
    if (!acc[q.kategori]) acc[q.kategori] = []
    acc[q.kategori].push(q)
    return acc
  }, {})

  const setA = (qid, key, val) =>
    setAns(prev => ({ ...prev, [qid]: { ...prev[qid], [key]: val } }))

  const handleSubmit = async () => {
    if (!unitId || !hm || selMechs.length === 0 || !start || !finish || !glId) {
      alert('Lengkapi semua data header!'); return
    }
    if (hmError) {
      alert(hmError); return
    }
    if (questions.length > 0 && !questions.every(q => ans[q.id]?.answer)) {
      alert('Semua pertanyaan harus dijawab!'); return
    }

    const answers = questions.map(q => {
      const a = ans[q.id]
      const item = { question_id: q.id, answer: a.answer }
      if (a.answer === 'bad') item.part_order = { part_name: a.part_name || '', part_number: a.part_number || '', quantity: parseInt(a.qty) || 1, keterangan: a.ket || '', foto_url: null }
      if (a.answer === 'repair') item.repair = { keterangan: a.rep_ket || '', foto_url: null }
      return item
    })

    setSaving(true)
    try {
      await api.createInspection({
        unit_id: parseInt(unitId),
        hour_meter: parseFloat(hm),
        jam_start: start,
        jam_finish: finish,
        group_leader_id: parseInt(glId),
        mekanik_ids: selMechs.map(m => m.id),
        answers,
        tanggal: TODAY,
      })
      await refetch()
      setSubmitted(true)
    } catch (e) {
      alert('Gagal menyimpan: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Sukses ──────────────────────────────────────────────────────────
  if (submitted) return (
    <div className="fade" style={{ textAlign: 'center', paddingTop: 60 }}>
      <div style={{ width: 80, height: 80, background: 'var(--okbg)', border: '2px solid var(--okbd)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 16px' }}>✓</div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t)', marginBottom: 8 }}>Inspeksi Tersimpan!</h2>
      <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 24 }}>Data inspeksi berhasil disimpan ke sistem</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn-g" onClick={() => setPage('dashboard')}>← Dashboard</button>
        <button className="btn-y" onClick={() => {
          setSubmitted(false); setAns({}); setUnitId('')
          setHm(''); setStart(''); setFinish(''); setGlId('')
        }}>
          Inspeksi Baru
        </button>
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

          {/* ── Pilih Unit ── */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="lbl">Unit *</label>
            <select
              value={unitId}
              onChange={e => { setUnitId(e.target.value); setAns({}) }}
              style={{ ...IS, borderColor: alreadyDone ? 'var(--err)' : undefined }}
            >
              <option value="">-- Pilih Unit --</option>
              {units.map(u => {
                const ins = inspections.find(i => {
                  const tgl = new Date(i.tanggal).toISOString().split('T')[0]
                  return i.unit_id === u._id && tgl === TODAY
                })
                return (
                  <option key={u._id} value={u._id}>
                    {u.nomor_unit} — {u.brand} {u.tipe}{ins ? ' ✓ (sudah diinspeksi)' : ''}
                  </option>
                )
              })}
            </select>

            {/* Info unit normal */}
            {selectedUnit && !alreadyDone && (
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--t3)' }}>
                Brand: <strong style={{ color: 'var(--t2)' }}>{selectedUnit.brand}</strong> ·
                Model: {selectedUnit.model} ·
                HM: <strong style={{ color: 'var(--pd)' }}>{selectedUnit.hm.toLocaleString()} jam</strong>
              </div>
            )}

            {/* ── WARNING UNIT SUDAH DIINSPEKSI — muncul langsung saat pilih unit ── */}
            {alreadyDone && selectedUnit && (() => {
              const mechs = (todayInspection.mekaniks || []).map(m => m.user_nama).filter(Boolean).join(', ')
              const gl = todayInspection.group_leader?.nama || '-'
              return (
                <div style={{ marginTop: 8, background: 'var(--errbg)', border: '1.5px solid var(--errbd)', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>🚫</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--err)', marginBottom: 6 }}>
                        {selectedUnit.nomor_unit} sudah diinspeksi hari ini
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ fontSize: 12, color: 'var(--t2)' }}>
                          ⏰ Waktu: <strong>{todayInspection.jam_start} – {todayInspection.jam_finish}</strong>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--t2)' }}>
                          👤 Mekanik: <strong>{mechs || '-'}</strong>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--t2)' }}>
                          👨‍💼 GL: <strong>{gl}</strong>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--t2)' }}>
                          📊 HM: <strong className="mono">{todayInspection.hour_meter?.toLocaleString()} jam</strong>
                        </div>
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

          {/* Input berikut hanya tampil jika unit belum diinspeksi */}
          {!alreadyDone && unitId && (
            <>
              {/* Hour Meter */}
              <div>
                <label className="lbl">Hour Meter *</label>
                <input
                  type="number"
                  value={hm}
                  onChange={e => handleHmChange(e.target.value)}
                  placeholder={selectedUnit ? `Min. ${selectedUnit.hm}` : 'e.g. 4523'}
                  min={selectedUnit?.hm || 0}
                  step="0.1"
                  style={{ ...IS, borderColor: hmError ? 'var(--err)' : undefined }}
                />
                {/* ── VALIDASI HM — muncul langsung saat input ── */}
                {hmError ? (
                  <div style={{ marginTop: 5, fontSize: 11, color: 'var(--err)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>⚠</span> {hmError}
                  </div>
                ) : hm && selectedUnit && parseFloat(hm) > selectedUnit.hm ? (
                  <div style={{ marginTop: 5, fontSize: 11, color: 'var(--ok)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>✓</span> +{(parseFloat(hm) - selectedUnit.hm).toLocaleString()} jam dari HM sebelumnya
                  </div>
                ) : hm && selectedUnit && parseFloat(hm) === selectedUnit.hm ? (
                  <div style={{ marginTop: 5, fontSize: 11, color: 'var(--t3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>ℹ</span> Sama dengan HM saat ini
                  </div>
                ) : null}
              </div>

              {/* Jam Start */}
              <div>
                <label className="lbl">Jam Start *</label>
                <input type="time" value={start} onChange={e => setStart(e.target.value)} style={IS} />
              </div>

              {/* Jam Finish */}
              <div>
                <label className="lbl">Jam Finish *</label>
                <input type="time" value={finish} onChange={e => setFinish(e.target.value)} style={IS} />
              </div>

              {/* Group Leader */}
              <div>
                <label className="lbl">Group Leader *</label>
                <select value={glId} onChange={e => setGlId(e.target.value)} style={IS}>
                  <option value="">-- Pilih GL --</option>
                  {gls.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
                </select>
              </div>

              {/* Mekanik */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="lbl">Mekanik Pelaksana *</label>
                <MultiUserInput
                  users={mechs}
                  selected={selMechs}
                  onChange={setSelMechs}
                  placeholder="Ketik nama mekanik..."
                />
              </div>
            </>
          )}

        </div>
      </div>

      {/* ── INFO PERTANYAAN ── */}
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

      {/* ── PERTANYAAN PER KATEGORI ── */}
      {!alreadyDone && Object.entries(grouped).map(([kat, qs]) => (
        <div key={kat} className="card" style={{ marginBottom: 14 }}>
          <div style={{ background: CAT_BG[kat] || 'var(--bd2)', borderRadius: 6, padding: '5px 12px', marginBottom: 14, display: 'inline-block', fontSize: 12, fontWeight: 700, color: 'var(--t2)', border: '1px solid var(--bd)' }}>
            {kat}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {qs.map(q => {
              const a = ans[q.id] || {}
              return (
                <div key={q.id} style={{ background: 'var(--bd2)', borderRadius: 8, padding: 14, border: a.answer ? `1.5px solid ${ANS_COLOR[a.answer]}26` : '1.5px solid transparent', transition: 'border-color .2s' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t)', marginBottom: 4 }}>
                    {q.urutan}. {q.pertanyaan}
                  </div>
                  {(Array.isArray(q.unit_tipe) ? q.unit_tipe.length > 0 : q.unit_tipe) || (Array.isArray(q.brand) ? q.brand.length > 0 : q.brand) ? (
                    <div style={{ fontSize: 10, color: 'var(--inf)', marginBottom: 8 }}>
                      Khusus: {[...(Array.isArray(q.brand) ? q.brand : (q.brand ? [q.brand] : [])), ...(Array.isArray(q.unit_tipe) ? q.unit_tipe : (q.unit_tipe ? [q.unit_tipe] : []))].join(', ')}
                    </div>
                  ) : null}
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
                  {a.answer === 'bad' && (
                    <div style={{ background: 'var(--errbg)', border: '1.5px solid var(--errbd)', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--err)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>⚠ Data Order Part</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} className="g2">
                        <div><label className="lbl">Part Name *</label><input value={a.part_name || ''} onChange={e => setA(q.id, 'part_name', e.target.value)} placeholder="e.g. Air Filter" style={IS} /></div>
                        <div><label className="lbl">Part Number</label><input value={a.part_number || ''} onChange={e => setA(q.id, 'part_number', e.target.value)} placeholder="e.g. AF-1234" style={IS} /></div>
                        <div><label className="lbl">Quantity *</label><input type="number" value={a.qty || ''} onChange={e => setA(q.id, 'qty', e.target.value)} placeholder="1" style={IS} /></div>
                        <div><label className="lbl">Keterangan</label><input value={a.ket || ''} onChange={e => setA(q.id, 'ket', e.target.value)} placeholder="Detail kondisi..." style={IS} /></div>
                      </div>
                      <button style={{ marginTop: 10, background: 'transparent', border: '1.5px dashed var(--p)', color: 'var(--pd)', padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                        📷 Upload Foto
                      </button>
                    </div>
                  )}
                  {a.answer === 'repair' && (
                    <div style={{ background: 'var(--wnbg)', border: '1.5px solid var(--wnbd)', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--wn)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>🔧 Detail Perbaikan</div>
                      <textarea value={a.rep_ket || ''} onChange={e => setA(q.id, 'rep_ket', e.target.value)} placeholder="Jelaskan perbaikan yang dilakukan..." rows={2} style={{ ...IS, resize: 'none' }} />
                      <button style={{ marginTop: 8, background: 'transparent', border: '1.5px dashed var(--p)', color: 'var(--pd)', padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                        📷 Upload Foto
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* ── TOMBOL SIMPAN ── */}
      {!alreadyDone && questions.length > 0 && (
        <button
          className="btn-y"
          onClick={handleSubmit}
          disabled={saving || !!hmError}
          style={{ width: '100%', padding: 13, fontSize: 14, letterSpacing: '.06em', marginBottom: 24, boxShadow: '0 2px 10px rgba(245,158,11,.28)', opacity: (saving || !!hmError) ? 0.5 : 1, cursor: hmError ? 'not-allowed' : 'pointer' }}
        >
          {saving ? '⏳ Menyimpan...' : '💾 SIMPAN HASIL INSPEKSI'}
        </button>
      )}
    </div>
  )
}