# Accepted producer notes

These summarize coordinator decisions delivered to this task and recorded in the
coordinator's `docs/contracts/m2-sessions.md` and the Session task's coordinator note.
They do not alter SQL, shared contracts or Session files from this worktree.

- `get_version(version_id)` and `require_usable(profile_id)` return the same flat
  version dict with id/profile_id/version/adapter/auth_mode/config/created_at/
  profile_deleted/check. `get(profile_id)` has nested version/check.
- `require_version_usable(version_id)` returns the same flat pinned version/check,
  honoring original immutable budgets/image/config while checking current profile
  consent, deletion, global privacy, latest check and job state. `require_usable`
  delegates the active version.
- `list_profiles(limit,cursor)` returns items,next_cursor.
- `settings()` returns max_active_sessions (initially 1); `update_settings(value)`
  accepts integers 1..4 and does not stop currently active work.
- Factories are `runner_factory(instance_id)` and `adapter_factory()`.
- `request_test` deduplicates an active job across the same profile, including after
  a new version is saved. It never overwrites a running version's check.
- Each profile test is external `execution.test`, max_attempts=1, with identifiers
  only in its queue payload; its container's session_id is the job.id. The runtime
  instance id is durable and shared with sessions.
- `result_json.private_runtime` may hold only instance_id/container_id/harness_pid/
  harness_start. All normal public check/profile/version/list/probe results omit it.
  No auth values, broker endpoint or token file content is retained there.
- The internal trusted-leader methods `pending_runtime_tests()` and
  `reconcile_test(version_id,job_id,containment_confirmed=bool)` expose/resolve recovery
  state. Only verified containment may resolve an already-needs_reconciliation job
  as failed; no requeue. Live leases are never stolen from metadata alone.
- Process identity matches the Session producer: Linux `linux:<start tick>` or
  `ps:` plus normalized UTC C-locale lstart. A bare PID is never enough for recovery.
- Product local_only is checked before any remote CLI probe, even synthetic.
  Profile allow_external_source is additionally required for require_usable/real
  repository execution, and never inferred from a successful synthetic test.
- Cached pass requires trusted inventory, successful mutating broker tool use,
  changed calc.sh, independently supplied POSIX validation, and confirmed harness/
  container/broker cleanup. Detection or a model success marker alone is insufficient.
- A fresh adapter stop event is set on successful exit too; trusted independent
  validation checks live authority without reopening model tools.

The coordinator owns Session runtime recovery wiring, worker registration, API/main
composition, SQL, and independent review/integration. The adapter dependency remains
subject to its own review fixes; this task does not claim it is approved.
