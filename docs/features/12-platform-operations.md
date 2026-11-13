# F12 — Persistence, background jobs and local operations

Status: Draft | Milestone: M0 onward | Parent: [Master PRD](../../Master%20PRD.md)

## Outcome and deployment boundary

Provide a reliable single-user, self-hosted foundation for durable context, conversations and execution. The application binds to loopback by default. Remote hosting, multiple users and tenant isolation require a separate authentication/TLS design and are not implicitly supported.

Retain Python for the initial migration. SQLite is the primary metadata/FTS store; a local vector backend and filesystem artifact/cache directories support bounded workloads. Split request handling, durable workers and execution runner responsibilities even if initially shipped together.

## Functional requirements

- **OP-01:** Use versioned SQLite migrations, foreign-key constraints, transactional state changes and a documented backup/restore path. Existing demos remain runnable throughout migration.
- **OP-02:** Persist indexing, summarization, provider and publication jobs with leases, checkpoints, attempt counts, retry classification and cancellation. Expired leases require reconciliation before reassignment.
- **OP-03:** Enforce configurable worker/session concurrency, priority, backpressure and per-job budgets. Default active implementation concurrency is one until the user increases it within host limits.
- **OP-04:** Store credentials through an OS-backed secret store or an explicitly configured encrypted store with its key outside the database. No plaintext database fallback. Missing secure storage blocks connection setup with guidance.
- **OP-05:** Persist append-only session events with a per-session sequence and bounded log artifacts. Redact secrets before persistence and before streaming.
- **OP-06:** Make Start session and publication idempotent. For unknown external outcomes, reconcile durable operation IDs/branches before retrying.
- **OP-07:** Keep endpoint origin/host protections for local browser requests; require validated input, opaque IDs and path containment. A local web server is not permission to expose host files or arbitrary commands.
- **OP-08:** Enforce timeouts and resource/network policy outside the model. Untrusted repository, skill and tool content cannot change grants.
- **OP-09:** Provide storage usage, queue health, worker health, runner health and recent failures without leaking prompt/source content into diagnostics.
- **OP-10:** Provide explicit export, retention and purge controls for repository caches, snapshots, conversations, memory, session logs and artifacts.
- **OP-11:** Default telemetry is off. Optional diagnostics exclude prompts, source, secrets and private repository names and can be previewed.
- **OP-12:** Shutdown stops accepting new jobs, checkpoints resumable workers and either safely stops runners or marks them interrupted after reconciliation. Restart never infers success from an absent process.

## Persistence and lifecycle rules

| Data | Default lifecycle | User control |
| --- | --- | --- |
| Catalog, plans and conversations | Retain until deleted | Export/delete |
| Active code index | Retain while enabled and within quota | Exclude/rebuild/purge |
| Citation snapshots | Retain while referenced, subject to quota and explicit purge | Show affected citations before cleanup |
| Session logs/artifacts | Retain until deleted; default cleanup suggestion after 30 days | Configurable retention and immediate purge |
| Disposable runner workspaces | Remove after verified artifact checkpoint/retention choice | Retain temporarily for debugging |
| Secrets | Retain in secret store while connected | Revoke/disconnect/delete |
| Memory and customization | Retain until edited/deleted/expired | Version, export and purge |

Quota pressure must not silently evict source underlying a visible citation. If users choose deletion, render unavailable/redacted placeholders. Audit records store minimal IDs and event metadata, not deleted content.

Permanent deletion removes target text, vectors, cache files and duplicated context payloads from active stores. Historical plans/events retain tombstones where necessary; immutable version identity does not justify retaining deleted content. Explain that backups and already-shared external data require separate handling. Access revocation immediately blocks retrieval even before background physical cleanup completes.

## Suggested entity ownership

Connection service owns installations/capabilities. Index service owns snapshots/chunks/embedding namespaces. Ask owns messages/plan versions. Session service owns attempts/events/validation and references publication operations. Customization services own versioned skills/plugins/memory. Shared IDs and foreign-key relationships preserve provenance without embedding credentials.

Artifact paths are generated from internal IDs, never arbitrary request paths. Database and vector activation use a commit marker/generation so an interrupted index build cannot become visible as complete. Serialize SQLite writes appropriately and benchmark concurrency before increasing limits.

## Proposed operator interfaces

`GET /api/health` exposes bounded local health; `GET /api/jobs` and job detail expose queue progress; settings expose budgets, storage and retention; explicit backup/restore tooling documents which directories and database files belong together. Backup uses a consistent SQLite snapshot and includes vector namespace metadata and artifact manifests; secret material is excluded unless separately exported through a secure process.

## Failure and recovery

Disk full stops new indexing/provisioning while preserving readable data and offers cleanup. SQLite contention retries within bounded limits. Corrupt indexes are rebuildable from permitted source; corrupt primary metadata requires restoration rather than silent reset. Lost runner ownership blocks resumption until reconciled. Restore validates schema version, integrity and artifact references before accepting new work.

## Acceptance criteria

1. Upgrade/restart preserves catalog, conversation, plan, job and session records; migration failure leaves a recoverable previous database.
2. Worker death requeues safe work after lease expiry, but uncertain publication reconciles before any repeat write.
3. Two retries of Start session with one idempotency key create one durable session; repeated publication creates one PR.
4. A backup restores into a fresh instance with matching entity counts and valid citation/artifact references; missing secrets require reconnect.
5. Purge removes content and vectors from active stores and replaces affected historical references with explicit tombstones.
6. Disk pressure yields an actionable paused/blocked state without deleting pinned citation data or reporting success.
7. Secret fixtures never appear in normal API responses, events, diagnostics, plan export or database backups.
8. A restart during active execution reports interrupted/reconciled status and does not start an unowned duplicate runner.

## Dependencies and delivery measures

This is the foundation for all other features. Runner integration depends on the selected F07 adapter; publication reconciliation uses the F06 operation contract. Deliver foundational slices before dependent feature work.

M0: schema/migrations, job skeleton, secret abstraction and basic health. M1: durable indexing and provider usage. M2: runner reconciliation, artifacts and publication idempotency. M3: customization retention/deletion. Measure recovery success, queue waits, write contention, storage growth and unresolved operations; report content-free operational metrics locally.
