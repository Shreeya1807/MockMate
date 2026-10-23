import { setTimeout as sleep } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { openDatabase } from './database.js'
import { createProvider } from './provider.js'
export async function processOne(store, provider, interval = 1000) {
  await store.heartbeat()
  const job = await store.claim(Date.now(), interval)
  if (!job) return false
  try {
    const sessionMode = await store.mode(job.session_id)
    if (provider.mode && sessionMode !== provider.mode) {
      const error = new Error('EVALUATION_MODE_CHANGED')
      error.code = 'EVALUATION_MODE_CHANGED'
      error.retryable = false
      throw error
    }
    const result = await provider(job.kind, job.payload)
    await store.complete(
      job,
      job.kind === 'evaluation'
        ? { ...result, question: job.payload.question, answer: job.payload.answer }
        : result,
    )
  } catch (error) {
    await store.fail(job, error)
  }
  return true
}
export function startWorker(store, provider, { concurrency = 2, interval = 1000 } = {}) {
  let stopped = false
  let maintenance = Promise.resolve()
  let maintaining = false
  let nextPrune = Date.now() + 60000
  const timer = setInterval(() => {
    if (maintaining) return
    maintaining = true
    maintenance = Promise.resolve()
      .then(async () => {
        await store.heartbeat()
        if (Date.now() >= nextPrune) {
          await store.prune()
          nextPrune = Date.now() + 60000
        }
      })
      .catch(() => {
        console.error(JSON.stringify({ event: 'maintenance_error' }))
      })
      .finally(() => {
        maintaining = false
      })
  }, 5000)
  const tasks = Array.from({ length: concurrency }, async () => {
    while (!stopped) {
      try {
        if (!(await processOne(store, provider, interval))) await sleep(2000)
      } catch {
        console.error(JSON.stringify({ event: 'worker_error' }))
        await sleep(1000)
      }
    }
  })
  return async () => {
    stopped = true
    clearInterval(timer)
    await Promise.all([...tasks, maintenance])
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const store = await openDatabase(),
    stop = startWorker(store, createProvider())
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, async () => {
      await stop()
      await store.close()
    })
}
