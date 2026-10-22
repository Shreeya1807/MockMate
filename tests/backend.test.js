import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { openStore } from '../server/store.js'
import { createApp } from '../server/app.js'
import { createProvider, demoPlan, ProviderError } from '../server/provider.js'
import { processOne } from '../server/worker.js'
import { assessment, validatePlan } from '../server/contracts.js'

const input = {
  resume:
    'Built React applications with Node.js, APIs, SQL databases, automated tests and Docker containers.',
  role: 'Software Engineer',
  level: 'mid',
}
const setup = () => {
  const store = openStore(':memory:')
  return {
    store,
    app: createApp(store, { limits: false }),
    provider: createProvider({ mode: 'demo' }),
  }
}
const post = (agent, path, data) => agent.post(path).set('X-MockMate-Request', '1').send(data)

test('complete workflow is isolated, idempotent, persistent and deletable', async (t) => {
  const { store, app, provider } = setup()
  t.after(() => store.db.close())
  const agent = request.agent(app),
    stranger = request.agent(app)
  const created = await post(agent, '/api/sessions', input).expect(202)
  const { id, jobId } = created.body
  await stranger.get(`/api/sessions/${id}`).expect(404)
  await stranger.get(`/api/jobs/${jobId}`).expect(404)
  await processOne(store, provider, 0)
  const session = (await agent.get(`/api/sessions/${id}`).expect(200)).body
  assert.equal(session.plan.questions.length, 6)
  assert.equal(
    store.db.prepare('SELECT input FROM sessions WHERE id=?').get(id).input.includes('resume'),
    false,
  )
  for (const question of session.plan.questions) {
    const payload = {
      questionId: question.id,
      answer:
        'I implemented a React dashboard, added integration tests, and measured a reduction in errors.',
    }
    const first = await post(agent, `/api/sessions/${id}/answers`, payload).expect(202)
    assert.equal(first.body.submission.answer, payload.answer)
    const duplicate = await post(agent, `/api/sessions/${id}/answers`, payload).expect(202)
    assert.equal(first.body.id, duplicate.body.id)
    await post(agent, `/api/sessions/${id}/answers`, {
      ...payload,
      answer: 'An entirely different answer',
    }).expect(409)
    await processOne(store, provider, 0)
    const result = await agent.get(`/api/jobs/${first.body.id}`).expect(200)
    assert.equal(result.body.status, 'completed')
    assert.equal(result.body.result.score, 65)
  }
  assert.equal((await agent.get(`/api/sessions/${id}`)).body.jobs.length, 7)
  await agent.delete(`/api/sessions/${id}`).set('X-MockMate-Request', '1').expect(204)
  assert.equal(store.jobs(id).length, 0)
  await agent.get(`/api/sessions/${id}`).expect(404)
})

test('CSRF, validation, and unready-session protection', async (t) => {
  const { store, app } = setup()
  t.after(() => store.db.close())
  await request(app).post('/api/sessions').send(input).expect(403)
  await request(app)
    .post('/api/sessions')
    .set('X-MockMate-Request', '1')
    .set('Origin', 'https://evil.example')
    .send(input)
    .expect(403)
  await post(request(app), '/api/sessions', { ...input, resume: 'short' }).expect(400)
  await post(request(app), '/api/sessions', { ...input, admin: true }).expect(400)
  const agent = request.agent(app),
    created = await post(agent, '/api/sessions', input).expect(202)
  await post(agent, `/api/sessions/${created.body.id}/answers`, {
    questionId: 1,
    answer: 'An answer',
  }).expect(409)
  await agent.get('/health/ready').expect(503)
  store.heartbeat()
  await agent.get('/health/ready').expect(200)
})

test('bounded retries honor Retry-After and exhaust after three attempts', (t) => {
  const { store } = setup()
  t.after(() => store.db.close())
  const { jobId } = store.create('owner', input, 'demo'),
    now = Date.now() + 1
  let job = store.claim(now, 0)
  store.fail(job, new ProviderError('PROVIDER_HTTP_429', true, 5000), now)
  assert.equal(store.claim(now + 4999, 0), null)
  job = store.claim(now + 5001, 0)
  assert.equal(job.attempts, 2)
  store.fail(job, new ProviderError('TIMEOUT'), now + 5001)
  job = store.claim(now + 10000, 0)
  assert.equal(job.attempts, 3)
  store.fail(job, new ProviderError('TIMEOUT'), now + 10000)
  assert.equal(store.job(jobId, 'owner').status, 'failed')
  assert.equal(store.claim(now + 100000, 0), null)
})

test('leases recover crashed workers and fence stale completion', (t) => {
  const { store } = setup()
  t.after(() => store.db.close())
  const { jobId } = store.create('owner', input, 'demo'),
    now = Date.now() + 1
  const first = store.claim(now, 0)
  assert.equal(store.claim(now + 1000, 0), null)
  const recovered = store.claim(now + 61000, 0)
  assert.equal(recovered.id, first.id)
  assert.equal(recovered.attempts, 2)
  store.complete(first, demoPlan(input))
  assert.equal(store.job(jobId, 'owner').status, 'running')
  store.complete(recovered, demoPlan(input))
  assert.equal(store.job(jobId, 'owner').status, 'completed')
})

test('provider pacing is shared by queue consumers and permanent failures do not retry', (t) => {
  const { store } = setup()
  t.after(() => store.db.close())
  store.create('owner', input, 'demo')
  store.create('owner', input, 'demo')
  const now = Date.now() + 1,
    job = store.claim(now, 1000)
  assert.equal(store.claim(now + 999, 1000), null)
  assert.ok(store.claim(now + 1000, 1000))
  store.fail(job, new ProviderError('PROVIDER_HTTP_401', false))
  assert.equal(store.job(job.id, 'owner').status, 'failed')
})

test('schema validation rejects invalid scores, missing fields and wrong categories', () => {
  assert.throws(() =>
    assessment.parse({
      score: 101,
      strengths: ['fine'],
      improvements: ['fine'],
      exampleAnswer: 'An example answer with context',
    }),
  )
  assert.throws(() => assessment.parse({ score: 50 }))
  const plan = demoPlan(input)
  plan.questions[0].id = 6
  assert.throws(() => validatePlan(plan))
  const other = demoPlan(input)
  other.questions[0].category = 'technical'
  assert.throws(() => validatePlan(other))
})

test('live provider rejects malformed output and classifies HTTP errors', async (t) => {
  const oldKey = process.env.OPENROUTER_API_KEY,
    oldModel = process.env.OPENROUTER_MODEL
  process.env.OPENROUTER_API_KEY = 'test-key'
  process.env.OPENROUTER_MODEL = 'test-model'
  t.after(() => {
    if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = oldKey
    if (oldModel === undefined) delete process.env.OPENROUTER_MODEL
    else process.env.OPENROUTER_MODEL = oldModel
  })
  const malformed = createProvider({
    mode: 'live',
    fetchImpl: async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'not JSON' } }] })),
  })
  await assert.rejects(() => malformed('plan', input), { code: 'INVALID_MODEL_RESPONSE' })
  const forbidden = createProvider({
    mode: 'live',
    fetchImpl: async () => new Response('', { status: 401 }),
  })
  await assert.rejects(() => forbidden('plan', input), {
    code: 'PROVIDER_HTTP_401',
    retryable: false,
  })
  const throttled = createProvider({
    mode: 'live',
    fetchImpl: async () => new Response('', { status: 429, headers: { 'retry-after': '8' } }),
  })
  await assert.rejects(() => throttled('plan', input), { retryAfter: 8000, retryable: true })
  const success = createProvider({
    mode: 'live',
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body)
      assert.equal(body.response_format.json_schema.strict, true)
      assert.equal(options.headers.Authorization, 'Bearer test-key')
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(demoPlan(input)) } }] }),
      )
    },
  })
  assert.equal((await success('plan', input)).questions.length, 6)
})

test('expired sessions cascade deletion', (t) => {
  const { store } = setup()
  t.after(() => store.db.close())
  const { id } = store.create('owner', input, 'demo')
  store.db.prepare('UPDATE sessions SET created=? WHERE id=?').run(Date.now() - 8 * 86400000, id)
  store.prune()
  assert.equal(store.session(id, 'owner'), undefined)
  assert.equal(store.jobs(id).length, 0)
})

test('write requests are rate-limited before filling the queue', async (t) => {
  const store = openStore(':memory:')
  t.after(() => store.db.close())
  const agent = request.agent(createApp(store))
  for (let i = 0; i < 12; i++) await post(agent, '/api/sessions', input).expect(202)
  const response = await post(agent, '/api/sessions', input).expect(429)
  assert.match(response.body.error, /wait/)
})
test('changing demo to live never sends prior demo data to the provider', async (t) => {
  const { store } = setup()
  t.after(() => store.db.close())
  const { jobId } = store.create('owner', input, 'demo')
  let called = false
  const provider = Object.assign(
    async () => {
      called = true
    },
    { mode: 'live' },
  )
  await processOne(store, provider, 0)
  assert.equal(called, false)
  assert.equal(store.job(jobId, 'owner').status, 'failed')
  assert.equal(store.job(jobId, 'owner').error, 'AI_MODE_CHANGED')
})
test('jobs survive a database reopen and independent connections cannot double-claim', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'mockmate-queue-'))
  t.after(() => {
    for (const file of readdirSync(directory)) unlinkSync(join(directory, file))
    rmdirSync(directory)
  })
  const path = join(directory, 'queue.sqlite')
  const first = openStore(path)
  const { jobId } = first.create('owner', input, 'demo')
  first.db.close()
  const reopened = openStore(path),
    other = openStore(path)
  try {
    assert.equal(reopened.job(jobId, 'owner').status, 'queued')
    const now = Date.now() + 1
    assert.equal(reopened.claim(now, 0).id, jobId)
    assert.equal(other.claim(now, 0), null)
  } finally {
    reopened.db.close()
    other.db.close()
  }
})
test('metrics require a secret and contain no interview payloads', async (t) => {
  const { store, app } = setup()
  const prior = process.env.METRICS_TOKEN
  t.after(() => {
    store.db.close()
    if (prior === undefined) delete process.env.METRICS_TOKEN
    else process.env.METRICS_TOKEN = prior
  })
  process.env.METRICS_TOKEN = 'test-metrics-token'
  store.create('owner', input, 'demo')
  await request(app).get('/metrics').expect(401)
  const response = await request(app)
    .get('/metrics')
    .set('Authorization', 'Bearer test-metrics-token')
    .expect(200)
  assert.match(response.text, /mockmate_jobs\{status="queued"\} 1/)
  assert.equal(response.text.includes(input.resume), false)
})
