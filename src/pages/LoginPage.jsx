import { useState } from 'react'
import { api } from '../lib/api'

export default function LoginPage({ onLogin }) {
  const [nrp, setNrp] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!nrp || !pw) { setErr('NRP dan password wajib diisi'); return }
    setLoading(true); setErr('')
    try {
      const res = await api.login(nrp, pw)
      localStorage.setItem('inspect_token', res.token)
      onLogin(res.user)
    } catch (e) {
      setErr(e.message || 'NRP atau password salah')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ width: 140, height: 140, margin: '-1rem auto', display: 'block' }}>
            {/* FIX: WebP lebih kecil (10KB vs 144KB), PNG sebagai fallback */}
            <picture>
              <source srcSet="/logo/mineinspect-crane.webp" type="image/webp" />
              <img
                src="/logo/mineinspect-crane.png"
                alt="MineInspect Logo"
                width="160"
                height="160"
                fetchPriority="high"
                style={{ width: 160, height: 160, margin: '-1rem auto', display: 'block', objectFit: 'contain' }}
              />
            </picture>
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--t)', letterSpacing: '.04em' }}>INSPECT</div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>Heavy Equipment Inspection System</div>
        </div>
        <div className="card" style={{ borderTop: '3px solid var(--p)' }}>
          <div style={{ marginBottom: 14 }}>
            <label className="lbl" htmlFor="login-nrp">NRP Karyawan</label>
            <input id="login-nrp" value={nrp} onChange={e => { setNrp(e.target.value); setErr('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Contoh: 1900374578" autoComplete="username" style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label className="lbl" htmlFor="login-pw">Password</label>
            <input id="login-pw" type="password" value={pw} onChange={e => { setPw(e.target.value); setErr('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Masukkan password" autoComplete="current-password" style={{ width: '100%' }} />
          </div>
          {err && <div role="alert" aria-live="polite" style={{ fontSize: 12, color: 'var(--err)', padding: '6px 10px', background: 'var(--errbg)', border: '1px solid var(--errbd)', borderRadius: 6, marginBottom: 8 }}>⚠ {err}</div>}
          <button className="btn-y" onClick={handleLogin} disabled={loading}
            style={{ width: '100%', padding: 11, fontSize: 14, marginTop: 6, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Memproses...' : 'MASUK →'}
          </button>
        </div>
        {/* <div style={{ background: 'var(--sf)', border: '1.5px solid var(--bd)', borderRadius: 10, padding: '10px 14px', marginTop: 14, fontSize: 12, color: 'var(--t3)' }}>
          Demo: ADM001/admin123 · GL001/gl123 · MK001/mk123
        </div> */}
      </div>
    </div>
  )
}