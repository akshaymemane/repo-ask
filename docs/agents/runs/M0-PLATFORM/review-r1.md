# Review: M0-PLATFORM at exact commit `5f17042b91898398c85760e6549913027b7802bf`

**Verdict: CHANGES_REQUESTED.** The fixes go back to the Codex author.

- **Base:** `bd8c3afd18a6fe23dd984455c194743595935577`
- **Branch:** `task/m0-platform`
- **Packet:** `.git/opendevin-runtime/reviews/5f17042b…/`
- **Scope:** the diff touches only the assigned paths (`repoask/platform/`, `tests/test_platform_foundation.py`, `docs/agents/runs/M0-PLATFORM/`). No entrypoint, web or dependency edits.
- **What I did:** read-only review of the manifest, diff, snapshot files, `checks.txt`, contract §2–§6 and the fixtures. I ran no tests. The coordinator's 21 passing tests are noted, but they don't cover F1 or F2.

## Findings

**F1 — High — A cancel request is lost when a retryable failure requeues the job (OP-02)**
- **Where:** `snapshot/repoask/platform/jobs.py:190-197`, reached via `worker.py:47-48`.
- **Bug:** `fail(retryable=True)` puts the job back in `queued` and never checks `cancel_requested`, which stays 1. The job is then claimed and run again even though the user cancelled it.
- **Why it matters:** for an `external` job this re-runs a real-world action after cancellation. `_reconcile` (`jobs.py:138`) already lets cancellation beat a retry for expired safe leases; `fail` doesn't.
- **Repro:**
  1. `j = enqueue('test.x', {}, effect='external')`, then `l = claim('w')`.
  2. `cancel(j.id)` sets the flag but leaves the job leased.
  3. `fail(l, code='transient', retryable=True)` returns `queued` with `cancel_requested=True`.
  4. `clock.advance(2000)`, then `claim('w')` returns a new lease with attempts=2.
- **Fix:** if `cancel_requested` is set, go to `cancelled` (set `finished_at`) instead of retrying. Add a test.
- **Related:** `resolve_reconciliation(requeue)` (`jobs.py:230`) also keeps the stale flag. `test_external_expiry_and_manual_requeue` reaches that state but doesn't assert on it. Clear the flag there, or ask the coordinator to decide.

**F2 — Medium — Two processes starting on one data dir make one fail with `MigrationFailed` (OP-01)**
- **Where:** `snapshot/repoask/platform/migrations.py:22-44`.
- **Bug:** `recorded` and `pending` are read before `BEGIN IMMEDIATE` and never re-checked after the lock is taken.
- **Repro:** two processes call `Store.open` on a fresh data dir at the same time.
  1. Both read `recorded={}`.
  2. Process A commits v1.
  3. Process B gets the lock, runs `CREATE TABLE jobs`, hits "table jobs already exists", raises `MigrationFailed` and refuses to start.
- **Same race on upgrade:** both processes write the same `backups/opendevin.pre-vN.sqlite3` at once, which can corrupt that backup.
- **Why it matters:** contract §4 says running concurrent processes on one data dir is safe. `test_restart_backup_permissions_and_two_connections` opens the second connection only after migration is done, so it misses this.
- **Fix:** after `BEGIN IMMEDIATE`, re-read `schema_migrations` and skip versions already applied. Hold an exclusive lock (or check again) around the pre-upgrade backup.

**F3 — Medium — A handler result that isn't valid JSON crashes `run_once` and leaves the job leased**
- **Where:** `snapshot/repoask/platform/worker.py:54-58`.
- **Bug:** `complete()` raises `ValueError` from `json_object` (on a non-Mapping, NaN, or anything over 16 KiB). That happens in the inner `else:` block, which the handler's `except` clauses don't cover, and the outer block only catches `LeaseLost`. So the error escapes `run_once`.
- **Result:** the job stays `leased` until the lease expires. A safe job is then silently re-run, and an external job lands in `needs_reconciliation` coded `lease_expired` instead of `internal`.
- **Repro:** a handler that returns `[]` or `{'v': float('nan')}`.
- **Fix:** treat it like the "any other exception" row in the contract table: `fail(internal)` for safe jobs, `mark_unknown_outcome(internal)` for external jobs.

**F4 — Medium — Worker records `cancelled` for a handler that finished its work (unknown-outcome fidelity)**
- **Where:** `snapshot/repoask/platform/worker.py:55-56`.
- **Bug:** if a cancel was requested while the handler ran, the worker calls `acknowledge_cancel` even when the handler returned normally. The returned result is thrown away and the job ends as `cancelled`.
- **Why it matters:** for an external job the action may have completed. Recording a terminal "cancelled" misreports the outcome, which breaks the contract rule that the platform never invents an outcome.
- **Decision needed:** this may be intended, since the test `cancel_handler` relies on it. The handler needs an explicit way to say "I stopped" versus "I finished". Otherwise, complete when the handler returns normally, or send external jobs to `needs_reconciliation`. This is a coordinator contract call.

**F5 — Low — Health `recent_failures` includes jobs that didn't fail (OP-09)**
- **Where:** `snapshot/repoask/platform/jobs.py:238-243`, used by `workspace.py:37`.
- **Bug:** the query selects any row with `last_error_code IS NOT NULL`. `complete`, a retry, and `resolve_reconciliation(succeeded)` never clear that field. So a job that hit one transient error and then succeeded is listed as a recent failure.
- **Bug:** `at` is `updated_at`, which later heartbeats and claims overwrite. It doesn't record when the failure happened.
- **Bug:** `_reconcile` (`jobs.py:140`) sets `last_error_code='lease_expired'` on the `cancelled` path, but the contract row for that transition sets no error code. Cancelled jobs therefore show up as failures.
- **Contrast with fixture:** `persistent_ok` has 4 succeeded, 1 failed and exactly one failure entry.
- **Fix:** clear error fields on success, or filter by state.

**F6 — Low — Secret values can be left behind in the backend or kept in exception chains (OP-04)**
- **Orphaned value:** `snapshot/repoask/platform/secrets.py:88-91`. If `put` raises after partly writing (for example, a keychain timeout), or `COMMIT` fails after `put` succeeded, the backend keeps a value with no ref. Nothing can revoke it. Fix: call `backend.delete(ref_id)` best-effort in the failure path.
- **Exception chain:** `raise … from None` hides the original exception from printed tracebacks but still keeps it in `__context__`. The test backend's `RuntimeError` there carries the secret value. Any logger that walks `__context__` would expose it. Fix: drop the original exception explicitly, or say in the handoff that this is accepted.

**F7 — Low — Backup files are readable by others while being written**
- **Where:** `snapshot/repoask/platform/migrations.py:33-35` and `db.py:75-77`.
- **Bug:** `sqlite3.connect(target)` creates the file with umask permissions (usually 0644). The full snapshot is written before `chmod(0o600)` runs. Separately, `with sqlite3.connect(...)` only commits; it doesn't close the backup connection.
- **Fix:** create the file 0600 first (`os.open` with `O_CREAT|O_EXCL`, 0o600), then close the connection explicitly.

**F8 — Info — The handoff is out of date**
- **Where:** `snapshot/docs/agents/runs/M0-PLATFORM/handoff.md:8`.
- **Issue:** it says "Submitted commit: none", but the packet is bound to `5f17042b`. Update it when the fixes are resubmitted.

## Verified OK (by reading the code)
- **Fencing:** every lease operation checks the token inside `BEGIN IMMEDIATE`, and the worker swallows `LeaseLost` without writing anything. Expiry alone doesn't revoke a lease.
- **Idempotency:** keyed enqueue runs inside one transaction and compares kind, canonical payload and effect.
- **Attempts and backoff:** attempt limits and the 2s/4s backoff behave as specified. Requeueing an exhausted job raises `InvalidTransition` with no write.
- **Migrations:** each migration rolls back as a unit, including `user_version`. Too-new and checksum-mismatch databases are refused. Startup fails closed with generic errors.
- **Secrets:** the unavailable backend is checked before any DB write, revoke commits before deleting from the backend, and `SecretValue` has a safe `repr` and isn't JSON-serializable.
- **Health:** it reads only, never reconciles, reports `workers_running: 0`, and leaves out messages and payloads.

## Requested checks after fixes
The coordinator should run these:
1. F1 test: cancel, then a retryable fail, should end `cancelled` and not be claimable.
2. F2 test: two threads or processes calling `Store.open` on a fresh directory should both succeed.
3. F3 test: a handler that returns an invalid result should give a classified terminal or reconciliation state, not an exception out of `run_once`.
4. Rerun `python3 -m unittest discover -s tests`.

**Blocker owner:** Codex M0-PLATFORM author for F1–F3 and F5–F8. Coordinator for the F4 contract decision.
