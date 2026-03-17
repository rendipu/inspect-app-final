// server.js — Express server untuk development lokal
// Di Vercel, file api/*.js otomatis jadi serverless functions
// Di lokal, server ini menjalankan semua route API

import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'

const app  = express()
const PORT = process.env.PORT || 3001

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// ── Helper: load handler ─────────────────────────────────────────────
async function loadHandler(path) {
  const mod = await import(path)
  return mod.default
}

// ── Route mapping (same as Vercel) ───────────────────────────────────
const routes = [
  { method: 'all', path: '/api/auth/login',         file: './api/auth/login.js' },
  { method: 'all', path: '/api/inspections',         file: './api/inspections/index.js' },
  { method: 'all', path: '/api/inspections/:id',     file: './api/inspections/[id].js' },
  { method: 'all', path: '/api/units/hm',            file: './api/units/hm.js' },
  { method: 'all', path: '/api/units',               file: './api/units/index.js' },
  { method: 'all', path: '/api/units/:id',           file: './api/units/[id].js' },
  { method: 'all', path: '/api/users',               file: './api/users/index.js' },
  { method: 'all', path: '/api/users/:id',           file: './api/users/[id].js' },
  { method: 'all', path: '/api/questions',           file: './api/questions/index.js' },
  { method: 'all', path: '/api/questions/:id',       file: './api/questions/[id].js' },
  { method: 'all', path: '/api/schedules',           file: './api/schedules/index.js' },
  { method: 'all', path: '/api/schedules/:id',       file: './api/schedules/[id].js' },
  { method: 'all', path: '/api/stock',               file: './api/stock/index.js' },
  { method: 'all', path: '/api/stock/:id',           file: './api/stock/[id].js' },
  { method: 'all', path: '/api/work-status/:id',     file: './api/work-status/[id].js' },
  { method: 'all', path: '/api/sse',                 file: './api/sse/index.js' },
]

// for (const route of routes) {
//   app[route.method](route.path, async (req, res) => {
//     try {
//       const handler = await loadHandler(route.file)
//       // Map Express params ke req.query agar kompatibel dengan Vercel
//       req.query = { ...req.query, ...req.params }
//       await handler(req, res)
//     } catch (err) {
//       console.error(`[${route.path}]`, err)
//       if (!res.headersSent) {
//         res.status(500).json({ error: 'Internal server error', detail: err.message })
//       }
//     }
//   })
// }

for (const route of routes) {
  app[route.method](route.path, async (req, res) => {
    try {
      const handler = await loadHandler(route.file)
      
      // PERBAIKAN DI SINI:
      // Gunakan Object.assign agar tidak menimpa property yang read-only
      Object.assign(req.query, req.params);
      
      await handler(req, res)
    } catch (err) {
      console.error(`[${route.path}]`, err)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error', detail: err.message })
      }
    }
  })
}

// ── Start ────────────────────────────────────────────────────────────
const server = createServer(app)
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} tidak ditemukan` })
})
server.listen(PORT, () => {
  console.log(`\n🚀 API server running at http://localhost:${PORT}`)
  console.log(`📡 SSE endpoint: http://localhost:${PORT}/api/sse`)
  console.log(`\nFrontend dev server (Vite): npm run dev:client`)
  console.log(`Jalankan keduanya: npm run dev\n`)
})
