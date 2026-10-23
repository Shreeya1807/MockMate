# HTTP API

The UI and API share an origin. JSON responses include `X-Request-ID`; `/api` responses are `Cache-Control: no-store`. Use JSON bodies and `X-MockMate-Request: 1` for mutations. If an Origin header is present, it must exactly match `APP_ORIGIN`. There is no cross-origin CORS allowance.

The server creates an HttpOnly SameSite browser capability cookie. Preserve cookies between requests. Knowing a session or job UUID is not authorization: another browser receives 404. This is anonymous browser ownership, not user-account authentication.

| Method | Route                       | Result                                                                     |
| ------ | --------------------------- | -------------------------------------------------------------------------- |
| GET    | `/api/config`               | Mode, retention, optional public ICE connection configuration              |
| GET    | `/api/sessions`             | Up to 50 owned session summaries, newest first                             |
| POST   | `/api/sessions`             | 202 `{ id, jobId }`; creates plan job                                      |
| GET    | `/api/sessions/:id`         | Owned session, plan, and sanitized job states/results                      |
| DELETE | `/api/sessions/:id`         | 204; cascades jobs/results                                                 |
| POST   | `/api/sessions/:id/answers` | 202 job; idempotent per question and identical answer                      |
| GET    | `/api/jobs/:id`             | Owned job status, attempt count, result, safe error code                   |
| GET    | `/health/live`              | 200 while HTTP process runs                                                |
| GET    | `/health/ready`             | 200 when DB accessible and worker heartbeat <15 seconds old, otherwise 503 |
| GET    | `/metrics`                  | Prometheus gauges; requires `Authorization: Bearer <METRICS_TOKEN>`        |

## Create a session

```json
{
  "resume": "At least fifty characters describing your projects and experience...",
  "role": "Software Engineer",
  "level": "mid"
}
```

Bounds: resume 50–24,000 characters; role 2–100; level `junior`, `mid`, or `senior`. Unknown fields are rejected. The JSON request body is limited to 128 KB.

## Submit an answer

```json
{
  "questionId": 1,
  "answer": "I investigated the incident, measured the slow query, and verified the fix with a regression test."
}
```

Question ID is 1–6; trimmed answer length is 5–8,000 characters. A plan must exist before submitting. A different answer after submission gets 409; use a new session for a second attempt at the whole interview.

## Job response

```json
{
  "id": "job-uuid",
  "kind": "evaluation",
  "questionId": 1,
  "status": "queued",
  "attempts": 0,
  "error": null,
  "result": null
}
```

States: `queued`, `running`, `completed`, `failed`. Evaluation results include `score`, `strengths`, `improvements`, `exampleAnswer`, `question`, and `answer`. Plan results include `introduction` and `questions`. Evaluation jobs also return a sanitized `submission` containing the question and original answer, so failed or pending work remains reviewable and exportable. Internal payloads, ownership hashes, and credentials are never returned.

## Error semantics

- 400: invalid JSON or schema (field details included for validation errors).
- 403: missing mutation header or wrong Origin.
- 404: missing resource or not owned by this browser.
- 409: plan not ready or conflicting answer.
- 413: request too large.
- 429: more than 180 API requests/minute/IP, 12 submissions/minute/IP, or 30 retained sessions/browser.
- 503: queue already contains 100 pending/running jobs, or readiness failure.

Job error codes distinguish invalid model output, HTTP provider failures, timeouts, and evaluation mode changes. External provider response bodies are not exposed. Retryable provider errors are 408, 429, 5xx, transport failures, and malformed output. Authentication/model configuration errors fail without repeated calls.

## Signaling protocol

The browser connects to `/socket.io` using WebSocket transport. Origin must equal `APP_ORIGIN`. `create(callback)` returns a private room capability; `join(room, callback)` reserves the second participant. The host receives `peer-ready`; clients exchange `signal` messages of type `offer`, `answer`, or `candidate`. `peer-left` signals departure. Invitations grant video participation only, never access to interview answers.
