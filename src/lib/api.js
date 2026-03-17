// src/lib/api.js
// API client — kompatibel dengan backend MongoDB Atlas baru
// Perubahan dari v1:
// - BASE URL dari VITE_API_URL (sama)
// - getInspections: response sekarang { data, meta } — di-handle di usePolling
// - stockMovement: kirim delta (bukan tipe/jumlah)

const BASE = import.meta.env.VITE_API_URL || ''

function getToken() {
  return localStorage.getItem('inspect_token')
}

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    const msg = err.detail ? `${err.error} — ${err.detail}` : (err.error || `Request gagal: ${res.status}`)
    throw new Error(msg)
  }

  return res.json()
}

export const api = {
  // ── Auth ────────────────────────────────────────────────────────────
  login: (nrp, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ nrp, password }) }),

  // ── Users ───────────────────────────────────────────────────────────
  getUsers:   ()           => request('/api/users'),
  createUser: (data)       => request('/api/users',    { method: 'POST',   body: JSON.stringify(data) }),
  updateUser: (id, data)   => request(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id)         => request(`/api/users/${id}`, { method: 'DELETE' }),

  // ── Units ───────────────────────────────────────────────────────────
  getUnits:   ()           => request('/api/units'),
  createUnit: (data)       => request('/api/units',    { method: 'POST',   body: JSON.stringify(data) }),
  updateUnit: (id, data)   => request(`/api/units/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUnit: (id)         => request(`/api/units/${id}`, { method: 'DELETE' }),

  getHourMeterLogs: (unit_id) => {
    const qs = unit_id ? `?unit_id=${unit_id}` : ''
    return request(`/api/units/hm${qs}`)
  },
  updateHourMeter: (data) =>
    request('/api/units/hm', { method: 'POST', body: JSON.stringify(data) }),

  // ── Questions ───────────────────────────────────────────────────────
  getQuestions: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/questions${qs ? `?${qs}` : ''}`)
  },
  createQuestion: (data)     => request('/api/questions',      { method: 'POST',   body: JSON.stringify(data) }),
  updateQuestion: (id, data) => request(`/api/questions/${id}`, { method: 'PUT',   body: JSON.stringify(data) }),
  deleteQuestion: (id)       => request(`/api/questions/${id}`, { method: 'DELETE' }),

  // ── Schedules ───────────────────────────────────────────────────────
  getTodaySchedule: (tanggal) => {
    const qs = tanggal ? `?tanggal=${tanggal}` : ''
    return request(`/api/schedules${qs}`)
  },
  getRecurringSchedules:     ()           => request('/api/schedules?mode=recurring'),
  saveRecurringSchedule:     (data)       => request('/api/schedules',    { method: 'POST',  body: JSON.stringify(data) }),
  updateRecurringSchedule:   (id, data)   => request(`/api/schedules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRecurringSchedule:   (id)         => request(`/api/schedules/${id}`, { method: 'DELETE' }),

  // ── Inspections ─────────────────────────────────────────────────────
  getInspections: (params = {}) => {
    // Default limit tinggi agar semua data masuk (frontend filter secara lokal)
    const p = { limit: 200, ...params }
    const qs = new URLSearchParams(p).toString()
    return request(`/api/inspections${qs ? `?${qs}` : ''}`)
  },
  getInspection:    (id)   => request(`/api/inspections/${id}`),
  createInspection: (data) => request('/api/inspections', { method: 'POST', body: JSON.stringify(data) }),

  // ── Work Status ─────────────────────────────────────────────────────
  updateWorkStatus: (id, type, data) =>
    request(`/api/work-status/${id}?type=${type}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // ── Stock ───────────────────────────────────────────────────────────
  getStocks: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request(`/api/stock${qs ? `?${qs}` : ''}`)
  },
  getStock:    (id)         => request(`/api/stock/${id}`),
  createStock: (data)       => request('/api/stock',    { method: 'POST',  body: JSON.stringify(data) }),
  updateStock: (id, data)   => request(`/api/stock/${id}`, { method: 'PUT',   body: JSON.stringify(data) }),
  deleteStock: (id)         => request(`/api/stock/${id}`, { method: 'DELETE' }),

  // stockMovement — backend menerima { delta, catatan }
  // delta positif = masuk, negatif = keluar
  stockMovement: (id, moveData) => {
    let delta = parseInt(moveData.jumlah) || 0
    if (moveData.tipe === 'keluar')     delta = -Math.abs(delta)
    if (moveData.tipe === 'masuk')      delta =  Math.abs(delta)
    if (moveData.tipe === 'adjustment') delta = parseInt(moveData.jumlah) // akan di-handle server sebagai set absolute

    return request(`/api/stock/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ delta, catatan: moveData.keterangan }),
    })
  },
}
