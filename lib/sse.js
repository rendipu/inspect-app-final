const clients = new Map()

export function addClient(id, res)    { clients.set(id, res) }
export function removeClient(id)      { clients.delete(id) }
export function getClientCount()      { return clients.size }

export function broadcast(event, data, roles) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  const dead    = []
  for (const [id, res] of clients.entries()) {
    try {
      if (roles && !roles.includes(res._userRole)) continue
      res.write(message)
    } catch { dead.push(id) }
  }
  dead.forEach(id => clients.delete(id))
}
