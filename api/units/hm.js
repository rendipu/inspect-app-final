// api/units/hm.js
import connectDB from '../../lib/mongodb.js'
import { Unit, HourMeterLog } from '../../lib/models.js'
import { requireAuth } from '../../lib/auth.js'
import { handleCors } from '../../lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  const currentUser = requireAuth(req, res)
  if (!currentUser) return

  await connectDB()

  if (req.method === 'GET') {
    const { unit_id } = req.query
    const filter = unit_id ? { unit_id: parseInt(unit_id) } : {}
    const logs = await HourMeterLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
    return res.json(logs)
  }

  if (req.method === 'POST') {
    const { unit_id, hm_after, catatan } = req.body
    if (!unit_id || hm_after === undefined || hm_after === '') {
      return res.status(400).json({ error: 'Field wajib: unit_id, hm_after' })
    }

    const newHm = parseFloat(hm_after)
    if (isNaN(newHm) || newHm < 0) return res.status(400).json({ error: 'HM tidak valid' })

    const unit = await Unit.findOne({ id: parseInt(unit_id) })
    if (!unit) return res.status(404).json({ error: 'Unit tidak ditemukan' })
    if (newHm < unit.hm) {
      return res.status(400).json({
        error: `HM baru (${newHm}) tidak boleh lebih kecil dari HM saat ini (${unit.hm})`,
      })
    }

    const [updatedUnit, log] = await Promise.all([
      Unit.findOneAndUpdate({ id: parseInt(unit_id) }, { hm: newHm }, { new: true }).lean(),
      HourMeterLog.create({
        unit_id:   parseInt(unit_id),
        unit_nomor: unit.nomor_unit,
        hm_before: unit.hm,
        hm_after:  newHm,
        user_id:   currentUser.id,
        user_nama: currentUser.nama,
        catatan:   catatan || null,
      }),
    ])

    return res.status(201).json({ unit: updatedUnit, log })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
