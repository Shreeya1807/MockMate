import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { PGlite } from '@electric-sql/pglite'
import request from 'supertest'
import { openPostgresStore } from '../server/postgres-store.js'
import { createApp } from '../server/app.js'
import { createProvider } from '../server/provider.js'
import { processOne } from '../server/worker.js'

async function database() {
  if (process.env.TEST_DATABASE_URL) {
    const schema = `test_${randomUUID().replaceAll('-', '')}`
    const admin = new Pool({ connectionString: process.env.TEST_DATABASE_URL })
    await admin.query(`CREATE SCHEMA ${schema}`)
    const pool = new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
    })
    return {
      pool,
      cleanup: async () => {
        await admin.query(`DROP SCHEMA ${schema} CASCADE`)
        await admin.end()
      },
    }
  }
  const db = new PGlite()
  let tail = Promise.resolve()
  const query = (sql, values) =>
    !values && sql.includes(';') ? db.exec(sql) : db.query(sql, values)
  // Embedded PostgreSQL has one connection; serialize checked-out transactions.
  return {
    pool: {
      query,
      end: () => db.close(),
      connect: async () => {
        const previous = tail
        let release
        tail = new Promise((resolve) => {
          release = resolve
        })
        await previous
        return { query, release }
      },
    },
    cleanup: async () => {},
  }
}
const input = {
  resume: 'Built React applications with Node.js, SQL databases and automated integration tests.',
  role: 'Software Engineer',
  level: 'mid',
}
const post = (agent, path, data) => agent.post(path).set('X-MockMate-Request', '1').send(data)

test('PostgreSQL persistence and queue contract', async (t) => {
  const { pool, cleanup } = await database()
  const store = await openPostgresStore(undefined, pool)
  t.after(async () => {
    await store.close()
    await cleanup()
  })
  const provider = createProvider({ mode: 'demo' })
  await t.test('complete API journey, ownership, idempotency and cascading deletion', async () => {
    const app = createApp(store, { limits: false })
    const agent = request.agent(app),
      stranger = request.agent(app)
    const { id, jobId } = (await post(agent, '/api/sessions', input).expect(202)).body
    await stranger.get(`/api/jobs/${jobId}`).expect(404)
    await processOne(store, provider, 0)
    const session = (await agent.get(`/api/sessions/${id}`).expect(200)).body
    assert.equal(session.plan.questions.length, 6)
    assert.equal(
      (await pool.query('SELECT input FROM sessions WHERE id=$1', [id])).rows[0].input.includes(
        'resume',
      ),
      false,
    )
    for (const question of session.plan.questions) {
      const payload = {
        questionId: question.id,
        answer: 'I built a tested dashboard and measured fewer errors after deployment.',
      }
      const first = (await post(agent, `/api/sessions/${id}/answers`, payload).expect(202)).body
      assert.equal(
        (await post(agent, `/api/sessions/${id}/answers`, payload).expect(202)).body.id,
        first.id,
      )
      await post(agent, `/api/sessions/${id}/answers`, {
        ...payload,
        answer: 'A completely different answer.',
      }).expect(409)
      await processOne(store, provider, 0)
      assert.equal((await agent.get(`/api/jobs/${first.id}`).expect(200)).body.result.score, 65)
    }
    await agent.get('/health/ready').expect(200)
    await agent.delete(`/api/sessions/${id}`).set('X-MockMate-Request', '1').expect(204)
    assert.equal((await store.jobs(id)).length, 0)
  })
  await t.test(
    'concurrent claims, expired leases, stale completion fencing and bounded retries',
    async () => {
      const { id, jobId } = await store.create('lease-owner', input, 'demo')
      const now = Date.now() + 1000
      const claims = await Promise.all([store.claim(now, 0), store.claim(now, 0)])
      assert.equal(claims.filter(Boolean).length, 1)
      const first = claims.find(Boolean)
      const second = await store.claim(now + 60001, 0)
      assert.equal(second.attempts, 2)
      await store.complete(first, { stale: true })
      assert.equal((await store.job(jobId, 'lease-owner')).status, 'running')
      await store.fail(second, { code: 'RATE_LIMIT', retryAfter: 10000 }, now + 60002)
      assert.equal(await store.claim(now + 61000, 0), null)
      const third = await store.claim(now + 71000, 0)
      assert.equal(third.attempts, 3)
      await store.fail(third, { code: 'UNAVAILABLE' }, now + 71001)
      assert.equal((await store.job(jobId, 'lease-owner')).status, 'failed')
      await store.remove(id, 'lease-owner')
      await pool.query("UPDATE runtime SET value=0 WHERE key='next_provider_call'")
    },
  )
  await t.test('retention and admission limits', async () => {
    for (let n = 0; n < 30; n++) await store.create('capacity-owner', input, 'demo')
    await assert.rejects(store.create('capacity-owner', input, 'demo'), { status: 429 })
    await pool.query('UPDATE sessions SET created=$1', [Date.now() - 8 * 86400000])
    await store.prune()
    assert.equal((await store.list('capacity-owner')).length, 0)
    assert.equal(await store.pending(), 0)
  })
})
