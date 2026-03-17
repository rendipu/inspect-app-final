// api/stock/[id].js
import connectDB from '../../lib/mongodb.js'
import { Stock } from '../../lib/models.js'
import { requireAuth, requireRole } from '../../lib/auth.js'
import { handleCors } from '../../lib/cors.js'
import { broadcast } from '../../lib/sse.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  await connectDB()

  const id = parseInt(req.query.id)
  if (isNaN(id)) return res.status(400).json({ error: 'ID tidak valid' })

  if (req.method === 'GET') {
    if (!requireAuth(req, res)) return
    const stock = await Stock.findOne({ id }).lean()
    if (!stock) return res.status(404).json({ error: 'Stock tidak ditemukan' })
    return res.json(stock)
  }

  if (req.method === 'PUT') {
    if (!requireRole(req, res, ['warehouse', 'admin'])) return
    const { part_number, material_description, jumlah_stock, satuan, location_storage, minimum_stock, harga_satuan, keterangan } = req.body
    const stock = await Stock.findOneAndUpdate(
      { id },
      { part_number, material_description, jumlah_stock: parseInt(jumlah_stock) || 0, satuan, location_storage, minimum_stock: parseInt(minimum_stock) || 0, harga_satuan: harga_satuan ? parseFloat(harga_satuan) : null, keterangan },
      { new: true }
    )
    if (!stock) return res.status(404).json({ error: 'Stock tidak ditemukan' })
    return res.json(stock)
  }

  // PATCH — update jumlah saja (keluar/masuk)
  if (req.method === 'PATCH') {
    const currentUser = requireRole(req, res, ['warehouse', 'admin'])
    if (!currentUser) return

    const { delta, catatan } = req.body
    if (delta === undefined || isNaN(parseInt(delta))) {
      return res.status(400).json({ error: 'Field wajib: delta (angka, positif = masuk, negatif = keluar)' })
    }

    const stock = await Stock.findOneAndUpdate(
      { id },
      {
        $inc: { jumlah_stock: parseInt(delta) },
        $push: {
          stock_logs: {
            user_id:   currentUser.id,
            user_nama: currentUser.nama,
            delta:     parseInt(delta),
            catatan,
          },
        },
      },
      { new: true }
    )
    if (!stock) return res.status(404).json({ error: 'Stock tidak ditemukan' })

    // Broadcast jika stock mencapai minimum
    if (stock.jumlah_stock <= stock.minimum_stock) {
      broadcast('stock_low', {
        id:                   stock.id,
        part_number:          stock.part_number,
        material_description: stock.material_description,
        jumlah_stock:         stock.jumlah_stock,
        minimum_stock:        stock.minimum_stock,
      })
    }

    return res.json(stock)
  }

  if (req.method === 'DELETE') {
    if (!requireRole(req, res, ['admin'])) return
    const stock = await Stock.findOneAndDelete({ id })
    if (!stock) return res.status(404).json({ error: 'Stock tidak ditemukan' })
    return res.json({ message: 'Stock dihapus' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
