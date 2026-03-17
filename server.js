import 'dotenv/config'
import express from 'express'
import handler from './api/index.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Tangkap semua request yang dimulai dengan /api
app.use('/api', async (req, res) => {
  try {
    // Tambahkan prefix /api kembali ke url agar handler bisa matching
    req.url = '/api' + req.url
    await handler(req, res)
  } catch (err) {
    console.error('[server error]', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', detail: err.message })
    }
  }
})

app.listen(PORT, () => {
  console.log(`\n🚀 API server: http://localhost:${PORT}`)
  console.log(`Frontend (Vite): http://localhost:5173\n`)
})