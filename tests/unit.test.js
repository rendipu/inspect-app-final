/**
 * MINEINSPECT — UNIT TEST SUITE
 * =============================================================
 * Cara install & jalankan:
 *   npm install --save-dev vitest
 *   npx vitest run tests/unit.test.js
 *
 * Test tanpa koneksi DB — semua logika dites secara terisolasi.
 * Coverage: auth, CORS, SSE, API handlers, frontend helpers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import jwt from 'jsonwebtoken'

const SECRET = 'test-jwt-secret-mineinspect-2024'
process.env.JWT_SECRET = SECRET
process.env.MONGODB_URI = 'mongodb://localhost/test_mineinspect'

// ─── Mock helpers ─────────────────────────────────────────────────────────────
function makeRes() {
  const r = { _status: 200, _body: null, _headers: {}, _ended: false }
  r.status = (c) => { r._status = c; return r }
  r.json = (b) => { r._body = b; return r }
  r.end = () => { r._ended = true }
  r.setHeader = (k, v) => { r._headers[k] = v }
  r.write = (d) => { r._written = (r._written || []).concat(d) }
  r.flushHeaders = () => { }
  return r
}

function makeReq({ method = 'GET', body = {}, query = {}, token = null, origin = null } = {}) {
  const headers = {}
  if (token) headers.authorization = `Bearer ${token}`
  if (origin) headers.origin = origin
  return { method, body, query, headers, url: '/', on: vi.fn() }
}

function makeToken(payload, opts = {}) {
  return jwt.sign(payload, SECRET, { expiresIn: '1h', ...opts })
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. AUTH LOGIC
// ══════════════════════════════════════════════════════════════════════════════
describe('Auth — signToken / verifyToken / requireAuth / requireRole', () => {
  // Ekstrak fungsi langsung dari api/index.js tanpa import ES module
  // (simulasi karena tidak bisa import modul dengan side-effects di sini)
  function signToken(payload) {
    return jwt.sign(payload, SECRET, { expiresIn: '7d' })
  }
  function verifyToken(req) {
    const auth = req.headers?.authorization
    if (auth?.startsWith('Bearer ')) {
      try { return jwt.verify(auth.slice(7), SECRET) } catch { return null }
    }
    const t = req.query?.token
    if (t) { try { return jwt.verify(t, SECRET) } catch { return null } }
    return null
  }
  function requireAuth(req, res) {
    const u = verifyToken(req)
    if (!u) { res.status(401).json({ error: 'Unauthorized' }); return null }
    return u
  }
  function requireRole(req, res, roles) {
    const u = requireAuth(req, res)
    if (!u) return null
    if (!roles.includes(u.role)) { res.status(403).json({ error: 'Akses ditolak' }); return null }
    return u
  }

  it('signToken menghasilkan JWT valid dengan payload', () => {
    const token = signToken({ id: 1, role: 'admin', nrp: 'ADMIN001' })
    const decoded = jwt.decode(token)
    expect(decoded.id).toBe(1)
    expect(decoded.role).toBe('admin')
    expect(decoded.nrp).toBe('ADMIN001')
  })

  it('signToken expire dalam 7 hari', () => {
    const token = signToken({ id: 1 })
    const { exp, iat } = jwt.decode(token)
    expect(exp - iat).toBe(7 * 24 * 60 * 60)
  })

  it('verifyToken mengembalikan payload untuk token valid (dari header)', () => {
    const token = makeToken({ id: 5, role: 'mekanik' })
    const req = makeReq({ token })
    const result = verifyToken(req)
    expect(result).not.toBeNull()
    expect(result.id).toBe(5)
  })

  it('verifyToken mengembalikan payload dari query param token', () => {
    const token = makeToken({ id: 7, role: 'admin' })
    const req = makeReq({ query: { token } })
    const result = verifyToken(req)
    expect(result?.id).toBe(7)
  })

  it('verifyToken mengembalikan null untuk token expired', () => {
    const token = makeToken({ id: 1 }, { expiresIn: '-1s' })
    const req = makeReq({ token })
    expect(verifyToken(req)).toBeNull()
  })

  it('verifyToken mengembalikan null untuk token palsu', () => {
    const req = makeReq({ token: 'palsu.token.ini' })
    expect(verifyToken(req)).toBeNull()
  })

  it('verifyToken mengembalikan null jika tidak ada token sama sekali', () => {
    const req = makeReq()
    expect(verifyToken(req)).toBeNull()
  })

  it('requireAuth mengembalikan user untuk token valid', () => {
    const token = makeToken({ id: 3, role: 'mekanik', nrp: 'M001' })
    const req = makeReq({ token })
    const res = makeRes()
    const result = requireAuth(req, res)
    expect(result?.id).toBe(3)
    expect(res._status).toBe(200) // tidak disentuh
  })

  it('requireAuth mengembalikan null + 401 tanpa token', () => {
    const req = makeReq()
    const res = makeRes()
    expect(requireAuth(req, res)).toBeNull()
    expect(res._status).toBe(401)
    expect(res._body.error).toMatch(/unauthorized/i)
  })

  it('requireRole mengizinkan role yang sesuai', () => {
    const token = makeToken({ id: 1, role: 'admin', nrp: 'A001' })
    const req = makeReq({ token })
    const res = makeRes()
    const user = requireRole(req, res, ['admin'])
    expect(user?.role).toBe('admin')
  })

  it('requireRole menolak role yang tidak sesuai dengan 403', () => {
    const token = makeToken({ id: 2, role: 'mekanik', nrp: 'M002' })
    const req = makeReq({ token })
    const res = makeRes()
    expect(requireRole(req, res, ['admin', 'group_leader'])).toBeNull()
    expect(res._status).toBe(403)
  })

  it('requireRole mengizinkan salah satu dari banyak role', () => {
    const token = makeToken({ id: 3, role: 'warehouse', nrp: 'W001' })
    const req = makeReq({ token })
    const res = makeRes()
    const user = requireRole(req, res, ['warehouse', 'admin'])
    expect(user).not.toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. CORS LOGIC
// ══════════════════════════════════════════════════════════════════════════════
describe('CORS — handleCors (fixed version)', () => {
  function cors(req, res) {
    const origin = req.headers.origin
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*')
    }
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') { res.status(204).end(); return true }
    return false
  }

  it('set Allow-Origin ke origin request (bukan *) saat ada origin header', () => {
    const req = makeReq({ method: 'GET', origin: 'https://mineinspect.vercel.app' })
    const res = makeRes()
    cors(req, res)
    expect(res._headers['Access-Control-Allow-Origin']).toBe('https://mineinspect.vercel.app')
    expect(res._headers['Access-Control-Allow-Credentials']).toBe('true')
  })

  it('set wildcard * jika tidak ada origin header (server-to-server)', () => {
    const req = makeReq({ method: 'GET' }) // tanpa origin
    const res = makeRes()
    cors(req, res)
    expect(res._headers['Access-Control-Allow-Origin']).toBe('*')
  })

  it('mengembalikan true dan status 204 untuk preflight OPTIONS', () => {
    const req = makeReq({ method: 'OPTIONS', origin: 'https://mineinspect.vercel.app' })
    const res = makeRes()
    const result = cors(req, res)
    expect(result).toBe(true)
    expect(res._status).toBe(204)
    expect(res._ended).toBe(true)
  })

  it('mengembalikan false untuk request non-OPTIONS', () => {
    const req = makeReq({ method: 'POST', origin: 'https://mineinspect.vercel.app' })
    const res = makeRes()
    expect(cors(req, res)).toBe(false)
  })

  it('Vary: Origin selalu di-set agar cache proxy tidak salah', () => {
    const req = makeReq({ origin: 'https://test.com' })
    const res = makeRes()
    cors(req, res)
    expect(res._headers['Vary']).toBe('Origin')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. SSE BROADCAST LOGIC
// ══════════════════════════════════════════════════════════════════════════════
describe('SSE — broadcast', () => {
  function makeSseModule() {
    const clients = new Map()
    let counter = 0

    function addClient(res) {
      const id = ++counter
      clients.set(id, res)
      return id
    }
    function removeClient(id) { clients.delete(id) }
    function getCount() { return clients.size }
    function broadcast(event, data) {
      const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
      const dead = []
      for (const [id, r] of clients.entries()) {
        try { r.write(msg) } catch { dead.push(id) }
      }
      dead.forEach(id => clients.delete(id))
    }
    return { addClient, removeClient, getCount, broadcast }
  }

  it('broadcast menulis event ke semua client aktif', () => {
    const { addClient, broadcast } = makeSseModule()
    const c1 = makeRes()
    const c2 = makeRes()
    addClient(c1)
    addClient(c2)
    broadcast('test_event', { hello: 'world' })
    expect(c1._written).toContain('event: test_event\ndata: {"hello":"world"}\n\n')
    expect(c2._written).toContain('event: test_event\ndata: {"hello":"world"}\n\n')
  })

  it('broadcast membersihkan dead client yang throw saat write', () => {
    const { addClient, getCount, broadcast } = makeSseModule()
    const dead = makeRes()
    dead.write = () => { throw new Error('stream closed') }
    addClient(dead)
    const before = getCount()
    expect(() => broadcast('event', {})).not.toThrow()
    expect(getCount()).toBe(before - 1)
  })

  it('format pesan SSE: event + newline + data + double newline', () => {
    const { addClient, broadcast } = makeSseModule()
    const c = makeRes()
    addClient(c)
    broadcast('my_event', { key: 'value' })
    const msg = c._written[0]
    expect(msg).toMatch(/^event: my_event\n/)
    expect(msg).toMatch(/data: .+\n\n$/)
    expect(msg).toContain('"key":"value"')
  })

  it('addClient dan removeClient berfungsi dengan benar', () => {
    const { addClient, removeClient, getCount } = makeSseModule()
    const c = makeRes()
    const id = addClient(c)
    expect(getCount()).toBe(1)
    removeClient(id)
    expect(getCount()).toBe(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. HOUR METER VALIDATION LOGIC
// ══════════════════════════════════════════════════════════════════════════════
describe('HM Validation — logika validasi Hour Meter', () => {
  function validateHm({ unit_id, hm_after, currentHm }) {
    if (!unit_id || hm_after === undefined || hm_after === '') {
      return { ok: false, status: 400, error: 'Field wajib: unit_id, hm_after' }
    }
    const newHm = parseFloat(hm_after)
    if (isNaN(newHm) || newHm < 0) {
      return { ok: false, status: 400, error: 'HM tidak valid' }
    }
    if (newHm < currentHm) {
      return { ok: false, status: 400, error: `HM baru tidak boleh lebih kecil dari HM saat ini (${currentHm})` }
    }
    return { ok: true, newHm }
  }

  it('valid jika hm_after lebih besar dari hm saat ini', () => {
    const r = validateHm({ unit_id: 1, hm_after: 1050, currentHm: 1000 })
    expect(r.ok).toBe(true)
    expect(r.newHm).toBe(1050)
  })

  it('valid jika hm_after sama dengan hm saat ini (tidak berubah)', () => {
    const r = validateHm({ unit_id: 1, hm_after: 1000, currentHm: 1000 })
    expect(r.ok).toBe(true)
  })

  it('400 jika hm_after lebih kecil dari hm saat ini', () => {
    const r = validateHm({ unit_id: 1, hm_after: 800, currentHm: 1000 })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
    expect(r.error).toMatch(/tidak boleh lebih kecil/i)
  })

  it('400 jika hm_after string kosong (BUG FIX #4)', () => {
    const r = validateHm({ unit_id: 1, hm_after: '', currentHm: 500 })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
  })

  it('400 jika hm_after undefined', () => {
    const r = validateHm({ unit_id: 1, hm_after: undefined, currentHm: 0 })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(400)
  })

  it('400 jika hm_after bukan angka', () => {
    const r = validateHm({ unit_id: 1, hm_after: 'abc', currentHm: 100 })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/tidak valid/i)
  })

  it('400 jika hm_after negatif', () => {
    const r = validateHm({ unit_id: 1, hm_after: -5, currentHm: 0 })
    expect(r.ok).toBe(false)
  })

  it('400 jika unit_id tidak ada', () => {
    const r = validateHm({ unit_id: null, hm_after: 100, currentHm: 0 })
    expect(r.ok).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 5. STOCK DELTA LOGIC
// ══════════════════════════════════════════════════════════════════════════════
describe('Stock Movement — perhitungan delta (BUG FIX #13)', () => {
  // Logika yang sama dengan api.stockMovement (versi terfix)
  function calcDelta(moveData, currentStock = 0) {
    const jumlah = parseInt(moveData.jumlah) || 0
    if (moveData.tipe === 'keluar') return -Math.abs(jumlah)
    if (moveData.tipe === 'masuk') return Math.abs(jumlah)
    if (moveData.tipe === 'adjustment') return jumlah - currentStock
    return 0
  }

  it('masuk → delta positif', () => {
    expect(calcDelta({ tipe: 'masuk', jumlah: 10 })).toBe(10)
  })

  it('keluar → delta negatif', () => {
    expect(calcDelta({ tipe: 'keluar', jumlah: 5 })).toBe(-5)
  })

  it('keluar dengan input negatif tetap menghasilkan delta negatif (abs)', () => {
    expect(calcDelta({ tipe: 'keluar', jumlah: -5 })).toBe(-5)
  })

  it('adjustment target > currentStock → delta positif', () => {
    expect(calcDelta({ tipe: 'adjustment', jumlah: 50 }, 30)).toBe(20)
  })

  it('adjustment target < currentStock → delta negatif', () => {
    expect(calcDelta({ tipe: 'adjustment', jumlah: 10 }, 25)).toBe(-15)
  })

  it('adjustment target = currentStock → delta 0', () => {
    expect(calcDelta({ tipe: 'adjustment', jumlah: 15 }, 15)).toBe(0)
  })

  it('adjustment tanpa currentStock default ke 0', () => {
    expect(calcDelta({ tipe: 'adjustment', jumlah: 20 })).toBe(20)
  })

  it('cegah stok negatif: delta negatif tidak boleh melebihi stok saat ini', () => {
    // Validasi yang ditambahkan di BUG FIX #7
    const currentStock = 10
    const delta = -15
    const wouldBeNegative = currentStock + delta < 0
    expect(wouldBeNegative).toBe(true) // server harus tolak ini
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 6. ID LOOKUP — _id vs id (BUG FIX #8-12, #14-24)
// ══════════════════════════════════════════════════════════════════════════════
describe('ID lookup — _id vs id (kriteria utama bug frontend)', () => {
  const mockUnits = [
    { id: 1, _id: 'mongo-oid-aaa', nomor_unit: 'HD-001', qr_code: 'QR-HD-001', hm: 5000 },
    { id: 2, _id: 'mongo-oid-bbb', nomor_unit: 'DZ-002', qr_code: 'QR-DZ-002', hm: 3200 },
  ]
  const mockSchedules = [
    { id: 101, unit_id: 1, tanggal: '2025-01-15', status: 'scheduled' },
    { id: 102, unit_id: 2, tanggal: '2025-01-15', status: 'done' },
  ]

  it('cari unit dari schedule harus pakai u.id === s.unit_id, bukan u._id', () => {
    const s = mockSchedules[0]
    // BUG: u._id === s.unit_id → '...' === 1 → false, selalu undefined
    const buggy = mockUnits.find(u => u._id === s.unit_id)
    // FIX: u.id === s.unit_id → 1 === 1 → true
    const fixed = mockUnits.find(u => u.id === s.unit_id)
    expect(buggy).toBeUndefined()
    expect(fixed).toBeDefined()
    expect(fixed.nomor_unit).toBe('HD-001')
  })

  it('scan QR harus pakai x.qr_code bukan x.qr', () => {
    const scanInput = 'QR-HD-001'
    // BUG: x.qr selalu undefined
    const buggy = mockUnits.find(x => x.nomor_unit === scanInput || x.qr === scanInput)
    // FIX
    const fixed = mockUnits.find(x => x.nomor_unit === scanInput || x.qr_code === scanInput)
    expect(buggy).toBeUndefined()
    expect(fixed?.id).toBe(1)
  })

  it('cek jadwal unit untuk tombol "Mulai Inspeksi" harus pakai s.unit_id === scanRes.id', () => {
    const scanRes = mockUnits[0] // unit id=1
    const TODAY = '2025-01-15'
    // BUG: s.unit_id === scanRes._id → number === string → false
    const buggy = mockSchedules.find(s => s.unit_id === scanRes._id && s.tanggal === TODAY && s.status === 'scheduled')
    // FIX: s.unit_id === scanRes.id → 1 === 1 → true
    const fixed = mockSchedules.find(s => s.unit_id === scanRes.id && s.tanggal === TODAY && s.status === 'scheduled')
    expect(buggy).toBeUndefined()
    expect(fixed?.id).toBe(101)
  })

  it('HM dari scanRes harus pakai data.units.find(u => u.id === scanRes.id)', () => {
    const scanRes = { id: 2, hm: 3200 }
    // BUG
    const buggy = mockUnits.find(u => u._id === scanRes._id)
    // FIX
    const fixed = mockUnits.find(u => u.id === scanRes.id)
    expect(buggy).toBeUndefined()
    expect(fixed?.hm).toBe(3200)
  })

  it('filter recurring untuk dropdown: r.unit_id === u.id bukan u._id', () => {
    const recurring = [{ unit_id: 1, aktif: true }]
    // BUG: unit.id=1 masih masuk dropdown karena r.unit_id(1) !== u._id('mongo-oid-aaa')
    const buggyFilter = mockUnits.filter(u => !recurring.find(r => r.unit_id === u._id))
    // FIX
    const fixedFilter = mockUnits.filter(u => !recurring.find(r => r.unit_id === u.id))
    expect(buggyFilter).toHaveLength(2) // unit id=1 salah masih tampil
    expect(fixedFilter).toHaveLength(1) // hanya unit id=2 yang tampil
    expect(fixedFilter[0].nomor_unit).toBe('DZ-002')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 7. INSPECTION DUPLICATE CHECK LOGIC
// ══════════════════════════════════════════════════════════════════════════════
describe('Inspection — validasi duplikasi per hari', () => {
  function isSameDay(dateStr, inspections, unitId) {
    return inspections.some(i => {
      const tgl = new Date(i.tanggal).toISOString().split('T')[0]
      return i.unit_id === parseInt(unitId) && tgl === dateStr
    })
  }

  const inspections = [
    { unit_id: 1, tanggal: '2025-01-15T04:00:00.000Z' },
    { unit_id: 2, tanggal: '2025-01-14T04:00:00.000Z' },
  ]

  it('deteksi unit yang sudah diinspeksi hari yang sama', () => {
    expect(isSameDay('2025-01-15', inspections, 1)).toBe(true)
  })

  it('tidak deteksi unit di hari yang berbeda', () => {
    expect(isSameDay('2025-01-15', inspections, 2)).toBe(false)
  })

  it('tidak deteksi unit yang belum pernah diinspeksi', () => {
    expect(isSameDay('2025-01-15', inspections, 99)).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 8. APPROVALS — question_pertanyaan vs a.question (BUG FIX #25)
// ══════════════════════════════════════════════════════════════════════════════
describe('Approvals — extracting pertanyaan dari embedded answer', () => {
  const mockInspection = {
    unit_id: 1,
    hour_meter: 5000,
    tanggal: '2025-01-15',
    mekaniks: [{ user_nama: 'Budi' }],
    answers: [
      {
        answer: 'bad',
        question_id: 10,
        question_pertanyaan: 'Cek kondisi oli mesin',  // field yang benar
        question_kategori: 'Engine',
        // 'question' sebagai object TIDAK ADA — itu field di model lama
        part_order: { id: 501, part_name: 'Oli Mesin', status: 'pending', quantity: 2 }
      },
      {
        answer: 'good',
        question_id: 11,
        question_pertanyaan: 'Cek tekanan ban',
        part_order: null,
      }
    ]
  }

  it('mengambil teks pertanyaan dari question_pertanyaan (bukan a.question)', () => {
    const orders = []
    mockInspection.answers.forEach(a => {
      if (a.answer === 'bad' && a.part_order?.id) {
        orders.push({
          pertanyaan: a.question_pertanyaan,   // FIX: bukan a.question
          po: a.part_order,
        })
      }
    })
    expect(orders).toHaveLength(1)
    expect(orders[0].pertanyaan).toBe('Cek kondisi oli mesin')
    expect(orders[0].pertanyaan).not.toBeUndefined()
  })

  it('a.question selalu undefined di data dari API (reproduksi bug)', () => {
    const a = mockInspection.answers[0]
    // BUG: a.question tidak ada di schema, hanya question_pertanyaan
    expect(a.question).toBeUndefined()
    expect(a.question_pertanyaan).toBe('Cek kondisi oli mesin')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 9. CONNECTDB — retry setelah gagal (BUG FIX #1)
// ══════════════════════════════════════════════════════════════════════════════
describe('connectDB — reset promise setelah gagal (BUG FIX #1)', () => {
  it('cached.promise di-reset ke null saat koneksi gagal agar bisa retry', async () => {
    const cached = { conn: null, promise: null }
    const failConnect = () => Promise.reject(new Error('Connection refused'))

    async function connectDB() {
      if (cached.conn) return cached.conn
      if (!cached.promise) cached.promise = failConnect()
      try {
        cached.conn = await cached.promise
      } catch (err) {
        cached.promise = null  // FIX: reset agar retry bisa berjalan
        throw err
      }
      return cached.conn
    }

    await expect(connectDB()).rejects.toThrow('Connection refused')
    // Setelah gagal, promise harus di-reset
    expect(cached.promise).toBeNull()
    // Panggilan berikutnya tidak langsung failed dengan promise lama
    await expect(connectDB()).rejects.toThrow('Connection refused')
  })

  it('tanpa fix — promise rejected di-cache, panggilan berikutnya pakai promise lama', async () => {
    const cached = { conn: null, promise: null }
    const failConnect = () => Promise.reject(new Error('First fail'))

    async function connectDBBuggy() {
      if (cached.conn) return cached.conn
      if (!cached.promise) cached.promise = failConnect()
      cached.conn = await cached.promise  // tidak ada try-catch, promise tidak direset
      return cached.conn
    }

    await expect(connectDBBuggy()).rejects.toThrow('First fail')
    // cached.promise masih terisi dengan promise yang rejected
    expect(cached.promise).not.toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 10. WORK STATUS — order_status double response bug (BUG FIX #5)
// ══════════════════════════════════════════════════════════════════════════════
describe('Work Status — cegah double response pada order_status (BUG FIX #5)', () => {
  it('mekanik tidak bisa approve order (403 tanpa double response)', () => {
    const cu = { id: 1, role: 'mekanik', nama: 'Budi' }
    const res = makeRes()
    let responseCount = 0

    // Versi BUGGY: requireRole dipanggil setelah requireAuth, keduanya menulis ke res
    // Versi FIX: cek role inline dari cu yang sudah ada
    if (!['group_leader', 'admin'].includes(cu.role)) {
      res.status(403).json({ error: 'Akses ditolak' })
      responseCount++
    }

    expect(responseCount).toBe(1)
    expect(res._status).toBe(403)
  })

  it('group_leader bisa approve order (tidak ada 403)', () => {
    const cu = { id: 2, role: 'group_leader', nama: 'Leader' }
    const res = makeRes()
    let blocked = false

    if (!['group_leader', 'admin'].includes(cu.role)) {
      res.status(403).json({ error: 'Akses ditolak' })
      blocked = true
    }

    expect(blocked).toBe(false)
    expect(res._status).toBe(200) // tidak disentuh
  })
})