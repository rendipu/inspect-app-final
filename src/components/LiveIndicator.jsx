function fmtTime(d) {
  return d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
}

export default function LiveIndicator({ syncing, lastSync, compact = false, rtStatus }) {

  const dot = rtStatus === 'connected'
    ? { color: 'var(--ok)',  label: 'Live',        pulse: true  }
    : rtStatus === 'connecting'
    ? { color: 'var(--wn)',  label: 'Connecting',  pulse: false }
    : { color: 'var(--err)', label: 'Offline RT',  pulse: false }

  return (
    <span className="live-badge">
      {syncing
        ? <span className="spin" style={{ fontSize:10 }}>↻</span>
        : <span className="live-dot" style={{ background: dot.color, ...(dot.pulse ? {} : {}) }} />}
      <span>
        {syncing ? 'Syncing...' : `${dot.label} · ${fmtTime(lastSync)}`}
      </span>
    </span>
  )
}
