const CFG = {
  belum_dikerjakan:  { bg: 'var(--errbg)', bd: 'var(--errbd)', c: 'var(--err)', label: 'Belum Dikerjakan'  },
  sedang_dikerjakan: { bg: 'var(--wnbg)',  bd: 'var(--wnbd)',  c: 'var(--wn)',  label: 'Sedang Dikerjakan' },
  sudah_selesai:     { bg: 'var(--okbg)',  bd: 'var(--okbd)',  c: 'var(--ok)',  label: 'Sudah Selesai'     },
}

export default function WorkStatusBadge({ status }) {
  const s = CFG[status] ?? CFG.belum_dikerjakan
  return (
    <span className="tag" style={{ background: s.bg, border: `1px solid ${s.bd}`, color: s.c }}>
      {s.label}
    </span>
  )
}
