// api/users/index.js
import bcrypt from 'bcryptjs'
import connectDB from '../../lib/mongodb.js'
import { User } from '../../lib/models.js'
import { requireAuth, requireRole } from '../../lib/auth.js'
import { handleCors } from '../../lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  await connectDB()

  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return
    const users = await User.find({}, 'id nrp nama jabatan role createdAt').sort({ id: 1 }).lean()
    return res.json(users)
  }

  if (req.method === 'POST') {
    if (!requireRole(req, res, ['admin'])) return
    const { nrp, nama, jabatan, role, password } = req.body
    if (!nrp || !nama || !password || !role) {
      return res.status(400).json({ error: 'Field wajib: nrp, nama, role, password' })
    }
    const hashed = await bcrypt.hash(password, 10)
    try {
      const user = await User.create({ nrp, nama, jabatan, role, password: hashed })
      return res.status(201).json({ id: user.id, nrp: user.nrp, nama: user.nama, jabatan: user.jabatan, role: user.role })
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ error: 'NRP sudah terdaftar' })
      throw e
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
