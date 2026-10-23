import { createServer } from 'node:http'
import { openDatabase } from './database.js'
import { createApp } from './app.js'
import { createProvider } from './provider.js'
import { startWorker } from './worker.js'
import { attachSignaling } from './signaling.js'

const store = await openDatabase(),
  provider = createProvider()
await store.prune()
const server = createServer(createApp(store))
const io = attachSignaling(
  server,
  process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173',
)
const stop = process.env.WORKER_MODE === 'external' ? async () => {} : startWorker(store, provider)
server.listen(Number(process.env.PORT || 3001), '0.0.0.0', () =>
  console.log(
    JSON.stringify({
      event: 'listening',
      port: Number(process.env.PORT || 3001),
      mode: process.env.EVALUATION_MODE || 'demo',
    }),
  ),
)
let closing = false
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    if (closing) return
    closing = true
    const timeout = setTimeout(() => process.exit(1), 35000)
    timeout.unref()
    io.close()
    server.close()
    await stop()
    await store.close()
    clearTimeout(timeout)
  })
