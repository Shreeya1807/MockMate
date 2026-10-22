# Deployment and operations

## Local modes

`npm run dev` runs Vite on 5173 and the API plus embedded workers on 3001. The Vite proxy forwards `/api`, `/health`, and `/socket.io`. Use `APP_ORIGIN=http://localhost:5173`.

After `npm run build`, `npm start` serves the UI and API together. Set `APP_ORIGIN=http://localhost:3001`. `WORKER_MODE=external` disables the embedded worker; run `npm run worker` against the same local `DATABASE_PATH`.

## Container deployment

```bash
docker compose config --quiet
docker compose up --build -d --wait
docker compose logs -f api worker
```

The API binds to host loopback at 3001. Both containers use the `mockmate-data` volume and UID 1000. The root filesystem is read-only, `/tmp` is a tmpfs, and Linux capabilities are dropped. Keep API and workers on the same host and local disk. Do not scale the API independently with the current in-process rate limiter and signaling map. Compose requires 2.24+ for optional `env_file` support.

An example Caddy reverse-proxy configuration on the host:

```caddyfile
mockmate.example.com {
  reverse_proxy 127.0.0.1:3001
}
```

Replace the domain with your own, configure DNS, set `APP_ORIGIN=https://your-domain`, and set `TRUST_PROXY=1` only when one trusted reverse proxy is the sole route to the API. WebSocket upgrades must be forwarded. HTTPS enables secure cookies and camera access remotely. `localhost` remains valid for development.

## Environment settings

| Variable                                       | Purpose                                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `AI_MODE`                                      | `demo` (default) or `live`                                                               |
| `OPENROUTER_API_KEY`                           | Server-only provider credential                                                          |
| `OPENROUTER_MODEL`                             | Explicit model ID supporting strict JSON schema                                          |
| `APP_ORIGIN`                                   | Exact browser origin, no trailing slash                                                  |
| `PORT`                                         | HTTP port; default 3001                                                                  |
| `DATABASE_PATH`                                | Writable SQLite path; default `data/mockmate.sqlite`                                     |
| `WORKER_MODE`                                  | `embedded` locally; `external` for Compose API                                           |
| `TRUST_PROXY`                                  | `1` only behind the configured single trusted proxy                                      |
| `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` | Optional WebRTC relay; ICE credentials are necessarily delivered to clients              |
| `METRICS_TOKEN`                                | Bearer secret protecting `/metrics`; unset disables access                               |
| `APP_REVISION`                                 | Optional build revision for readiness; Render supplies `RENDER_GIT_COMMIT` automatically |

Never use a `VITE_` prefix for provider credentials. Restrict the provider key's spend, rotate it if it was previously exposed in a browser bundle, and restart the API and worker together after configuration changes. TURN credentials should be scoped/short-lived; the app does not implement a TURN credential-minting service.

## GitHub CI and release

Quality gates install the lockfile, lint, check formatting, run API tests, audit dependencies, build, and run Chromium E2E tests. A second job builds Compose and checks readiness. CodeQL and Dependabot are configured separately. Require the quality and container jobs in branch protection.

Release tags matching `v*` or a manual release workflow rerun all quality gates before publishing `ghcr.io/shreeya1807/mockmate:sha-<commit>`. The token needs repository package permissions, which the publish job requests. Package visibility/access must be configured in GHCR if you want anonymous pulls.

Optional Render setup:

1. Connect the repository to Render and create a Blueprint from `render.yaml`. Review the paid compute and disk configuration before creating resources.
2. Set the service's exact HTTPS `APP_ORIGIN`. Keep `AI_MODE=demo` initially; enable live mode only with a compatible model/key.
3. Confirm `/health/ready` is ready. A persistent disk must be writable by the non-root container user.
4. Create a GitHub environment named `production`. Store `RENDER_DEPLOY_HOOK` (the complete secret URL, including its key query parameter) and `PRODUCTION_HEALTH_URL` (the public HTTPS `/health/ready` URL).
5. Set repository variable `DEPLOY_ENABLED=true`. The release workflow appends `ref=<tested SHA>` to the Render hook and waits for readiness **at that SHA**. Set an environment approval rule if your team requires one.

This integration follows [Render deploy hooks](https://render.com/docs/deploy-hooks) and its [Blueprint specification](https://render.com/docs/blueprint-spec). Render builds the verified Git commit; GHCR publishing is a separate deliverable. No deployment occurs when `DEPLOY_ENABLED` is absent/false. CI configuration cannot prove successful cloud delivery until credentials and a target are connected.

## Observe and diagnose

- `/health/live`: process availability.
- `/health/ready`: database access, recent worker heartbeat, deployed revision. It does **not** prove the upstream AI provider is healthy.
- `/metrics`: job counts by status and worker readiness, protected by a bearer token. Use your monitoring system's secret configuration for the header.
- JSON logs include request ID, method, status, and latency, without bodies, resume text, tokens, query strings, or invite URLs.

Investigate growing queued work, failed evaluations, sustained 429s, stale heartbeat, and disk exhaustion. Log/metric retention is an operator responsibility. No uptime SLA or performance benchmark is claimed.

| Symptom                                      | Check                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| 403 on submissions or video connection fails | Browser origin exactly matches `APP_ORIGIN`; restart after changes                   |
| Sessions unavailable in another tab/browser  | Same origin and capability cookie; different browsers are intentionally isolated     |
| Queued jobs never progress                   | Worker running, same database path, `/health/ready`, disk permissions                |
| `PROVIDER_HTTP_401` / 403                    | Key validity and provider access                                                     |
| `PROVIDER_HTTP_400` / invalid model output   | Model supports requested schema and parameters                                       |
| `PROVIDER_HTTP_429`                          | Provider quota; queued retries honor bounded cooldown                                |
| `AI_MODE_CHANGED`                            | Session was created under another mode; start a new session with appropriate consent |
| Video works locally but not remotely         | HTTPS, proxy WebSocket support, TURN credentials and network restrictions            |
| OCR cannot load                              | Browser network/CSP allows public engine and language assets; paste text as fallback |

## Backup and restore

```bash
npm run backup
# Or choose a destination explicitly:
npm run backup -- backups/pre-release.sqlite
```

This uses SQLite's online backup API and creates a consistent database snapshot while WAL writes may be active. Do not copy only the main `.sqlite` file from an active deployment. In Compose, write the snapshot to the writable volume, then copy it out:

```bash
docker compose exec api node scripts/backup.js /app/data/pre-release.sqlite
docker compose cp api:/app/data/pre-release.sqlite ./pre-release.sqlite
```

Backups contain sensitive interview data. Encrypt off-host copies, restrict access, and enforce a retention policy separately from the seven-day application expiry. A restore reintroduces data retained in the snapshot, including previously deleted sessions.

To restore: stop both API and worker; preserve the current database and its WAL/SHM companions as a recovery set; place the verified backup at `DATABASE_PATH`; ensure no stale WAL/SHM files remain at that path; restore UID/permissions; start services; check readiness and a known session. Perform this in a test environment first. Never restore over a running database.

## Rollback and schema changes

Before releasing, create a verified backup. The current schema is version 1 and initialized idempotently; future schema changes need explicit, tested migrations. On a bad release, use Render's prior successful deployment or redeploy a known-good commit. For manual containers, run the previous image revision. Preserve the data volume. Verify readiness, revision, and a sample flow after rollback. Restore a backup only when schema compatibility requires it, acknowledging loss of post-backup data.

Persistent-disk deployments are single-instance; maintenance/restarts can interrupt video rooms. Queue leases recover unfinished work within 60 seconds. In-flight provider requests may be billed more than once after a crash. The workflow detects a failed deployment and stops; rollback remains an explicit operator action.
