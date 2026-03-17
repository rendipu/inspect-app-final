// api/questions/index.js
import connectDB from '../../lib/mongodb.js'
import { Question } from '../../lib/models.js'
import { requireAuth, requireRole } from '../../lib/auth.js'
import { handleCors } from '../../lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  await connectDB()

  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return
    const { unit_tipe, brand } = req.query

    let filter = { aktif: true }

    if (unit_tipe && brand) {
      filter.$or = [
        { unit_tipe: null },
        { unit_tipe, brand: null },
        { unit_tipe, brand },
      ]
    } else if (unit_tipe) {
      filter.$or = [
        { unit_tipe: null },
        { unit_tipe, brand: null },
      ]
    }

    // Set cache header — daftar pertanyaan jarang berubah
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')

    const questions = await Question.find(filter).sort({ kategori: 1, urutan: 1 }).lean()
    return res.json(questions)
  }

  if (req.method === 'POST') {
    if (!requireRole(req, res, ['admin'])) return
    const { kategori, pertanyaan, urutan, unit_tipe, brand } = req.body
    if (!kategori || !pertanyaan) return res.status(400).json({ error: 'Field wajib: kategori, pertanyaan' })
    const q = await Question.create({
      kategori, pertanyaan,
      urutan:    urutan    ? parseInt(urutan) : 0,
      unit_tipe: unit_tipe || null,
      brand:     brand     || null,
    })
    return res.status(201).json(q)
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
