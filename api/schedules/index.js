// api/schedules/index.js
import connectDB from '../../lib/mongodb.js'
import { RecurringSchedule, Inspection, Unit } from '../../lib/models.js'
import { requireAuth, requireRole } from '../../lib/auth.js'
import { handleCors } from '../../lib/cors.js'

const DAY_MAP = { 0: 'Minggu', 1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu' }

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (!requireAuth(req, res)) return

  await connectDB()

  if (req.method === 'GET') {
    const { mode, tanggal } = req.query

    // Mode recurring: kembalikan semua jadwal yang ada
    if (mode === 'recurring') {
      const schedules = await RecurringSchedule.find().sort({ id: 1 }).lean()
      // Gabungkan data unit
      const unitIds = [...new Set(schedules.map(s => s.unit_id))]
      const units = await Unit.find({ id: { $in: unitIds } }).lean()
      const unitMap = Object.fromEntries(units.map(u => [u.id, u]))
      return res.json(schedules.map(s => ({ ...s, unit: unitMap[s.unit_id] || null })))
    }

    // Jadwal hari ini / tanggal tertentu
    const date    = tanggal ? new Date(tanggal) : new Date()
    const dayName = DAY_MAP[date.getDay()]
    const dateStr = date.toISOString().split('T')[0]

    // Ambil semua recurring yang aktif dan mengandung hari ini
    const recurringToday = await RecurringSchedule.find({
      aktif: true,
      hari:  dayName, // MongoDB dapat query elemen array langsung
    }).lean()

    if (!recurringToday.length) return res.json([])

    const unitIds = recurringToday.map(s => s.unit_id)

    // Paralel: ambil data unit + cek inspeksi hari ini
    const startOfDay = new Date(dateStr + 'T00:00:00.000Z')
    const endOfDay   = new Date(dateStr + 'T23:59:59.999Z')

    const [units, doneToday] = await Promise.all([
      Unit.find({ id: { $in: unitIds } }).lean(),
      Inspection.find(
        { unit_id: { $in: unitIds }, tanggal: { $gte: startOfDay, $lte: endOfDay } },
        'unit_id'
      ).lean(),
    ])

    const unitMap    = Object.fromEntries(units.map(u => [u.id, u]))
    const doneUnitIds = new Set(doneToday.map(i => i.unit_id))

    const result = recurringToday.map(s => ({
      id:      s.id,
      unit_id: s.unit_id,
      unit:    unitMap[s.unit_id] || null,
      tanggal: dateStr,
      hari:    s.hari,
      status:  doneUnitIds.has(s.unit_id) ? 'done' : 'scheduled',
    }))

    return res.json(result)
  }

  if (req.method === 'POST') {
    if (!requireRole(req, res, ['admin'])) return
    const { unit_id, hari } = req.body
    if (!unit_id) return res.status(400).json({ error: 'Field wajib: unit_id' })
    if (!hari || !Array.isArray(hari) || hari.length === 0) {
      return res.status(400).json({ error: 'Field wajib: hari (array, minimal 1 hari)' })
    }

    const validDays   = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
    const invalidDays = hari.filter(h => !validDays.includes(h))
    if (invalidDays.length > 0) {
      return res.status(400).json({ error: `Hari tidak valid: ${invalidDays.join(', ')}` })
    }

    const schedule = await RecurringSchedule.findOneAndUpdate(
      { unit_id: parseInt(unit_id) },
      { hari, aktif: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    const unit = await Unit.findOne({ id: parseInt(unit_id) }).lean()
    return res.status(201).json({ ...schedule.toObject(), unit })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
