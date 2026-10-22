# Contributing

Use Node 22.20+ and `npm ci`. Work on a focused branch and keep commits reviewable. Run `npm run format`, `npm run check`, and `npm run test:e2e` before opening a pull request. Browser tests use synthetic resumes and simulated camera devices; never add real candidate data to fixtures.

Changes to queue or API semantics should include regression coverage for a failure case. Update the API reference and architecture notes when contracts change. Document new environment variables in `.env.example` and the operations runbook. Database schema changes require explicit versioned migration and rollback planning; do not silently mutate production data.

Use the explicit demo provider for deterministic tests and separate paid provider smoke tests from CI. Include screenshots for UI changes and describe accessibility or browser compatibility constraints. Do not add secrets or claim deployments/benchmarks without evidence.
