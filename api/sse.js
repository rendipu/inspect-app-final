import jwt from 'jsonwebtoken'

export const config = {
    api: { bodyParser: false },
}

const clients = new Map()
let counter = 0

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') { res.status(204).end(); return }

    const token = req.query?.token
    if (!token) { res.status(401).json({ error: 'Unauthorized' }); return }

    try {
        jwt.verify(token, process.env.JWT_SECRET)
    } catch {
        res.status(401).json({ error: 'Token tidak valid' }); return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    const id = ++counter
    clients.set(id, res)

    res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id })}\n\n`)

    const hb = setInterval(() => {
        try { res.write(': heartbeat\n\n') } catch { clearInterval(hb) }
    }, 25000)

    req.on('close', () => { clearInterval(hb); clients.delete(id) })
    req.on('error', () => { clearInterval(hb); clients.delete(id) })
}