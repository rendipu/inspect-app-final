# 🏗️ Inspect Mining App v2

Aplikasi inspeksi kendaraan alat berat tambang.

**Tech Stack:**
- Frontend: React 18 + Vite + CSS Variables (tanpa framework UI)
- Backend:  Vercel Serverless Functions (Node.js)
- Database: MongoDB Atlas (ganti dari MySQL)
- Realtime: Server-Sent Events (SSE)
- PWA:      vite-plugin-pwa (service worker, installable)

---

## 🚀 Deploy ke Vercel (5 menit)

### 1. Setup MongoDB Atlas (gratis)
1. Daftar di https://cloud.mongodb.com
2. Buat cluster **M0 Free**
3. Database Access → Add User
4. Network Access → Add IP → `0.0.0.0/0`
5. Connect → Drivers → salin connection string

### 2. Push ke GitHub
```bash
git init
git add .
git commit -m "init"
git remote add origin https://github.com/username/inspect-app.git
git push -u origin main
```

### 3. Import di Vercel
1. Buka https://vercel.com/new
2. Import repo GitHub
3. Framework: **Vite** (auto-detected)
4. Tambah Environment Variables:

| Key | Value |
|-----|-------|
| `MONGODB_URI` | `mongodb+srv://...` |
| `JWT_SECRET` | string random 64 karakter |
| `VITE_CLOUDINARY_CLOUD_NAME` | cloud name Cloudinary |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | upload preset name |

5. Deploy!

### 4. Seed data awal
```bash
# Install dependencies dulu
npm install

# Buat .env dari template
cp .env.example .env
# Edit .env, isi MONGODB_URI dan JWT_SECRET

# Jalankan seed
npm run seed
```

Login awal: **NRP: ADMIN001 / Password: admin123**

---

## 💻 Development Lokal

```bash
npm install
cp .env.example .env
# Edit .env

# Jalankan API + Frontend sekaligus
npm run dev

# API:     http://localhost:3001
# Frontend: http://localhost:5173
```

---

## 📁 Struktur Proyek

```
inspect-app/
├── api/                    ← Vercel serverless functions
│   ├── auth/login.js
│   ├── inspections/
│   ├── units/
│   ├── users/
│   ├── questions/
│   ├── schedules/
│   ├── stock/
│   ├── work-status/
│   └── sse/index.js        ← SSE realtime endpoint
├── lib/
│   ├── mongodb.js          ← Koneksi MongoDB (connection pool)
│   ├── models.js           ← Semua Mongoose models
│   ├── auth.js             ← JWT helper
│   ├── cors.js             ← CORS helper
│   └── sse.js              ← SSE broadcast manager
├── src/                    ← Frontend React (Vite)
│   ├── App.jsx
│   ├── main.jsx
│   ├── index.css
│   ├── lib/api.js          ← API client
│   ├── hooks/
│   │   ├── usePolling.js   ← Data fetch + SSE realtime
│   │   ├── useOnline.js
│   │   └── useWindowWidth.js
│   ├── components/
│   │   ├── Badge.jsx
│   │   ├── BottomNav.jsx
│   │   ├── LiveIndicator.jsx
│   │   ├── MultiUserInput.jsx
│   │   ├── PwaBanner.jsx
│   │   ├── Sidebar.jsx
│   │   ├── TopBar.jsx
│   │   └── WorkStatusBadge.jsx
│   └── pages/
│       ├── LoginPage.jsx
│       ├── Dashboard.jsx
│       ├── InspectionForm.jsx
│       ├── HistoryPage.jsx
│       ├── Analytics.jsx
│       ├── Approvals.jsx
│       ├── AdminPanel.jsx
│       ├── HourMeter.jsx
│       └── stockPage.jsx
├── scripts/
│   ├── seed.js                     ← Data awal
│   ├── migrate-mysql-to-mongo.js   ← Migrasi dari MySQL lama
│   └── generate-icons.js           ← Generate PWA icons
├── public/
│   ├── manifest.json
│   └── icons/                      ← Buat dengan generate-icons.js
├── server.js               ← Express server untuk dev lokal
├── vite.config.js
├── vercel.json
├── .env.example
└── package.json
```

---

## 🔄 Migrasi dari MySQL

Jika punya data di MySQL lama:

```bash
# Tambah ke .env:
OLD_DATABASE_URL="mysql://username:password@host:3307/database"

# Jalankan migrasi
npm run migrate
```

---

## 📱 Cara Install PWA

- **Android Chrome**: tap `⋮` → Add to Home Screen
- **iOS Safari**: tap Share → Add to Home Screen
- **Desktop Chrome/Edge**: klik icon install di address bar

---

## ⚡ Perubahan dari v1 (MySQL → MongoDB)

1. **Prisma dihapus** → Mongoose (lebih ringan, ~80% lebih kecil)
2. **Data di-embed** → answers, mekaniks, work_logs ada di dalam dokumen Inspection (tidak ada JOIN)
3. **Realtime SSE** → usePolling sekarang terkoneksi ke `/api/sse`, trigger refetch otomatis saat ada data baru
4. **PWA** → installable, cache otomatis
5. **Connection pooling** → tidak "too many connections" di serverless
6. **Parallel queries** → `Promise.all()` menggantikan query sekuensial
