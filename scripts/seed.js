// scripts/seed.js
// Jalankan sekali untuk mengisi data awal: node scripts/seed.js
// Pastikan MONGODB_URI sudah diset di environment

import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) { console.error('MONGODB_URI tidak diset'); process.exit(1) }

await mongoose.connect(MONGODB_URI)
console.log('✅ Terhubung ke MongoDB Atlas')

// Import models
const { User, Unit, Question, Counter } = await import('../lib/models.js')

// Reset counters
await Counter.deleteMany({})

// Admin user
const adminPassword = await bcrypt.hash('admin123', 10)
const adminExists = await User.findOne({ nrp: 'ADMIN001' })
if (!adminExists) {
  await User.create({ nrp: 'ADMIN001', nama: 'Administrator', jabatan: 'Admin', role: 'admin', password: adminPassword })
}
console.log('✅ Admin user dibuat (NRP: ADMIN001, password: admin123)')

// Sample units
const units = [
  { nomor_unit: 'DT-001', tipe: 'Dump Truck', brand: 'Komatsu', model: 'HD785', tahun: 2020, hm: 15000 },
  { nomor_unit: 'DT-002', tipe: 'Dump Truck', brand: 'Caterpillar', model: '777G', tahun: 2021, hm: 12500 },
  { nomor_unit: 'EX-001', tipe: 'Excavator', brand: 'Komatsu', model: 'PC2000', tahun: 2019, hm: 20000 },
  { nomor_unit: 'GD-001', tipe: 'Grader', brand: 'Caterpillar', model: '16M3', tahun: 2022, hm: 8000 },
]
for (const u of units) {
  const exists = await Unit.findOne({ nomor_unit: u.nomor_unit })
  if (!exists) await Unit.create(u)
}
console.log(`✅ ${units.length} unit dibuat`)

// Sample questions
const questions = [
  // Mesin
  { kategori: 'Mesin', pertanyaan: 'Kondisi oli mesin', urutan: 1 },
  { kategori: 'Mesin', pertanyaan: 'Kondisi filter udara', urutan: 2 },
  { kategori: 'Mesin', pertanyaan: 'Kondisi filter oli', urutan: 3 },
  { kategori: 'Mesin', pertanyaan: 'Kondisi fan belt', urutan: 4 },
  { kategori: 'Mesin', pertanyaan: 'Kondisi radiator dan coolant', urutan: 5 },
  // Hidrolik
  { kategori: 'Hidrolik', pertanyaan: 'Level oli hidrolik', urutan: 1 },
  { kategori: 'Hidrolik', pertanyaan: 'Kondisi selang hidrolik (kebocoran)', urutan: 2 },
  { kategori: 'Hidrolik', pertanyaan: 'Kondisi cylinder hidrolik', urutan: 3 },
  // Roda/Undercarriage
  { kategori: 'Roda', pertanyaan: 'Kondisi ban (tekanan dan keausan)', urutan: 1, unit_tipe: 'Dump Truck' },
  { kategori: 'Roda', pertanyaan: 'Kondisi rim dan baut roda', urutan: 2, unit_tipe: 'Dump Truck' },
  { kategori: 'Undercarriage', pertanyaan: 'Kondisi track dan roller', urutan: 1, unit_tipe: 'Excavator' },
  { kategori: 'Undercarriage', pertanyaan: 'Kondisi sprocket dan idler', urutan: 2, unit_tipe: 'Excavator' },
  // Kelistrikan
  { kategori: 'Kelistrikan', pertanyaan: 'Kondisi aki/battery', urutan: 1 },
  { kategori: 'Kelistrikan', pertanyaan: 'Kondisi lampu (head, tail, work lamp)', urutan: 2 },
  { kategori: 'Kelistrikan', pertanyaan: 'Kondisi kabel-kabel', urutan: 3 },
  // Keselamatan
  { kategori: 'Keselamatan', pertanyaan: 'Kondisi ROPS/FOPS', urutan: 1 },
  { kategori: 'Keselamatan', pertanyaan: 'Kondisi sabuk pengaman', urutan: 2 },
  { kategori: 'Keselamatan', pertanyaan: 'Kondisi pemadam api', urutan: 3 },
  { kategori: 'Keselamatan', pertanyaan: 'Kondisi alarm mundur', urutan: 4 },
]
for (const q of questions) {
  const exists = await Question.findOne({ kategori: q.kategori, pertanyaan: q.pertanyaan })
  if (!exists) await Question.create(q)
}
console.log(`✅ ${questions.length} pertanyaan inspeksi dibuat`)

await mongoose.disconnect()
console.log('🎉 Seed selesai!')
