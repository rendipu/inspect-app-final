// api/inspections/index.js
import connectDB from '../../lib/mongodb.js'
import { Inspection, Unit, User, Question } from '../../lib/models.js'
import { requireAuth } from '../../lib/auth.js'
import { handleCors } from '../../lib/cors.js'
import { broadcast } from '../../lib/sse.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  const currentUser = requireAuth(req, res)
  if (!currentUser) return

  await connectDB()

  // ── GET: Daftar inspeksi dengan filter ────────────────────────────────────
  if (req.method === 'GET') {
    const { unit_id, tanggal_from, tanggal_to, page = 1, limit = 20 } = req.query
    const filter = {}

    if (unit_id)      filter.unit_id = parseInt(unit_id)
    if (tanggal_from || tanggal_to) {
      filter.tanggal = {}
      if (tanggal_from) filter.tanggal.$gte = new Date(tanggal_from)
      if (tanggal_to)   filter.tanggal.$lte = new Date(tanggal_to)
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [inspections, total] = await Promise.all([
      Inspection.find(filter)
        .sort({ tanggal: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Inspection.countDocuments(filter),
    ])

    return res.json({
      data: inspections,
      meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    })
  }

  // ── POST: Buat inspeksi baru ──────────────────────────────────────────────
  if (req.method === 'POST') {
    const { unit_id, hour_meter, jam_start, jam_finish, group_leader_id, mekanik_ids, answers, tanggal } = req.body

    if (!unit_id || !hour_meter || !jam_start || !jam_finish || !group_leader_id || !mekanik_ids?.length || !answers?.length) {
      return res.status(400).json({ error: 'Data tidak lengkap' })
    }

    // Validasi: unit hanya boleh inspeksi 1x per hari
    const inspDate   = tanggal ? new Date(tanggal) : new Date()
    const dateStr    = inspDate.toISOString().split('T')[0]
    const startOfDay = new Date(dateStr + 'T00:00:00.000Z')
    const endOfDay   = new Date(dateStr + 'T23:59:59.999Z')

    const alreadyInspected = await Inspection.findOne({
      unit_id: parseInt(unit_id),
      tanggal: { $gte: startOfDay, $lte: endOfDay },
    }).lean()

    if (alreadyInspected) {
      const mechs = (alreadyInspected.mekaniks || []).map(m => m.user_nama).filter(Boolean).join(', ')
      return res.status(409).json({
        error:       `Unit ${alreadyInspected.unit_nomor} sudah diinspeksi hari ini`,
        detail:      `Inspeksi sebelumnya pukul ${alreadyInspected.jam_start} oleh ${mechs || 'mekanik'}`,
        existing_id: alreadyInspected.id,
      })
    }

    // Ambil data relasi untuk di-embed (1 kali DB call)
    const [unit, leader, mekanikUsers, questionDocs] = await Promise.all([
      Unit.findOne({ id: parseInt(unit_id) }).lean(),
      User.findOne({ id: parseInt(group_leader_id) }, 'id nrp nama').lean(),
      User.find({ id: { $in: mekanik_ids.map(Number) } }, 'id nrp nama').lean(),
      Question.find({ id: { $in: answers.map(a => parseInt(a.question_id)) }, aktif: true }, 'id kategori pertanyaan').lean(),
    ])

    if (!unit) return res.status(404).json({ error: 'Unit tidak ditemukan' })

    const mekanikMap  = Object.fromEntries(mekanikUsers.map(u => [u.id, u]))
    const questionMap = Object.fromEntries(questionDocs.map(q => [q.id, q]))

    // Siapkan counter id untuk embedded docs
    const { Counter } = await import('../../lib/models.js')

    // Bangun answers dengan data embedded
    const builtAnswers = answers.map(a => {
      const q = questionMap[parseInt(a.question_id)] || {}
      const ans = {
        question_id:          parseInt(a.question_id),
        question_kategori:    q.kategori,
        question_pertanyaan:  q.pertanyaan,
        answer:               a.answer,
      }
      if (a.answer === 'bad' && a.part_order) {
        ans.part_order = {
          part_name:   a.part_order.part_name,
          part_number: a.part_order.part_number || null,
          quantity:    parseInt(a.part_order.quantity) || 1,
          keterangan:  a.part_order.keterangan || null,
          foto_url:    a.part_order.foto_url || null,
        }
      }
      if (a.answer === 'repair' && a.repair) {
        ans.repair = {
          keterangan: a.repair.keterangan || null,
          foto_url:   a.repair.foto_url || null,
        }
      }
      return ans
    })

    const inspection = await Inspection.create({
      unit_id:           parseInt(unit_id),
      unit_nomor:        unit.nomor_unit,
      unit_tipe:         unit.tipe,
      unit_brand:        unit.brand,
      tanggal:           inspDate,
      hour_meter:        parseFloat(hour_meter),
      jam_start,
      jam_finish,
      group_leader_id:   parseInt(group_leader_id),
      group_leader_nama: leader?.nama,
      mekaniks: mekanik_ids.map(mid => {
        const u = mekanikMap[parseInt(mid)] || {}
        return { user_id: parseInt(mid), user_nrp: u.nrp, user_nama: u.nama }
      }),
      answers: builtAnswers,
    })

    // Update HM unit
    await Unit.updateOne({ id: parseInt(unit_id) }, { hm: parseFloat(hour_meter) })

    // Broadcast SSE realtime
    broadcast('inspection_created', {
      id:         inspection.id,
      unit_nomor: inspection.unit_nomor,
      tanggal:    inspection.tanggal,
    })

    return res.status(201).json(inspection)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
