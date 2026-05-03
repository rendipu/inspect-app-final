// ─── CSV Export Utility ───────────────────────────────────────────────
// Export data array ke file CSV yang bisa dibuka di Excel
// Menggunakan separator titik koma (;) agar otomatis menjadi kolom terpisah di Excel (Region Indonesia/Eropa)

function escapeCsv(val) {
  if (val === null || val === undefined) return ''
  const s = String(val)
  // Escape if it contains semicolon, comma, quotes, or newlines
  if (s.includes(';') || s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function exportCsv(filename, headers, rows) {
  const bom = '\uFEFF' // UTF-8 BOM for Excel compatibility

  const headerLine = headers.map(escapeCsv).join(';')
  const dataLines = rows.map(row => row.map(escapeCsv).join(';'))

  const csv = bom + [headerLine, ...dataLines].join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
