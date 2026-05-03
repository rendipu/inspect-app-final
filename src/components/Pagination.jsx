import { useMemo } from 'react'

const PAGE_SIZE = 10

export { PAGE_SIZE }

export default function Pagination({ total, page, setPage }) {
  const totalPages = Math.ceil(total / PAGE_SIZE)
  
  // Don't render if 10 or fewer items
  if (total <= PAGE_SIZE) return null

  const pages = useMemo(() => {
    const p = []
    const maxVisible = 5
    let start = Math.max(1, page - Math.floor(maxVisible / 2))
    let end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1)
    if (start > 1) { p.push(1); if (start > 2) p.push('...') }
    for (let i = start; i <= end; i++) p.push(i)
    if (end < totalPages) { if (end < totalPages - 1) p.push('...'); p.push(totalPages) }
    return p
  }, [page, totalPages])

  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  return (
    <div>
      <div className="pagination">
        <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
        {pages.map((p, i) =>
          p === '...' ? <span key={`e${i}`} style={{ padding: '0 4px', color: 'var(--t3)' }}>…</span>
          : <button key={p} className={`pagination-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p)}>{p}</button>
        )}
        <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>›</button>
      </div>
      <div className="pagination-info">Menampilkan {from}–{to} dari {total}</div>
    </div>
  )
}
