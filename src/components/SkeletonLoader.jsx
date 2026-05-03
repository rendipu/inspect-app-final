// ─── Skeleton Loading Components ──────────────────────────────────────
// Digunakan saat data sedang dimuat, menggantikan spinner loading

function SkeletonPulse({ width, height, radius = 6, style = {} }) {
  return (
    <div
      className="skeleton-shimmer"
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  )
}

// Skeleton untuk stat card di Dashboard
export function SkeletonStatCards({ count = 3 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count},1fr)`, gap: 12, marginBottom: 16 }} className="g3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: 16 }}>
          <SkeletonPulse width="60%" height={10} style={{ marginBottom: 10 }} />
          <SkeletonPulse width="40%" height={28} style={{ marginBottom: 6 }} />
          <SkeletonPulse width="50%" height={10} />
        </div>
      ))}
    </div>
  )
}

// Skeleton untuk card inspeksi/kerusakan
export function SkeletonCard() {
  return (
    <div className="card" style={{ borderLeft: '3px solid var(--bd)', borderRadius: '0 12px 12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <SkeletonPulse width={90} height={16} radius={4} />
            <SkeletonPulse width={100} height={14} radius={4} />
            <SkeletonPulse width={50} height={18} radius={10} />
          </div>
          <SkeletonPulse width="70%" height={12} style={{ marginBottom: 6 }} />
          <SkeletonPulse width="50%" height={12} />
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
          <SkeletonPulse width={80} height={14} style={{ marginBottom: 6, marginLeft: 'auto' }} />
          <SkeletonPulse width={60} height={12} style={{ marginLeft: 'auto' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
            <SkeletonPulse width="60%" height={10} style={{ margin: '0 auto 6px' }} />
            <SkeletonPulse width="40%" height={18} style={{ margin: '0 auto' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Skeleton untuk tabel
export function SkeletonTable({ rows = 4, cols = 5 }) {
  return (
    <div className="card">
      <SkeletonPulse width={160} height={12} style={{ marginBottom: 16 }} />
      <div className="ptbl">
        <table className="tbl" style={{ width: '100%' }}>
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i}><SkeletonPulse width="80%" height={10} /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c}><SkeletonPulse width={c === 0 ? 80 : '70%'} height={13} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Skeleton untuk card list (History)
export function SkeletonCardList({ count = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

// Skeleton layout yang menyerupai Dashboard
export function SkeletonDashboard() {
  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <SkeletonPulse width={140} height={22} style={{ marginBottom: 8 }} />
          <SkeletonPulse width={220} height={14} />
        </div>
        <SkeletonPulse width={120} height={28} radius={14} />
      </div>

      {/* Stat cards */}
      <SkeletonStatCards count={3} />

      {/* Table */}
      <SkeletonTable rows={4} cols={5} />
    </div>
  )
}

// Skeleton untuk halaman saat lazy-load (Suspense fallback)
export function SkeletonPage() {
  return (
    <div className="fade">
      <div style={{ marginBottom: 14 }}>
        <SkeletonPulse width={160} height={22} style={{ marginBottom: 8 }} />
        <SkeletonPulse width={280} height={14} />
      </div>

      {/* Tab buttons skeleton */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[80, 70, 110, 90, 110].map((w, i) => (
          <SkeletonPulse key={i} width={w} height={30} radius={20} />
        ))}
      </div>

      {/* Cards skeleton */}
      <SkeletonCardList count={4} />
    </div>
  )
}
