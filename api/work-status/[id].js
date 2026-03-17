// api/work-status/[id].js
import connectDB from '../../lib/mongodb.js'
import { Inspection } from '../../lib/models.js'
import { requireAuth, requireRole } from '../../lib/auth.js'
import { handleCors } from '../../lib/cors.js'
import { broadcast } from '../../lib/sse.js'

export default async function handler(req, res) {
  if (handleCors(req, res)) return
  const currentUser = requireAuth(req, res)
  if (!currentUser) return

  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const answerId = parseInt(req.query.id)
  const type     = req.query.type

  if (isNaN(answerId) || !['part_order', 'repair'].includes(type)) {
    return res.status(400).json({ error: 'Parameter tidak valid. Butuh id dan type=part_order|repair' })
  }

  const body         = req.body || {}
  const work_status  = body.work_status
  const order_status = body.order_status
  const catatan      = body.catatan || null

  await connectDB()

  // ── Update work_status ────────────────────────────────────────────────────
  if (work_status) {
    const valid = ['belum_dikerjakan', 'sedang_dikerjakan', 'sudah_selesai']
    if (!valid.includes(work_status)) {
      return res.status(400).json({ error: `work_status harus: ${valid.join(' | ')}` })
    }

    const logEntry = {
      user_id:    currentUser.id,
      user_nama:  currentUser.nama,
      work_status,
      catatan,
      createdAt:  new Date(),
    }

    let inspection
    if (type === 'part_order') {
      inspection = await Inspection.findOneAndUpdate(
        { 'answers.part_order.id': answerId },
        {
          $set:  { 'answers.$[ans].part_order.work_status': work_status },
          $push: { 'answers.$[ans].part_order.work_logs': logEntry },
        },
        {
          arrayFilters: [{ 'ans.part_order.id': answerId }],
          new: true,
        }
      )
    } else {
      inspection = await Inspection.findOneAndUpdate(
        { 'answers.repair.id': answerId },
        {
          $set:  { 'answers.$[ans].repair.work_status': work_status },
          $push: { 'answers.$[ans].repair.work_logs': logEntry },
        },
        {
          arrayFilters: [{ 'ans.repair.id': answerId }],
          new: true,
        }
      )
    }

    if (!inspection) return res.status(404).json({ error: 'Data tidak ditemukan' })

    broadcast('work_status_updated', {
      answerId, type, work_status,
      updated_by: currentUser.nama,
    })

    return res.json({ success: true, work_status })
  }

  // ── Update order_status (approve/reject) ─────────────────────────────────
  if (order_status) {
    if (!requireRole(req, res, ['group_leader', 'admin'])) return

    const valid = ['approved', 'rejected']
    if (!valid.includes(order_status)) {
      return res.status(400).json({ error: `order_status harus: approved | rejected` })
    }
    if (type !== 'part_order') {
      return res.status(400).json({ error: 'order_status hanya untuk type=part_order' })
    }

    const inspection = await Inspection.findOneAndUpdate(
      { 'answers.part_order.id': answerId },
      {
        $set: {
          'answers.$[ans].part_order.status':      order_status,
          'answers.$[ans].part_order.approved_by': currentUser.id,
          'answers.$[ans].part_order.approved_at': new Date(),
        },
      },
      {
        arrayFilters: [{ 'ans.part_order.id': answerId }],
        new: true,
      }
    )

    if (!inspection) return res.status(404).json({ error: 'Part order tidak ditemukan' })

    broadcast('order_status_updated', {
      answerId, order_status,
      approved_by: currentUser.nama,
    })

    return res.json({ success: true, order_status })
  }

  return res.status(400).json({ error: 'Kirim work_status atau order_status di body' })
}
