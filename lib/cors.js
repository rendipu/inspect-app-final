const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)

export function handleCors(req, res) {
  const origin  = req.headers.origin
  const allowed = process.env.NODE_ENV === 'development' || !origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')

  if (allowed && origin) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods',  'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers',  'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') { res.status(204).end(); return true }
  return false
}
