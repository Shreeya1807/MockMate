import { createServer } from 'node:http'
import { openStore } from './store.js'
import { createApp } from './app.js'
import { createProvider } from './provider.js'
import { startWorker } from './worker.js'
import { attachSignaling } from './signaling.js'

const store = openStore(),
  provider = createProvider()
store.prune()
const server = createServer(createApp(store))
const io = attachSignaling(server, process.env.APP_ORIGIN || 'http://localhost:5173')
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
    store.db.close()
    clearTimeout(timeout)
  })
