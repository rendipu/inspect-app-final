// api/sse/index.js
// Server-Sent Events endpoint untuk realtime update
// Client connect ke sini untuk menerima notifikasi real-time


// import { verifyToken } from '../../lib/auth.js'
// import { addClient, removeClient, getClientCount } from '../../lib/sse.js'
// import { handleCors } from '../../lib/cors.js'

// export const config = {
//   api: {
//     // Nonaktifkan body parser — SSE butuh streaming
//     bodyParser: false,
//   },
//   maxDuration: 300,
// }


// export default function handler(req, res) {
//   if (handleCors(req, res)) return

//   // Ambil token dari Header ATAU Query String
//   const token = req.headers.authorization?.split(' ')[1] || req.query.token;

//   // Validasi token
//   const user = verifyToken(token)
//   if (!user) return res.status(401).json({ error: 'Unauthorized' })

//   // Setup SSE headers
//   res.setHeader('Content-Type', 'text/event-stream')
//   res.setHeader('Cache-Control', 'no-cache, no-transform')
//   res.setHeader('Connection', 'keep-alive')
//   res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering
//   res.flushHeaders()

//   const clientId = user.id || user._id
//   res._userRole = user.role  // Simpan role untuk broadcast filtering

//   // Daftarkan client
//   addClient(clientId, res)

//   // Kirim balik ID ke client agar client tahu ID-nya sendiri
//   res.write(`event: init\ndata: ${JSON.stringify({ yourId: clientId })}\n\n`)

//   const heartbeat = setInterval(() => {
//     res.write(': heartbeat\n\n')
//   }, 25000)

//   const cleanup = () => {
//     clearInterval(heartbeat)
//     removeClient(clientId)
//   }

//   req.on('close', cleanup)
//   req.on('error', cleanup)
// }

import jwt from 'jsonwebtoken'

// Simpan clients di memory (per instance)
const clients = new Map()
let counter = 0

export default function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  // Auth — ambil token dari query param
  const token = req.query?.token || req.headers.authorization?.split(' ')[1]
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return }

  let user
  try {
    user = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    res.status(401).json({ error: 'Token tidak valid' }); return
  }

  // Setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  const id = ++counter
  clients.set(id, res)

  // Kirim konfirmasi koneksi
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id })}\n\n`)

  // Heartbeat tiap 25 detik
  const hb = setInterval(() => {
    try { res.write(': heartbeat\n\n') } catch { clearInterval(hb) }
  }, 25000)

  req.on('close', () => { clearInterval(hb); clients.delete(id) })
  req.on('error', () => { clearInterval(hb); clients.delete(id) })
}