# Security and data handling

Report a suspected vulnerability privately to the repository owner through GitHub's private vulnerability reporting when available. Do not publish keys, real resumes, or interview recordings in issues.

## Protections implemented

- Provider credentials remain on the server. `.env`, local databases, backups and browser test outputs are ignored by Git.
- Ownership uses a random 256-bit browser capability in an HttpOnly, SameSite=Strict cookie. Production HTTPS origins enable Secure cookies; the database stores only a hash.
- Mutations require a custom header and enforce the configured Origin. No cross-origin API access is enabled.
- Helmet headers/CSP, input schemas, parameterized SQL, payload limits, rate limits, and bounded jobs constrain requests.
- Model outputs are validated before persistence. Models receive no execution tools. Job error messages expose safe codes instead of raw provider payloads.
- Media access is opt-in; tracks are stopped on leave/unmount. Video is neither recorded nor sent to the evaluation service.

## Where data goes

PDF extraction and English OCR run in browser workers. Engine/language files load from public CDNs; fonts may load from Google Fonts. Original files are not uploaded to MockMate. The reviewed extracted text is submitted to the server only after consent. In live mode, resume text is sent to OpenRouter/model providers for questions, and answers plus their questions/context are sent for evaluation. Their processing/retention policies apply.

The raw resume is removed from active session input and successful plan-job payload after generation. Derived questions/feedback and submitted answers remain until deletion or seven-day expiry. Failed plan payloads may retain resume text until expiry. SQLite deletes are logical removal, not guaranteed forensic erasure; backups and provider retention are separate. Use encrypted disks and restricted host access.

Browser speech recognition may process audio through the browser vendor. Peer media can expose network addresses to the other participant and uses a relay if TURN is configured. Anyone holding an invite can join the second seat. Do not post room links publicly. TURN credentials in ICE configuration are visible to participating browsers; never reuse unrelated infrastructure secrets.

## Boundaries

Browser capability ownership is not enterprise authentication or account recovery. Clearing cookies loses access to existing sessions. No authorization roles, SSO, abuse-proof public signup, or compliance certification are claimed. Public hosting with live evaluation needs a suitable access/cost policy in addition to these basic limits. Keep provider budgets bounded. An API key previously embedded in a `VITE_*` build should be rotated.

The API and room rate limits are process-local. Run one API instance with a trusted proxy configuration. Automated output can be wrong or influenced by input even when structurally valid; it is coaching, not an employment decision. Deleting a session cannot retract information already transmitted to a provider.
