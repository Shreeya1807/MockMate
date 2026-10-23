import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { randomBytes, createHash, randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { sessionInput, answerInput } from './contracts.js'

export const publicJob = (j) => {
  const result = j.result ? JSON.parse(j.result) : null
  const submitted = j.kind === 'evaluation' ? result || JSON.parse(j.payload) : null
  return {
    id: j.id,
    kind: j.kind,
    questionId: j.question_id,
    status: j.status,
    attempts: j.attempts,
    error: j.error,
    result,
    submission: submitted ? { question: submitted.question, answer: submitted.answer } : null,
  }
}
export function createApp(
  store,
  {
    mode = process.env.EVALUATION_MODE || 'demo',
    origin = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173',
    limits = true,
  } = {},
) {
  const app = express()
  app.disable('x-powered-by')
  // Set only when your reverse proxy is the sole trusted network hop.
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'wasm-unsafe-eval'", 'https://cdn.jsdelivr.net'],
          workerSrc: ["'self'", 'blob:'],
          connectSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://tessdata.projectnaptha.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          mediaSrc: ["'self'", 'blob:'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          upgradeInsecureRequests: null,
        },
      },
    }),
  )
  app.use((req, res, next) => {
    const id = randomUUID(),
      start = Date.now()
    res.setHeader('X-Request-ID', id)
    res.on('finish', () =>
      console.log(
        JSON.stringify({
          event: 'http',
          requestId: id,
          method: req.method,
          status: res.statusCode,
          durationMs: Date.now() - start,
        }),
      ),
    )
    next()
  })
  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }))
  app.get('/health/ready', async (_req, res) => {
    try {
      await store.ping()
      const ready = await store.ready()
      res.status(ready ? 200 : 503).json({
        status: ready ? 'ready' : 'worker unavailable',
        revision: process.env.RENDER_GIT_COMMIT || process.env.APP_REVISION || 'local',
      })
    } catch {
      res.status(503).json({ status: 'database unavailable' })
    }
  })
  app.get('/metrics', async (req, res) => {
    if (
      !process.env.METRICS_TOKEN ||
      req.get('Authorization') !== `Bearer ${process.env.METRICS_TOKEN}`
    )
      return res.status(401).end()
    const rows = await store.counts()
    const lines = [
      '# HELP mockmate_jobs Jobs by status.',
      '# TYPE mockmate_jobs gauge',
      ...rows.map((r) => `mockmate_jobs{status="${r.status}"} ${r.count}`),
      '# TYPE mockmate_worker_ready gauge',
      `mockmate_worker_ready ${(await store.ready()) ? 1 : 0}`,
    ]
    res.type('text/plain').send(lines.join('\n') + '\n')
  })
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store')
    next()
  })
  if (limits)
    app.use(
      '/api',
      rateLimit({
        windowMs: 60000,
        limit: 180,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { error: 'Too many requests. Try again shortly.' },
      }),
    )
  app.use('/api', (req, res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (req.get('X-MockMate-Request') !== '1' || (req.get('Origin') && req.get('Origin') !== origin))
    )
      return res.status(403).json({ error: 'Request origin rejected' })
    const cookie = req.headers.cookie
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('mm_owner='))
      ?.slice(9)
    const token = /^[a-f0-9]{64}$/.test(cookie || '') ? cookie : randomBytes(32).toString('hex')
    if (token !== cookie)
      res.cookie('mm_owner', token, {
        httpOnly: true,
        sameSite: 'strict',
        secure: origin.startsWith('https:'),
        maxAge: 7 * 86400000,
        path: '/',
      })
    req.owner = createHash('sha256').update(token).digest('hex')
    next()
  })
  app.use(express.json({ limit: '128kb' }))
  const writes = limits
    ? rateLimit({
        windowMs: 60000,
        limit: 12,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { error: 'Please wait before submitting more work.' },
      })
    : (_req, _res, next) => next()
  app.get('/api/config', (_req, res) =>
    res.json({
      mode,
      retentionDays: 7,
      iceServers: process.env.TURN_URL
        ? [
            {
              urls: process.env.TURN_URL,
              username: process.env.TURN_USERNAME,
              credential: process.env.TURN_CREDENTIAL,
            },
          ]
        : [],
    }),
  )
  app.get('/api/sessions', async (req, res) => res.json(await store.list(req.owner)))
  app.post('/api/sessions', writes, async (req, res) => {
    const input = sessionInput.parse(req.body)
    if ((await store.list(req.owner)).length >= 30)
      return res
        .status(429)
        .json({ error: 'Session limit reached. Delete an older session first.' })
    const pending = await store.pending()
    if (pending >= 100)
      return res.status(503).json({ error: 'The queue is full. Try again shortly.' })
    res.status(202).json(await store.create(req.owner, input, mode))
  })
  app.get('/api/sessions/:id', async (req, res) => {
    const session = await store.session(req.params.id, req.owner)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    const { role, level } = JSON.parse(session.input)
    res.json({
      id: session.id,
      role,
      level,
      mode: session.mode,
      created: session.created,
      plan: session.plan ? JSON.parse(session.plan) : null,
      jobs: (await store.jobs(session.id)).map(publicJob),
    })
  })
  app.delete('/api/sessions/:id', async (req, res) => {
    if (!(await store.remove(req.params.id, req.owner)))
      return res.status(404).json({ error: 'Session not found' })
    res.status(204).end()
  })
  app.post('/api/sessions/:id/answers', writes, async (req, res) => {
    const input = answerInput.parse(req.body),
      session = await store.session(req.params.id, req.owner)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    if (!session.plan) return res.status(409).json({ error: 'Interview questions are not ready' })
    const question = JSON.parse(session.plan).questions.find((q) => q.id === input.questionId)
    const existing = (await store.jobs(session.id)).find(
      (j) => j.question_id === input.questionId && j.kind === 'evaluation',
    )
    if (existing) {
      const previous = existing.result
        ? JSON.parse(existing.result).answer
        : JSON.parse(existing.payload).answer
      if (previous !== input.answer)
        return res.status(409).json({ error: 'This question already has a submitted answer' })
      return res.status(202).json(publicJob(existing))
    }
    if ((await store.pending()) >= 100)
      return res.status(503).json({ error: 'The queue is full. Try again shortly.' })
    const { role, level } = JSON.parse(session.input)
    res.status(202).json(
      publicJob(
        await store.enqueue(session.id, input.questionId, {
          question,
          answer: input.answer,
          role,
          level,
        }),
      ),
    )
  })
  app.get('/api/jobs/:id', async (req, res) => {
    const job = await store.job(req.params.id, req.owner)
    if (!job) return res.status(404).json({ error: 'Job not found' })
    res.json(publicJob(job))
  })
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }))
  const dist = resolve('dist')
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false }))
    app.get('/{*path}', (_req, res) => res.sendFile(resolve(dist, 'index.html')))
  }
  app.use((err, _req, res, _next) => {
    if ([409, 429, 503].includes(err.status))
      return res.status(err.status).json({ error: err.message })
    if (err.name === 'ZodError')
      return res.status(400).json({
        error: 'Invalid input',
        fields: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      })
    const status = err.status === 413 ? 413 : err instanceof SyntaxError ? 400 : 500
    res.status(status).json({
      error:
        status === 500
          ? 'Unexpected server error'
          : status === 413
            ? 'Request too large'
            : 'Invalid JSON',
    })
  })
  return app
}
