import { setTimeout as sleep } from 'node:timers/promises'
const { RENDER_API_KEY, RENDER_SERVICE_ID, PRODUCTION_URL, GITHUB_SHA, GITHUB_REPOSITORY } =
  process.env
if (!RENDER_API_KEY || !RENDER_SERVICE_ID || !PRODUCTION_URL || !GITHUB_SHA)
  throw new Error('Deployment configuration is incomplete')
if (GITHUB_REPOSITORY) {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/commits/main`, {
    headers: { Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error('Cannot verify current main revision')
  if ((await response.json()).sha !== GITHUB_SHA) {
    console.log('Skipping superseded revision.')
    process.exit(0)
  }
}
async function render(path, body) {
  const response = await fetch(`https://api.render.com/v1/services/${RENDER_SERVICE_ID}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${RENDER_API_KEY}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) throw new Error(`Render request failed (${response.status})`)
  return response.json()
}
const deploy = await render('/deploys', { commitId: GITHUB_SHA, clearCache: 'do_not_clear' })
console.log(`Deployment started for ${GITHUB_SHA}.`)
let live = false
for (let attempt = 0; attempt < 60; attempt++) {
  await sleep(10000)
  const current = await render(`/deploys/${deploy.id}`)
  if (current.status === 'live') {
    live = true
    break
  }
  if (
    ['build_failed', 'update_failed', 'canceled', 'pre_deploy_failed', 'deactivated'].includes(
      current.status,
    )
  )
    throw new Error(`Deployment ended: ${current.status}`)
}
if (!live) throw new Error('Deployment timed out')
for (let attempt = 0; attempt < 12; attempt++) {
  try {
    const response = await fetch(new URL('/health/ready', PRODUCTION_URL), {
      signal: AbortSignal.timeout(15000),
    })
    const health = await response.json()
    if (response.ok && health.status === 'ready' && health.revision === GITHUB_SHA) {
      console.log(`Verified public readiness at ${GITHUB_SHA}.`)
      process.exit(0)
    }
  } catch {
    /* Retry while the new instance becomes reachable. */
  }
  await sleep(5000)
}
throw new Error('Public readiness did not match deployed revision')
