import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'

const base = new URL(process.argv[2] || 'http://localhost:3001').origin
const allowLive = process.argv.includes('--allow-live')
let cookie = ''
async function api(path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method,
    signal: AbortSignal.timeout(90000),
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      'X-MockMate-Request': '1',
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const setCookie = response.headers.getSetCookie().find((value) => value.startsWith('mm_owner='))
  if (setCookie) cookie = setCookie.split(';')[0]
  if (!response.ok)
    throw new Error(
      `Verification request failed: ${method} ${path.split('/')[1]} (${response.status})`,
    )
  return response.status === 204 ? null : response.json()
}
async function completed(id) {
  const deadline = Date.now() + 300000
  while (Date.now() < deadline) {
    const job = await api(`/api/jobs/${id}`)
    if (job.status === 'completed') return job.result
    if (job.status === 'failed') throw new Error(`Evaluation failed: ${job.error}`)
    await sleep(2000)
  }
  throw new Error('Verification timed out waiting for worker')
}
const health = await api('/health/ready')
assert.equal(health.status, 'ready')
const config = await api('/api/config')
if (config.mode === 'live' && !allowLive)
  throw new Error(
    'Live verification sends two synthetic provider requests. Pass --allow-live to permit provider usage.',
  )
let sessionId
try {
  const created = await api('/api/sessions', 'POST', {
    resume:
      'Built a React dashboard with Node.js APIs, SQL storage and integration tests. Documented deployment and monitored failures.',
    role: 'Software Engineer',
    level: 'mid',
  })
  sessionId = created.id
  const plan = await completed(created.jobId)
  assert.equal(plan.questions.length, 6)
  const job = await api(`/api/sessions/${sessionId}/answers`, 'POST', {
    questionId: plan.questions[0].id,
    answer:
      'I added integration tests for our dashboard APIs, reproduced an invalid-input bug, fixed validation, and checked the deployment health endpoint.',
  })
  const feedback = await completed(job.id)
  assert.ok(Number.isInteger(feedback.score) && feedback.score >= 0 && feedback.score <= 100)
  assert.ok((await api('/api/sessions')).some((session) => session.id === sessionId))
  console.log(
    `Verified readiness, question generation, feedback and history (${config.mode}, revision ${health.revision}).`,
  )
} finally {
  if (sessionId) {
    await api(`/api/sessions/${sessionId}`, 'DELETE')
    console.log('Verification session deleted.')
  }
}
