import { useState } from 'react'
import Badge from '../components/Badge'
import { api } from '../lib/api'

// Catatan ID di project ini:
// Setiap dokumen MongoDB punya DUA field id:
//   _id → ObjectId string (auto dari MongoDB, selalu ada)
//   id  → Integer auto-increment custom via Counter schema
// Semua FK relasi (unit_id, user_id, dll) memakai INTEGER 'id'
// Maka perbandingan relasi SELALU pakai .id — bukan ._id

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const IS = {
  background: 'var(--sf)', border: '1.5px solid var(--bd)', color: 'var(--t)',
  borderRadius: 8, padding: '7px 10px', fontFamily: 'inherit', fontSize: 12, outline: 'none',
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab({ users, refetch }) {
  const [editRow, setEditRow] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nrp: '', nama: '', jabatan: '', role: 'mekanik', password: '' })
  const [saving, setSaving] = useState(false)

  const saveNew = async () => {
    if (!form.nrp || !form.nama || !form.password) { alert('NRP, Nama, Password wajib!'); return }
    setSaving(true)
    try {
      await api.createUser(form)
      await refetch()
      setForm({ nrp: '', nama: '', jabatan: '', role: 'mekanik', password: '' })
      setShowForm(false)
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      await api.updateUser(editRow.id, editRow)   // PUT /api/users/:id — integer id
      await refetch()
      setEditRow(null)
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const remove = async (id) => {
    if (!confirm('Hapus user ini?')) return
    try { await api.deleteUser(id); await refetch() } catch (e) { alert(e.message) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--t3)' }}>{users.length} users</span>
        <button className="btn-y btn-sm" onClick={() => setShowForm(p => !p)}>+ Tambah User</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 12, background: 'var(--sfy)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }} className="g3">
            {[['NRP *', 'nrp', 'text'], ['Nama *', 'nama', 'text'], ['Jabatan', 'jabatan', 'text']].map(([p, k, t]) => (
              <input key={k} placeholder={p} type={t} value={form[k]}
                onChange={e => setForm(v => ({ ...v, [k]: e.target.value }))} style={{ ...IS, width: '100%' }} />
            ))}
            <select value={form.role} onChange={e => setForm(v => ({ ...v, role: e.target.value }))} style={{ ...IS, width: '100%' }}>
              <option value="mekanik">Mekanik</option>
              <option value="group_leader">Group Leader</option>
              <option value="admin">Admin</option>
              <option value="warehouse">Warehouse</option>
            </select>
            <input placeholder="Password *" type="password" value={form.password}
              onChange={e => setForm(v => ({ ...v, password: e.target.value }))} style={{ ...IS, width: '100%' }} />
            <button className="btn-ok" onClick={saveNew} disabled={saving}>{saving ? '...' : 'Simpan'}</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="ptbl">
          <table className="tbl">
            <thead>
              <tr><th>NRP</th><th>Nama</th><th>Jabatan</th><th>Role</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id}>
                  {editRow?._id === u._id ? (
                    <>
                      <td><input value={editRow.nrp} onChange={e => setEditRow(v => ({ ...v, nrp: e.target.value }))} style={IS} /></td>
                      <td><input value={editRow.nama} onChange={e => setEditRow(v => ({ ...v, nama: e.target.value }))} style={IS} /></td>
                      <td><input value={editRow.jabatan || ''} onChange={e => setEditRow(v => ({ ...v, jabatan: e.target.value }))} style={IS} /></td>
                      <td>
                        <select value={editRow.role} onChange={e => setEditRow(v => ({ ...v, role: e.target.value }))} style={IS}>
                          <option value="mekanik">mekanik</option>
                          <option value="group_leader">group_leader</option>
                          <option value="admin">admin</option>
                          <option value="warehouse">warehouse</option>
                        </select>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn-ok btn-sm" style={{ marginRight: 4 }} onClick={saveEdit} disabled={saving}>✓</button>
                        <button className="btn-g btn-sm" onClick={() => setEditRow(null)}>✕</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td><span className="mono" style={{ color: 'var(--pd)', fontWeight: 700 }}>{u.nrp}</span></td>
                      <td style={{ fontWeight: 600, color: 'var(--t)' }}>{u.nama}</td>
                      <td style={{ color: 'var(--t3)' }}>{u.jabatan}</td>
                      <td><Badge type={u.role} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn-g btn-sm" style={{ marginRight: 6 }} onClick={() => setEditRow({ ...u })}>Edit</button>
                        <button className="btn-err btn-sm" onClick={() => remove(u.id)}>Hapus</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--t3)' }}>Belum ada user</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Units Tab ────────────────────────────────────────────────────────────────
function UnitsTab({ units, refetch }) {
  const [editRow, setEditRow] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nomor_unit: '', tipe: '', brand: '', model: '', tahun: '', hm: '' })
  const [saving, setSaving] = useState(false)

  const saveNew = async () => {
    if (!form.nomor_unit || !form.tipe || !form.brand) { alert('No. Unit, Tipe, Brand wajib!'); return }
    setSaving(true)
    try {
      await api.createUnit(form)
      await refetch()
      setForm({ nomor_unit: '', tipe: '', brand: '', model: '', tahun: '', hm: '' })
      setShowForm(false)
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      await api.updateUnit(editRow.id, editRow)   // PUT /api/units/:id — integer id
      await refetch()
      setEditRow(null)
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const remove = async (id) => {
    if (!confirm('Hapus unit ini?')) return
    try { await api.deleteUnit(id); await refetch() } catch (e) { alert(e.message) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--t3)' }}>{units.length} unit</span>
        <button className="btn-y btn-sm" onClick={() => setShowForm(p => !p)}>+ Tambah Unit</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 12, background: 'var(--sfy)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }} className="g3">
            {[['No. Unit *', 'nomor_unit'], ['Tipe *', 'tipe'], ['Brand *', 'brand'], ['Model', 'model']].map(([p, k]) => (
              <input key={k} placeholder={p} value={form[k]}
                onChange={e => setForm(v => ({ ...v, [k]: e.target.value }))} style={{ ...IS, width: '100%' }} />
            ))}
            <input placeholder="Tahun" type="number" value={form.tahun}
              onChange={e => setForm(v => ({ ...v, tahun: e.target.value }))} style={{ ...IS, width: '100%' }} />
            <input placeholder="Hour Meter" type="number" value={form.hm}
              onChange={e => setForm(v => ({ ...v, hm: e.target.value }))} style={{ ...IS, width: '100%' }} />
            <button className="btn-ok" onClick={saveNew} disabled={saving}>{saving ? '...' : 'Simpan'}</button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="ptbl">
          <table className="tbl">
            <thead>
              <tr><th>No. Unit</th><th>Tipe</th><th>Brand</th><th>Model</th><th>Tahun</th><th>HM</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {units.map(u => (
                <tr key={u._id}>
                  {editRow?._id === u._id ? (
                    <>
                      <td><input value={editRow.nomor_unit} onChange={e => setEditRow(v => ({ ...v, nomor_unit: e.target.value }))} style={{ ...IS, width: '100%' }} /></td>
                      <td><input value={editRow.tipe} onChange={e => setEditRow(v => ({ ...v, tipe: e.target.value }))} style={{ ...IS, width: '100%' }} /></td>
                      <td><input value={editRow.brand} onChange={e => setEditRow(v => ({ ...v, brand: e.target.value }))} style={{ ...IS, width: '100%' }} /></td>
                      <td><input value={editRow.model || ''} onChange={e => setEditRow(v => ({ ...v, model: e.target.value }))} style={{ ...IS, width: '100%' }} /></td>
                      <td><input type="number" value={editRow.tahun || ''} onChange={e => setEditRow(v => ({ ...v, tahun: parseInt(e.target.value) }))} style={{ ...IS, width: 70 }} /></td>
                      <td><input type="number" value={editRow.hm || 0} onChange={e => setEditRow(v => ({ ...v, hm: parseFloat(e.target.value) }))} style={{ ...IS, width: 80 }} /></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn-ok btn-sm" style={{ marginRight: 4 }} onClick={saveEdit} disabled={saving}>✓</button>
                        <button className="btn-g btn-sm" onClick={() => setEditRow(null)}>✕</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td><span className="mono" style={{ color: 'var(--pd)', fontWeight: 700 }}>{u.nomor_unit}</span></td>
                      <td style={{ fontWeight: 600 }}>{u.tipe}</td>
                      <td><span style={{ background: 'var(--pl)', color: 'var(--wn)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{u.brand}</span></td>
                      <td style={{ color: 'var(--t3)' }}>{u.model}</td>
                      <td>{u.tahun}</td>
                      <td><span className="mono">{u.hm?.toLocaleString()}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn-g btn-sm" style={{ marginRight: 6 }} onClick={() => setEditRow({ ...u })}>Edit</button>
                        <button className="btn-err btn-sm" onClick={() => remove(u.id)}>Hapus</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {units.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--t3)' }}>Belum ada unit</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Questions Tab ────────────────────────────────────────────────────────────
function QuestionsTab({ questions, refetch }) {
  const [editRow, setEditRow] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ kategori: '', pertanyaan: '', urutan: '', unit_tipe: '', brand: '' })
  const [saving, setSaving] = useState(false)

  const saveNew = async () => {
    if (!form.kategori || !form.pertanyaan) { alert('Kategori & Pertanyaan wajib!'); return }
    setSaving(true)
    try {
      await api.createQuestion(form)
      await refetch()
      setForm({ kategori: '', pertanyaan: '', urutan: '', unit_tipe: '', brand: '' })
      setShowForm(false)
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      await api.updateQuestion(editRow.id, editRow)  // PUT /api/questions/:id — integer id
      await refetch()
      setEditRow(null)
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const remove = async (id) => {
    if (!confirm('Hapus pertanyaan ini?')) return
    try { await api.deleteQuestion(id); await refetch() } catch (e) { alert(e.message) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--t3)' }}>{questions.length} pertanyaan</span>
        <button className="btn-y btn-sm" onClick={() => setShowForm(p => !p)}>+ Tambah</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 12, background: 'var(--sfy)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input placeholder="Kategori *" value={form.kategori}
              onChange={e => setForm(v => ({ ...v, kategori: e.target.value }))} style={{ ...IS, width: 120 }} />
            <input placeholder="Pertanyaan *" value={form.pertanyaan}
              onChange={e => setForm(v => ({ ...v, pertanyaan: e.target.value }))} style={{ ...IS, flex: 1, minWidth: 200 }} />
            <input placeholder="No." type="number" value={form.urutan}
              onChange={e => setForm(v => ({ ...v, urutan: e.target.value }))} style={{ ...IS, width: 60 }} />
            <input placeholder="Tipe Unit (kosong=semua)" value={form.unit_tipe}
              onChange={e => setForm(v => ({ ...v, unit_tipe: e.target.value }))} style={{ ...IS, width: 160 }} />
            <input placeholder="Brand (kosong=semua)" value={form.brand}
              onChange={e => setForm(v => ({ ...v, brand: e.target.value }))} style={{ ...IS, width: 140 }} />
            <button className="btn-ok" onClick={saveNew} disabled={saving}>{saving ? '...' : 'Simpan'}</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--t3)' }}>
            💡 Kosongkan Tipe Unit &amp; Brand agar pertanyaan berlaku untuk semua unit
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[...questions].sort((a, b) => a.urutan - b.urutan).map(q => (
          <div key={q._id} className="scard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            {editRow?.id === q.id ? (
              <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                <input type="number" value={editRow.urutan}
                  onChange={e => setEditRow(v => ({ ...v, urutan: parseInt(e.target.value) }))} style={{ ...IS, width: 55 }} />
                <input value={editRow.kategori}
                  onChange={e => setEditRow(v => ({ ...v, kategori: e.target.value }))} style={{ ...IS, width: 110 }} />
                <input value={editRow.pertanyaan}
                  onChange={e => setEditRow(v => ({ ...v, pertanyaan: e.target.value }))} style={{ ...IS, flex: 1, minWidth: 180 }} />
                <input value={editRow.unit_tipe || ''} placeholder="Tipe"
                  onChange={e => setEditRow(v => ({ ...v, unit_tipe: e.target.value || null }))} style={{ ...IS, width: 100 }} />
                <input value={editRow.brand || ''} placeholder="Brand"
                  onChange={e => setEditRow(v => ({ ...v, brand: e.target.value || null }))} style={{ ...IS, width: 90 }} />
                <button className="btn-ok btn-sm" onClick={saveEdit} disabled={saving}>✓</button>
                <button className="btn-g btn-sm" onClick={() => setEditRow(null)}>✕</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, flexWrap: 'wrap' }}>
                  <span className="mono" style={{ color: 'var(--p)', width: 20, fontWeight: 700 }}>{q.urutan}</span>
                  <span style={{ background: 'var(--pl)', color: 'var(--wn)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{q.kategori}</span>
                  <span style={{ fontSize: 13, color: 'var(--t)' }}>{q.pertanyaan}</span>
                  {(q.unit_tipe || q.brand) && (
                    <span style={{ fontSize: 10, color: 'var(--inf)', background: 'var(--infbg)', border: '1px solid var(--infbd)', padding: '1px 6px', borderRadius: 4 }}>
                      {q.brand ? `${q.brand} ${q.unit_tipe}` : q.unit_tipe}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button className="btn-g btn-sm" onClick={() => setEditRow({ ...q })}>Edit</button>
                  <button className="btn-err btn-sm" onClick={() => remove(q.id)}>Hapus</button>
                </div>
              </>
            )}
          </div>
        ))}
        {questions.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>Belum ada pertanyaan</div>
        )}
      </div>
    </div>
  )
}

// ─── Schedules Tab ────────────────────────────────────────────────────────────
function SchedulesTab({ units, recurring, refetch }) {
  const [form, setForm] = useState({ unit_id: '', hari: [] })
  const [saving, setSaving] = useState(false)

  const toggleHari = h => setForm(v => ({
    ...v,
    hari: v.hari.includes(h) ? v.hari.filter(x => x !== h) : [...v.hari, h],
  }))

  const save = async () => {
    if (!form.unit_id || form.hari.length === 0) { alert('Pilih unit dan minimal 1 hari!'); return }
    setSaving(true)
    try {
      await api.saveRecurringSchedule({ unit_id: parseInt(form.unit_id), hari: form.hari })
      await refetch()
      setForm({ unit_id: '', hari: [] })
    } catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const remove = async (id) => {
    if (!confirm('Hapus jadwal ini?')) return
    try { await api.deleteRecurringSchedule(id); await refetch() } catch (e) { alert(e.message) }
  }

  const toggle = async (id, aktif) => {
    try { await api.updateRecurringSchedule(id, { aktif }); await refetch() } catch (e) { alert(e.message) }
  }

  // recurring.unit_id adalah integer → bandingkan dengan u.id (integer), bukan u._id (ObjectId)
  const unitsWithoutSchedule = units.filter(u => !recurring.find(r => r.unit_id === u.id))
  return (
    <div>
      <div className="card" style={{ marginBottom: 12, background: 'var(--sfy)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pd)', marginBottom: 10 }}>Tambah Jadwal Berulang</div>

        <div style={{ marginBottom: 10 }}>
          <label className="lbl">Unit</label>
          <select value={form.unit_id} onChange={e => setForm(v => ({ ...v, unit_id: e.target.value }))} style={{ ...IS, width: '100%' }}>
            <option value="">-- Pilih Unit --</option>
            {/* value={u.id} agar parseInt(form.unit_id) bisa dikirim ke API sebagai integer */}
            {unitsWithoutSchedule.map(u => (
              <option key={u.id} value={u.id}>{u.nomor_unit} — {u.brand} {u.tipe}</option>
            ))}
          </select>
          {unitsWithoutSchedule.length === 0 && units.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>Semua unit sudah memiliki jadwal</div>
          )}
        </div>

        <div style={{ marginBottom: 10 }}>
          <label className="lbl">Hari Inspeksi</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {HARI_LIST.map(h => (
              <button key={h} onClick={() => toggleHari(h)}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', border: '1.5px solid',
                  background: form.hari.includes(h) ? 'var(--p)' : 'transparent',
                  color: form.hari.includes(h) ? '#1c1917' : 'var(--t3)',
                  borderColor: form.hari.includes(h) ? 'var(--p)' : 'var(--bd)',
                  transition: 'all .15s',
                }}>
                {h}
              </button>
            ))}
          </div>
        </div>

        <button className="btn-y btn-sm" onClick={save} disabled={saving}>
          {saving ? 'Menyimpan...' : '+ Simpan Jadwal'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recurring.map(s => (
          <div key={s._id} className="scard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', opacity: s.aktif ? 1 : 0.5 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="mono" style={{ color: 'var(--pd)', fontWeight: 700 }}>{s.unit?.nomor_unit}</span>
                <span style={{ fontSize: 12, color: 'var(--t3)' }}>{s.unit?.brand} {s.unit?.tipe}</span>
                {!s.aktif && (
                  <span style={{ fontSize: 10, color: 'var(--t3)', background: 'var(--bd2)', padding: '1px 6px', borderRadius: 4 }}>
                    Nonaktif
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {s.hari.map(h => (
                  <span key={h} style={{ background: 'var(--pl)', color: 'var(--wn)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                    {h}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {/* toggle dan remove pakai s.id (integer), bukan s._id */}
              <button className="btn-g btn-sm" onClick={() => toggle(s._id, !s.aktif)}>
                {s.aktif ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
              <button className="btn-err btn-sm" onClick={() => remove(s._id)}>Hapus</button>
            </div>
          </div>
        ))}
        {recurring.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>Belum ada jadwal berulang</div>
        )}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const TABS = [
  { k: 'users', l: '👥 Pengguna' },
  { k: 'units', l: '🚜 Unit' },
  { k: 'questions', l: '❓ Pertanyaan' },
  { k: 'schedules', l: '📅 Jadwal' },
]

export default function AdminPanel({ data, refetch }) {
  const [tab, setTab] = useState('users')
  const { users, units, questions, recurring } = data

  return (
    <div className="fade">
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t)', marginBottom: 4 }}>Manajemen Admin</h1>
      <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 14 }}>CRUD semua data sistem</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', borderBottom: '1.5px solid var(--bd)', paddingBottom: 12 }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', border: '1.5px solid',
              background: tab === t.k ? 'var(--p)' : 'transparent',
              color: tab === t.k ? '#1c1917' : 'var(--t3)',
              borderColor: tab === t.k ? 'var(--p)' : 'var(--bd)',
              transition: 'all .15s',
            }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab users={users || []} refetch={refetch} />}
      {tab === 'units' && <UnitsTab units={units || []} refetch={refetch} />}
      {tab === 'questions' && <QuestionsTab questions={questions || []} refetch={refetch} />}
      {tab === 'schedules' && <SchedulesTab units={units || []} recurring={recurring || []} refetch={refetch} />}
    </div>
  )
}