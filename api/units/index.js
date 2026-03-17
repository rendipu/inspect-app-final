// api/units/index.js
import connectDB from '../../lib/mongodb.js'
import { Unit, RecurringSchedule } from '../../lib/models.js'
import { requireAuth, requireRole } from '../../lib/auth.js'
import { handleCors } from '../../lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  await connectDB()

  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return

    const units = await Unit.find().sort({ nomor_unit: 1 }).lean()

    // Gabungkan jadwal ke tiap unit
    const schedules = await RecurringSchedule.find({
      unit_id: { $in: units.map(u => u.id) },
    }).lean()
    const schedMap = Object.fromEntries(schedules.map(s => [s.unit_id, s]))

    const result = units.map(u => ({ ...u, schedule: schedMap[u.id] || null }))
    return res.json(result)
  }

  if (req.method === 'POST') {
    const currentUser = requireRole(req, res, ['admin'])
    if (!currentUser) return

    const { nomor_unit, tipe, brand, model, tahun, hm, qr_code } = req.body
    if (!nomor_unit || !tipe || !brand) {
      return res.status(400).json({ error: 'Field wajib: nomor_unit, tipe, brand' })
    }
    try {
      const unit = await Unit.create({
        nomor_unit, tipe, brand, model,
        tahun:   tahun   ? parseInt(tahun)      : null,
        hm:      hm      ? parseFloat(hm)       : 0,
        qr_code: qr_code || `QR-${nomor_unit}`,
      })
      return res.status(201).json(unit)
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ error: 'Nomor unit sudah terdaftar' })
      throw e
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
