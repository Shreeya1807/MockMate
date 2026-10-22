# Résumé claim audit

The original repository at `bc6e88c` was a React/Vite prototype. This table separates what already existed from what the upgrade implements. Feature implementation is not evidence that it ran in production or was completed during an earlier date range.

| Original claim                             | Prototype                          | Current implementation and evidence                                                                                                                          |
| ------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| React/Vite interview platform              | Present                            | Responsive studio in `src/App.jsx` and components                                                                                                            |
| Parsed resumes into personalized questions | PDF extraction + direct client API | PDF/TXT parsing, role/seniority context, server-side generation in `src/resume.js`, `server/provider.js`                                                     |
| OCR                                        | Absent                             | Image and scanned-PDF OCR; browser regression tests exercise the real Tesseract worker                                                                       |
| Automated LLM feedback                     | Unstructured feedback text         | Validated score, strengths, improvements and examples in `server/contracts.js` and `server/provider.js`; actual live service requires configured credentials |
| WebRTC live interviews                     | Local webcam preview only          | Two-peer signaling and `RTCPeerConnection` in `server/signaling.js` and `MediaPanel.jsx`; browser test establishes a connection with fake camera devices     |
| Browser speech APIs                        | Present with cleanup gaps          | Optional dictation, question playback, error handling and cleanup                                                                                            |
| Queued evaluation workers                  | Absent                             | Persistent SQLite jobs, async consumers, optional separate process; `server/store.js` and `server/worker.js`                                                 |
| Bounded retries and rate limiting          | Absent                             | Three-attempt policy, backoff, shared pacing, provider cooldown, request/queue caps; API regressions                                                         |
| Structured LLM response validation         | Basic JSON parse only              | Strict JSON-schema request + Zod and semantic plan checks                                                                                                    |
| Regression tests in CI                     | Absent                             | Node API/queue tests + Playwright journeys + GitHub quality gates                                                                                            |
| DevOps delivery                            | Absent                             | Docker/Compose, readiness, metrics, backup, CodeQL, Dependabot, GHCR and opt-in Render delivery                                                              |

## Suggested bullets after reviewing and understanding the code

- Built a full-stack React/Vite interview platform with PDF and OCR résumé ingestion, role-specific LLM questions, structured feedback, browser speech, and two-person WebRTC practice.
- Implemented durable SQLite evaluation jobs with atomic leases, idempotent submissions, bounded retries, provider pacing, and schema validation; added API and browser regression tests.
- Added non-root Docker deployments, health probes, backup tooling, and GitHub Actions quality/security checks, with container publishing and a configurable deployment workflow.

Use “deployed” only after actually configuring and running the hosting workflow. Do not claim benchmarked scalability, enterprise users, accuracy improvements, or uptime unless measured. If the résumé keeps May–June 2026, distinguish the later upgrade or revise the date range to reflect when the new work was completed. This upgrade was implemented in October 2026.

## Explain these decisions in an interview

1. Why the API returns 202 and polling tracks a durable job.
2. How a unique database constraint prevents duplicate local evaluation work.
3. Why leases plus an attempt fence avoid stale results, but do not guarantee exactly-once provider billing.
4. How provider timeouts, retries, and a shared cooldown bound failure behavior.
5. Why a webcam preview alone is not a peer WebRTC interview.
6. What SQLite simplifies, and which components need replacement before horizontal scaling.
7. Why demo examples must remain distinguishable from real model assessments.
