import { jsPDF } from 'jspdf'

// ── Helper ──────────────────────────────────────────────────────────────────
function fmtDateID(d) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}
function fmtDuration(start, finish) {
  if (!start || !finish) return '-'
  const [sh, sm] = start.split(':').map(Number)
  const [fh, fm] = finish.split(':').map(Number)
  const diff = (fh * 60 + fm) - (sh * 60 + sm)
  if (diff <= 0) return '-'
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return h > 0 ? `${h} jam ${m} menit` : `${m} menit`
}

// ── Main export function ────────────────────────────────────────────────────
export function exportInspectionPdf(inspection, unit) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const PW  = 210          // page width
  const ML  = 18           // margin left
  const MR  = 192          // margin right
  const W   = MR - ML      // content width

  const mechs   = (inspection.mekaniks || []).map(m => m.user_nama).filter(Boolean).join(', ') || '-'
  const gl      = inspection.group_leader_nama || '-'
  const dur     = fmtDuration(inspection.jam_start, inspection.jam_finish)
  const answers = inspection.answers || []
  const unitLabel = unit
    ? `${unit.brand || ''} ${unit.tipe || ''}`.trim()
    : (inspection.unit_nomor || '-')
  const nomorUnit = unit?.nomor_unit || inspection.unit_nomor || '-'

  // ── Grouped answers by kategori ──────────────────────────────────────────
  const grouped = {}
  answers.forEach(a => {
    const kat = a.question_kategori || 'Lainnya'
    if (!grouped[kat]) grouped[kat] = []
    grouped[kat].push(a)
  })

  // ── TEMUAN (bad / repair answers) ────────────────────────────────────────
  const findings = answers.filter(a => a.answer === 'bad' || a.answer === 'repair')

  // ── Typography helpers ───────────────────────────────────────────────────
  let y = 18

  const setFont = (style, size, color = '#000000') => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    doc.setTextColor(r, g, b)
  }

  const text = (str, x, yy, opts = {}) => {
    doc.text(str ?? '-', x, yy, opts)
  }

  const line = (x1, yy, x2, color = '#cccccc', lw = 0.2) => {
    doc.setDrawColor(color)
    doc.setLineWidth(lw)
    doc.line(x1, yy, x2, yy)
  }

  const addPageIfNeeded = (needed = 14) => {
    if (y + needed > 278) {
      doc.addPage()
      y = 18
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HEADER
  // ══════════════════════════════════════════════════════════════════════════
  setFont('bold', 14)
  text(`Daily Inspeksi ${unitLabel}`, PW / 2, y, { align: 'center' })
  y += 2
  line(ML, y, MR, '#999999', 0.4)
  y += 6

  // Tanggal (right aligned)
  setFont('normal', 10, '#444444')
  text(`Tanggal: ${fmtDateID(inspection.tanggal)}`, MR, y, { align: 'right' })
  y += 7

  // ── Info Header ──────────────────────────────────────────────────────────
  const infoRows = [
    ['No. Unit',     nomorUnit],
    ['Hour Meter',   `${(inspection.hour_meter ?? '-').toLocaleString()} jam`],
    ['Start',        inspection.jam_start || '-'],
    ['Finish',       inspection.jam_finish || '-'],
    ['Total Waktu',  dur],
    ['Mekanik',      mechs],
    ['Group Leader', gl],
  ]

  setFont('normal', 10)
  infoRows.forEach(([lbl, val]) => {
    setFont('normal', 10, '#555555')
    text(lbl, ML, y)
    setFont('normal', 10, '#555555')
    text(':', ML + 32, y)
    setFont('bold', 10, '#111111')
    text(val, ML + 36, y)
    y += 5.5
  })

  y += 4
  line(ML, y, MR, '#cccccc', 0.3)
  y += 8

  // ══════════════════════════════════════════════════════════════════════════
  // HASIL INSPEKSI
  // ══════════════════════════════════════════════════════════════════════════
  setFont('bold', 11, '#111111')
  text('HASIL INSPEKSI', PW / 2, y, { align: 'center' })
  y += 7

  // Column header
  const COL_ITEM   = ML
  const COL_RESULT = MR - 28

  setFont('bold', 9, '#888888')
  text('ITEM', COL_ITEM, y)
  text('HASIL', COL_RESULT, y)
  y += 2
  line(ML, y, MR, '#cccccc', 0.2)
  y += 5

  // Grouped answers
  Object.entries(grouped).forEach(([kat, qs]) => {
    addPageIfNeeded(14)

    // Category header
    setFont('bold', 10, '#333333')
    text(kat.toUpperCase(), COL_ITEM, y)
    y += 5

    qs.forEach(a => {
      addPageIfNeeded(8)

      const pertanyaan = a.question_pertanyaan || '-'
      const answerLabel = a.answer === 'good' ? 'Good' : a.answer === 'bad' ? 'Bad / Order Part' : 'Repair'
      const answerColor = a.answer === 'good' ? '#16a34a' : a.answer === 'bad' ? '#dc2626' : '#d97706'

      setFont('normal', 9, '#333333')
      // wrap long text
      const lines = doc.splitTextToSize(`  ${pertanyaan}`, COL_RESULT - COL_ITEM - 4)
      doc.text(lines, COL_ITEM, y)

      setFont('bold', 9, answerColor)
      text(answerLabel, COL_RESULT, y)

      const lineHeight = Math.max(lines.length * 4.5, 6)
      y += lineHeight
    })
    y += 2
  })

  y += 2
  line(ML, y, MR, '#cccccc', 0.3)
  y += 8

  // ══════════════════════════════════════════════════════════════════════════
  // TEMUAN (bad & repair summary)
  // ══════════════════════════════════════════════════════════════════════════
  if (findings.length > 0) {
    addPageIfNeeded(20)

    // Box
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor('#333333')
    doc.setLineWidth(0.4)
    doc.rect(ML, y, W, Math.min(findings.length * 10 + 20, 90), 'S')

    y += 6

    setFont('bold', 10, '#111111')
    text('TEMUAN:', ML + 4, y)
    text('Status', COL_RESULT, y)
    y += 5
    line(ML, y, MR, '#cccccc', 0.2)
    y += 5

    findings.forEach((a, idx) => {
      addPageIfNeeded(10)

      const label = a.answer === 'bad'
        ? (a.part_order?.part_name || a.question_pertanyaan || '-')
        : (a.repair?.keterangan || a.question_pertanyaan || '-')

      const status = (() => {
        if (a.answer === 'bad') {
          const ws = a.part_order?.work_status
          return ws === 'sudah_selesai' ? 'Sudah Dikerjakan / Close' : 'Belum Dikerjakan'
        }
        const ws = a.repair?.work_status
        return ws === 'sudah_selesai' ? 'Sudah Dikerjakan / Close' : 'Belum Dikerjakan'
      })()

      const statusColor = status.includes('Sudah') ? '#16a34a' : '#dc2626'

      setFont('normal', 9, '#222222')
      const itemLines = doc.splitTextToSize(`${idx + 1}. ${label}`, COL_RESULT - ML - 8)
      doc.text(itemLines, ML + 4, y)

      setFont('bold', 9, statusColor)
      text(status, COL_RESULT, y)

      y += Math.max(itemLines.length * 4.5, 6) + 2
    })

    y += 4
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Part Orders detail (bad answers)
  // ══════════════════════════════════════════════════════════════════════════
  const badAnswers = answers.filter(a => a.answer === 'bad' && a.part_order)
  if (badAnswers.length > 0) {
    addPageIfNeeded(20)
    line(ML, y, MR, '#cccccc', 0.3)
    y += 7

    setFont('bold', 10, '#dc2626')
    text('ORDER PART', ML, y)
    y += 6

    setFont('bold', 8, '#888888')
    const colPN = ML + 70
    const colQty = MR - 20
    text('ITEM', ML, y)
    text('PART NAME', colPN, y)
    text('QTY', colQty, y)
    y += 2
    line(ML, y, MR, '#cccccc', 0.2)
    y += 4

    badAnswers.forEach(a => {
      addPageIfNeeded(8)
      setFont('normal', 9, '#222222')
      const pertLines = doc.splitTextToSize(a.question_pertanyaan || '-', colPN - ML - 2)
      doc.text(pertLines, ML, y)
      text(a.part_order.part_name || '-', colPN, y)
      text(String(a.part_order.quantity ?? '-'), colQty, y)
      y += Math.max(pertLines.length * 4.5, 6)
    })
    y += 4
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Footer
  // ══════════════════════════════════════════════════════════════════════════
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    setFont('normal', 8, '#aaaaaa')
    doc.text(`Halaman ${i} / ${totalPages}`, PW / 2, 290, { align: 'center' })
    doc.text('Dicetak oleh Sistem Inspeksi Alat Berat', ML, 290)
    doc.text(new Date().toLocaleDateString('id-ID'), MR, 290, { align: 'right' })
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  const safeName = (unit?.nomor_unit || inspection.unit_nomor || 'unit').replace(/[^a-zA-Z0-9_-]/g, '_')
  const dateStr  = (inspection.tanggal || '').slice(0, 10).replace(/-/g, '')
  doc.save(`Inspeksi_${safeName}_${dateStr}.pdf`)
}

// ─────────────────────────────────────────────────────────────
// EXPORT HOUR METER PDF
// ─────────────────────────────────────────────────────────────
export function exportHourMeterPdf(histories = []) {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'landscape',
  })

  let y = 18

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Laporan Hour Meter', 14, y)

  y += 10

  // HEADER TABLE
  const headers = [
    'Tanggal',
    'Unit',
    'Hour meter',
    'Catatan/Lokasi',
    'User',
  ]

  const colWidths = [35, 35, 28, 80, 35]

  let x = 10

  doc.setFontSize(9)

  headers.forEach((h, i) => {
    doc.setFillColor(230, 230, 230)
    doc.rect(x, y, colWidths[i], 8, 'F')
    doc.text(h, x + 2, y + 5.5)
    x += colWidths[i]
  })

  y += 8

  histories.forEach((item) => {
    x = 10

    const row = [
      new Date(item.updatedAt).toLocaleDateString('id-ID'),
      item.unit_nomor || '-',
      String(item.hm_after ?? '-'),
      item.catatan || '-',
      item.user_nama || '-',
    ]

    row.forEach((cell, i) => {
      doc.rect(x, y, colWidths[i], 8)
      doc.text(String(cell).slice(0, 40), x + 2, y + 5.5)
      x += colWidths[i]
    })

    y += 8

    // PAGE BREAK
    if (y > 185) {
      doc.addPage()
      y = 20
    }
  })

  doc.save(`hour-meter-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.pdf`)
}
