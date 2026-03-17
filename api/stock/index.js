// api/stock/index.js
import connectDB from '../../lib/mongodb.js'
import { Stock } from '../../lib/models.js'
import { requireAuth, requireRole } from '../../lib/auth.js'
import { handleCors } from '../../lib/cors.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  if (!requireAuth(req, res)) return

  await connectDB()

  if (req.method === 'GET') {
    const { search, low_stock } = req.query
    let filter = {}

    if (search) {
      // Gunakan MongoDB text search (lebih efisien dari regex)
      filter.$text = { $search: search }
    }

    let query = Stock.find(filter).sort({ part_number: 1 })

    // Batasi stock_logs yang dikembalikan — hanya 1 terbaru
    query = query.select('-stock_logs').lean()

    const stocks = await query

    // Filter low stock di aplikasi
    const result = low_stock === 'true'
      ? stocks.filter(s => s.jumlah_stock <= s.minimum_stock)
      : stocks

    return res.json(result)
  }

  if (req.method === 'POST') {
    if (!requireRole(req, res, ['warehouse', 'admin'])) return
    const { part_number, material_description, jumlah_stock, satuan, location_storage, minimum_stock, harga_satuan, keterangan } = req.body
    if (!part_number || !material_description || !satuan) {
      return res.status(400).json({ error: 'Field wajib: part_number, material_description, satuan' })
    }
    try {
      const stock = await Stock.create({
        part_number,
        material_description,
        jumlah_stock:    parseInt(jumlah_stock)   || 0,
        satuan,
        location_storage: location_storage        || null,
        minimum_stock:   parseInt(minimum_stock)  || 0,
        harga_satuan:    harga_satuan ? parseFloat(harga_satuan) : null,
        keterangan:      keterangan               || null,
      })
      return res.status(201).json(stock)
    } catch (e) {
      if (e.code === 11000) return res.status(409).json({ error: 'Part number sudah terdaftar' })
      throw e
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
