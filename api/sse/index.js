// api/sse/index.js
// Server-Sent Events endpoint untuk realtime update
// Client connect ke sini untuk menerima notifikasi real-time

import { verifyToken } from '../../lib/auth.js'
import { addClient, removeClient, getClientCount } from '../../lib/sse.js'
import { handleCors } from '../../lib/cors.js'

export const config = {
  api: {
    // Nonaktifkan body parser — SSE butuh streaming
    bodyParser: false,
  },
  runtime: 'edge',
}


export default function handler(req, res) {
  if (handleCors(req, res)) return

  // Ambil token dari Header ATAU Query String
  const token = req.headers.authorization?.split(' ')[1] || req.query.token;

  // Validasi token
  const user = verifyToken(token)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  // Setup SSE headers
  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection',    'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering
  res.flushHeaders()

  const clientId = user.id || user._id
  res._userRole  = user.role  // Simpan role untuk broadcast filtering

  // Daftarkan client
  addClient(clientId, res)

  // Kirim balik ID ke client agar client tahu ID-nya sendiri
  res.write(`event: init\ndata: ${JSON.stringify({ yourId: clientId })}\n\n`)

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n')
  }, 25000)

  const cleanup = () => {
    clearInterval(heartbeat)
    removeClient(clientId)
  }

  req.on('close', cleanup)
  req.on('error', cleanup)
}

//   addClient(clientId, res)

//   // Kirim event pertama sebagai konfirmasi koneksi
//   res.write(`event: connected\ndata: ${JSON.stringify({ clientId, time: Date.now() })}\n\n`)

//   // Heartbeat setiap 25 detik untuk mencegah timeout
//   const heartbeat = setInterval(() => {
//     try {
//       res.write(': heartbeat\n\n')
//     } catch {
//       clearInterval(heartbeat)
//     }
//   }, 25000)

//   // Cleanup saat client disconnect
//   req.on('close', () => {
//     clearInterval(heartbeat)
//     removeClient(clientId)
//   })

//   req.on('error', () => {
//     clearInterval(heartbeat)
//     removeClient(clientId)
//   })
// }
