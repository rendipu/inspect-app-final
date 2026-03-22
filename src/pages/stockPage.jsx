import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api'

const SATUAN_LIST = ['pcs', 'liter', 'meter', 'set', 'roll', 'kg', 'box', 'unit']
const canEdit     = (role) => role === 'warehouse' || role === 'admin'

function fmtDateTime(d) {
  return new Date(d).toLocaleString('id-ID', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

// ─── Badge stock status ───────────────────────────────────────────────
function StockStatus({ jumlah, minimum }) {
  if (jumlah === 0) return (
    <span className="tag" style={{ background:'var(--errbg)', border:'1px solid var(--errbd)', color:'var(--err)' }}>Habis</span>
  )
  if (jumlah > 0 && jumlah <= 1) return (
    <span className="tag" style={{ background:'var(--wnbg)', border:'1px solid var(--wnbd)', color:'var(--wn)' }}>⚠ Stok Rendah</span>
  )
  return (
    <span className="tag" style={{ background:'var(--okbg)', border:'1px solid var(--okbd)', color:'var(--ok)' }}>Aman</span>
  )
}

// ─── Parse Excel dengan SheetJS (CDN) ────────────────────────────────
// Cari kolom secara fleksibel berdasarkan keyword header
function findColIndex(headers, keywords) {
  const kw = keywords.map(k => k.toLowerCase())
  return headers.findIndex(h =>
    h && kw.some(k => String(h).toLowerCase().includes(k))
  )
}

async function parseExcelToRows(file) {
  // Load SheetJS dari CDN jika belum ada
  if (!window.XLSX) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      s.onload  = resolve
      s.onerror = () => reject(new Error('Gagal load library Excel'))
      document.head.appendChild(s)
    })
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.onload  = (e) => {
      try {
        const XLSX    = window.XLSX
        const wb      = XLSX.read(e.target.result, { type: 'array' })
        const ws      = wb.Sheets[wb.SheetNames[0]]
        const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

        if (rawRows.length < 2) {
          reject(new Error('File Excel kosong atau tidak ada data'))
          return
        }

        // Cari baris header — bisa tidak di baris pertama
        let headerRowIdx = 0
        for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
          const row = rawRows[i].map(c => String(c).toLowerCase())
          if (row.some(c => c.includes('material') || c.includes('part') || c.includes('unrestricted'))) {
            headerRowIdx = i
            break
          }
        }

        const headers = rawRows[headerRowIdx].map(c => String(c).trim())

        // Cari index kolom secara fleksibel
        const iMaterial     = findColIndex(headers, ['material'])            // kolom "Material"
        const iDesc         = findColIndex(headers, ['material description', 'description', 'deskripsi'])
        const iUnrestricted = findColIndex(headers, ['unrestricted', 'qty', 'quantity', 'jumlah'])
        const iSatuan       = findColIndex(headers, ['base unit', 'satuan', 'uom', 'unit of measure'])
        const iStorage      = findColIndex(headers, ['storage', 'lokasi', 'location'])

        if (iMaterial < 0) {
          reject(new Error('Kolom "Material" tidak ditemukan. Pastikan header Excel sesuai.'))
          return
        }
        if (iDesc < 0) {
          reject(new Error('Kolom "Material Description" tidak ditemukan.'))
          return
        }

        const rows = []
        for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
          const row = rawRows[i]
          const material = String(row[iMaterial] ?? '').trim()
          const desc     = String(row[iDesc] ?? '').trim()
          if (!material || !desc) continue  // skip baris kosong

          const unrestricted = iUnrestricted >= 0 ? parseInt(row[iUnrestricted]) || 0 : 0
          const satuan       = iSatuan >= 0 ? String(row[iSatuan] ?? '').trim().toLowerCase() || 'pcs' : 'pcs'
          // Untuk storage: ambil dari kolom jika ada, tapi user bisa override
          const storageRaw   = iStorage >= 0 ? String(row[iStorage] ?? '').trim() : ''

          rows.push({
            part_number:          material,
            material_description: desc,
            jumlah_stock:         unrestricted,
            satuan:               SATUAN_LIST.includes(satuan) ? satuan : 'pcs',
            location_storage:     storageRaw || '',   // akan diisi default 'SWI' di UI
            minimum_stock:        2,
            harga_satuan:         '',
            keterangan:           '',
            _status:              'pending',   // pending | ok | skip | error
            _msg:                 '',
          })
        }

        if (rows.length === 0) {
          reject(new Error('Tidak ada data valid di file Excel'))
          return
        }
        resolve(rows)
      } catch (err) {
        reject(new Error('Gagal memproses Excel: ' + err.message))
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

// ─── Modal Import Excel ───────────────────────────────────────────────
function ImportExcelModal({ onClose, onDone }) {
  const fileRef           = useRef(null)
  const [rows,     setRows]     = useState([])
  const [loading,  setLoading]  = useState(false)
  const [importing,setImporting]= useState(false)
  const [progress, setProgress] = useState(0)
  const [defaultLoc, setDefaultLoc] = useState('SWI')
  const [fileName, setFileName] = useState('')
  const [parseErr, setParseErr] = useState('')
  // dupMode: 'skip' = lewati duplikat | 'update' = update jumlah_stock jika sudah ada
  const [dupMode, setDupMode] = useState('update')

  const handleFile = async (file) => {
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setParseErr('Hanya file .xlsx, .xls, atau .csv yang didukung')
      return
    }
    setFileName(file.name)
    setParseErr('')
    setRows([])
    setLoading(true)
    try {
      const parsed = await parseExcelToRows(file)
      setRows(parsed)
    } catch (e) {
      setParseErr(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  // Terapkan defaultLoc ke semua baris yang location kosong
  const rowsWithLoc = rows.map(r => ({
    ...r,
    location_storage: r.location_storage || defaultLoc,
  }))

  const toggleSkip = (idx) => {
    setRows(prev => prev.map((r, i) =>
      i === idx ? { ...r, _status: r._status === 'skip' ? 'pending' : 'skip' } : r
    ))
  }

  const pendingCount = rowsWithLoc.filter(r => r._status === 'pending').length
  const skipCount    = rowsWithLoc.filter(r => r._status === 'skip').length

  const handleImport = async () => {
    const toImport = rowsWithLoc.filter(r => r._status === 'pending')
    if (toImport.length === 0) return

    setImporting(true)
    setProgress(0)

    let ok = 0, updated = 0, skipped = 0, failed = 0

    for (let i = 0; i < toImport.length; i++) {
      const r = toImport[i]
      const idx = rows.findIndex(x => x.part_number === r.part_number)
      try {
        await api.createStock({
          part_number:          r.part_number,
          material_description: r.material_description,
          jumlah_stock:         r.jumlah_stock,
          satuan:               r.satuan,
          location_storage:     r.location_storage,
          minimum_stock:        r.minimum_stock || 2,
          harga_satuan:         r.harga_satuan || undefined,
          keterangan:           r.keterangan || '',
        })
        ok++
        setRows(prev => prev.map((x, xi) => xi === idx ? { ...x, _status: 'ok', _msg: 'Baru ditambahkan' } : x))
      } catch (e) {
        const isDup = e.message?.toLowerCase().includes('duplicate') || e.message?.includes('sudah ada') || e.message?.includes('E11000')
        if (isDup && dupMode === 'update') {
          // Cari id stock yang sudah ada lalu lakukan adjustment ke nilai baru
          try {
            const existing = await api.getStocks({ search: r.part_number })
            const found = existing.find(s => s.part_number === r.part_number)
            if (found) {
              // Adjustment: set stok ke nilai dari Excel
              await api.stockMovement(found.id, { tipe: 'adjustment', jumlah: r.jumlah_stock, keterangan: 'Update via import Excel' }, found.jumlah_stock)
              updated++
              setRows(prev => prev.map((x, xi) => xi === idx
                ? { ...x, _status: 'ok', _msg: `Stok diupdate: ${found.jumlah_stock} → ${r.jumlah_stock}` }
                : x
              ))
            } else {
              throw new Error('Data tidak ditemukan untuk diupdate')
            }
          } catch (e2) {
            failed++
            setRows(prev => prev.map((x, xi) => xi === idx
              ? { ...x, _status: 'error', _msg: 'Gagal update: ' + e2.message }
              : x
            ))
          }
        } else if (isDup && dupMode === 'skip') {
          skipped++
          setRows(prev => prev.map((x, xi) => xi === idx
            ? { ...x, _status: 'skip', _msg: 'Sudah ada, dilewati' }
            : x
          ))
        } else {
          failed++
          setRows(prev => prev.map((x, xi) => xi === idx
            ? { ...x, _status: 'error', _msg: e.message }
            : x
          ))
        }
      }
      setProgress(Math.round(((i + 1) / toImport.length) * 100))
    }

    setImporting(false)
    const parts = []
    if (ok > 0) parts.push(`${ok} item baru`)
    if (updated > 0) parts.push(`${updated} stok diupdate`)
    if (skipped > 0) parts.push(`${skipped} dilewati`)
    if (failed > 0) parts.push(`${failed} gagal`)
    onDone('Import selesai: ' + parts.join(', '))
  }

  const statusColor = { pending: 'var(--t3)', ok: 'var(--ok)', skip: 'var(--inf)', error: 'var(--err)' }
  const statusIcon  = { pending: '○', ok: '✓', skip: '—', error: '✕' }

  const isDone = rows.length > 0 && rows.every(r => r._status !== 'pending')

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'var(--sf)', borderRadius:14, padding:24, width:'100%', maxWidth:680, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 24px 80px rgba(0,0,0,.3)' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div>
            <h2 style={{ fontSize:17, fontWeight:800, color:'var(--t)', marginBottom:2 }}>📂 Import Stock dari Excel</h2>
            <p style={{ fontSize:12, color:'var(--t3)' }}>Kolom yang dibutuhkan: Material, Material Description, Unrestricted</p>
          </div>
          <button onClick={onClose} style={{ background:'transparent', border:'none', fontSize:22, cursor:'pointer', color:'var(--t3)', lineHeight:1, flexShrink:0 }}>✕</button>
        </div>

        {/* Drop zone */}
        {rows.length === 0 && (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            style={{
              border: '2px dashed var(--bd)',
              borderRadius: 10,
              padding: '32px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              marginBottom: 16,
              transition: 'border-color .2s, background .2s',
              background: 'var(--bd2)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--p)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--bd)'}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display:'none' }}
              onChange={e => handleFile(e.target.files?.[0])}
            />
            <div style={{ fontSize:36, marginBottom:10 }}>📊</div>
            {loading ? (
              <div style={{ fontSize:13, color:'var(--t3)' }}>
                <span className="spin" style={{ display:'inline-block', marginRight:6 }}>↻</span>
                Membaca file Excel...
              </div>
            ) : (
              <>
                <div style={{ fontSize:14, fontWeight:700, color:'var(--t)', marginBottom:4 }}>
                  Klik atau drag & drop file Excel di sini
                </div>
                <div style={{ fontSize:12, color:'var(--t3)' }}>.xlsx, .xls, .csv — maks. 5MB</div>
              </>
            )}
          </div>
        )}

        {/* Error parse */}
        {parseErr && (
          <div style={{ background:'var(--errbg)', border:'1px solid var(--errbd)', color:'var(--err)', borderRadius:8, padding:'10px 14px', fontSize:12, fontWeight:600, marginBottom:14 }}>
            ⚠ {parseErr}
          </div>
        )}

        {/* Berhasil parse: konfigurasi & preview */}
        {rows.length > 0 && (
          <>
            {/* Info file + default location */}
            <div style={{ background:'var(--sfy)', border:'1.5px solid var(--wnbd)', borderRadius:8, padding:'10px 14px', marginBottom:14, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--pd)' }}>📄 {fileName}</div>
                <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>
                  {rows.length} baris ditemukan · {pendingCount} akan diimport · {skipCount} dilewati
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <label htmlFor="default-loc" style={{ fontSize:12, color:'var(--t2)', fontWeight:600, whiteSpace:'nowrap' }}>
                  Default Location:
                </label>
                <input
                  id="default-loc" name="defaultLoc"
                  value={defaultLoc}
                  onChange={e => setDefaultLoc(e.target.value.toUpperCase())}
                  placeholder="e.g. SWI"
                  style={{ width:80, fontFamily:'monospace', fontWeight:700, fontSize:13, textTransform:'uppercase' }}
                />
              </div>
              {!importing && !isDone && (
                <button
                  onClick={() => { setRows([]); setFileName(''); setParseErr('') }}
                  style={{ fontSize:11, color:'var(--t3)', background:'transparent', border:'1px solid var(--bd)', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}
                >
                  Ganti File
                </button>
              )}
            </div>

            {/* Opsi jika duplikat */}
            {!importing && !isDone && (
              <div style={{ background:'var(--bd2)', borderRadius:8, padding:'10px 14px', marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                  Jika Part Number sudah ada di database:
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button
                    onClick={() => setDupMode('update')}
                    style={{ flex:1, padding:'8px 10px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', border:'1.5px solid', background: dupMode === 'update' ? 'var(--ok)' : 'transparent', color: dupMode === 'update' ? '#fff' : 'var(--ok)', borderColor:'var(--ok)', transition:'all .15s', textAlign:'center' }}
                  >
                    🔄 Update Stok
                    <div style={{ fontSize:10, fontWeight:400, marginTop:2, opacity:.85 }}>set ke nilai dari Excel</div>
                  </button>
                  <button
                    onClick={() => setDupMode('skip')}
                    style={{ flex:1, padding:'8px 10px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', border:'1.5px solid', background: dupMode === 'skip' ? 'var(--inf)' : 'transparent', color: dupMode === 'skip' ? '#fff' : 'var(--inf)', borderColor:'var(--inf)', transition:'all .15s', textAlign:'center' }}
                  >
                    ⏭ Lewati
                    <div style={{ fontSize:10, fontWeight:400, marginTop:2, opacity:.85 }}>biarkan data lama</div>
                  </button>
                </div>
              </div>
            )
            }
            <div style={{ display:'none' }}>{/* spacer */}
            </div>

            {/* Progress bar */}
            {importing && (
              <div style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--t3)', marginBottom:4 }}>
                  <span>Mengimport data...</span>
                  <span>{progress}%</span>
                </div>
                <div style={{ height:6, background:'var(--bd2)', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ height:'100%', background:'var(--p)', borderRadius:3, width:`${progress}%`, transition:'width .3s' }} />
                </div>
              </div>
            )}

            {/* Preview tabel */}
            <div style={{ border:'1px solid var(--bd)', borderRadius:8, overflow:'hidden', marginBottom:16 }}>
              <div style={{ overflowX:'auto', maxHeight:320, overflowY:'auto' }}>
                <table className="tbl" style={{ fontSize:11 }}>
                  <thead>
                    <tr>
                      <th style={{ width:28, textAlign:'center' }}>#</th>
                      <th>Part Number</th>
                      <th>Material Description</th>
                      <th style={{ textAlign:'center' }}>Qty</th>
                      <th>Satuan</th>
                      <th>Location</th>
                      <th style={{ textAlign:'center' }}>Status</th>
                      <th style={{ textAlign:'center' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsWithLoc.map((r, i) => (
                      <tr key={i} style={{ opacity: r._status === 'skip' ? 0.45 : 1 }}>
                        <td style={{ textAlign:'center', color:'var(--t3)' }}>{i + 1}</td>
                        <td>
                          <span className="mono" style={{ fontWeight:700, color:'var(--pd)', fontSize:11 }}>{r.part_number}</span>
                        </td>
                        <td style={{ maxWidth:200 }}>
                          <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.material_description}>
                            {r.material_description}
                          </div>
                        </td>
                        <td style={{ textAlign:'center' }}>
                          <span className="mono" style={{ fontWeight:700 }}>{r.jumlah_stock}</span>
                        </td>
                        <td>{r.satuan}</td>
                        <td>
                          <span style={{ fontFamily:'monospace', fontSize:11, color:'var(--pur)', fontWeight:700 }}>
                            {r.location_storage || defaultLoc}
                          </span>
                        </td>
                        <td style={{ textAlign:'center' }}>
                          <span style={{ color: statusColor[r._status], fontWeight:700, fontSize:13 }}>
                            {statusIcon[r._status]}
                          </span>
                          {r._msg && (
                            <div style={{ fontSize:9, color:'var(--t3)', maxWidth:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r._msg}>
                              {r._msg}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign:'center' }}>
                          {(r._status === 'pending' || r._status === 'skip') && !importing && !isDone && (
                            <button
                              onClick={() => toggleSkip(i)}
                              style={{ fontSize:10, padding:'2px 8px', borderRadius:4, cursor:'pointer', border:'1px solid', background: r._status === 'skip' ? 'var(--okbg)' : 'var(--errbg)', color: r._status === 'skip' ? 'var(--ok)' : 'var(--err)', borderColor: r._status === 'skip' ? 'var(--okbd)' : 'var(--errbd)', fontWeight:700 }}
                            >
                              {r._status === 'skip' ? 'Aktifkan' : 'Lewati'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Legend status */}
            <div style={{ display:'flex', gap:14, fontSize:11, color:'var(--t3)', marginBottom:16, flexWrap:'wrap' }}>
              <span><span style={{ color:'var(--t3)', fontWeight:700 }}>○</span> Menunggu</span>
              <span><span style={{ color:'var(--ok)', fontWeight:700 }}>✓</span> Berhasil</span>
              <span><span style={{ color:'var(--inf)', fontWeight:700 }}>—</span> Dilewati / Duplikat</span>
              <span><span style={{ color:'var(--err)', fontWeight:700 }}>✕</span> Gagal</span>
            </div>

            {/* Tombol aksi */}
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn-g" onClick={onClose} style={{ flex:1 }} disabled={importing}>
                {isDone ? 'Tutup' : 'Batal'}
              </button>
              {!isDone && (
                <button
                  className="btn-y"
                  onClick={handleImport}
                  disabled={importing || pendingCount === 0}
                  style={{ flex:2, opacity: (importing || pendingCount === 0) ? 0.6 : 1 }}
                >
                  {importing
                    ? `⏳ Mengimport ${progress}%...`
                    : `📥 Import ${pendingCount} Item`
                  }
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Modal Form tambah/edit ───────────────────────────────────────────
function StockForm({ item, onSave, onClose, saving }) {
  const isEdit = !!item?.id
  const [form, setForm] = useState({
    part_number:          item?.part_number          || '',
    material_description: item?.material_description || '',
    jumlah_stock:         item?.jumlah_stock          ?? '',
    satuan:               item?.satuan               || 'pcs',
    location_storage:     item?.location_storage     || '',
    minimum_stock:        item?.minimum_stock         ?? 1,
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
            <label className="lbl" htmlFor="part-number">Part Number *</label>
            <input id="part-number" name="part_number" value={form.part_number} onChange={e => set('part_number', e.target.value)}
              placeholder="e.g. AF-BT1234" style={{ width:'100%' }} disabled={isEdit} />
            {isEdit && <div style={{ fontSize:10, color:'var(--t3)', marginTop:3 }}>Part number tidak bisa diubah</div>}
          </div>
          <div style={{ gridColumn:'1 / -1' }}>
            <label className="lbl" htmlFor="mat-desc">Material Description *</label>
            <input id="mat-desc" name="material_description" value={form.material_description} onChange={e => set('material_description', e.target.value)}
              placeholder="e.g. Air Filter Element" style={{ width:'100%' }} />
          </div>
          <div>
            <label className="lbl" htmlFor="jumlah-stock">Jumlah Stock</label>
            <input id="jumlah-stock" name="jumlah_stock" type="number" value={form.jumlah_stock} onChange={e => set('jumlah_stock', e.target.value)}
              placeholder="0" min="0" style={{ width:'100%' }} disabled={isEdit} />
            {isEdit && <div style={{ fontSize:10, color:'var(--t3)', marginTop:3 }}>Ubah via Stock Movement</div>}
          </div>
          <div>
            <label className="lbl" htmlFor="satuan">Satuan *</label>
            <select id="satuan" name="satuan" value={form.satuan} onChange={e => set('satuan', e.target.value)} style={{ width:'100%' }}>
              {SATUAN_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl" htmlFor="location">Location Storage</label>
            <input id="location" name="location_storage" value={form.location_storage} onChange={e => set('location_storage', e.target.value)}
              placeholder="e.g. SWI" style={{ width:'100%' }} />
          </div>
          <div>
            <label className="lbl" htmlFor="min-stock">Minimum Stock</label>
            <input id="min-stock" name="minimum_stock" type="number" value={form.minimum_stock} onChange={e => set('minimum_stock', e.target.value)}
              placeholder="0" min="0" style={{ width:'100%' }} />
            <div style={{ fontSize:10, color:'var(--t3)', marginTop:3 }}>Alert jika stock ≤ nilai ini</div>
          </div>
          <div>
            <label className="lbl" htmlFor="harga-satuan">Harga Satuan (Rp)</label>
            <input id="harga-satuan" name="harga_satuan" type="number" value={form.harga_satuan} onChange={e => set('harga_satuan', e.target.value)}
              placeholder="opsional" min="0" style={{ width:'100%' }} />
          </div>
          <div style={{ gridColumn:'1 / -1' }}>
            <label className="lbl" htmlFor="keterangan-stock">Keterangan</label>
            <textarea id="keterangan-stock" name="keterangan" value={form.keterangan} onChange={e => set('keterangan', e.target.value)}
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

        <div style={{ background:'var(--sfy)', border:'1.5px solid var(--wnbd)', borderRadius:8, padding:'10px 14px', marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--pd)' }}>{item.part_number}</div>
          <div style={{ fontSize:12, color:'var(--t2)' }}>{item.material_description}</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:6, marginTop:4 }}>
            <span style={{ fontSize:10, color:'var(--t3)' }}>Stock saat ini:</span>
            <span className="mono" style={{ fontSize:18, fontWeight:700, color:'var(--t)' }}>{item.jumlah_stock}</span>
            <span style={{ fontSize:12, color:'var(--t3)' }}>{item.satuan}</span>
          </div>
        </div>

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

        <div style={{ marginBottom:12 }}>
          <label className="lbl" htmlFor="jumlah-move">{tipe === 'adjustment' ? 'Jumlah Stock Baru' : 'Jumlah'} *</label>
          <input id="jumlah-move" name="jumlahMove" type="number" value={jumlah} onChange={e => setJumlah(e.target.value)}
            placeholder={tipe === 'adjustment' ? 'Stock baru...' : 'Masukkan jumlah...'}
            min="0" style={{ width:'100%' }} />
        </div>

        {after !== null && (
          <div style={{ background: after < 0 ? 'var(--errbg)' : 'var(--okbg)', border:`1px solid ${after < 0 ? 'var(--errbd)' : 'var(--okbd)'}`, borderRadius:8, padding:'8px 14px', marginBottom:12, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:12, color: after < 0 ? 'var(--err)' : 'var(--ok)' }}>
              {after < 0 ? '⚠ Stock tidak mencukupi!' : 'Stock setelah: '}
            </span>
            {after >= 0 && (
              <span className="mono" style={{ fontSize:16, fontWeight:700, color:'var(--ok)' }}>
                {after} {item.satuan}
              </span>
            )}
          </div>
        )}

        <div style={{ marginBottom:20 }}>
          <label className="lbl" htmlFor="ket-move">Keterangan</label>
          <input id="ket-move" name="keteranganMove" value={keterangan} onChange={e => setKeterangan(e.target.value)}
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
  const [stocks,       setStocks]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterLow,    setFilterLow]    = useState(false)
  const [filterSatuan, setFilterSatuan] = useState('all')

  const [showForm,   setShowForm]   = useState(false)
  const [showMove,   setShowMove]   = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editItem,   setEditItem]   = useState(null)
  const [moveItem,   setMoveItem]   = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState('')

  const satuanList = ['all', ...new Set(stocks.map(s => s.satuan))]

  // Load SEMUA data sekaligus tanpa search param
  // Search & filter dilakukan murni di browser agar partial search instan
  const loadStocks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getStocks({})
      setStocks(res)
    } catch (e) {
      setError('Gagal memuat data stock')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStocks()
  }, [loadStocks])

  // Filter lokal murni di browser — partial search instan
  // Ketik '7867' cocok '78675765001', ketik '001' cocok dari belakang
  const filtered = stocks.filter(s => {
    if (filterSatuan !== 'all' && s.satuan !== filterSatuan) return false
    if (filterLow && !(s.jumlah_stock <= s.minimum_stock)) return false
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      String(s.part_number          ?? '').toLowerCase().includes(q) ||
      String(s.material_description ?? '').toLowerCase().includes(q) ||
      String(s.location_storage     ?? '').toLowerCase().includes(q) ||
      String(s.keterangan           ?? '').toLowerCase().includes(q)
    )
  })

  const totalItems = stocks.length
  const lowItems   = stocks.filter(s => s.jumlah_stock <2 && s.jumlah_stock > 0).length
  const emptyItems = stocks.filter(s => s.jumlah_stock === 0).length
  const totalNilai = stocks.reduce((sum, s) => sum + (s.jumlah_stock * (s.harga_satuan || 0)), 0)

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
      await api.stockMovement(moveItem.id, moveData, moveItem.jumlah_stock)
      setSuccess(`Stock movement berhasil disimpan`)
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

  const handleImportDone = async (msg) => {
    setShowImport(false)
    setSuccess(msg)
    await loadStocks()
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
          { l:'Total Item',  v: totalItems,  c:'var(--p)',   sub:'jenis barang'   },
          { l:'Stok Rendah', v: lowItems,    c:'var(--wn)',  sub:'perlu restock'  },
          { l:'Stok Habis',  v: emptyItems,  c:'var(--err)', sub:'segera restock' },
          { l:'Nilai Stock', v: totalNilai > 0 ? `Rp ${(totalNilai/1000000).toFixed(1)}jt` : '-', c:'var(--ok)', sub:'estimasi nilai' },
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
          id="search-stock" name="searchStock" aria-label="Cari part number"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Cari part number / deskripsi / lokasi..."
          style={{ flex:1, minWidth:200 }}
        />
        <select id="filter-satuan" name="filterSatuan" aria-label="Filter Satuan" value={filterSatuan} onChange={e => setFilterSatuan(e.target.value)} style={{ minWidth:100 }}>
          {satuanList.map(s => <option key={s} value={s}>{s === 'all' ? 'Semua Satuan' : s}</option>)}
        </select>
        <button
          onClick={() => setFilterLow(p => !p)}
          style={{ padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', border:'1.5px solid', background: filterLow ? 'var(--wn)' : 'transparent', color: filterLow ? '#fff' : 'var(--wn)', borderColor:'var(--wn)', transition:'all .15s', whiteSpace:'nowrap' }}
        >
          ⚠ Stok Rendah {filterLow && `(${lowItems})`}
        </button>
        {canEdit(user.role) && (
          <>
            {/* Tombol Import Excel */}
            <button
              onClick={() => setShowImport(true)}
              style={{ padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:700, cursor:'pointer', border:'1.5px solid var(--inf)', background:'var(--infbg)', color:'var(--inf)', whiteSpace:'nowrap', transition:'all .15s' }}
            >
              📂 Import Excel
            </button>
            <button className="btn-y" onClick={() => { setEditItem(null); setShowForm(true) }} style={{ whiteSpace:'nowrap' }}>
              + Tambah Item
            </button>
          </>
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
              <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:16 }}>
                <button className="btn-g" onClick={() => setShowImport(true)}>📂 Import Excel</button>
                <button className="btn-y" onClick={() => { setEditItem(null); setShowForm(true) }}>+ Tambah Manual</button>
              </div>
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
                              {lastLog.delta > 0 ? '↑' : lastLog.delta < 0 ? '↓' : '⇄'}
                              {' '}{Math.abs(lastLog.delta)} {s.satuan}
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
                            <button className="btn-g btn-sm" onClick={() => { setEditItem(s); setShowForm(true) }}>
                              Edit
                            </button>
                            {user.role === 'admin' && (
                              <button className="btn-err btn-sm" onClick={() => handleDelete(s.id, s.part_number)}>
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
      {showImport && (
        <ImportExcelModal
          onClose={() => setShowImport(false)}
          onDone={handleImportDone}
        />
      )}
    </div>
  )
}