import { Pool } from 'pg'
import { randomUUID } from 'node:crypto'

// A single checked-out client owns every statement in each transaction.
export async function openPostgresStore(connectionString, suppliedPool) {
  const pool =
    suppliedPool ||
    new Pool({
      connectionString,
      max: 4,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 10000,
      statement_timeout: 15000,
    })
  if (!suppliedPool)
    pool.on('error', () => console.error(JSON.stringify({ event: 'database_connection_error' })))
  const query = (sql, values = []) => pool.query(sql, values)
  const one = async (sql, values = []) => (await query(sql, values)).rows[0]
  async function transaction(fn) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
  await transaction(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(71001)')
    await c.query(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, input TEXT NOT NULL, plan TEXT,
      created BIGINT NOT NULL, mode TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS sessions_owner ON sessions(owner,created);
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        kind TEXT NOT NULL, question_id INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0,
        available BIGINT NOT NULL, lease BIGINT, result TEXT, error TEXT,
        UNIQUE(session_id,kind,question_id));
      CREATE INDEX IF NOT EXISTS jobs_ready ON jobs(status,available);
      CREATE TABLE IF NOT EXISTS runtime (key TEXT PRIMARY KEY,value BIGINT NOT NULL);
      INSERT INTO runtime VALUES ('next_provider_call',0) ON CONFLICT DO NOTHING;`)
  })
  const normalize = (row) =>
    row
      ? {
          ...row,
          ...(row.created !== undefined ? { created: Number(row.created) } : {}),
          ...(row.available !== undefined
            ? {
                available: Number(row.available),
                lease: row.lease === null ? null : Number(row.lease),
              }
            : {}),
        }
      : undefined
  return {
    kind: 'postgres',
    close: () => pool.end(),
    ping: () => query('SELECT 1'),
    async mode(id) {
      return (await one('SELECT mode FROM sessions WHERE id=$1', [id]))?.mode
    },
    async pending() {
      return Number(
        (await one("SELECT count(*) AS n FROM jobs WHERE status IN ('queued','running')")).n,
      )
    },
    async counts() {
      return (await query('SELECT status,count(*) AS count FROM jobs GROUP BY status')).rows
    },
    async create(owner, input, mode) {
      return transaction(async (c) => {
        // Admission lock keeps backlog/browser caps correct under concurrent submissions.
        await c.query('SELECT pg_advisory_xact_lock(71002)')
        const retained = Number(
          (await c.query('SELECT count(*) AS n FROM sessions WHERE owner=$1', [owner])).rows[0].n,
        )
        const pending = Number(
          (await c.query("SELECT count(*) AS n FROM jobs WHERE status IN ('queued','running')"))
            .rows[0].n,
        )
        if (retained >= 30 || pending >= 100)
          throw Object.assign(new Error('Submission capacity reached'), {
            status: retained >= 30 ? 429 : 503,
          })
        const id = randomUUID(),
          jobId = randomUUID(),
          now = Date.now()
        await c.query('INSERT INTO sessions VALUES ($1,$2,$3,NULL,$4,$5)', [
          id,
          owner,
          JSON.stringify(input),
          now,
          mode,
        ])
        await c.query(
          'INSERT INTO jobs(id,session_id,kind,payload,available) VALUES ($1,$2,$3,$4,$5)',
          [jobId, id, 'plan', JSON.stringify(input), now],
        )
        return { id, jobId }
      })
    },
    async session(id, owner) {
      return normalize(await one('SELECT * FROM sessions WHERE id=$1 AND owner=$2', [id, owner]))
    },
    async list(owner) {
      return (
        await query(
          'SELECT id,input,created,mode FROM sessions WHERE owner=$1 ORDER BY created DESC LIMIT 50',
          [owner],
        )
      ).rows.map((s) => ({
        id: s.id,
        role: JSON.parse(s.input).role,
        created: Number(s.created),
        mode: s.mode,
      }))
    },
    async enqueue(sessionId, questionId, payload) {
      return transaction(async (c) => {
        await c.query('SELECT pg_advisory_xact_lock(71002)')
        const existing = (
          await c.query(
            "SELECT * FROM jobs WHERE session_id=$1 AND kind='evaluation' AND question_id=$2",
            [sessionId, questionId],
          )
        ).rows[0]
        if (existing) {
          const previous = existing.result
            ? JSON.parse(existing.result).answer
            : JSON.parse(existing.payload).answer
          if (previous !== payload.answer)
            throw Object.assign(new Error('This question already has a submitted answer'), {
              status: 409,
            })
          return normalize(existing)
        }
        if (
          Number(
            (await c.query("SELECT count(*) AS n FROM jobs WHERE status IN ('queued','running')"))
              .rows[0].n,
          ) >= 100
        )
          throw Object.assign(new Error('The queue is full. Try again shortly.'), { status: 503 })
        return normalize(
          (
            await c.query(
              "INSERT INTO jobs(id,session_id,kind,question_id,payload,available) VALUES ($1,$2,'evaluation',$3,$4,$5) RETURNING *",
              [randomUUID(), sessionId, questionId, JSON.stringify(payload), Date.now()],
            )
          ).rows[0],
        )
      })
    },
    async job(id, owner) {
      return normalize(
        await one(
          'SELECT jobs.* FROM jobs JOIN sessions ON sessions.id=jobs.session_id WHERE jobs.id=$1 AND sessions.owner=$2',
          [id, owner],
        ),
      )
    },
    async jobs(id) {
      return (
        await query('SELECT * FROM jobs WHERE session_id=$1 ORDER BY question_id', [id])
      ).rows.map(normalize)
    },
    async claim(now = Date.now(), interval = 1000) {
      return transaction(async (c) => {
        const next = Number(
          (await c.query("SELECT value FROM runtime WHERE key='next_provider_call' FOR UPDATE"))
            .rows[0].value,
        )
        await c.query(
          "UPDATE jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,error='Worker lease expired' WHERE status='running' AND lease<$1",
          [now],
        )
        if (next > now) return null
        const job = (
          await c.query(
            "SELECT * FROM jobs WHERE status='queued' AND available<=$1 ORDER BY available LIMIT 1 FOR UPDATE SKIP LOCKED",
            [now],
          )
        ).rows[0]
        if (!job) return null
        await c.query("UPDATE jobs SET status='running',attempts=attempts+1,lease=$1 WHERE id=$2", [
          now + 60000,
          job.id,
        ])
        await c.query("UPDATE runtime SET value=$1 WHERE key='next_provider_call'", [
          now + interval,
        ])
        return { ...normalize(job), attempts: job.attempts + 1, payload: JSON.parse(job.payload) }
      })
    },
    async complete(job, result) {
      return transaction(async (c) => {
        const changed = await c.query(
          "UPDATE jobs SET status='completed',result=$1,payload='{}',error=NULL,lease=NULL WHERE id=$2 AND status='running' AND attempts=$3 RETURNING id",
          [JSON.stringify(result), job.id, job.attempts],
        )
        if (changed.rows.length && job.kind === 'plan')
          await c.query(
            "UPDATE sessions SET plan=$1,input=(input::jsonb-'resume')::text WHERE id=$2",
            [JSON.stringify(result), job.session_id],
          )
      })
    },
    async fail(job, error, now = Date.now()) {
      const retry = error.retryable !== false && job.attempts < 3
      const delay = Math.max(
        Math.min(error.retryAfter || 0, 120000),
        1000 * 2 ** (job.attempts - 1) + Math.floor(Math.random() * 500),
      )
      return transaction(async (c) => {
        // Match claim's lock ordering to prevent cooldown/claim deadlocks.
        await c.query("SELECT value FROM runtime WHERE key='next_provider_call' FOR UPDATE")
        const changed = await c.query(
          "UPDATE jobs SET status=$1,available=$2,error=$3,lease=NULL WHERE id=$4 AND status='running' AND attempts=$5 RETURNING id",
          [
            retry ? 'queued' : 'failed',
            now + delay,
            error.code || 'PROVIDER_UNAVAILABLE',
            job.id,
            job.attempts,
          ],
        )
        if (changed.rows.length && error.retryAfter > 0)
          await c.query(
            "UPDATE runtime SET value=GREATEST(value,$1) WHERE key='next_provider_call'",
            [now + delay],
          )
      })
    },
    heartbeat: () =>
      query(
        "INSERT INTO runtime VALUES ('worker_heartbeat',$1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [Date.now()],
      ),
    async ready() {
      return (
        Date.now() -
          Number(
            (await one("SELECT value FROM runtime WHERE key='worker_heartbeat'"))?.value || 0,
          ) <
        15000
      )
    },
    prune: () => query('DELETE FROM sessions WHERE created<$1', [Date.now() - 7 * 86400000]),
    async remove(id, owner) {
      return (
        await query('DELETE FROM sessions WHERE id=$1 AND owner=$2 RETURNING id', [id, owner])
      ).rows.length
    },
  }
}
