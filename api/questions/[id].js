// api/questions/[id].js
import connectDB from '../../lib/mongodb.js'
import { Question } from '../../lib/models.js'
import { requireAuth, requireRole } from '../../lib/auth.js'
import { handleCors } from '../../lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  await connectDB()

  const id = parseInt(req.query.id)
  if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' })

  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return
    const q = await Question.findOne({ id }).lean()
    if (!q) return res.status(404).json({ error: 'Pertanyaan tidak ditemukan' })
    return res.json(q)
  }

  if (req.method === 'PUT') {
    if (!requireRole(req, res, ['admin'])) return
    const { kategori, pertanyaan, urutan, unit_tipe, brand, aktif } = req.body
    const q = await Question.findOneAndUpdate(
      { id },
      { kategori, pertanyaan, urutan: urutan ? parseInt(urutan) : 0, unit_tipe: unit_tipe || null, brand: brand || null, aktif: aktif !== undefined ? aktif : true },
      { new: true }
    )
    if (!q) return res.status(404).json({ error: 'Pertanyaan tidak ditemukan' })
    return res.json(q)
  }

  if (req.method === 'DELETE') {
    if (!requireRole(req, res, ['admin'])) return
    // Soft delete — nonaktifkan saja
    const q = await Question.findOneAndUpdate({ id }, { aktif: false }, { new: true })
    if (!q) return res.status(404).json({ error: 'Pertanyaan tidak ditemukan' })
    return res.json({ message: 'Pertanyaan dinonaktifkan' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
