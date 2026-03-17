import dotenv from 'dotenv'
dotenv.config()
import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'inspect-secret-change-in-production'

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '8h' })
}

function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET)
  } catch {
    return null
  }
}

function getTokenFromRequest(req) {
  const auth = req.headers.authorization || ''
  if (auth.startsWith('Bearer ')) return auth.slice(7)
  return null
}

function requireAuth(req, res) {
  const token = getTokenFromRequest(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized — token tidak ditemukan' })
    return null
  }
  const payload = verifyToken(token)
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized — token tidak valid atau kadaluarsa' })
    return null
  }
  // Terima token yang punya id ATAU nrp
  if (!payload.id && !payload.nrp) {
    res.status(401).json({ error: 'Unauthorized — payload tidak valid' })
    return null
  }
  return payload
}

function requireRole(req, res, roles = []) {
  const user = requireAuth(req, res)
  if (!user) return null
  if (roles.length && !roles.includes(user.role)) {
    res.status(403).json({ error: 'Forbidden — role tidak memiliki akses' })
    return null
  }
  return user
}

export { signToken, verifyToken, getTokenFromRequest, requireAuth, requireRole }