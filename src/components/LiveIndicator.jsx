function fmtTime(d) {
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function LiveIndicator({ syncing, lastSync, compact = false }) {
  if (compact) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {syncing
          ? <span className="spin" style={{ fontSize: 12, color: 'var(--t3)' }}>↻</span>
          : <span className="live-dot pulse" />}
      </span>
    )
  }

  return (
    <span className="live-badge">
      {syncing
        ? <span className="spin" style={{ fontSize: 10 }}>↻</span>
        : <span className="live-dot pulse" />}
      {syncing ? 'Syncing...' : `Live · ${fmtTime(lastSync)}`}
    </span>
  )
}