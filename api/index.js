import "dotenv/config";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Pusher from 'pusher'

// Inisialisasi Pusher (lazy — hanya dibuat saat dibutuhkan)
let pusherInstance = null
function getPusher() {
  if (!pusherInstance && process.env.PUSHER_APP_ID) {
    pusherInstance = new Pusher({
      appId:   process.env.PUSHER_APP_ID,
      key:     process.env.PUSHER_KEY,
      secret:  process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER,
      useTLS:  true,
    })
  }
  return pusherInstance
}

// Helper broadcast — tidak throw jika Pusher belum dikonfigurasi
async function broadcast(event, data) {
  try {
    const pusher = getPusher()
    if (!pusher) return
    await pusher.trigger('inspect-channel', event, data)
  } catch (e) {
    console.error('[Pusher broadcast error]', e.message)
  }
}

if (process.env.NODE_ENV !== "production") {
  const { default: dotenv } = await import("dotenv");
  dotenv.config();
}

// ── DB Connection ────────────────────────────────────────────────────
let cached = global._mongooseCache;
if (!cached) cached = global._mongooseCache = { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// ── Models ───────────────────────────────────────────────────────────
const { Schema, model, models } = mongoose;

const CounterSchema = new Schema({
  _id: String,
  seq: { type: Number, default: 0 },
});
const Counter = models.Counter || model("Counter", CounterSchema);

async function nextId(name) {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return doc.seq;
}

const UserSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    nrp: { type: String, required: true, unique: true },
    nama: { type: String, required: true },
    jabatan: String,
    role: {
      type: String,
      enum: ["admin", "group_leader", "mekanik", "warehouse"],
      required: true,
    },
    password: { type: String, required: true },
  },
  { timestamps: true },
);
UserSchema.pre("save", async function (next) {
  if (!this.id) this.id = await nextId("user");
  next();
});
const User = models.User || model("User", UserSchema);

const UnitSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    nomor_unit: { type: String, required: true, unique: true },
    tipe: { type: String, required: true },
    brand: { type: String, required: true },
    model: String,
    tahun: Number,
    hm: { type: Number, default: 0 },
    qr_code: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
);
UnitSchema.pre("save", async function (next) {
  if (!this.id) this.id = await nextId("unit");
  if (!this.qr_code) this.qr_code = `QR-${this.nomor_unit}`;
  next();
});
const Unit = models.Unit || model("Unit", UnitSchema);

const QuestionSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    kategori: { type: String, required: true },
    pertanyaan: { type: String, required: true },
    urutan: { type: Number, default: 0 },
    unit_tipe: { type: [String], default: [] },
    brand: { type: [String], default: [] },
    aktif: { type: Boolean, default: true },
  },
  { timestamps: true },
);
QuestionSchema.pre("save", async function (next) {
  if (!this.id) this.id = await nextId("question");
  next();
});
const Question = models.Question || model("Question", QuestionSchema);

const RecurringScheduleSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    unit_id: { type: Number, required: true, unique: true },
    hari: { type: [String], default: [] },
    aktif: { type: Boolean, default: true },
  },
  { timestamps: true },
);
RecurringScheduleSchema.pre("save", async function (next) {
  if (!this.id) this.id = await nextId("schedule");
  next();
});
const RecurringSchedule =
  models.RecurringSchedule ||
  model("RecurringSchedule", RecurringScheduleSchema);

const WorkLogSub = new Schema(
  {
    user_id: Number,
    user_nama: String,
    work_status: String,
    catatan: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const PartOrderSub = new Schema(
  {
    id: Number,
    part_name: String,
    part_number: String,
    quantity: { type: Number, default: 1 },
    keterangan: String,
    foto_url: String,
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    work_status: {
      type: String,
      enum: ["belum_dikerjakan", "sedang_dikerjakan", "sudah_selesai"],
      default: "belum_dikerjakan",
    },
    approved_by: Number,
    approved_at: Date,
    work_logs: [WorkLogSub],
  },
  { timestamps: true },
);

const RepairSub = new Schema(
  {
    id: Number,
    keterangan: String,
    foto_url: String,
    work_status: {
      type: String,
      enum: ["belum_dikerjakan", "sedang_dikerjakan", "sudah_selesai"],
      default: "belum_dikerjakan",
    },
    work_logs: [WorkLogSub],
  },
  { timestamps: true },
);

const AnswerSub = new Schema(
  {
    id: Number,
    question_id: Number,
    question_kategori: String,
    question_pertanyaan: String,
    answer: { type: String, enum: ["good", "bad", "repair"] },
    part_order: { type: PartOrderSub, default: null },
    repair: { type: RepairSub, default: null },
  },
  { _id: false },
);

const MekanikSub = new Schema(
  {
    user_id: Number,
    user_nrp: String,
    user_nama: String,
  },
  { _id: false },
);

const InspectionSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    unit_id: { type: Number, required: true, index: true },
    unit_nomor: String,
    unit_tipe: String,
    unit_brand: String,
    tanggal: { type: Date, required: true, index: true },
    hour_meter: { type: Number, required: true },
    jam_start: String,
    jam_finish: String,
    group_leader_id: Number,
    group_leader_nama: String,
    mekaniks: [MekanikSub],
    answers: [AnswerSub],
  },
  { timestamps: true },
);
InspectionSchema.index({ unit_id: 1, tanggal: 1 });
InspectionSchema.pre("save", async function (next) {
  if (!this.id) this.id = await nextId("inspection");
  next();
});
const Inspection = models.Inspection || model("Inspection", InspectionSchema);

const StockLogSub = new Schema(
  {
    user_id: Number,
    user_nama: String,
    delta: Number,
    catatan: String,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const StockSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    part_number: { type: String, required: true, unique: true },
    material_description: { type: String, required: true },
    jumlah_stock: { type: Number, default: 0 },
    satuan: { type: String, required: true },
    location_storage: String,
    minimum_stock: { type: Number, default: 0 },
    harga_satuan: Number,
    keterangan: String,
    stock_logs: [StockLogSub],
  },
  { timestamps: true },
);
StockSchema.index({ part_number: "text", material_description: "text" });
StockSchema.pre("save", async function (next) {
  if (!this.id) this.id = await nextId("stock");
  next();
});
const Stock = models.Stock || model("Stock", StockSchema);

const HourMeterLogSchema = new Schema(
  {
    id: { type: Number, unique: true, index: true },
    unit_id: { type: Number, required: true },
    unit_nomor: String,
    hm_before: Number,
    hm_after: Number,
    user_id: Number,
    user_nama: String,
    catatan: String,
  },
  { timestamps: true },
);
HourMeterLogSchema.pre("save", async function (next) {
  if (!this.id) this.id = await nextId("hmlog");
  next();
});
const HourMeterLog =
  models.HourMeterLog || model("HourMeterLog", HourMeterLogSchema);

// ── Auth Helpers ─────────────────────────────────────────────────────
function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}
function verifyToken(req) {
  const auth = req.headers?.authorization;
  if (auth?.startsWith("Bearer ")) {
    try {
      return jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    } catch {
      return null;
    }
  }
  const t = req.query?.token;
  if (t) {
    try {
      return jwt.verify(t, process.env.JWT_SECRET);
    } catch {
      return null;
    }
  }
  return null;
}
function requireAuth(req, res) {
  const u = verifyToken(req);
  if (!u) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return u;
}
function requireRole(req, res, roles) {
  const u = requireAuth(req, res);
  if (!u) return null;
  if (!roles.includes(u.role)) {
    res.status(403).json({ error: "Akses ditolak" });
    return null;
  }
  return u;
}

// ── CORS ─────────────────────────────────────────────────────────────
function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

// ── DAY MAP ───────────────────────────────────────────────────────────
const DAY_MAP = {
  0: "Minggu",
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu",
};

// ── MAIN HANDLER ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    await connectDB();
  } catch (err) {
    return res
      .status(503)
      .json({ error: "Database tidak dapat terhubung", detail: err.message });
  }

  // ← url dan meth BARU ada di sini
  const url = req.url.split("?")[0].replace(/\/$/, "");
  const meth = req.method;
  try {
    // ← Taruh public route DI SINI, setelah url dideklarasikan
    const publicUnitMatch = url.match(/^\/api\/public\/unit\/([^/]+)$/);
    if (publicUnitMatch && meth === "GET") {
      const qr_code = decodeURIComponent(publicUnitMatch[1]);
      const unit = await Unit.findOne({
        $or: [{ qr_code }, { nomor_unit: qr_code }],
      }).lean();
      if (!unit) return res.status(404).json({ error: "Unit tidak ditemukan" });
      const [inspections, hmLogs] = await Promise.all([
        Inspection.find({ unit_id: unit.id })
          .sort({ tanggal: -1 })
          .limit(50)
          .lean(),
        HourMeterLog.find({ unit_id: unit.id })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
      ]);
      return res.json({ unit, inspections, hmLogs });
    }

    // ── Auth ────────────────────────────────────────────────────────────
    if (url === "/api/auth/login" && meth === "POST") {
      const { nrp, password } = req.body;
      if (!nrp || !password)
        return res.status(400).json({ error: "NRP dan password wajib" });
      const user = await User.findOne({ nrp }).lean();
      if (!user || !(await bcrypt.compare(password, user.password)))
        return res.status(401).json({ error: "NRP atau password salah" });
      const token = signToken({
        id: user.id,
        nrp: user.nrp,
        nama: user.nama,
        jabatan: user.jabatan,
        role: user.role,
      });
      return res.json({
        token,
        user: {
          id: user.id,
          nrp: user.nrp,
          nama: user.nama,
          jabatan: user.jabatan,
          role: user.role,
        },
      });
    }

    // ── Users ────────────────────────────────────────────────────────────
    if (url === "/api/users") {
      if (!requireAuth(req, res)) return;
      if (meth === "GET") {
        const users = await User.find({}, "id nrp nama jabatan role createdAt")
          .sort({ id: 1 })
          .lean();
        return res.json(users);
      }
      if (meth === "POST") {
        if (!requireRole(req, res, ["admin"])) return;
        const { nrp, nama, jabatan, role, password } = req.body;
        if (!nrp || !nama || !password || !role)
          return res
            .status(400)
            .json({ error: "Field wajib: nrp, nama, role, password" });
        const hashed = await bcrypt.hash(password, 10);
        try {
          const u = await User.create({
            nrp,
            nama,
            jabatan,
            role,
            password: hashed,
          });
          return res.status(201).json({
            id: u.id,
            nrp: u.nrp,
            nama: u.nama,
            jabatan: u.jabatan,
            role: u.role,
          });
        } catch (e) {
          if (e.code === 11000)
            return res.status(409).json({ error: "NRP sudah terdaftar" });
          throw e;
        }
      }
    }

    const userIdMatch = url.match(/^\/api\/users\/(\d+)$/);
    if (userIdMatch) {
      const id = parseInt(userIdMatch[1]);
      if (meth === "GET") {
        if (!requireAuth(req, res)) return;
        const u = await User.findOne({ id }, "id nrp nama jabatan role").lean();
        if (!u) return res.status(404).json({ error: "User tidak ditemukan" });
        return res.json(u);
      }
      if (meth === "PUT") {
        if (!requireRole(req, res, ["admin"])) return;
        const { nama, jabatan, role, password } = req.body;
        const upd = { nama, jabatan, role };
        if (password) upd.password = await bcrypt.hash(password, 10);
        const u = await User.findOneAndUpdate({ id }, upd, { new: true });
        if (!u) return res.status(404).json({ error: "User tidak ditemukan" });
        return res.json({
          id: u.id,
          nrp: u.nrp,
          nama: u.nama,
          jabatan: u.jabatan,
          role: u.role,
        });
      }
      if (meth === "DELETE") {
        if (!requireRole(req, res, ["admin"])) return;
        const u = await User.findOneAndDelete({ id });
        if (!u) return res.status(404).json({ error: "User tidak ditemukan" });
        return res.json({ message: "User dihapus" });
      }
    }

    // ── Units ────────────────────────────────────────────────────────────
    if (url === "/api/units/hm") {
      const cu = requireAuth(req, res);
      if (!cu) return;
      if (meth === "GET") {
        const { unit_id } = req.query;
        const filter = unit_id ? { unit_id: parseInt(unit_id) } : {};
        const logs = await HourMeterLog.find(filter)
          .sort({ createdAt: -1 })
          .limit(100)
          .lean();
        return res.json(logs);
      }
      if (meth === "POST") {
        const { unit_id, hm_after, catatan } = req.body;
        if (!unit_id || hm_after === undefined)
          return res
            .status(400)
            .json({ error: "Field wajib: unit_id, hm_after" });
        const newHm = parseFloat(hm_after);
        if (isNaN(newHm) || newHm < 0)
          return res.status(400).json({ error: "HM tidak valid" });
        const unit = await Unit.findOne({ id: parseInt(unit_id) });
        if (!unit)
          return res.status(404).json({ error: "Unit tidak ditemukan" });
        if (newHm < unit.hm)
          return res.status(400).json({
            error: `HM baru tidak boleh lebih kecil dari HM saat ini (${unit.hm})`,
          });
        const [updUnit, log] = await Promise.all([
          Unit.findOneAndUpdate(
            { id: parseInt(unit_id) },
            { hm: newHm },
            { new: true },
          ).lean(),
          HourMeterLog.create({
            unit_id: parseInt(unit_id),
            unit_nomor: unit.nomor_unit,
            hm_before: unit.hm,
            hm_after: newHm,
            user_id: cu.id,
            user_nama: cu.nama,
            catatan: catatan || null,
          }),
        ]);
        return res.status(201).json({ unit: updUnit, log });
      }
    }

    if (url === "/api/units") {
      if (meth === "GET") {
        if (!requireAuth(req, res)) return;
        const units = await Unit.find().sort({ nomor_unit: 1 }).lean();
        const scheds = await RecurringSchedule.find({
          unit_id: { $in: units.map((u) => u.id) },
        }).lean();
        const schedMap = Object.fromEntries(scheds.map((s) => [s.unit_id, s]));
        return res.json(
          units.map((u) => ({ ...u, schedule: schedMap[u.id] || null })),
        );
      }
      if (meth === "POST") {
        if (!requireRole(req, res, ["admin"])) return;
        const { nomor_unit, tipe, brand, model, tahun, hm, qr_code } = req.body;
        if (!nomor_unit || !tipe || !brand)
          return res
            .status(400)
            .json({ error: "Field wajib: nomor_unit, tipe, brand" });
        try {
          const u = await Unit.create({
            nomor_unit,
            tipe,
            brand,
            model,
            tahun: tahun ? parseInt(tahun) : null,
            hm: hm ? parseFloat(hm) : 0,
            qr_code: qr_code || null,
          });
          return res.status(201).json(u);
        } catch (e) {
          if (e.code === 11000)
            return res
              .status(409)
              .json({ error: "Nomor unit sudah terdaftar" });
          throw e;
        }
      }
    }

    const unitIdMatch = url.match(/^\/api\/units\/(\d+)$/);
    if (unitIdMatch) {
      const id = parseInt(unitIdMatch[1]);
      if (!requireAuth(req, res)) return;
      if (meth === "GET") {
        const u = await Unit.findOne({ id }).lean();
        if (!u) return res.status(404).json({ error: "Unit tidak ditemukan" });
        return res.json(u);
      }
      if (meth === "PUT") {
        if (!requireRole(req, res, ["admin"])) return;
        const { nomor_unit, tipe, brand, model, tahun, hm } = req.body;
        const u = await Unit.findOneAndUpdate(
          { id },
          { nomor_unit, tipe, brand, model, tahun, hm },
          { new: true },
        );
        if (!u) return res.status(404).json({ error: "Unit tidak ditemukan" });
        return res.json(u);
      }
      if (meth === "DELETE") {
        if (!requireRole(req, res, ["admin"])) return;
        const u = await Unit.findOneAndDelete({ id });
        if (!u) return res.status(404).json({ error: "Unit tidak ditemukan" });
        return res.json({ message: "Unit dihapus" });
      }
    }

    // ── Questions ────────────────────────────────────────────────────────
    if (url === "/api/questions") {
      if (!requireAuth(req, res)) return;
      if (meth === "GET") {
        const { unit_tipe, brand } = req.query;
        let filter = { aktif: true };
        if (unit_tipe && brand) {
          filter.$or = [
            { unit_tipe: { $size: 0 } },
            { unit_tipe: null },
            { unit_tipe: unit_tipe, brand: { $size: 0 } },
            { unit_tipe: unit_tipe, brand: null },
            { unit_tipe: unit_tipe, brand: brand },
          ];
        } else if (unit_tipe) {
          filter.$or = [
            { unit_tipe: { $size: 0 } },
            { unit_tipe: null },
            { unit_tipe: unit_tipe, brand: { $size: 0 } },
            { unit_tipe: unit_tipe, brand: null },
          ];
        }
        const qs = await Question.find(filter)
          .sort({ kategori: 1, urutan: 1 })
          .lean();
        return res.json(qs);
      }
      if (meth === "POST") {
        if (!requireRole(req, res, ["admin"])) return;
        const { kategori, pertanyaan, urutan, unit_tipe, brand } = req.body;
        if (!kategori || !pertanyaan)
          return res
            .status(400)
            .json({ error: "Field wajib: kategori, pertanyaan" });
        const q = await Question.create({
          kategori,
          pertanyaan,
          urutan: urutan ? parseInt(urutan) : 0,
          unit_tipe: unit_tipe || [],
          brand: brand || [],
        });
        return res.status(201).json(q);
      }
    }

    const qIdMatch = url.match(/^\/api\/questions\/(\d+)$/);
    if (qIdMatch) {
      const id = parseInt(qIdMatch[1]);
      if (meth === "PUT") {
        if (!requireRole(req, res, ["admin"])) return;
        const q = await Question.findOneAndUpdate({ id }, req.body, {
          new: true,
        });
        if (!q)
          return res.status(404).json({ error: "Pertanyaan tidak ditemukan" });
        return res.json(q);
      }
      if (meth === "DELETE") {
        if (!requireRole(req, res, ["admin"])) return;
        const q = await Question.findOneAndUpdate(
          { id },
          { aktif: false },
          { new: true },
        );
        if (!q)
          return res.status(404).json({ error: "Pertanyaan tidak ditemukan" });
        return res.json({ message: "Pertanyaan dinonaktifkan" });
      }
    }

    // ── Schedules ────────────────────────────────────────────────────────
    if (url === "/api/schedules") {
      if (!requireAuth(req, res)) return;
      if (meth === "GET") {
        const { mode, tanggal } = req.query;
        if (mode === "recurring") {
          const scheds = await RecurringSchedule.find({ aktif: true }).sort({ id: 1 }).lean();
          const unitIds = scheds.map((s) => s.unit_id);
          const units = await Unit.find({ id: { $in: unitIds } }).lean();
          const uMap = Object.fromEntries(units.map((u) => [u.id, u]));
          return res.json(
            scheds.map((s) => ({ ...s, unit: uMap[s.unit_id] || null })),
          );
        }
        const date = tanggal ? new Date(tanggal) : new Date();
        const dayName = DAY_MAP[date.getDay()];
        const dateStr = date.toISOString().split("T")[0];
        const recurring = await RecurringSchedule.find({
          aktif: true,
          hari: dayName,
        }).lean();
        if (!recurring.length) return res.json([]);
        const unitIds = recurring.map((s) => s.unit_id);
        const startOfDay = new Date(dateStr + "T00:00:00.000Z");
        const endOfDay = new Date(dateStr + "T23:59:59.999Z");
        const [units, done] = await Promise.all([
          Unit.find({ id: { $in: unitIds } }).lean(),
          Inspection.find(
            {
              unit_id: { $in: unitIds },
              tanggal: { $gte: startOfDay, $lte: endOfDay },
            },
            "unit_id",
          ).lean(),
        ]);
        const uMap = Object.fromEntries(units.map((u) => [u.id, u]));
        const doneIds = new Set(done.map((i) => i.unit_id));
        return res.json(
          recurring.map((s) => ({
            id: s.id,
            unit_id: s.unit_id,
            unit: uMap[s.unit_id] || null,
            tanggal: dateStr,
            hari: s.hari,
            status: doneIds.has(s.unit_id) ? "done" : "scheduled",
          })),
        );
      }
      if (meth === "POST") {
        if (!requireRole(req, res, ["admin"])) return;
        const { unit_id, hari } = req.body;
        if (!unit_id || !hari?.length)
          return res.status(400).json({ error: "Field wajib: unit_id, hari" });

        let s = await RecurringSchedule.findOne({ unit_id: parseInt(unit_id) });
        if (s) {
          s.hari = hari;
          s.aktif = true;
          await s.save();
        } else {
          s = await RecurringSchedule.create({
            unit_id: parseInt(unit_id),
            hari,
            aktif: true,
          });
        }

        const unit = await Unit.findOne({ id: parseInt(unit_id) }).lean();
        return res.status(201).json({ ...s.toObject(), unit });
      }
    }

    // Terima integer id (\d+) ATAU MongoDB ObjectId (24 hex chars)
    const schedIdMatch = url.match(/^\/api\/schedules\/(\d+|[a-f0-9]{24})$/);
    if (schedIdMatch) {
      const raw = schedIdMatch[1];
      // Tentukan filter: integer id atau ObjectId _id
      const filter = /^\d+$/.test(raw) ? { id: parseInt(raw) } : { _id: raw };

      if (!requireRole(req, res, ["admin"])) return;
      if (meth === "PATCH") {
        const s = await RecurringSchedule.findOneAndUpdate(filter, req.body, {
          new: true,
        });
        if (!s)
          return res.status(404).json({ error: "Jadwal tidak ditemukan" });
        return res.json(s);
      }
      if (meth === 'DELETE') {
  const s = await RecurringSchedule.findOneAndDelete(filter)
  if (!s) return res.status(404).json({ error: 'Jadwal tidak ditemukan' })
  return res.json({ message: 'Jadwal dihapus' })
}
    }

    // ── Inspections ──────────────────────────────────────────────────────
    if (url === "/api/inspections") {
      if (!requireAuth(req, res)) return;
      if (meth === "GET") {
        const {
          unit_id,
          tanggal_from,
          tanggal_to,
          page = 1,
          limit = 200,
        } = req.query;
        const filter = {};
        if (unit_id) filter.unit_id = parseInt(unit_id);
        if (tanggal_from || tanggal_to) {
          filter.tanggal = {};
          if (tanggal_from) filter.tanggal.$gte = new Date(tanggal_from);
          if (tanggal_to) filter.tanggal.$lte = new Date(tanggal_to);
        }
        const [data, total] = await Promise.all([
          Inspection.find(filter)
            .sort({ tanggal: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit))
            .lean(),
          Inspection.countDocuments(filter),
        ]);
        return res.json({
          data,
          meta: { total, page: parseInt(page), limit: parseInt(limit) },
        });
      }
      if (meth === "POST") {
        const cu = requireAuth(req, res);
        if (!cu) return;
        const {
          unit_id,
          hour_meter,
          jam_start,
          jam_finish,
          group_leader_id,
          mekanik_ids,
          answers,
          tanggal,
        } = req.body;
        if (
          !unit_id ||
          !hour_meter ||
          !jam_start ||
          !jam_finish ||
          !group_leader_id ||
          !mekanik_ids?.length ||
          !answers?.length
        )
          return res.status(400).json({ error: "Data tidak lengkap" });
        const inspDate = tanggal ? new Date(tanggal) : new Date();
        const dateStr = inspDate.toISOString().split("T")[0];
        const startOfDay = new Date(dateStr + "T00:00:00.000Z");
        const endOfDay = new Date(dateStr + "T23:59:59.999Z");
        const already = await Inspection.findOne({
          unit_id: parseInt(unit_id),
          tanggal: { $gte: startOfDay, $lte: endOfDay },
        }).lean();
        if (already) {
          const mechs = (already.mekaniks || [])
            .map((m) => m.user_nama)
            .filter(Boolean)
            .join(", ");
          return res.status(409).json({
            error: `Unit ${already.unit_nomor} sudah diinspeksi hari ini`,
            detail: `Pukul ${already.jam_start} oleh ${mechs || "mekanik"}`,
            existing_id: already.id,
          });
        }
        const [unit, leader, mekanikUsers, questionDocs] = await Promise.all([
          Unit.findOne({ id: parseInt(unit_id) }).lean(),
          User.findOne({ id: parseInt(group_leader_id) }, "id nrp nama").lean(),
          User.find(
            { id: { $in: mekanik_ids.map(Number) } },
            "id nrp nama",
          ).lean(),
          Question.find(
            { id: { $in: answers.map((a) => parseInt(a.question_id)) } },
            "id kategori pertanyaan",
          ).lean(),
        ]);
        if (!unit)
          return res.status(404).json({ error: "Unit tidak ditemukan" });
        const mMap = Object.fromEntries(mekanikUsers.map((u) => [u.id, u]));
        const qMap = Object.fromEntries(questionDocs.map((q) => [q.id, q]));
        const builtAnswers = await Promise.all(
          answers.map(async (a) => {
            const q = qMap[parseInt(a.question_id)] || {};
            const ans = {
              id: await nextId("answer"),
              question_id: parseInt(a.question_id),
              question_kategori: q.kategori,
              question_pertanyaan: q.pertanyaan,
              answer: a.answer,
            };
            if (a.answer === "bad" && a.part_order) {
              const autoApprove = !!a.part_order.auto_approve;
              ans.part_order = {
                id: await nextId("partorder"),
                part_name: a.part_order.part_name,
                part_number: a.part_order.part_number || null,
                quantity: parseInt(a.part_order.quantity) || 1,
                keterangan: a.part_order.keterangan || null,
                foto_url: a.part_order.foto_url || null,
                status: autoApprove ? "approved" : "pending",
                approved_by: autoApprove ? 0 : null,
                approved_at: autoApprove ? new Date() : null,
                work_status: a.part_order.work_status || "belum_dikerjakan",
              };
            }
            if (a.answer === "repair" && a.repair) {
              ans.repair = {
                id: await nextId("repair"),
                keterangan: a.repair.keterangan || null,
                foto_url: a.repair.foto_url || null,
                work_status: a.repair.work_status || "belum_dikerjakan",
              };
              // Repair bisa juga punya part_order jika butuh order barang
              if (a.repair.needs_part && a.repair.part_order) {
                const autoApprove = !!a.repair.part_order.auto_approve;
                ans.part_order = {
                  id: await nextId("partorder"),
                  part_name: a.repair.part_order.part_name,
                  part_number: a.repair.part_order.part_number || null,
                  quantity: parseInt(a.repair.part_order.quantity) || 1,
                  keterangan: a.repair.part_order.keterangan || null,
                  foto_url: a.repair.part_order.foto_url || null,
                  status: autoApprove ? "approved" : "pending",
                  approved_by: autoApprove ? 0 : null,
                  approved_at: autoApprove ? new Date() : null,
                };
              }
            }
            return ans;
          }),
        );
        const inspection = await Inspection.create({
          unit_id: parseInt(unit_id),
          unit_nomor: unit.nomor_unit,
          unit_tipe: unit.tipe,
          unit_brand: unit.brand,
          tanggal: inspDate,
          hour_meter: parseFloat(hour_meter),
          jam_start,
          jam_finish,
          group_leader_id: parseInt(group_leader_id),
          group_leader_nama: leader?.nama,
          mekaniks: mekanik_ids.map((mid) => {
            const u = mMap[parseInt(mid)] || {};
            return {
              user_id: parseInt(mid),
              user_nrp: u.nrp,
              user_nama: u.nama,
            };
          }),
          answers: builtAnswers,
        });
        await Unit.updateOne(
          { id: parseInt(unit_id) },
          { hm: parseFloat(hour_meter) },
        );
        broadcast("inspection_created", {
          id: inspection.id,
          unit_nomor: inspection.unit_nomor,
          tanggal: inspection.tanggal,
        });
        return res.status(201).json(inspection);
      }
    }

    const inspIdMatch = url.match(/^\/api\/inspections\/(\d+)$/);
    if (inspIdMatch) {
      if (!requireAuth(req, res)) return;
      const id = parseInt(inspIdMatch[1]);
      if (meth === "GET") {
        const insp = await Inspection.findOne({ id }).lean();
        if (!insp)
          return res.status(404).json({ error: "Inspeksi tidak ditemukan" });
        return res.json(insp);
      }
    }

    // ── Work Status ──────────────────────────────────────────────────────
    const wsMatch = url.match(/^\/api\/work-status\/(\d+)$/);
    if (wsMatch && meth === "PATCH") {
      const cu = requireAuth(req, res);
      if (!cu) return;
      const answerId = parseInt(wsMatch[1]);
      const type = req.query.type;
      if (!["part_order", "repair"].includes(type))
        return res
          .status(400)
          .json({ error: "type harus part_order atau repair" });
      const { work_status, order_status, catatan } = req.body;
      if (work_status) {
        const valid = [
          "belum_dikerjakan",
          "sedang_dikerjakan",
          "sudah_selesai",
        ];
        if (!valid.includes(work_status))
          return res.status(400).json({ error: "work_status tidak valid" });
        const logEntry = {
          user_id: cu.id,
          user_nama: cu.nama,
          work_status,
          catatan: catatan || null,
          createdAt: new Date(),
        };
        let insp;
        if (type === "part_order") {
          insp = await Inspection.findOneAndUpdate(
            { "answers.part_order.id": answerId },
            {
              $set: { "answers.$[ans].part_order.work_status": work_status },
              $push: { "answers.$[ans].part_order.work_logs": logEntry },
            },
            { arrayFilters: [{ "ans.part_order.id": answerId }], new: true },
          );
        } else {
          insp = await Inspection.findOneAndUpdate(
            { "answers.repair.id": answerId },
            {
              $set: { "answers.$[ans].repair.work_status": work_status },
              $push: { "answers.$[ans].repair.work_logs": logEntry },
            },
            { arrayFilters: [{ "ans.repair.id": answerId }], new: true },
          );
        }
        if (!insp)
          return res.status(404).json({ error: "Data tidak ditemukan" });
        broadcast("work_status_updated", {
          answerId,
          type,
          work_status,
          updated_by: cu.nama,
        });
        return res.json({ success: true, work_status });
      }
      if (order_status) {
        const cu2 = requireRole(req, res, ["group_leader", "admin"]);
        if (!cu2) return;
        const insp = await Inspection.findOneAndUpdate(
          { "answers.part_order.id": answerId },
          {
            $set: {
              "answers.$[ans].part_order.status": order_status,
              "answers.$[ans].part_order.approved_by": cu.id,
              "answers.$[ans].part_order.approved_at": new Date(),
            },
          },
          { arrayFilters: [{ "ans.part_order.id": answerId }], new: true },
        );
        if (!insp)
          return res.status(404).json({ error: "Data tidak ditemukan" });
        broadcast("order_status_updated", {
          answerId,
          order_status,
          approved_by: cu.nama,
        });
        return res.json({ success: true, order_status });
      }
      return res
        .status(400)
        .json({ error: "Kirim work_status atau order_status" });
    }

    // ── Stock ─────────────────────────────────────────────────────────────
    if (url === "/api/stock") {
      if (!requireAuth(req, res)) return;
      if (meth === "GET") {
        const { search, low_stock } = req.query;
        let filter = {};
        if (search) {
          // Regex case-insensitive: bisa cari partial (misal '7867' cocok '78675765001')
          const re = {
            $regex: search.replace(/[.*+?^${}()|[\]\\/]/g, "\\\$&"),
            $options: "i",
          };
          filter.$or = [
            { part_number: re },
            { material_description: re },
            { location_storage: re },
          ];
        }
        const stocks = await Stock.find(filter)
          .select("-stock_logs")
          .sort({ part_number: 1 })
          .lean();
        const result =
          low_stock === "true"
            ? stocks.filter(
                (s) => s.minimum_stock > 0 && s.jumlah_stock <= s.minimum_stock,
              )
            : stocks;
        return res.json(result);
      }
      if (meth === "POST") {
        if (!requireRole(req, res, ["warehouse", "admin"])) return;
        const {
          part_number,
          material_description,
          jumlah_stock,
          satuan,
          location_storage,
          minimum_stock,
          harga_satuan,
          keterangan,
        } = req.body;
        if (!part_number || !material_description || !satuan)
          return res.status(400).json({
            error: "Field wajib: part_number, material_description, satuan",
          });
        try {
          const s = await Stock.create({
            part_number,
            material_description,
            jumlah_stock: parseInt(jumlah_stock) || 0,
            satuan,
            location_storage: location_storage || null,
            minimum_stock: parseInt(minimum_stock) || 0,
            harga_satuan: harga_satuan ? parseFloat(harga_satuan) : null,
            keterangan: keterangan || null,
          });
          return res.status(201).json(s);
        } catch (e) {
          if (e.code === 11000)
            return res
              .status(409)
              .json({ error: "Part number sudah terdaftar" });
          throw e;
        }
      }
    }

    // Endpoint update massal minimum_stock semua item sekaligus
    if (url === "/api/stock/set-minimum" && meth === "PATCH") {
      if (!requireRole(req, res, ["warehouse", "admin"])) return;
      const { minimum_stock } = req.body;
      const val = parseInt(minimum_stock);
      if (isNaN(val) || val < 0)
        return res.status(400).json({ error: "minimum_stock tidak valid" });
      const r = await Stock.updateMany(
        { minimum_stock: { $lt: val } },
        { $set: { minimum_stock: val } },
      );
      return res.json({
        success: true,
        updated: r.modifiedCount,
        message: `${r.modifiedCount} item diupdate ke minimum_stock = ${val}`,
      });
    }

    const stockIdMatch = url.match(/^\/api\/stock\/(\d+)$/);
    if (stockIdMatch) {
      const id = parseInt(stockIdMatch[1]);
      if (!requireAuth(req, res)) return;
      if (meth === "GET") {
        const s = await Stock.findOne({ id }).lean();
        if (!s) return res.status(404).json({ error: "Stock tidak ditemukan" });
        return res.json(s);
      }
      if (meth === "PUT") {
        if (!requireRole(req, res, ["warehouse", "admin"])) return;
        const s = await Stock.findOneAndUpdate({ id }, req.body, { new: true });
        if (!s) return res.status(404).json({ error: "Stock tidak ditemukan" });
        return res.json(s);
      }
      if (meth === "PATCH") {
        const cu = requireRole(req, res, ["warehouse", "admin"]);
        if (!cu) return;
        const { delta, catatan } = req.body;
        if (delta === undefined)
          return res.status(400).json({ error: "Field wajib: delta" });
        const s = await Stock.findOneAndUpdate(
          { id },
          {
            $inc: { jumlah_stock: parseInt(delta) },
            $push: {
              stock_logs: {
                user_id: cu.id,
                user_nama: cu.nama,
                delta: parseInt(delta),
                catatan,
              },
            },
          },
          { new: true },
        );
        if (!s) return res.status(404).json({ error: "Stock tidak ditemukan" });
        if (s.jumlah_stock <= s.minimum_stock)
          broadcast("stock_low", {
            id: s.id,
            part_number: s.part_number,
            material_description: s.material_description,
            jumlah_stock: s.jumlah_stock,
          });
        return res.json(s);
      }
      if (meth === "DELETE") {
        if (!requireRole(req, res, ["admin"])) return;
        const s = await Stock.findOneAndDelete({ id });
        if (!s) return res.status(404).json({ error: "Stock tidak ditemukan" });
        return res.json({ message: "Stock dihapus" });
      }
    }

    return res.status(404).json({ error: "Route tidak ditemukan" });
  } catch (err) {
    console.error("[Handler Error]", err);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: "Internal server error", detail: err.message });
    }
  }
}
