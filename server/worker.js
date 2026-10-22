import { setTimeout as sleep } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { openStore } from './store.js'
import { createProvider } from './provider.js'
export async function processOne(store,provider,interval=1000) {
  store.heartbeat()
  const job=store.claim(Date.now(),interval)
  if(!job) return false
  try {
    const result=await provider(job.kind,job.payload)
    store.complete(job,job.kind==='evaluation'?{...result,question:job.payload.question,answer:job.payload.answer}:result)
  } catch(error) { store.fail(job,error) }
  return true
}
export function startWorker(store,provider,{concurrency=2,interval=1000}={}) {
  let stopped=false
  const timer=setInterval(()=>{store.heartbeat();store.prune()},5000)
  store.heartbeat()
  const tasks=Array.from({length:concurrency},async()=>{
    while(!stopped) {
      try { if(!await processOne(store,provider,interval)) await sleep(250) }
      catch { console.error(JSON.stringify({event:'worker_error'})); await sleep(1000) }
    }
  })
  return async()=>{stopped=true;clearInterval(timer);await Promise.all(tasks)}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const store=openStore(),stop=startWorker(store,createProvider())
  for(const signal of ['SIGINT','SIGTERM']) process.once(signal,async()=>{await stop();store.db.close()})
}
