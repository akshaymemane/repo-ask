# ADR 0001 — M0 foundation: storage, jobs, secrets, workspace summary

Status: Accepted (CONTRACT-01), see coordinator review-r2 | Date: 2026-11-13
Contract: [docs/contracts/README.md](../contracts/README.md) `opendevin.m0/1`
Requirements: OP-01, OP-02, OP-04, OP-09, UX-02, UX-08, UX-10

## Context

The shipped prototype is a read-only loopback server (`repoask/__main__.py`) with an
in-memory SQLite FTS index and vanilla web assets. M0 must add durable storage, a job
skeleton and a secret abstraction without breaking the demo, adding dependencies or
implying GitHub, provider-profile or execution support.

## Decisions

| # | Decision | Why | Consequence / migration implication |
| --- | --- | --- | --- |
| D1 | Standard-library `sqlite3` plus a ~100-line in-repo migration runner. No ORM, no Alembic. | No dependency installs; schema is small. | Migrations are append-only Python data with SHA-256 checksums. One owner allocates numbers (coordinator). |
| D2 | Persistence is opt-in in M0 via `--data-dir PATH`; without it the platform uses `:memory:` and reports `persistent: false`. | Demo keeps working with zero disk writes; no premature home-directory convention. | Default-on location is an open decision for M1 (needed once GitHub tokens/catalog exist). |
| D3 | One SQLite connection per process, guarded by a `threading.Lock`; writes use `BEGIN IMMEDIATE`. WAL + `synchronous=FULL` on file DBs. | Mirrors `CodeIndex`; avoids per-thread connection bugs under `ThreadingHTTPServer`; durability over throughput. | Benchmark before adding a pool (F12 "benchmark concurrency before increasing limits"). |
| D4 | Jobs live in one `jobs` table. Ownership = matching `lease_token` while `state='leased'`. Expired leases are reconciled before reassignment; `effect='external'` jobs never auto-requeue and go to `needs_reconciliation`. | OP-02, OP-06, F12 acceptance 2. Simple and testable with an injected clock. | No attempt-history table in M0; add in M1 if diagnostics need it (new migration). |
| D5 | Secret store fails closed. The only runtime backend shipped in M0 is `UnavailableSecretStore`. The in-memory double lives under `tests/` only. | OP-04: no plaintext DB fallback; nothing in M0 needs a real credential. | OS-backed backend is an M1 spike with the first consumer (F01/F07). DB holds only `secret_refs` metadata. |
| D6 | New M0 routes are GET-only and read-only: `/api/workspace`, `/api/health`. No state-changing route in M0. | Keeps loopback/Origin model unchanged; nothing to authorize yet. | `/api/jobs` and POST routes arrive with their first real consumer (M1). |
| D7 | UI navigation uses hash routes (`#/ask`, `#/repositories`, `#/settings`) in the existing vanilla app. | Server serves only `/`; no route table change for deep links (UX-03 partial). | Server-side history routes can come later without breaking hashes. |
| D8 | DB timestamps are INTEGER Unix milliseconds (UTC); new API JSON uses RFC 3339 UTC `YYYY-MM-DDTHH:MM:SS.sssZ`. Legacy `/api/repos.indexed_at` keeps its current `isoformat()` value. | Integer compare for leases; one unambiguous wire format. | Consumers must not reparse legacy fields to the new format. |

## Rejected / deferred alternatives

- Separate worker process or external queue (Redis/Celery): unnecessary for single host; violates no-dependency rule.
- Encrypted-file secret store with key in env: possible later "explicitly configured encrypted store" (OP-04), needs key-handling review; not required by M0.
- Persisting the FTS index in M0: belongs to F02/M1-INDEX; current in-memory index stays.

## Open decisions (owner: coordinator, unless noted)

1. Default data-dir location and whether persistence becomes default-on (M1).
2. First OS secret backend (macOS Keychain via `security` passes values in argv — visible to `ps`; needs stdin-based or ctypes approach). Owner: M1 integration/platform spike.
3. Repository identity migration from `name` to GitHub numeric ID (`gh:<id>`) — M1-GITHUB contract.
