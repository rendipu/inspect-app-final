import { useState, useRef, useEffect } from 'react'

export default function MultiUserInput({ users, selected, onChange, placeholder = 'Ketik nama mekanik...' }) {
  const [query,    setQuery]    = useState('')
  const [open,     setOpen]     = useState(false)
  const [focused,  setFocused]  = useState(false)
  const inputRef  = useRef(null)
  const dropRef   = useRef(null)

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const handler = (e) => {
      if (!dropRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Filter user berdasarkan query, exclude yang sudah dipilih
  const suggestions = users.filter(u =>
    u.nama.toLowerCase().includes(query.toLowerCase()) &&
    !selected.find(s => s.id === u.id)
  ).slice(0, 8)

  const addUser = (user) => {
    onChange([...selected, user])
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  const removeUser = (id) => {
    onChange(selected.filter(u => u.id !== id))
  }

  const handleKey = (e) => {
    // Enter → pilih item pertama dari suggestion
    if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault()
      addUser(suggestions[0])
    }
    // Backspace → hapus pilihan terakhir jika input kosong
    if (e.key === 'Backspace' && query === '' && selected.length > 0) {
      removeUser(selected[selected.length - 1].id)
    }
    // Escape → tutup dropdown
    if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
    }
  }

  return (
    <div style={{ position: 'relative' }} ref={dropRef}>
      {/* Input area dengan chips */}
      <div
        onClick={() => { inputRef.current?.focus(); setOpen(true) }}
        style={{
          minHeight: 42,
          background: 'var(--sf)',
          border: `1.5px solid ${focused ? 'var(--p)' : 'var(--bd)'}`,
          borderRadius: 8,
          padding: '5px 8px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 5,
          alignItems: 'center',
          cursor: 'text',
          transition: 'border-color .15s',
          boxShadow: focused ? '0 0 0 3px rgba(245,158,11,.12)' : 'none',
        }}
      >
        {/* Chips mekanik yang sudah dipilih */}
        {selected.map(u => (
          <span key={u.id} style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: 'var(--p)',
            color: '#1c1917',
            padding: '3px 8px 3px 10px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}>
            {u.nama}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeUser(u.id) }}
              style={{
                background: 'rgba(0,0,0,.15)',
                border: 'none',
                borderRadius: '50%',
                width: 16,
                height: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                color: '#1c1917',
                fontWeight: 900,
                padding: 0,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </span>
        ))}

        {/* Input teks */}
        <input
          id="multi-user-input" name="multiUserInput" aria-label={placeholder || 'Ketik nama mekanik'}
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setFocused(true); setOpen(true) }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKey}
          placeholder={selected.length === 0 ? placeholder : ''}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 13,
            color: 'var(--t)',
            minWidth: 120,
            flex: 1,
            padding: '2px 4px',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Dropdown suggestions */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: 'var(--sf)',
          border: '1.5px solid var(--bd)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          zIndex: 100,
          overflow: 'hidden',
          maxHeight: 260,
          overflowY: 'auto',
        }}>
          {suggestions.length > 0 ? (
            <>
              {/* Header hint */}
              <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--bd2)', background: 'var(--bd2)' }}>
                Pilih mekanik
              </div>
              {suggestions.map((u, idx) => (
                <button
                  key={u.id}
                  type="button"
                  onMouseDown={e => e.preventDefault()} // prevent blur
                  onClick={() => addUser(u)}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: idx < suggestions.length - 1 ? '1px solid var(--bd2)' : 'none',
                    padding: '10px 14px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    transition: 'background .1s',
                    fontSize: 13,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--sfy)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Avatar inisial */}
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--pl)',
                    border: '1.5px solid var(--wnbd)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 800,
                    color: 'var(--pd)',
                    flexShrink: 0,
                  }}>
                    {u.nama.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--t)' }}>
                      {/* Highlight query match */}
                      {highlightMatch(u.nama, query)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>{u.nrp} · {u.jabatan}</div>
                  </div>
                </button>
              ))}
              {/* Hint enter */}
              <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--t3)', borderTop: '1px solid var(--bd2)', background: 'var(--bd2)', display: 'flex', gap: 12 }}>
                <span>↵ Enter untuk pilih pertama</span>
                <span>⌫ Backspace untuk hapus terakhir</span>
              </div>
            </>
          ) : query.length > 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
              Tidak ada mekanik dengan nama "{query}"
            </div>
          ) : selected.length === users.filter(u=>u.role==='mekanik').length ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
              Semua mekanik sudah dipilih
            </div>
          ) : (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
              Ketik nama untuk mencari...
            </div>
          )}
        </div>
      )}

      {/* Counter info */}
      {selected.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 5 }}>
          {selected.length} mekanik dipilih ·
          <button
            type="button"
            onClick={() => onChange([])}
            style={{ background: 'none', border: 'none', color: 'var(--err)', fontSize: 11, cursor: 'pointer', fontWeight: 700, marginLeft: 4 }}
          >
            Hapus semua
          </button>
        </div>
      )}
    </div>
  )
}

// Helper: highlight bagian nama yang cocok dengan query
function highlightMatch(text, query) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ background: 'var(--pl)', color: 'var(--pd)', borderRadius: 3, padding: '0 2px', fontWeight: 800 }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  )
}