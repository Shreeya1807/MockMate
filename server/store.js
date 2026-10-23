import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'

export function openStore(path = process.env.DATABASE_PATH || 'data/mockmate.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, owner TEXT NOT NULL, input TEXT NOT NULL, plan TEXT, created INTEGER NOT NULL, mode TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_owner ON sessions(owner, created);
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, question_id INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0,
      available INTEGER NOT NULL, lease INTEGER, result TEXT, error TEXT,
      UNIQUE(session_id, kind, question_id));
    CREATE INDEX IF NOT EXISTS jobs_ready ON jobs(status, available);
    CREATE TABLE IF NOT EXISTS runtime (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
    PRAGMA user_version=1;`)
  const one = (sql, ...args) => db.prepare(sql).get(...args)
  return {
    db,
    kind: 'sqlite',
    close: () => db.close(),
    ping: () => one('SELECT 1'),
    mode: (id) => one('SELECT mode FROM sessions WHERE id=?', id)?.mode,
    pending: () => one("SELECT count(*) AS n FROM jobs WHERE status IN ('queued','running')").n,
    counts: () => db.prepare('SELECT status,count(*) AS count FROM jobs GROUP BY status').all(),
    create(owner, input, mode) {
      const id = randomUUID(),
        jobId = randomUUID(),
        now = Date.now()
      db.exec('BEGIN IMMEDIATE')
      try {
        if (one('SELECT count(*) AS n FROM sessions WHERE owner=?', owner).n >= 30)
          throw Object.assign(new Error('Session limit reached'), { status: 429 })
        if (one("SELECT count(*) AS n FROM jobs WHERE status IN ('queued','running')").n >= 100)
          throw Object.assign(new Error('The queue is full. Try again shortly.'), { status: 503 })
        db.prepare('INSERT INTO sessions VALUES (?, ?, ?, NULL, ?, ?)').run(
          id,
          owner,
          JSON.stringify(input),
          now,
          mode,
        )
        db.prepare(
          'INSERT INTO jobs(id,session_id,kind,payload,available) VALUES (?, ?, ?, ?, ?)',
        ).run(jobId, id, 'plan', JSON.stringify(input), now)
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
      return { id, jobId }
    },
    session(id, owner) {
      return one('SELECT * FROM sessions WHERE id=? AND owner=?', id, owner)
    },
    list(owner) {
      return db
        .prepare(
          'SELECT id,input,created,mode FROM sessions WHERE owner=? ORDER BY created DESC LIMIT 50',
        )
        .all(owner)
        .map((s) => ({
          id: s.id,
          role: JSON.parse(s.input).role,
          created: s.created,
          mode: s.mode,
        }))
    },
    enqueue(sessionId, questionId, payload) {
      const existing = () =>
        one(
          'SELECT * FROM jobs WHERE session_id=? AND kind=? AND question_id=?',
          sessionId,
          'evaluation',
          questionId,
        )
      db.exec('BEGIN IMMEDIATE')
      try {
        const previous = existing()
        if (previous) {
          const answer = JSON.parse(previous.result || previous.payload).answer
          if (answer !== payload.answer)
            throw Object.assign(new Error('This question already has a submitted answer'), {
              status: 409,
            })
          db.exec('COMMIT')
          return previous
        }
        if (one("SELECT count(*) AS n FROM jobs WHERE status IN ('queued','running')").n >= 100)
          throw Object.assign(new Error('The queue is full. Try again shortly.'), { status: 503 })
        db.prepare(
          'INSERT INTO jobs(id,session_id,kind,question_id,payload,available) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(
          randomUUID(),
          sessionId,
          'evaluation',
          questionId,
          JSON.stringify(payload),
          Date.now(),
        )
        const job = existing()
        db.exec('COMMIT')
        return job
      } catch (error) {
        db.exec('ROLLBACK')
        throw error
      }
    },
    job(id, owner) {
      return one(
        'SELECT jobs.* FROM jobs JOIN sessions ON sessions.id=jobs.session_id WHERE jobs.id=? AND sessions.owner=?',
        id,
        owner,
      )
    },
    jobs(id) {
      return db.prepare('SELECT * FROM jobs WHERE session_id=? ORDER BY question_id').all(id)
    },
    claim(now = Date.now(), interval = 1000) {
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare(
          "UPDATE jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,error='Worker lease expired' WHERE status='running' AND lease<?",
        ).run(now)
        const next = one("SELECT value FROM runtime WHERE key='next_provider_call'")?.value || 0
        const job =
          next <= now
            ? one(
                "SELECT * FROM jobs WHERE status='queued' AND available<=? ORDER BY available LIMIT 1",
                now,
              )
            : null
        if (job) {
          db.prepare("UPDATE jobs SET status='running',attempts=attempts+1,lease=? WHERE id=?").run(
            now + 60000,
            job.id,
          )
          db.prepare("INSERT OR REPLACE INTO runtime VALUES ('next_provider_call', ?)").run(
            now + interval,
          )
        }
        db.exec('COMMIT')
        return job ? { ...job, attempts: job.attempts + 1, payload: JSON.parse(job.payload) } : null
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
    complete(job, result) {
      db.exec('BEGIN IMMEDIATE')
      try {
        const changed = db
          .prepare(
            "UPDATE jobs SET status='completed',result=?,payload='{}',error=NULL,lease=NULL WHERE id=? AND status='running' AND attempts=?",
          )
          .run(JSON.stringify(result), job.id, job.attempts).changes
        if (changed && job.kind === 'plan')
          db.prepare(
            "UPDATE sessions SET plan=?,input=json_remove(input,'$.resume') WHERE id=?",
          ).run(JSON.stringify(result), job.session_id)
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    },
    fail(job, error, now = Date.now()) {
      const retry = error.retryable !== false && job.attempts < 3
      const delay = Math.max(
        Math.min(error.retryAfter || 0, 120000),
        1000 * 2 ** (job.attempts - 1) + Math.floor(Math.random() * 500),
      )
      const changed = db
        .prepare(
          "UPDATE jobs SET status=?,available=?,error=?,lease=NULL WHERE id=? AND status='running' AND attempts=?",
        )
        .run(
          retry ? 'queued' : 'failed',
          now + delay,
          error.code || 'PROVIDER_UNAVAILABLE',
          job.id,
          job.attempts,
        ).changes
      if (changed && error.retryAfter > 0)
        db.prepare(
          "INSERT INTO runtime(key,value) VALUES ('next_provider_call',?) ON CONFLICT(key) DO UPDATE SET value=max(value,excluded.value)",
        ).run(now + delay)
    },
    heartbeat() {
      db.prepare("INSERT OR REPLACE INTO runtime VALUES ('worker_heartbeat', ?)").run(Date.now())
    },
    ready() {
      return (
        Date.now() - (one("SELECT value FROM runtime WHERE key='worker_heartbeat'")?.value || 0) <
        15000
      )
    },
    prune() {
      db.prepare('DELETE FROM sessions WHERE created<?').run(Date.now() - 7 * 86400000)
    },
    remove(id, owner) {
      return db.prepare('DELETE FROM sessions WHERE id=? AND owner=?').run(id, owner).changes
    },
  }
}
