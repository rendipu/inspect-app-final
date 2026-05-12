const CONFIG = {
  good:           { bg: 'var(--okbg)',  bd: 'var(--okbd)',  c: 'var(--ok)',  label: 'Good'           },
  bad:            { bg: 'var(--errbg)', bd: 'var(--errbd)', c: 'var(--err)', label: 'Order Part'     },
  repair:         { bg: 'var(--wnbg)',  bd: 'var(--wnbd)',  c: 'var(--wn)',  label: 'Repair'         },
  pending:        { bg: 'var(--infbg)', bd: 'var(--infbd)', c: 'var(--inf)', label: 'Pending'        },
  approved:       { bg: 'var(--okbg)',  bd: 'var(--okbd)',  c: 'var(--ok)',  label: 'Approved'       },
  rejected:       { bg: 'var(--errbg)', bd: 'var(--errbd)', c: 'var(--err)', label: 'Rejected'       },
  scheduled:      { bg: 'var(--purbg)', bd: 'var(--purbd)', c: 'var(--pur)', label: 'Terjadwal'      },
  done:           { bg: 'var(--okbg)',  bd: 'var(--okbd)',  c: 'var(--ok)',  label: 'Selesai'        },
  admin:          { bg: 'var(--purbg)', bd: 'var(--purbd)', c: 'var(--pur)', label: 'Admin'          },
  group_leader:   { bg: 'var(--infbg)', bd: 'var(--infbd)', c: 'var(--inf)', label: 'Group Leader'   },
  mekanik:        { bg: 'var(--okbg)',  bd: 'var(--okbd)',  c: 'var(--ok)',  label: 'Mekanik'        },
  warehouse:      { bg: 'var(--wnbg)',  bd: 'var(--wnbd)',  c: 'var(--wn)',  label: 'Warehouse'      },
  planner:        { bg: '#eef2ff',      bd: '#a5b4fc',      c: '#4f46e5',    label: 'Planner'        },
  sudah_dipesan:  { bg: '#eff6ff',      bd: '#93c5fd',      c: '#2563eb',    label: '🛒 Sudah Dipesan' },
  full_supply:    { bg: '#f0fdf4',      bd: '#4ade80',      c: '#15803d',    label: '📦 Full Supply'  },
}

export default function Badge({ type }) {
  const s = CONFIG[type] ?? CONFIG.pending
  return (
    <span className="tag" style={{ background: s.bg, border: `1px solid ${s.bd}`, color: s.c }}>
      {s.label}
    </span>
  )
}