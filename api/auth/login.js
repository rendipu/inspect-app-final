import bcrypt from 'bcryptjs'
import connectDB from '../../lib/mongodb.js'
import { User } from '../../lib/models.js'
import { signToken } from '../../lib/auth.js'
import { handleCors } from '../../lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { nrp, password } = req.body
  if (!nrp || !password) return res.status(400).json({ error: 'NRP dan password wajib diisi' })

  try {
    await connectDB()
    const user = await User.findOne({ nrp }).lean()
    if (!user) return res.status(401).json({ error: 'NRP atau password salah' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'NRP atau password salah' })

    const token = signToken({ id: user._id, nrp: user.nrp, nama: user.nama, jabatan: user.jabatan, role: user.role })
    return res.status(200).json({
      token,
      user: { id: user._id, nrp: user.nrp, nama: user.nama, jabatan: user.jabatan, role: user.role },
    })
  } catch (err) {
    console.error('[login]', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
