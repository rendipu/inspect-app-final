import { useRef } from 'react'

/**
 * FotoUpload — komponen upload foto dengan kompresi otomatis
 * Foto dikompres ke JPEG max 800px dan kualitas 0.6 → rata-rata ~20-50KB
 * Disimpan sebagai base64 string langsung di database
 */

const MAX_SIZE = 800    // px sisi terpanjang
const QUALITY = 0.60    // JPEG quality (0-1)

/**
 * Kompres image file → base64 JPEG string
 */
async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Gagal memuat gambar'))
      img.onload = () => {
        // Hitung dimensi baru
        let { width, height } = img
        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round((height * MAX_SIZE) / width)
            width = MAX_SIZE
          } else {
            width = Math.round((width * MAX_SIZE) / height)
            height = MAX_SIZE
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        const base64 = canvas.toDataURL('image/jpeg', QUALITY)
        resolve(base64)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

/**
 * FotoUpload component
 * Props:
 *   value    — base64 string atau null
 *   onChange — fn(base64 | null)
 *   label    — teks label (opsional)
 *   color    — warna tema border/icon (opsional, default var(--p))
 */
export default function FotoUpload({ value, onChange, label = '📷 Upload Foto', color = 'var(--p)' }) {
  const inputRef = useRef(null)
  const idRef = useRef(`foto-${Math.random().toString(36).slice(2)}`)

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Hanya file gambar yang diizinkan (JPG, PNG, WEBP)')
      return
    }
    try {
      const compressed = await compressImage(file)
      onChange(compressed)
    } catch (err) {
      alert('Gagal memproses foto: ' + err.message)
    }
  }

  const handleInput = (e) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // reset agar bisa pilih file yang sama lagi
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e) => e.preventDefault()

  if (value) {
    // Tampilkan preview + tombol hapus
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ position: 'relative', display: 'inline-block', borderRadius: 8, overflow: 'hidden', border: '2px solid var(--okbd)' }}>
          <img
            src={value}
            alt="Foto"
            style={{ display: 'block', maxWidth: 200, maxHeight: 150, objectFit: 'cover' }}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Hapus foto"
            style={{
              position: 'absolute', top: 4, right: 4,
              background: 'rgba(0,0,0,0.65)', color: '#fff',
              border: 'none', borderRadius: '50%',
              width: 24, height: 24, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--ok)', marginTop: 4, fontWeight: 600 }}>
          ✓ Foto terlampir — sudah dikompres
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 8 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleInput}
        style={{ display: 'none' }}
        id={idRef.current}
        name="fotoUpload"
        aria-label={label || 'Upload Foto'}
      />
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => inputRef.current?.click()}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'transparent',
          border: `1.5px dashed ${color}`,
          color: color,
          padding: '6px 14px',
          borderRadius: 6, fontSize: 12,
          cursor: 'pointer', fontWeight: 600,
          transition: 'background .15s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        {label}
      </div>
      <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 3 }}>
        Foto dikompres otomatis — maks. ~50KB
      </div>
    </div>
  )
}
