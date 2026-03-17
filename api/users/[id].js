// api/users/[id].js
import bcrypt from 'bcryptjs'
import connectDB from '../../lib/mongodb.js'
import { User } from '../../lib/models.js'
import { requireAuth, requireRole } from '../../lib/auth.js'
import { handleCors } from '../../lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  await connectDB()

  const id = parseInt(req.query.id)
  if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' })

  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return
    const user = await User.findOne({ id }, 'id nrp nama jabatan role createdAt').lean()
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' })
    return res.json(user)
  }

  if (req.method === 'PUT') {
    if (!requireRole(req, res, ['admin'])) return
    const { nama, jabatan, role, password } = req.body
    const update = { nama, jabatan, role }
    if (password) update.password = await bcrypt.hash(password, 10)
    const user = await User.findOneAndUpdate({ id }, update, { new: true, select: 'id nrp nama jabatan role' })
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' })
    return res.json(user)
  }

  if (req.method === 'DELETE') {
    if (!requireRole(req, res, ['admin'])) return
    const user = await User.findOneAndDelete({ id })
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' })
    return res.json({ message: 'User dihapus' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
