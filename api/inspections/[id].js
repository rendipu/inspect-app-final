// api/inspections/[id].js
import connectDB from '../../lib/mongodb.js'
import { Inspection } from '../../lib/models.js'
import { requireAuth } from '../../lib/auth.js'
import { handleCors } from '../../lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (!requireAuth(req, res)) return

  const id = parseInt(req.query.id)
  if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' })

  await connectDB()

  if (req.method === 'GET') {
    const inspection = await Inspection.findOne({ id }).lean()
    if (!inspection) return res.status(404).json({ error: 'Inspeksi tidak ditemukan' })
    return res.json(inspection)
  }

  if (req.method === 'DELETE') {
    const currentUser = requireAuth(req, res)
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Hanya admin yang bisa hapus inspeksi' })
    }
    const deleted = await Inspection.findOneAndDelete({ id })
    if (!deleted) return res.status(404).json({ error: 'Inspeksi tidak ditemukan' })
    return res.json({ message: 'Inspeksi dihapus' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
