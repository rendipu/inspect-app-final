// api/schedules/[id].js
import connectDB from '../../lib/mongodb.js'
import { RecurringSchedule } from '../../lib/models.js'
import { requireRole } from '../../lib/auth.js'
import { handleCors } from '../../lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  await connectDB()

  const id = parseInt(req.query.id)
  if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' })

  if (req.method === 'DELETE') {
    if (!requireRole(req, res, ['admin'])) return
    const s = await RecurringSchedule.findOneAndUpdate({ id }, { aktif: false }, { new: true })
    if (!s) return res.status(404).json({ error: 'Jadwal tidak ditemukan' })
    return res.json({ message: 'Jadwal dinonaktifkan' })
  }

  if (req.method === 'PATCH') {
    if (!requireRole(req, res, ['admin'])) return
    const { hari, aktif } = req.body
    const update = {}
    if (hari)    update.hari  = hari
    if (aktif !== undefined) update.aktif = aktif
    const s = await RecurringSchedule.findOneAndUpdate({ id }, update, { new: true })
    if (!s) return res.status(404).json({ error: 'Jadwal tidak ditemukan' })
    return res.json(s)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
