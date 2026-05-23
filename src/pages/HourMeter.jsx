import { useState, useEffect, useMemo } from 'react'
import { api } from '../lib/api'
import Pagination, { PAGE_SIZE } from '../components/Pagination'
import { SkeletonCardList } from '../components/SkeletonLoader'
import { useSelector, useDispatch } from 'react-redux'
import { selectLoading, pushToQueue } from '../store/appSlice'
import { exportCsv } from '../lib/exportCsv'
import { exportHourMeterPdf } from '../lib/exportPdf'

function fmtDateTime(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function HourMeter({ data, user, refetch }) {
  const dispatch = useDispatch()
  const { units } = data

  const [unitId,  setUnitId]  = useState('')
  const [hmAfter, setHmAfter] = useState('')
  const [catatan, setCatatan] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')
  const [hmLogs, setHmLogs] = useState([])
  const [unitSearch, setUnitSearch] = useState('')
  const [showUnitDropdown, setShowUnitDropdown] = useState(false)

  const loading = useSelector(selectLoading)

  // Filter kategori
  const [filterTipe,  setFilterTipe]  = useState('all')
  const [filterBrand, setFilterBrand] = useState('all')
  const [page,        setPage]        = useState(1)

  useEffect(() => {
    setPage(1)
  }, [filterTipe, filterBrand])
  useEffect(() => {
  loadHmLogs()
}, [units])

const loadHmLogs = async () => {
  try {
    const logs = await api.getHourMeterLogs()
    setHmLogs(logs)
  } catch (err) {
    console.error('Gagal load HM logs', err)
  }
}

  const { tipes, brands } = useMemo(() => {
    return {
      tipes: [...new Set(units.map(u => u.tipe))].sort(),
      brands: [...new Set(units.map(u => u.brand))].sort()
    }
  }, [units])

  const latestInspectionMap = useMemo(() => {
    const map = {}
    if (data.inspections) {
      data.inspections.forEach(insp => {
        const uid = insp.unit_id
        if (!map[uid] || new Date(insp.tanggal) > new Date(map[uid].tanggal)) {
          map[uid] = insp
        }
      })
    }
    return map
  }, [data.inspections])

  const hmLogMap = useMemo(() => {
    const map = {}
    hmLogs.forEach(log => {
      const uid = log.unit_id
      // Keep only the latest log per unit (by createdAt)
      if (!map[uid] || new Date(log.createdAt) > new Date(map[uid].createdAt)) {
        map[uid] = log
      }
    })
    return map
  }, [hmLogs])

  const filteredUnits = useMemo(() => {
    return units.map(unit => {
      const latestLog = hmLogMap[unit.id]
      const latestInsp = latestInspectionMap[unit.id]

      const logTime = latestLog ? new Date(latestLog.createdAt).getTime() : 0
      const inspTime = latestInsp ? new Date(latestInsp.tanggal).getTime() : 0

      let catatan = ''
      let user_nama = ''
      let updated_at = unit.updatedAt || null

      if (logTime > 0 || inspTime > 0) {
        if (logTime >= inspTime) {
          catatan = latestLog.catatan || 'Update Manual'
          user_nama = latestLog.user_nama || '-'
          updated_at = latestLog.createdAt
        } else {
          catatan = 'Diupdate via Daily Inspeksi'
          user_nama = latestInsp.mekaniks?.map(m => m.user_nama).filter(Boolean).join(', ') || '-'
          updated_at = latestInsp.tanggal
        }
      } else {
        catatan = '-'
        user_nama = '-'
      }

      return {
        ...unit,
        hm_catatan: catatan,
        hm_user: user_nama,
        hm_updated_at: updated_at,
      }
    }).filter(unit => {
      return (
        (filterTipe === 'all' || unit.tipe === filterTipe) &&
        (filterBrand === 'all' || unit.brand === filterBrand)
      )
    })
  }, [units, hmLogMap, latestInspectionMap, filterTipe, filterBrand])

  const paginatedUnits = useMemo(() => {
    return [...filteredUnits]
      .sort((a, b) => a.nomor_unit.localeCompare(b.nomor_unit))
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  }, [filteredUnits, page])

  const selectedUnit = useMemo(() => units.find(u => u.id === parseInt(unitId)), [units, unitId])
  // Reset HM input saat ganti unit
  const handleUnitSelect = (id) => {
    const u = units.find(x => x.id === parseInt(id))
    setUnitId(String(id))
    setHmAfter(u ? u.hm.toString() : '')
    setError('')
    setSuccess('')
    setShowUnitDropdown(false)
    setUnitSearch('')
  }

  const searchedUnits = useMemo(() => {
    if (!unitSearch.trim()) return filteredUnits
    const q = unitSearch.toLowerCase()
    return filteredUnits.filter(u => {
      const text = `${u.nomor_unit} ${u.brand} ${u.tipe} ${u.model || ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [filteredUnits, unitSearch])

  const handleSubmit = async () => {
    if (!unitId)  { setError('Pilih unit terlebih dahulu'); return }
    if (!hmAfter) { setError('Masukkan nilai Hour Meter');  return }

    const newHm = parseFloat(hmAfter)
    if (isNaN(newHm) || newHm < 0) { setError('Nilai HM tidak valid'); return }
    if (selectedUnit && newHm < selectedUnit.hm) {
      setError(`HM tidak boleh lebih kecil dari HM saat ini (${selectedUnit.hm.toLocaleString()} jam)`)
      return
    }
    if (selectedUnit && newHm === selectedUnit.hm) {
      setError('Nilai HM sama dengan sekarang, tidak ada perubahan')
      return
    }

    setSaving(true); setError(''); setSuccess('')
    const payload = {
      unit_id:  parseInt(unitId),
      hm_after: newHm,
      catatan:  catatan || `Diupdate oleh ${user.nama} pada ${new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })}`,
    }

    try {
      if (!navigator.onLine) {
        throw new Error('OFFLINE')
      }
      await api.updateHourMeter(payload)
      setSuccess(`HM ${selectedUnit?.nomor_unit} berhasil diupdate ke ${newHm.toLocaleString()} jam`)
      setCatatan('')
      setUnitId('')
      setHmAfter('')
      await refetch()
      await loadHmLogs()
    } catch (e) {
      if (e.message === 'OFFLINE' || e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
        dispatch(pushToQueue({ type: 'UPDATE_HM', data: payload }))
        setSuccess(`Anda sedang offline. HM ${selectedUnit?.nomor_unit} tersimpan di perangkat dan akan dikirim otomatis saat online.`)
        setCatatan('')
        setUnitId('')
        setHmAfter('')
      } else {
        setError(e.message || 'Gagal mengupdate HM')
      }
    } finally {
      setSaving(false)
    }
  }

  // Build latest-per-unit data for export (all units with latest HM)
  const latestHmPerUnit = useMemo(() => {
    return filteredUnits.map(u => {
      return {
        updatedAt: u.hm_updated_at || null,
        nomor_unit: u.nomor_unit,
        hm_after: u.hm,
        catatan: u.hm_catatan || '-',
        user_nama: u.hm_user || '-',
      }
    })
  }, [filteredUnits])

  const exportHMCSV = () => {
    const headers = [
      'No',
      'Tanggal',
      'Unit',
      'Hour Meter',
      'Catatan/Lokasi',
      'User',
    ]

    const rows = latestHmPerUnit.map((item, index) => [
      index + 1,
      item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' }) : '-',
      item.nomor_unit || '-',
      item.hm_after || 0,
      item.catatan || '-',
      item.user_nama || '-',
    ])

    exportCsv(
      `hour-meter-${new Date().toISOString().slice(0,10)}.csv`,
      headers,
      rows
    )
  }

  return (
    <div className="fade">
      <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--t)', marginBottom: 4 }}>Update Hour Meter</h1>
      <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 18 }}>Update hourmeter unit alat berat</p>

      {/* ── Form Update ── */}
      <div className="card" style={{ marginBottom: 16, borderTop: '3px solid var(--p)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--pd)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 14 }}>
          Input Hour Meter
        </div>

        {/* Filter kategori unit */}
        <div style={{ background: 'var(--bd2)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
          <div className="lbl" style={{ marginBottom: 8 }}>Filter Unit</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} className="g2">
            <div>
              <label className="lbl" htmlFor="filter-tipe">Tipe Unit</label>
              <select
                id="filter-tipe" name="filterTipe"
                value={filterTipe}
                onChange={e => { setFilterTipe(e.target.value); setUnitId(''); setHmAfter('') }}
                style={{ width: '100%' }}
              >
                <option value="all">Semua Tipe</option>
                {tipes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="filter-brand">Brand</label>
              <select
                id="filter-brand" name="filterBrand"
                value={filterBrand}
                onChange={e => { setFilterBrand(e.target.value); setUnitId(''); setHmAfter('') }}
                style={{ width: '100%' }}
              >
                <option value="all">Semua Brand</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Pilih unit */}
        <div style={{ marginBottom: 12 }}>
          <label className="lbl" htmlFor="unit-id">Unit * ({filteredUnits.length} unit)</label>
          <div style={{ position: 'relative' }}>
            <input
              id="unit-id"
              type="text"
              value={showUnitDropdown ? unitSearch : (selectedUnit ? `${selectedUnit.nomor_unit} — ${selectedUnit.brand} ${selectedUnit.tipe}` : '')}
              onChange={e => {
                setUnitSearch(e.target.value)
                if (!showUnitDropdown) setShowUnitDropdown(true)
              }}
              onFocus={() => {
                setShowUnitDropdown(true)
                setUnitSearch('')
              }}
              onBlur={() => {
                setTimeout(() => setShowUnitDropdown(false), 200)
              }}
              placeholder="Cari atau Pilih Unit..."
              style={{ width: '100%' }}
              autoComplete="off"
            />
            {showUnitDropdown && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                background: 'var(--bg, #ffffff)', border: '1px solid var(--bd)',
                borderRadius: 6, maxHeight: 250, overflowY: 'auto',
                zIndex: 10, marginTop: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                {searchedUnits.length > 0 ? searchedUnits.map(u => (
                  <div
                    key={u.id}
                    onClick={() => handleUnitSelect(u.id)}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--bd2, #f1f5f9)',
                      fontSize: 13,
                      color: unitId === String(u.id) ? 'var(--pd)' : 'var(--t, #0f172a)',
                      fontWeight: unitId === String(u.id) ? 700 : 400,
                      background: 'var(--bg, #ffffff)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bd2, #f1f5f9)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg, #ffffff)'}
                  >
                    {u.nomor_unit} — {u.brand} {u.tipe}
                    <span className="mono" style={{ marginLeft: 8, fontSize: 11, color: 'var(--t3)' }}>
                      HM {u.hm.toLocaleString()}
                    </span>
                  </div>
                )) : (
                  <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--t3)', textAlign: 'center', background: 'var(--bg, #ffffff)' }}>
                    Unit tidak ditemukan
                  </div>
                )}
              </div>
            )}
          </div>
          {filteredUnits.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--err)', marginTop: 4 }}>
              Tidak ada unit untuk filter ini
            </div>
          )}
        </div>

        {/* Info HM saat ini */}
        {selectedUnit && (
          <div style={{ background: 'var(--sfy)', border: '1.5px solid var(--wnbd)', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>
                  HM Saat Ini
                </div>
                <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--pd)', lineHeight: 1 }}>
                  {selectedUnit.hm.toLocaleString()}
                  <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 400, marginLeft: 4 }}>jam</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>{selectedUnit.brand}-{selectedUnit.nomor_unit}</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>update terakhir : {fmtDateTime(selectedUnit.updatedAt)}</div>
              </div>
            </div>

            {/* Selisih live */}
            {hmAfter && parseFloat(hmAfter) > selectedUnit.hm && (
              <div style={{ borderTop: '1px solid var(--wnbd)', marginTop: 10, paddingTop: 10, display: 'flex', gap: 16, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Nilai Baru</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--t)' }}>{parseFloat(hmAfter).toLocaleString()} jam</div>
                </div>
                <div style={{ fontSize: 18, color: 'var(--t3)' }}>→</div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--ok)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Selisih</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ok)' }}>
                    +{(parseFloat(hmAfter) - selectedUnit.hm).toLocaleString()} jam
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input HM baru */}
        <div style={{ marginBottom: 12 }}>
          <label className="lbl" htmlFor="hm-baru">Hour Meter Baru *</label>
          <input
            id="hm-baru" name="hmAfter"
            type="number"
            value={hmAfter}
            onChange={e => { setHmAfter(e.target.value); setError('') }}
            placeholder={selectedUnit ? `Min. ${selectedUnit.hm}` : 'Pilih unit dulu'}
            min={selectedUnit?.hm || 0}
            step="0.1"
            style={{ width: '100%' }}
            disabled={!selectedUnit}
          />
        </div>

        {/* Catatan opsional */}
        <div style={{ marginBottom: 12 }}>
          <label className="lbl" htmlFor="catatan">Lokasi</label>
          <input
            id="catatan" name="catatan"
            value={catatan}
            onChange={e => setCatatan(e.target.value)}
            placeholder={`e.g. Lokasi Unit`}
            style={{ width: '100%' }}
            disabled={!selectedUnit}
          />
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
            Jika kosong, catatan otomatis: "Diupdate oleh {user.nama} pada [tanggal]"
          </div>
        </div>

        {/* Error / Success */}
        {error && (
          <div style={{ background: 'var(--errbg)', border: '1px solid var(--errbd)', color: 'var(--err)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10, fontWeight: 600 }}>
            ⚠ {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'var(--okbg)', border: '1px solid var(--okbd)', color: 'var(--ok)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10, fontWeight: 600 }}>
            ✓ {success}
          </div>
        )}

        <button
          className="btn-y"
          onClick={handleSubmit}
          disabled={saving || !unitId || !hmAfter}
          style={{ width: '100%', padding: 12, fontSize: 14, letterSpacing: '.04em', opacity: (saving || !unitId || !hmAfter) ? 0.6 : 1, boxShadow: '0 2px 10px rgba(245,158,11,.25)' }}
        >
          {saving ? '⏳ Menyimpan...' : '💾 Simpan Update HM'}
        </button>
      </div>

      {/* ── Daftar HM Terkini Semua Unit ── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div className="lbl" style={{ marginBottom: 0 }}>⏱ HM Terkini Semua Unit</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <select id="filter-tipe-list" name="filterTipeList" aria-label="Filter Tipe" value={filterTipe} onChange={e => setFilterTipe(e.target.value)} style={{ fontSize: 12, padding: '5px 8px' }}>
              <option value="all">Semua Tipe</option>
              {tipes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select id="filter-brand-list" name="filterBrandList" aria-label="Filter Brand" value={filterBrand} onChange={e => setFilterBrand(e.target.value)} style={{ fontSize: 12, padding: '5px 8px' }}>
              <option value="all">Semua Brand</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
  
</div>
          </div>
  <button
    className="btn-ok btn-sm"
    onClick={exportHMCSV}
  >
    Export CSV
  </button>

  <button
    className="btn-oy btn-sm"
    onClick={() => exportHourMeterPdf(latestHmPerUnit)}
  >
    Export PDF
  </button>
        </div>

        {loading && units.length === 0 ? (
          <SkeletonCardList count={4} />
        ) : filteredUnits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div>Tidak ada unit untuk filter ini</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }} className="g2">
            {paginatedUnits.map(u => (
                <div
                  key={u.id}
                  onClick={() => {
                    setUnitId(String(u.id))
                    setHmAfter(u.hm.toString())
                    setError('')
                    setSuccess('')
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  style={{ background: unitId === String(u.id) ? 'var(--sfy)' : 'var(--bd2)', border: `1.5px solid ${unitId === String(u.id) ? 'var(--p)' : 'var(--bd)'}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all .15s' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--pd)' }}>{u.nomor_unit}</div>
                      <div style={{ fontSize: 11, color: 'var(--t3)' }}>Update terakhir: {fmtDateTime(u.hm_updated_at)}</div>
                      <div style={{ fontSize: 11, color: 'var(--t3)' }}>Lokasi terakhir: {u.hm_catatan}</div>
                    </div>
                    {unitId === String(u.id) && (
                      <span style={{ background: 'var(--p)', color: '#1c1917', fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        Dipilih
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--t)' }}>
                      {u.hm.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--t3)' }}>jam</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>
                    Tap untuk pilih & update
                  </div>
                </div>
              ))}
          </div>
        )}

        {!loading && filteredUnits.length > 0 && (
          <Pagination total={filteredUnits.length} page={page} setPage={setPage} />
        )}
      </div>
    </div>
  )
}