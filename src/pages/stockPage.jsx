import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api'

const SATUAN_LIST = ['pcs', 'liter', 'meter', 'set', 'roll', 'kg', 'box', 'unit']
const canEdit     = (role) => role === 'warehouse' || role === 'admin'

function fmtDateTime(d) {
  return new Date(d).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

// ─── Badge stock status ───────────────────────────────────────────────
function StockStatus({ jumlah, minimum }) {
  const kosong  = jumlah === 0
  const rendah  = jumlah > 0 && jumlah <= minimum
  const aman    = jumlah > minimum

  if (kosong) return (
    <span className="tag" style={{ background:'var(--errbg)', border:'1px solid var(--errbd)', color:'var(--err)' }}>
      Habis
    </span>
  )
  if (rendah) return (
    <span className="tag" style={{ background:'var(--wnbg)', border:'1px solid var(--wnbd)', color:'var(--wn)' }}>
      ⚠ Stok Rendah
    </span>
  )
  return (
    <span className="tag" style={{ background:'var(--okbg)', border:'1px solid var(--okbd)', color:'var(--ok)' }}>
      Aman
    </span>
  )
}

// ─── Modal Form ───────────────────────────────────────────────────────
function StockForm({ item, onSave, onClose, saving }) {
  const isEdit = !!item?.id
  const [form, setForm] = useState({
    part_number:          item?.part_number          || '',
    material_description: item?.material_description || '',
    jumlah_stock:         item?.jumlah_stock          ?? '',
    satuan:               item?.satuan               || 'pcs',
    location_storage:     item?.location_storage     || '',
    minimum_stock:        item?.minimum_stock         ?? 0,
    harga_satuan:         item?.harga_satuan          || '',
    keterangan:           item?.keterangan            || '',
  })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'var(--sf)', borderRadius:12, padding:24, width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ fontSize:16, fontWeight:800, color:'var(--t)' }}>
            {isEdit ? 'Edit Stock' : 'Tambah Stock Baru'}
          </h2>
          <button onClick={onClose} style={{ background:'transparent', border:'none', fontSize:20, cursor:'pointer', color:'var(--t3)', lineHeight:1 }}>✕</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }} className="g2">
          <div style={{ gridColumn:'1 / -1' }}>
            <label className="lbl">Part Number *</label>
            <input value={form.part_number} onChange={e => set('part_number', e.target.value)}
              placeholder="e.g. AF-BT1234" style={{ width:'100%' }} disabled={isEdit} />
            {isEdit && <div style={{ fontSize:10, color:'var(--t3)', marginTop:3 }}>Part number tidak bisa diubah</div>}
          </div>
          <div style={{ gridColumn:'1 / -1' }}>
            <label className="lbl">Material Description *</label>
            <input value={form.material_description} onChange={e => set('material_description', e.target.value)}
              placeholder="e.g. Air Filter Element" style={{ width:'100%' }} />
          </div>
          <div>
            <label className="lbl">Jumlah Stock</label>
            <input type="number" value={form.jumlah_stock} onChange={e => set('jumlah_stock', e.target.value)}
              placeholder="0" min="0" style={{ width:'100%' }} disabled={isEdit} />
            {isEdit && <div style={{ fontSize:10, color:'var(--t3)', marginTop:3 }}>Ubah via Stock Movement</div>}
          </div>
          <div>
            <label className="lbl">Satuan *</label>
            <select value={form.satuan} onChange={e => set('satuan', e.target.value)} style={{ width:'100%' }}>
              {SATUAN_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">Location Storage</label>
            <input value={form.location_storage} onChange={e => set('location_storage', e.target.value)}
              placeholder="e.g. RAK-A1" style={{ width:'100%' }} />
          </div>
          <div>
            <label className="lbl">Minimum Stock</label>
            <input type="number" value={form.minimum_stock} onChange={e => set('minimum_stock', e.target.value)}
              placeholder="0" min="0" style={{ width:'100%' }} />
            <div style={{ fontSize:10, color:'var(--t3)', marginTop:3 }}>Alert jika stock ≤ nilai ini</div>
          </div>
          <div>
            <label className="lbl">Harga Satuan (Rp)</label>
            <input type="number" value={form.harga_satuan} onChange={e => set('harga_satuan', e.target.value)}
              placeholder="opsional" min="0" style={{ width:'100%' }} />
          </div>
          <div style={{ gridColumn:'1 / -1' }}>
            <label className="lbl">Keterangan</label>
            <textarea value={form.keterangan} onChange={e => set('keterangan', e.target.value)}
              placeholder="Catatan tambahan..." rows={2} style={{ width:'100%', resize:'none' }} />
          </div>
        </div>

        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button className="btn-g" onClick={onClose} style={{ flex:1 }}>Batal</button>
          <button className="btn-y" onClick={() => onSave(form)} disabled={saving}
            style={{ flex:2, opacity: saving ? 0.7 : 1 }}>
            {saving ? '⏳ Menyimpan...' : isEdit ? '💾 Simpan Perubahan' : '➕ Tambah Stock'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal Stock Movement ─────────────────────────────────────────────
function MovementForm({ item, onSave, onClose, saving }) {
  const [tipe,       setTipe]       = useState('masuk')
  const [jumlah,     setJumlah]     = useState('')
  const [keterangan, setKeterangan] = useState('')

  const preview = () => {
    if (!jumlah || isNaN(parseInt(jumlah))) return null
    const qty = parseInt(jumlah)
    if (tipe === 'masuk')      return item.jumlah_stock + qty
    if (tipe === 'keluar')     return item.jumlah_stock - qty
    if (tipe === 'adjustment') return qty
    return null
  }
  const after = preview()

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'var(--sf)', borderRadius:12, padding:24, width:'100%', maxWidth:420, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ fontSize:16, fontWeight:800, color:'var(--t)' }}>Stock Movement</h2>
          <button onClick={onClose} style={{ background:'transparent', border:'none', fontSize:20, cursor:'pointer', color:'var(--t3)' }}>✕</button>
        </div>

        {/* Info item */}
        <div style={{ background:'var(--sfy)', border:'1.5px solid var(--wnbd)', borderRadius:8, padding:'10px 14px', marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--pd)' }}>{item.part_number}</div>
          <div style={{ fontSize:12, color:'var(--t2)' }}>{item.material_description}</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:6, marginTop:4 }}>
            <span style={{ fontSize:10, color:'var(--t3)' }}>Stock saat ini:</span>
            <span className="mono" style={{ fontSize:18, fontWeight:700, color:'var(--t)' }}>{item.jumlah_stock}</span>
            <span style={{ fontSize:12, color:'var(--t3)' }}>{item.satuan}</span>
          </div>
        </div>

        {/* Tipe movement */}
        <div style={{ marginBottom:12 }}>
          <label className="lbl">Tipe Pergerakan</label>
          <div style={{ display:'flex', gap:8 }}>
            {[
              { v:'masuk',      l:'➕ Masuk',      c:'var(--ok)'  },
              { v:'keluar',     l:'➖ Keluar',     c:'var(--err)' },
              { v:'adjustment', l:'🔄 Adjustment', c:'var(--inf)' },
            ].map(t => (
              <button key={t.v} onClick={() => setTipe(t.v)}
                style={{ flex:1, padding:'8px 4px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', border:`1.5px solid ${t.c}`, background: tipe===t.v ? t.c : 'transparent', color: tipe===t.v ? '#fff' : t.c, transition:'all .15s' }}>
                {t.l}
              </button>
            ))}
          </div>
          {tipe === 'adjustment' && (
            <div style={{ fontSize:11, color:'var(--inf)', marginTop:4 }}>
              ℹ Adjustment akan langsung mengubah stock ke nilai yang diisi
            </div>
          )}
        </div>

        {/* Jumlah */}
        <div style={{ marginBottom:12 }}>
          <label className="lbl">{tipe === 'adjustment' ? 'Jumlah Stock Baru' : 'Jumlah'} *</label>
          <input type="number" value={jumlah} onChange={e => setJumlah(e.target.value)}
            placeholder={tipe === 'adjustment' ? 'Stock baru...' : 'Masukkan jumlah...'}
            min="0" style={{ width:'100%' }} />
        </div>

        {/* Preview */}
        {after !== null && (
          <div style={{ background: after < 0 ? 'var(--errbg)' : 'var(--okbg)', border:`1px solid ${after < 0 ? 'var(--errbd)' : 'var(--okbd)'}`, borderRadius:8, padding:'8px 14px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:12, color: after < 0 ? 'var(--err)' : 'var(--ok)' }}>
              {after < 0 ? '⚠ Stock tidak mencukupi!' : `Stock setelah: `}
            </span>
            {after >= 0 && (
              <span className="mono" style={{ fontSize:16, fontWeight:700, color:'var(--ok)' }}>
                {after} {item.satuan}
              </span>
            )}
          </div>
        )}

        {/* Keterangan */}
        <div style={{ marginBottom:20 }}>
          <label className="lbl">Keterangan</label>
          <input value={keterangan} onChange={e => setKeterangan(e.target.value)}
            placeholder="e.g. Penerimaan PO #1234" style={{ width:'100%' }} />
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button className="btn-g" onClick={onClose} style={{ flex:1 }}>Batal</button>
          <button className="btn-y" onClick={() => onSave({ tipe, jumlah: parseInt(jumlah), keterangan })}
            disabled={saving || !jumlah || isNaN(parseInt(jumlah)) || (after !== null && after < 0)}
            style={{ flex:2, opacity: (saving || !jumlah) ? 0.6 : 1 }}>
            {saving ? '⏳ Menyimpan...' : '💾 Simpan Movement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main StockPage ───────────────────────────────────────────────────
export default function StockPage({ user }) {
  const [stocks,      setStocks]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [filterLow,   setFilterLow]   = useState(false)
  const [filterSatuan,setFilterSatuan]= useState('all')

  const [showForm,    setShowForm]    = useState(false)
  const [showMove,    setShowMove]    = useState(false)
  const [editItem,    setEditItem]    = useState(null)
  const [moveItem,    setMoveItem]    = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')

  const satuanList = ['all', ...new Set(stocks.map(s => s.satuan))]

  const loadStocks = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search)    params.search    = search
      if (filterLow) params.low_stock = 'true'
      const res = await api.getStocks(params)
      setStocks(res)
    } catch (e) {
      setError('Gagal memuat data stock')
    } finally {
      setLoading(false)
    }
  }, [search, filterLow])

  useEffect(() => {
    const timer = setTimeout(loadStocks, 300)
    return () => clearTimeout(timer)
  }, [loadStocks])

  const filtered = filterSatuan === 'all'
    ? stocks
    : stocks.filter(s => s.satuan === filterSatuan)

  // Summary
  const totalItems  = stocks.length
  const lowItems    = stocks.filter(s => s.jumlah_stock > 0 && s.jumlah_stock <= s.minimum_stock).length
  const emptyItems  = stocks.filter(s => s.jumlah_stock === 0).length
  const totalNilai  = stocks.reduce((sum, s) => sum + (s.jumlah_stock * (s.harga_satuan || 0)), 0)

  const handleSave = async (form) => {
    setSaving(true); setError(''); setSuccess('')
    try {
      if (editItem?.id) {
        await api.updateStock(editItem.id, form)
        setSuccess('Stock berhasil diupdate')
      } else {
        await api.createStock(form)
        setSuccess('Stock baru berhasil ditambahkan')
      }
      setShowForm(false); setEditItem(null)
      await loadStocks()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleMovement = async (moveData) => {
    setSaving(true); setError(''); setSuccess('')
    try {
      await api.stockMovement(moveItem.id, moveData)
      const tipeLabel = moveData.tipe === 'masuk' ? 'masuk' : moveData.tipe === 'keluar' ? 'keluar' : 'adjustment'
      setSuccess(`Stock movement (${tipeLabel}) berhasil disimpan`)
      setShowMove(false); setMoveItem(null)
      await loadStocks()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, partNumber) => {
    if (!confirm(`Hapus stock ${partNumber}? Data tidak bisa dikembalikan.`)) return
    try {
      await api.deleteStock(id)
      setSuccess(`Stock ${partNumber} dihapus`)
      await loadStocks()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="fade">
      <h1 style={{ fontSize:20, fontWeight:800, color:'var(--t)', marginBottom:4 }}>Stock Barang</h1>
      <p style={{ fontSize:13, color:'var(--t3)', marginBottom:18 }}>Manajemen stock spare part & material</p>

      {/* Notifikasi */}
      {error && (
        <div style={{ background:'var(--errbg)', border:'1px solid var(--errbd)', color:'var(--err)', borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:600, marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>⚠ {error}</span>
          <button onClick={() => setError('')} style={{ background:'none', border:'none', color:'var(--err)', cursor:'pointer', fontSize:16, lineHeight:1 }}>✕</button>
        </div>
      )}
      {success && (
        <div style={{ background:'var(--okbg)', border:'1px solid var(--okbd)', color:'var(--ok)', borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:600, marginBottom:14, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>✓ {success}</span>
          <button onClick={() => setSuccess('')} style={{ background:'none', border:'none', color:'var(--ok)', cursor:'pointer', fontSize:16, lineHeight:1 }}>✕</button>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }} className="g4">
        {[
          { l:'Total Item',   v: totalItems,  c:'var(--p)',   sub:'jenis barang' },
          { l:'Stok Rendah',  v: lowItems,    c:'var(--wn)',  sub:'perlu restock' },
          { l:'Stok Habis',   v: emptyItems,  c:'var(--err)', sub:'segera restock' },
          { l:'Nilai Stock',  v: totalNilai > 0 ? `Rp ${(totalNilai/1000000).toFixed(1)}jt` : '-', c:'var(--ok)', sub:'estimasi nilai' },
        ].map(s => (
          <div key={s.l} className="card" style={{ borderTop:`3px solid ${s.c}`, padding:'14px 16px' }}>
            <div className="lbl" style={{ marginBottom:4 }}>{s.l}</div>
            <div className="mono" style={{ fontSize:22, fontWeight:700, color:'var(--t)' }}>{s.v}</div>
            <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Cari part number / deskripsi / lokasi..."
          style={{ flex:1, minWidth:200 }}
        />
        <select value={filterSatuan} onChange={e => setFilterSatuan(e.target.value)} style={{ minWidth:100 }}>
          {satuanList.map(s => <option key={s} value={s}>{s === 'all' ? 'Semua Satuan' : s}</option>)}
        </select>
        <button
          onClick={() => setFilterLow(p => !p)}
          style={{ padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', border:'1.5px solid', background: filterLow ? 'var(--wn)' : 'transparent', color: filterLow ? '#fff' : 'var(--wn)', borderColor:'var(--wn)', transition:'all .15s', whiteSpace:'nowrap' }}
        >
          ⚠ Stok Rendah {filterLow && `(${lowItems})`}
        </button>
        {canEdit(user.role) && (
          <button className="btn-y" onClick={() => { setEditItem(null); setShowForm(true) }} style={{ whiteSpace:'nowrap' }}>
            + Tambah Item
          </button>
        )}
      </div>

      {/* Tabel */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:48, color:'var(--t3)' }}>
            <span className="spin" style={{ fontSize:24, display:'block', marginBottom:8 }}>↻</span>
            Memuat data stock...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:48, color:'var(--t3)' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>📦</div>
            <div style={{ fontSize:14, fontWeight:600 }}>Tidak ada data stock</div>
            {canEdit(user.role) && (
              <button className="btn-y" style={{ marginTop:16 }} onClick={() => { setEditItem(null); setShowForm(true) }}>
                + Tambah Item Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="ptbl">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Part Number</th>
                  <th>Material Description</th>
                  <th style={{ textAlign:'center' }}>Stock</th>
                  <th style={{ textAlign:'center' }}>Min. Stock</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Update Terakhir</th>
                  {canEdit(user.role) && <th>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const lastLog = s.stock_logs?.[0]
                  const isLow   = s.jumlah_stock > 0 && s.jumlah_stock <= s.minimum_stock
                  const isEmpty = s.jumlah_stock === 0

                  return (
                    <tr key={s.id} style={{ background: isEmpty ? 'var(--errbg)' : isLow ? 'var(--wnbg)26' : undefined }}>
                      <td>
                        <span className="mono" style={{ fontWeight:700, color:'var(--pd)', fontSize:13 }}>{s.part_number}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight:600, color:'var(--t)', fontSize:13 }}>{s.material_description}</div>
                        {s.keterangan && <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{s.keterangan}</div>}
                        {s.harga_satuan && <div style={{ fontSize:11, color:'var(--t3)' }}>Rp {s.harga_satuan.toLocaleString()}/{s.satuan}</div>}
                      </td>
                      <td style={{ textAlign:'center' }}>
                        <div style={{ display:'flex', alignItems:'baseline', gap:4, justifyContent:'center' }}>
                          <span className="mono" style={{ fontSize:18, fontWeight:700, color: isEmpty ? 'var(--err)' : isLow ? 'var(--wn)' : 'var(--t)' }}>
                            {s.jumlah_stock}
                          </span>
                          <span style={{ fontSize:11, color:'var(--t3)' }}>{s.satuan}</span>
                        </div>
                      </td>
                      <td style={{ textAlign:'center' }}>
                        <span className="mono" style={{ color:'var(--t3)' }}>{s.minimum_stock} {s.satuan}</span>
                      </td>
                      <td>
                        {s.location_storage
                          ? <span style={{ background:'var(--purbg)', color:'var(--pur)', border:'1px solid var(--purbd)', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight:700, fontFamily:'monospace' }}>{s.location_storage}</span>
                          : <span style={{ color:'var(--t3)', fontSize:12 }}>-</span>}
                      </td>
                      <td><StockStatus jumlah={s.jumlah_stock} minimum={s.minimum_stock} /></td>
                      <td>
                        {lastLog ? (
                          <div>
                            <div style={{ fontSize:11, color:'var(--t2)', fontWeight:600 }}>{fmtDateTime(lastLog.createdAt)}</div>
                            <div style={{ fontSize:10, color:'var(--t3)' }}>
                              {lastLog.tipe === 'masuk' ? '↑' : lastLog.tipe === 'keluar' ? '↓' : '⇄'}
                              {' '}{lastLog.jumlah} {s.satuan} · {lastLog.user?.nama}
                            </div>
                          </div>
                        ) : <span style={{ fontSize:11, color:'var(--t3)' }}>Belum ada</span>}
                      </td>
                      {canEdit(user.role) && (
                        <td style={{ whiteSpace:'nowrap' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            <button
                              className="btn-sm"
                              onClick={() => { setMoveItem(s); setShowMove(true) }}
                              style={{ background:'var(--okbg)', color:'var(--ok)', border:'1.5px solid var(--okbd)', fontWeight:700, fontSize:11 }}
                            >
                              ±
                            </button>
                            <button
                              className="btn-g btn-sm"
                              onClick={() => { setEditItem(s); setShowForm(true) }}
                            >
                              Edit
                            </button>
                            {user.role === 'admin' && (
                              <button
                                className="btn-err btn-sm"
                                onClick={() => handleDelete(s.id, s.part_number)}
                              >
                                Hapus
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && (
        <StockForm
          item={editItem}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null) }}
          saving={saving}
        />
      )}
      {showMove && moveItem && (
        <MovementForm
          item={moveItem}
          onSave={handleMovement}
          onClose={() => { setShowMove(false); setMoveItem(null) }}
          saving={saving}
        />
      )}
    </div>
  )
}