// scripts/migrate-mysql-to-mongo.js
// Script migrasi data dari MySQL (filess.io) ke MongoDB Atlas
// Jalankan SEKALI setelah setup MongoDB Atlas
// Requirement: npm install mysql2 mongoose dotenv

import 'dotenv/config'
import mysql from 'mysql2/promise'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const MYSQL_URL  = process.env.OLD_DATABASE_URL  // URL MySQL lama
const MONGO_URL  = process.env.MONGODB_URI

if (!MYSQL_URL || !MONGO_URL) {
  console.error('Set OLD_DATABASE_URL dan MONGODB_URI di .env')
  process.exit(1)
}

console.log('🔄 Mulai migrasi MySQL → MongoDB Atlas...\n')

// Koneksi MySQL
const mysqlConn = await mysql.createConnection(MYSQL_URL)
console.log('✅ Terhubung ke MySQL')

// Koneksi MongoDB
await mongoose.connect(MONGO_URL)
console.log('✅ Terhubung ke MongoDB Atlas\n')

const { User, Unit, Question, RecurringSchedule, Inspection, Stock, HourMeterLog, Counter } = 
  await import('../lib/models.js')

// Reset semua data dan counter
await Promise.all([
  User.deleteMany({}), Unit.deleteMany({}), Question.deleteMany({}),
  RecurringSchedule.deleteMany({}), Inspection.deleteMany({}),
  Stock.deleteMany({}), HourMeterLog.deleteMany({}), Counter.deleteMany({}),
])
console.log('🗑️  Database MongoDB dibersihkan\n')

// ── 1. Users ─────────────────────────────────────────────────────────────────
const [mysqlUsers] = await mysqlConn.execute('SELECT * FROM User ORDER BY id')
let userCount = 0
for (const u of mysqlUsers) {
  await User.findOneAndUpdate(
    { nrp: u.nrp },
    { id: u.id, nrp: u.nrp, nama: u.nama, jabatan: u.jabatan, role: u.role, password: u.password },
    { upsert: true, setDefaultsOnInsert: false }
  )
  userCount++
}
await Counter.findByIdAndUpdate('user', { seq: mysqlUsers.length }, { upsert: true })
console.log(`✅ ${userCount} users dimigrasikan`)

// ── 2. Units ─────────────────────────────────────────────────────────────────
const [mysqlUnits] = await mysqlConn.execute('SELECT * FROM Unit ORDER BY id')
let unitCount = 0
for (const u of mysqlUnits) {
  await Unit.findOneAndUpdate(
    { nomor_unit: u.nomor_unit },
    { id: u.id, nomor_unit: u.nomor_unit, tipe: u.tipe, brand: u.brand, model: u.model, tahun: u.tahun, hm: u.hm, qr_code: u.qr_code },
    { upsert: true, setDefaultsOnInsert: false }
  )
  unitCount++
}
await Counter.findByIdAndUpdate('unit', { seq: mysqlUnits.length }, { upsert: true })
console.log(`✅ ${unitCount} units dimigrasikan`)

// ── 3. Questions ─────────────────────────────────────────────────────────────
const [mysqlQs] = await mysqlConn.execute('SELECT * FROM Question ORDER BY id')
for (const q of mysqlQs) {
  await Question.findOneAndUpdate(
    { id: q.id },
    { id: q.id, kategori: q.kategori, pertanyaan: q.pertanyaan, urutan: q.urutan, unit_tipe: q.unit_tipe, brand: q.brand, aktif: q.aktif === 1 },
    { upsert: true, setDefaultsOnInsert: false }
  )
}
await Counter.findByIdAndUpdate('question', { seq: mysqlQs.length }, { upsert: true })
console.log(`✅ ${mysqlQs.length} questions dimigrasikan`)

// ── 4. Recurring Schedules ───────────────────────────────────────────────────
const [mysqlScheds] = await mysqlConn.execute('SELECT * FROM RecurringSchedule ORDER BY id')
for (const s of mysqlScheds) {
  let hari = []
  try { hari = typeof s.hari === 'string' ? JSON.parse(s.hari) : s.hari } catch {}
  await RecurringSchedule.findOneAndUpdate(
    { id: s.id },
    { id: s.id, unit_id: s.unit_id, hari, aktif: s.aktif === 1 },
    { upsert: true, setDefaultsOnInsert: false }
  )
}
await Counter.findByIdAndUpdate('recurringschedule', { seq: mysqlScheds.length }, { upsert: true })
console.log(`✅ ${mysqlScheds.length} schedules dimigrasikan`)

// ── 5. Inspections (paling kompleks) ─────────────────────────────────────────
const [mysqlInspections] = await mysqlConn.execute(
  'SELECT i.*, u.nomor_unit, u.tipe as unit_tipe, u.brand as unit_brand, gl.nama as gl_nama FROM Inspection i JOIN Unit u ON u.id = i.unit_id JOIN User gl ON gl.id = i.group_leader_id ORDER BY i.id'
)

const [allMekaniks] = await mysqlConn.execute(
  'SELECT im.*, u.nrp, u.nama FROM InspectionMekanik im JOIN User u ON u.id = im.user_id'
)
const [allAnswers] = await mysqlConn.execute(
  `SELECT ia.*, q.kategori as q_kat, q.pertanyaan as q_text,
   po.id as po_id, po.part_name, po.part_number, po.quantity, po.keterangan as po_ket, po.foto_url as po_foto, po.status as po_status, po.work_status as po_ws,
   rd.id as rd_id, rd.keterangan as rd_ket, rd.foto_url as rd_foto, rd.work_status as rd_ws
   FROM InspectionAnswer ia
   LEFT JOIN Question q ON q.id = ia.question_id
   LEFT JOIN PartOrder po ON po.inspection_answer_id = ia.id
   LEFT JOIN RepairDetail rd ON rd.inspection_answer_id = ia.id`
)
const [allWorkLogs] = await mysqlConn.execute('SELECT * FROM WorkStatusLog ORDER BY createdAt ASC')

// Index lookup
const mekaniksByInspection = {}
for (const m of allMekaniks) {
  if (!mekaniksByInspection[m.inspection_id]) mekaniksByInspection[m.inspection_id] = []
  mekaniksByInspection[m.inspection_id].push(m)
}
const answersByInspection = {}
for (const a of allAnswers) {
  if (!answersByInspection[a.inspection_id]) answersByInspection[a.inspection_id] = []
  answersByInspection[a.inspection_id].push(a)
}
const workLogsByPO = {}, workLogsByRepair = {}
for (const l of allWorkLogs) {
  if (l.part_order_id) {
    if (!workLogsByPO[l.part_order_id]) workLogsByPO[l.part_order_id] = []
    workLogsByPO[l.part_order_id].push(l)
  }
  if (l.repair_id) {
    if (!workLogsByRepair[l.repair_id]) workLogsByRepair[l.repair_id] = []
    workLogsByRepair[l.repair_id].push(l)
  }
}

let inspCount = 0
for (const insp of mysqlInspections) {
  const mekaniks = (mekaniksByInspection[insp.id] || []).map(m => ({
    user_id: m.user_id, user_nrp: m.nrp, user_nama: m.nama,
  }))
  const answers = (answersByInspection[insp.id] || []).map(a => {
    const ans = {
      id: a.id,
      question_id: a.question_id,
      question_kategori: a.q_kat,
      question_pertanyaan: a.q_text,
      answer: a.answer,
    }
    if (a.po_id) {
      ans.part_order = {
        id: a.po_id, part_name: a.part_name, part_number: a.part_number,
        quantity: a.quantity, keterangan: a.po_ket, foto_url: a.po_foto,
        status: a.po_status, work_status: a.po_ws,
        work_logs: (workLogsByPO[a.po_id] || []).map(l => ({
          user_id: l.user_id, work_status: l.work_status, catatan: l.catatan, createdAt: l.createdAt,
        })),
      }
    }
    if (a.rd_id) {
      ans.repair = {
        id: a.rd_id, keterangan: a.rd_ket, foto_url: a.rd_foto, work_status: a.rd_ws,
        work_logs: (workLogsByRepair[a.rd_id] || []).map(l => ({
          user_id: l.user_id, work_status: l.work_status, catatan: l.catatan, createdAt: l.createdAt,
        })),
      }
    }
    return ans
  })

  await Inspection.findOneAndUpdate(
    { id: insp.id },
    {
      id: insp.id, unit_id: insp.unit_id,
      unit_nomor: insp.nomor_unit, unit_tipe: insp.unit_tipe, unit_brand: insp.unit_brand,
      tanggal: insp.tanggal, hour_meter: insp.hour_meter,
      jam_start: insp.jam_start, jam_finish: insp.jam_finish,
      group_leader_id: insp.group_leader_id, group_leader_nama: insp.gl_nama,
      mekaniks, answers,
      createdAt: insp.createdAt, updatedAt: insp.updatedAt,
    },
    { upsert: true, setDefaultsOnInsert: false }
  )
  inspCount++
  if (inspCount % 50 === 0) process.stdout.write(`\r  → ${inspCount}/${mysqlInspections.length} inspections...`)
}
await Counter.findByIdAndUpdate('inspection', { seq: mysqlInspections.length }, { upsert: true })
console.log(`\n✅ ${inspCount} inspections dimigrasikan`)

// ── 6. Stock ─────────────────────────────────────────────────────────────────
const [mysqlStocks] = await mysqlConn.execute('SELECT * FROM Stock ORDER BY id')
for (const s of mysqlStocks) {
  await Stock.findOneAndUpdate(
    { id: s.id },
    { id: s.id, part_number: s.part_number, material_description: s.material_description, jumlah_stock: s.jumlah_stock, satuan: s.satuan, location_storage: s.location_storage, minimum_stock: s.minimum_stock, harga_satuan: s.harga_satuan, keterangan: s.keterangan },
    { upsert: true, setDefaultsOnInsert: false }
  )
}
await Counter.findByIdAndUpdate('stock', { seq: mysqlStocks.length }, { upsert: true })
console.log(`✅ ${mysqlStocks.length} stock items dimigrasikan`)

// ── 7. HourMeterLog ──────────────────────────────────────────────────────────
const [mysqlHMLogs] = await mysqlConn.execute(
  'SELECT hml.*, u.nomor_unit, usr.nama as user_nama FROM HourMeterLog hml JOIN Unit u ON u.id = hml.unit_id JOIN User usr ON usr.id = hml.user_id ORDER BY hml.id'
)
for (const l of mysqlHMLogs) {
  await HourMeterLog.findOneAndUpdate(
    { id: l.id },
    { id: l.id, unit_id: l.unit_id, unit_nomor: l.nomor_unit, hm_before: l.hm_before, hm_after: l.hm_after, user_id: l.user_id, user_nama: l.user_nama, catatan: l.catatan, createdAt: l.createdAt },
    { upsert: true, setDefaultsOnInsert: false }
  )
}
await Counter.findByIdAndUpdate('hourMeterLog', { seq: mysqlHMLogs.length }, { upsert: true })
console.log(`✅ ${mysqlHMLogs.length} hour meter logs dimigrasikan`)

await mysqlConn.end()
await mongoose.disconnect()

console.log('\n🎉 Migrasi selesai!')
console.log('Verifikasi data di MongoDB Atlas Compass atau compass.mongodb.com')
