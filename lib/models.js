// lib/models.js
// Semua model Mongoose — dikelompokkan untuk memudahkan import
// Menggunakan mongoose.models[name] guard agar tidak redeclare di hot-reload

import mongoose from 'mongoose'
const { Schema, model, models } = mongoose

// ─── Counter (auto-increment pengganti integer ID) ──────────────────────────
const CounterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } })
export const Counter = models.Counter || model('Counter', CounterSchema)

async function nextId(name) {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
  return doc.seq
}

// ─── User ────────────────────────────────────────────────────────────────────
const UserSchema = new Schema(
  {
    id:       { type: Number, unique: true, index: true },
    nrp:      { type: String, required: true, unique: true, index: true },
    nama:     { type: String, required: true },
    jabatan:  { type: String },
    role:     { type: String, enum: ['admin', 'group_leader', 'mekanik', 'warehouse'], required: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
)
UserSchema.pre('save', async function (next) {
  if (!this.id) this.id = await nextId('user')
  next()
})
export const User = models.User || model('User', UserSchema)

// ─── Unit ────────────────────────────────────────────────────────────────────
const UnitSchema = new Schema(
  {
    id:          { type: Number, unique: true, index: true },
    nomor_unit:  { type: String, required: true, unique: true, index: true },
    tipe:        { type: String, required: true },
    brand:       { type: String, required: true },
    model:       { type: String },
    tahun:       { type: Number },
    hm:          { type: Number, default: 0 },
    qr_code:     { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
)
UnitSchema.pre('save', async function (next) {
  if (!this.id) this.id = await nextId('unit')
  if (!this.qr_code) this.qr_code = `QR-${this.nomor_unit}`
  next()
})
export const Unit = models.Unit || model('Unit', UnitSchema)

// ─── Question ────────────────────────────────────────────────────────────────
const QuestionSchema = new Schema(
  {
    id:         { type: Number, unique: true, index: true },
    kategori:   { type: String, required: true, index: true },
    pertanyaan: { type: String, required: true },
    urutan:     { type: Number, default: 0 },
    unit_tipe:  { type: [String], default: [] },
    brand:      { type: [String], default: [] },
    aktif:      { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
)
QuestionSchema.pre('save', async function (next) {
  if (!this.id) this.id = await nextId('question')
  next()
})
// Compound index untuk query filter pertanyaan berdasarkan tipe unit
QuestionSchema.index({ aktif: 1, unit_tipe: 1, brand: 1 })
export const Question = models.Question || model('Question', QuestionSchema)

// ─── RecurringSchedule ───────────────────────────────────────────────────────
const RecurringScheduleSchema = new Schema(
  {
    id:      { type: Number, unique: true, index: true },
    unit_id: { type: Number, required: true, unique: true, index: true },
    hari:    { type: [String], default: [] }, // Array langsung, tidak perlu JSON.parse
    aktif:   { type: Boolean, default: true },
  },
  { timestamps: true }
)
RecurringScheduleSchema.pre('save', async function (next) {
  if (!this.id) this.id = await nextId('recurringschedule')
  next()
})
export const RecurringSchedule = models.RecurringSchedule || model('RecurringSchedule', RecurringScheduleSchema)

// ─── Inspection ──────────────────────────────────────────────────────────────
// Embedded document: mekaniks + answers (denormalized untuk performa baca)
const WorkStatusLogSubSchema = new Schema(
  {
    user_id:    { type: Number },
    user_nama:  { type: String },
    work_status: { type: String },
    catatan:    { type: String },
    createdAt:  { type: Date, default: Date.now },
  },
  { _id: false }
)

const PartOrderSchema = new Schema(
  {
    id:           { type: Number, unique: true, sparse: true },
    part_name:    { type: String, required: true },
    part_number:  { type: String },
    quantity:     { type: Number, default: 1 },
    keterangan:   { type: String },
    foto_url:     { type: String },
    status:       { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
    work_status:  { type: String, enum: ['belum_dikerjakan','sedang_dikerjakan','sudah_selesai'], default: 'belum_dikerjakan' },
    approved_by:  { type: Number },
    approved_at:  { type: Date },
    work_logs:    [WorkStatusLogSubSchema],
  },
  { timestamps: true }
)

const RepairDetailSchema = new Schema(
  {
    id:          { type: Number, unique: true, sparse: true },
    keterangan:  { type: String },
    foto_url:    { type: String },
    work_status: { type: String, enum: ['belum_dikerjakan','sedang_dikerjakan','sudah_selesai'], default: 'belum_dikerjakan' },
    work_logs:   [WorkStatusLogSubSchema],
  },
  { timestamps: true }
)

const InspectionAnswerSchema = new Schema(
  {
    id:          { type: Number },
    question_id: { type: Number, required: true },
    // Embed question data untuk menghindari lookup saat read
    question_kategori:  { type: String },
    question_pertanyaan: { type: String },
    answer:      { type: String, enum: ['good','bad','repair'], required: true },
    part_order:  { type: PartOrderSchema, default: null },
    repair:      { type: RepairDetailSchema, default: null },
  },
  { _id: false }
)

const MekanikSubSchema = new Schema(
  {
    user_id:   { type: Number, required: true },
    user_nrp:  { type: String },
    user_nama: { type: String },
  },
  { _id: false }
)

const InspectionSchema = new Schema(
  {
    id:             { type: Number, unique: true, index: true },
    unit_id:        { type: Number, required: true, index: true },
    // Embed unit info untuk dashboard queries
    unit_nomor:     { type: String },
    unit_tipe:      { type: String },
    unit_brand:     { type: String },
    tanggal:        { type: Date, required: true, index: true },
    hour_meter:     { type: Number, required: true },
    jam_start:      { type: String, required: true },
    jam_finish:     { type: String, required: true },
    group_leader_id: { type: Number, required: true },
    group_leader_nama: { type: String },
    mekaniks:       [MekanikSubSchema],
    answers:        [InspectionAnswerSchema],
  },
  { timestamps: true }
)
// Compound index untuk query "unit + tanggal" (validasi 1 inspeksi per hari)
InspectionSchema.index({ unit_id: 1, tanggal: 1 })
InspectionSchema.pre('save', async function (next) {
  if (!this.id) this.id = await nextId('inspection')
  next()
})
export const Inspection = models.Inspection || model('Inspection', InspectionSchema)

// ─── Stock ────────────────────────────────────────────────────────────────────
const StockLogSubSchema = new Schema(
  {
    user_id:   { type: Number },
    user_nama: { type: String },
    delta:     { type: Number },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const StockSchema = new Schema(
  {
    id:                   { type: Number, unique: true, index: true },
    part_number:          { type: String, required: true, unique: true, index: true },
    material_description: { type: String, required: true },
    jumlah_stock:         { type: Number, default: 0 },
    satuan:               { type: String, required: true },
    location_storage:     { type: String },
    minimum_stock:        { type: Number, default: 0 },
    harga_satuan:         { type: Number },
    keterangan:           { type: String },
    stock_logs:           [StockLogSubSchema],
  },
  { timestamps: true }
)
StockSchema.pre('save', async function (next) {
  if (!this.id) this.id = await nextId('stock')
  next()
})
// Text index untuk full-text search
StockSchema.index({ part_number: 'text', material_description: 'text', location_storage: 'text' })
export const Stock = models.Stock || model('Stock', StockSchema)

// ─── HourMeterLog ────────────────────────────────────────────────────────────
const HourMeterLogSchema = new Schema(
  {
    id:        { type: Number, unique: true, index: true },
    unit_id:   { type: Number, required: true, index: true },
    unit_nomor: { type: String },
    hm_before: { type: Number, required: true },
    hm_after:  { type: Number, required: true },
    user_id:   { type: Number, required: true },
    user_nama: { type: String },
    catatan:   { type: String },
  },
  { timestamps: true }
)
HourMeterLogSchema.pre('save', async function (next) {
  if (!this.id) this.id = await nextId('hourMeterLog')
  next()
})
export const HourMeterLog = models.HourMeterLog || model('HourMeterLog', HourMeterLogSchema)
