import { useMemo, useState, useEffect } from 'react'
import { api } from '../lib/api'

const ICON_OPTIONS = [
  { value: 'function', label: 'Fungsi', sym: 'ƒ' },
  { value: 'construction', label: 'Alat', sym: '🔧' },
  { value: 'warehouse', label: 'Gudang', sym: '🏭' },
  { value: 'bolt', label: 'Listrik', sym: '⚡' },
  { value: 'book', label: 'Buku', sym: '📖' },
  { value: 'folder', label: 'Folder', sym: '📁' },
]

const MAX_FILE_BYTES = 2.6 * 1024 * 1024

function ManualIconBox({ icon }) {
  const sym = ICON_OPTIONS.find((o) => o.value === icon)?.sym || '📄'
  return (
    <div className="manual-lib-ico-box" aria-hidden>
      <span className="manual-lib-ico-sym">{sym}</span>
    </div>
  )
}

async function fileToPdfDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(new Error('Gagal membaca file'))
    r.onload = () => resolve(r.result)
    r.readAsDataURL(file)
  })
}

async function openManualDocument(row) {
  try {
    const full = await api.getManual(row.id)
    if (full.external_url && String(full.external_url).trim()) {
      window.open(full.external_url.trim(), '_blank', 'noopener,noreferrer')
      return
    }
    const raw = full.pdf_base64
    if (!raw || raw.length < 20) {
      alert('Dokumen PDF belum tersedia.')
      return
    }
    let b64 = String(raw).trim()
    const ix = b64.indexOf('base64,')
    if (b64.startsWith('data:') && ix !== -1) b64 = b64.slice(ix + 7)
    b64 = b64.replace(/\s/g, '')
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 120_000)
  } catch (e) {
    alert(e.message || 'Gagal membuka dokumen')
  }
}

export default function ManualLibraryPage({ kind, user, setPage, data, refetch }) {
  const [q, setQ] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const title = kind === 'shopmanual' ? 'Shop Manual' : 'Partbook'
  const kicker = kind === 'shopmanual' ? 'Find equipment manual' : 'Find part documentation'

  const list = useMemo(() => {
    const rows = data?.manuals?.[kind] || []
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(
      (r) =>
        (r.title && r.title.toLowerCase().includes(s)) ||
        (r.subtitle && r.subtitle.toLowerCase().includes(s)),
    )
  }, [data, kind, q])

  const openAdd = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setModalOpen(true)
  }

  const onDelete = async (row) => {
    if (!window.confirm(`Hapus "${row.title}"?`)) return
    try {
      await api.deleteManual(row.id)
      await refetch?.()
    } catch (e) {
      alert(e.message || 'Gagal menghapus')
    }
  }

  return (
    <div className="manual-lib-root manual-lib-root--mob fade">
      <nav className="manual-lib-topbar">
        <div className="manual-lib-topbar-left">
          <button type="button" className="manual-lib-icon-btn" onClick={() => setPage('dashboard')} aria-label="Kembali">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="manual-lib-title">{title}</h1>
        </div>
        <div className="manual-lib-topbar-right">
          <span className="manual-lib-bookmark" aria-hidden title="Bookmark">🔖</span>
          <div className="manual-lib-avatar" aria-hidden title={user?.nama}>
            {(user?.nama || '?').slice(0, 1).toUpperCase()}
          </div>
        </div>
      </nav>

      <main className="manual-lib-main">
        <div className="manual-lib-field">
          <label className="manual-lib-label" htmlFor={`manual-search-${kind}`}>{kicker}</label>
          <div className="manual-lib-search-wrap">
            <span className="manual-lib-search-ico" aria-hidden>🔍</span>
            <input
              id={`manual-search-${kind}`}
              className="manual-lib-search"
              placeholder="Search by model or manufacturer..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="manual-lib-list">
          {list.map((row) => (
            <div key={row.id} className="manual-lib-card">
              <div className="manual-lib-card-left">
                <ManualIconBox icon={row.icon} />
                <div>
                  <h3 className="manual-lib-card-title">{row.title}</h3>
                  <p className="manual-lib-card-sub">{row.subtitle || '—'}</p>
                </div>
              </div>
              <div className="manual-lib-card-actions">
                <button type="button" className="manual-lib-btn-ghost" onClick={() => openEdit(row)} title="Ubah">
                  Ubah
                </button>
                <button type="button" className="manual-lib-btn-ghost manual-lib-btn-danger" onClick={() => onDelete(row)} title="Hapus">
                  Hapus
                </button>
                <button
                  type="button"
                  className="manual-lib-btn-open"
                  onClick={() => openManualDocument(row)}
                  disabled={!row.has_pdf && !row.has_external}
                >
                  OPEN
                  <span className="manual-lib-open-ico" aria-hidden>↗</span>
                </button>
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <div className="manual-lib-empty">Belum ada dokumen. Tambahkan lewat tombol +.</div>
          )}
        </div>

        <div className="manual-lib-offline">
          <div className="manual-lib-offline-inner">
            <h2 className="manual-lib-offline-title">Offline Access</h2>
            <p className="manual-lib-offline-desc">
              Download selected manuals for offline use in the field without connectivity.
            </p>
            <button
              type="button"
              className="manual-lib-offline-btn"
              onClick={() => alert('Manajemen unduhan offline akan tersedia di pembaruan berikutnya.')}
            >
              MANAGE DOWNLOADS
            </button>
          </div>
          <span className="manual-lib-offline-deco" aria-hidden>⬇</span>
        </div>
      </main>

      <button type="button" className="manual-lib-fab" onClick={openAdd} aria-label={`Tambah ${title}`}>
        +
      </button>

      {modalOpen && (
        <ManualFormModal
          key={editing?.id ?? 'new'}
          kind={kind}
          title={title}
          initial={editing}
          saving={saving}
          setSaving={setSaving}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSaved={async () => {
            setModalOpen(false)
            setEditing(null)
            await refetch?.()
          }}
        />
      )}
    </div>
  )
}

function ManualFormModal({ kind, title, initial, saving, setSaving, onClose, onSaved }) {
  const [formTitle, setFormTitle] = useState(initial?.title || '')
  const [subtitle, setSubtitle] = useState(initial?.subtitle || '')
  const [icon, setIcon] = useState(initial?.icon || 'book')
  const [externalUrl, setExternalUrl] = useState(initial?.external_url || '')
  const [file, setFile] = useState(null)

  useEffect(() => {
    setFormTitle(initial?.title || '')
    setSubtitle(initial?.subtitle || '')
    setIcon(initial?.icon || 'book')
    setExternalUrl(initial?.external_url || '')
    setFile(null)
  }, [initial])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!formTitle.trim()) {
      alert('Judul wajib diisi.')
      return
    }
    let pdf_base64 = ''
    let pdf_filename = ''
    if (file) {
      if (file.size > MAX_FILE_BYTES) {
        alert('PDF terlalu besar (maks ~2.6 MB). Gunakan URL eksternal atau kompres PDF.')
        return
      }
      if (file.type !== 'application/pdf') {
        alert('Hanya file PDF yang diperbolehkan.')
        return
      }
      try {
        pdf_base64 = await fileToPdfDataUrl(file)
        pdf_filename = file.name
      } catch (err) {
        alert(err.message || 'Gagal membaca PDF')
        return
      }
    }
    const ext = externalUrl.trim()
    if (!initial && !pdf_base64 && !ext) {
      alert('Unggah PDF atau isi URL dokumen (salah satu wajib).')
      return
    }
    setSaving(true)
    try {
      if (initial) {
        const body = {
          title: formTitle.trim(),
          subtitle: subtitle.trim(),
          icon,
          external_url: ext,
        }
        if (pdf_base64) {
          body.pdf_base64 = pdf_base64
          body.pdf_filename = pdf_filename
        }
        await api.updateManual(initial.id, body)
      } else {
        await api.createManual({
          kind,
          title: formTitle.trim(),
          subtitle: subtitle.trim(),
          icon,
          pdf_base64: pdf_base64 || undefined,
          pdf_filename: pdf_filename || undefined,
          external_url: ext || undefined,
        })
      }
      await onSaved()
    } catch (err) {
      alert(err.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="manual-lib-modal-back" role="presentation" onClick={onClose}>
      <div
        className="manual-lib-modal"
        role="dialog"
        aria-labelledby="manual-form-h"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 id="manual-form-h" className="manual-lib-modal-h">{initial ? 'Ubah' : 'Tambah'} {title}</h2>
        <form onSubmit={onSubmit} className="manual-lib-form">
          <label className="manual-lib-form-label">Judul</label>
          <input className="manual-lib-form-input" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required />

          <label className="manual-lib-form-label">Kategori / subjudul</label>
          <input className="manual-lib-form-input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Mis. Dump Truck / Heavy Duty" />

          <label className="manual-lib-form-label">Ikon</label>
          <select className="manual-lib-form-input" value={icon} onChange={(e) => setIcon(e.target.value)}>
            {ICON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.sym} {o.label}</option>
            ))}
          </select>

          <label className="manual-lib-form-label">File PDF {initial && '(kosongkan jika tidak diganti)'}</label>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="manual-lib-form-file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          <label className="manual-lib-form-label">URL eksternal (opsional, ganti / tambah tautan)</label>
          <input
            className="manual-lib-form-input"
            type="url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://..."
          />

          <div className="manual-lib-form-actions">
            <button type="button" className="btn-g" onClick={onClose} disabled={saving}>Batal</button>
            <button type="submit" className="btn-y" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
