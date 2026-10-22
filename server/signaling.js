import { Server } from 'socket.io'
import { randomBytes } from 'node:crypto'

// Rooms are ephemeral capabilities; possession of an invite grants access to video only.
export function attachSignaling(server, origin) {
  const rooms = new Map()
  const io = new Server(server, {
    maxHttpBufferSize: 64000,
    allowRequest: (req, cb) => cb(null, req.headers.origin === origin),
  })
  io.on('connection', (socket) => {
    let roomId = null,
      events = 0
    const reset = setInterval(() => {
      events = 0
    }, 10000)
    const expiry = setTimeout(() => socket.disconnect(true), 3600000)
    socket.use((_packet, next) => {
      if (++events > 100) return socket.disconnect(true)
      next()
    })
    socket.on('create', (ack) => {
      if (typeof ack !== 'function') return
      if (roomId || rooms.size >= 100) return ack({ error: 'Room unavailable' })
      roomId = randomBytes(16).toString('hex')
      rooms.set(roomId, { host: socket.id, guest: null, created: Date.now() })
      socket.join(roomId)
      ack({ room: roomId })
    })
    socket.on('join', (id, ack) => {
      if (typeof ack !== 'function') return
      const room = typeof id === 'string' ? rooms.get(id) : null
      if (roomId || !room || room.guest || Date.now() - room.created > 3600000)
        return ack({ error: 'Room expired, missing, or full' })
      roomId = id
      room.guest = socket.id
      socket.join(id)
      ack({ ok: true })
      io.to(room.host).emit('peer-ready')
    })
    socket.on('signal', (payload) => {
      if (!roomId || !payload || !['offer', 'answer', 'candidate'].includes(payload.type)) return
      socket.to(roomId).emit('signal', payload)
    })
    socket.on('disconnect', () => {
      clearInterval(reset)
      clearTimeout(expiry)
      if (!roomId) return
      const room = rooms.get(roomId)
      socket.to(roomId).emit('peer-left')
      if (room?.host === socket.id) {
        rooms.delete(roomId)
        io.in(roomId).disconnectSockets(true)
      } else if (room) room.guest = null
    })
  })
  return io
}
