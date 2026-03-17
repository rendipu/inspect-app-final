// api/units/[id].js
import connectDB from '../../lib/mongodb.js'
import { Unit } from '../../lib/models.js'
import { requireAuth, requireRole } from '../../lib/auth.js'
import { handleCors } from '../../lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  await connectDB()

  const id = parseInt(req.query.id)
  if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' })

  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return
    const unit = await Unit.findOne({ id }).lean()
    if (!unit) return res.status(404).json({ error: 'Unit tidak ditemukan' })
    return res.json(unit)
  }

  if (req.method === 'PUT') {
    if (!requireRole(req, res, ['admin'])) return
    const { nomor_unit, tipe, brand, model, tahun, hm, qr_code } = req.body
    try {
      const unit = await Unit.findOneAndUpdate(
        { id },
        { nomor_unit, tipe, brand, model, tahun: tahun ? parseInt(tahun) : null, hm: hm ? parseFloat(hm) : 0, qr_code },
        { new: true }
      )
      if (!unit) return res.status(404).json({ error: 'Unit tidak ditemukan' })
      return res.json(unit)
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ error: 'Nomor unit sudah terdaftar' })
      throw e
    }
  }

  if (req.method === 'DELETE') {
    if (!requireRole(req, res, ['admin'])) return
    const unit = await Unit.findOneAndDelete({ id })
    if (!unit) return res.status(404).json({ error: 'Unit tidak ditemukan' })
    return res.json({ message: 'Unit dihapus' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
