# Builder handoff — M1-GITHUB

## Identity

- Author/harness: Codex; session `01a1d5c0-a956-77a0-882f-6acf69420e60`.
- Persona: platform. Branch: `task/m1-github`.
- Worktree: `../opendevin-m1-github`.
- Base/HEAD before submission: `cb2dcad262050eed989cb64df05511db08974780`.
- Submitted source: local commit attempt result recorded below; the source hash manifest
  binds the six package/test files independently of Git metadata access.
- Task: `docs/agents/runs/M1-GITHUB/task.json`.
- Requirements: GH-01, GH-03, GH-05, GH-07, GH-08, GH-09, GH-10.
- Status: ready for independent review, not approved or integrated.

## Outcome

Implemented the accepted `opendevin.m1/1` GitHub service slice against the exact existing
shared schema and atomic queue API. Foundation `0bdeb33` approval is reported by the
coordinator/user; no independent review of this builder slice is claimed.

Changed product/test files (all exclusive scope):

- `repoask/github/__init__.py`: public package exports.
- `repoask/github/errors.py`: content-free PlatformError service failure.
- `repoask/github/client.py`: injected request/response types, bounded HTTPS transport,
  disabled proxies/redirects, RSA validation, RS256 JWTs, authenticated installation checks,
  scoped short-lived tokens, paginated repository requests and bounded source helpers.
- `repoask/github/service.py`: configuration and secret rotation, atomic callback state,
  catalog/grant reconciliation, durable/manual/periodic refresh, retries and restart
  checkpoints, selection, disconnect, access/eligibility boundaries and safe purge hooks.
- `tests/test_github_client.py`, `tests/test_github_service.py`: 32 deterministic tests.
- Task-local status, setup, self-evaluation, source manifest, task card and this handoff.

No shared platform, migration, manifest, entrypoint, web asset or existing test was edited.
Previous partial contributions were preserved and completed in place. No subagents,
package installation, GitHub mutation, credential import, source sharing or push occurred.

Important behavior: only callback-verified installations are traversed. Reconciliation
removes unseen grants only after a complete installation traversal; authoritative suspension
or 404 removes that installation's grants immediately. Numeric repository identity survives
renames/transfers and preserves explicit selections. Multiple installations/connections
can keep a repository accessible. Every fetched page checks connection/run/installation
state again before committing. All transport calls occur outside Store locks/transactions.

Rate-limit continuation uses a new atomic queue job and preserves the discovery checkpoint.
Transient errors allow three continuations with bounded exponential delays; exhaustion defers
periodic retry to the configured polling interval. Auth failures require reconnect. Active
refresh/purge requests deduplicate; later completed refreshes/purges can run again. Purge
immediately excludes indexing and invokes registered idempotent derived-data hooks.

Additive service helpers: `update_refresh_interval` and `run_purge`; an installation approval
request on an already connected App returns `setup_status: pending_approval` while preserving
its existing connected grants. A first pending request leaves the connection pending and
attaches no installation. These fit the packet's sanitized-dictionary boundary; no schema
change was required.

## Verification evidence

All results below were rerun on the final source after the continuation request.

| Requirement | Actual command or scenario | Result |
| --- | --- | --- |
| All assigned | `python3 -m unittest discover -s tests -p 'test_github_*.py'` | Exit0; 32 tests passed in10.053s. |
| GH-01 | RSA signature/claims verified; encrypted, weak and non-RSA keys rejected; GET/app identity mismatch, persistent-store requirement, secret rotation and failed transaction cleanup | Passed, injected GitHub and test-only vault. |
| GH-03 | 250 repositories across three pages/two owners; repeat refresh and active deduplication; cursor/filters; rename/transfer and preference preservation | Passed against actual SQLite and JobQueue. |
| GH-05 | Separate index/implementation choices, missing write capability, token repository/permission scope, immediate verified permission downgrade | Passed. |
| GH-07 | Reset-time continuation, failed middle-page grant retention, bounded transient retries, reopened-store continuation | Passed. |
| GH-08 | Suspension/404, multiple grants/connections, installation revoked in flight, callback-detected suspension and token-endpoint revocation | Passed. |
| GH-09 | Disconnect racing a page and a callback, callback replay/expiry/concurrent consumption, grant availability and eligibility notifications | Passed. |
| GH-10 | Immediate indexing exclusion, registered cleanup hook execution, active purge deduplication and exclusion surviving rediscovery | Passed; no future derived-data tables are claimed to be purged. |
| Privacy/boundaries | SQLite dump/public-output credential checks; redacted representations/errors; transport timeout/failure/body bounds; no redirects/proxies; other thread acquires Store lock during injected calls | Passed. |
| Regressions | `python3 -m unittest discover -s tests` | Exit1; 77 tests run in10.833s: 72 passed, five socket-bind errors, zero assertion failures. |
| Python compatibility | `ast.parse(..., feature_version=(3,10))` on all six Python files | Passed syntax; not an actual Python3.10 runtime test. |
| Whitespace | Owning Python files scanned for trailing whitespace | Passed. |

The five full-suite errors all occur before exercising HTTP behavior because sandboxed
`socket.bind(('127.0.0.1',0))` raises `PermissionError: [Errno1] Operation not permitted`:

- `ApplicationLifecycleTests.test_actual_cli_serves_then_sigterm_exits_cleanly_without_demo_files`
- `ApplicationLifecycleTests.test_actual_cli_storage_failure_has_no_traceback_path_or_fallback`
- `FoundationHTTPTests.test_durable_job_survives_server_restart`
- `FoundationHTTPTests.test_status_routes_preserve_host_and_query_boundaries`
- `FoundationHTTPTests.test_summary_health_and_legacy_routes_are_real`

No permission bypass was attempted. Coordinator must rerun the full suite in an environment
that permits loopback binding. This is not a claim that the full regression suite is green.

## Risks and next action

- Independent quality and security boundary review is required for this exact submitted slice.
  Reviewer persona/harness: quality-reviewer / Claude, coordinator to schedule; no reviewer ran here.
- No real App credentials are configured; no live GitHub or OS-vault check was performed.
  No CLI token was read. All service network evidence is deterministic injected transport.
- Runtime used existing Python3.12/cryptography41.0.5. The shared manifest declares newer
  supported cryptography; coordinator owns project-venv verification and installation.
- HTTP/UI wiring, fixed callback redirect/Origin enforcement, Worker registration and periodic
  scheduler invocation remain coordinator scope. Setup and exact integration notes are in `setup.md`.
- Consumer eligibility listeners run after commit and must be nonthrowing/idempotent. The accepted
  schema has no durable notification outbox; future indexing/runtime consumers must recheck eligibility
  and access at their own boundaries and on restart. No shared schema was changed to invent an outbox.
- Purge hooks must be registered by future source/summary/vector/plan/session services and tolerate
  replay after a crash. This branch contains no such derived data and makes no physical cleanup claim.
- No owned background process remains. All unittest commands completed; only temporary test threads ran.
- Next action: coordinator captures the submitted source, obtains independent exact-source review,
  reruns the five sandbox-blocked HTTP checks plus supported-venv checks, then integrates only approved
  changes. Do not publish or merge remotely as part of this handoff.

## Local submission attempt

The scoped staging command was attempted exactly once:

`git add -- repoask/github tests/test_github_client.py tests/test_github_service.py docs/agents/runs/M1-GITHUB`

It exited128 with:

`fatal: Unable to create './.git/worktrees/opendevin-m1-github/index.lock': Operation not permitted`

No commit was created and no permission bypass was attempted. HEAD remains
`cb2dcad262050eed989cb64df05511db08974780`; all deliverables remain untracked in this
assigned worktree. `source-manifest.json` records SHA256 hashes for the exact six final
package/test files tested above. Coordinator owns committing/capturing this preserved
source in a permitted context and creating the immutable independent review packet.
Do not interpret the base HEAD as a submitted implementation commit.

## R1 corrections — supersedes earlier source/submission status

Review input: `review-r1.md`, changes requested against
`64231ae16456fbd2c05aba26821ec27bf59c76fd`. The coordinator committed the earlier
submission at that SHA; this work preserves it and applies only the requested delta.
Current branch is `task/m1-github`, in the same assigned worktree. Independent approval
is still required for the corrected commit. The review input itself was left unchanged.

### Changes

1. **GH-05/GH-08: fence stale discovery after a verified callback.** Successful callback
   grant updates now atomically cancel the connection's active discovery run and its
   pending continuation/job, then create a new run/job/generation in that same transaction.
   Existing `_live` checks prevent the old installation metadata or fetched repository page
   from writing after the callback. This uses durable run identity/state, not timestamps,
   and works across service instances and same-millisecond callbacks. Conservative restart
   also covers a callback that adds an installation while the old run has a fixed snapshot.
   The replacement starts from an empty checkpoint and fresh verified metadata. No migration
   or new shared interface was added; `_create_refresh` reuses the existing atomic enqueue API.
2. **GH-08: discovery token minting 404.** A 404 from the discovery access-token endpoint
   now invalidates that installation and deletes its grants through the existing invalidation
   path, recalculates access and emits eligibility changes, then continues other installations.
   Other valid grants remain accessible. Invalidation checks the current discovery run under
   the transaction so an already fenced run cannot invalidate a newer callback's grants.

Product/test delta is limited to `repoask/github/service.py` and
`tests/test_github_service.py`; remaining changes are task-local status/handoff/manifest.
No shared platform, schema, migration, entrypoint, web, existing tests outside the owning
file, dependency, account access, remote mutation, push or subagent was involved.

### Regression evidence actually run

Before implementation, the three precise review reproductions were added and run with:
`python3 -m unittest discover -s tests -p 'test_github_service.py' -k review_r1`.
All three failed against the submitted implementation: two restored write access and one
kept the revoked installation's repositories eligible. After implementation those three
passed. A fourth test then covered replacement of an already waiting rate-limit continuation.

Final-source checks:

| Check | Actual result |
| --- | --- |
| `python3 -m unittest discover -s tests -p 'test_github_*.py'` | Exit0; 36 tests passed in11.065s. |
| `python3 -m unittest discover -s tests` | Exit1; 81 tests in11.532s: 76 passed, the same five pre-existing HTTP socket-bind errors listed above, no assertion failures. |
| `git diff --check` | Exit0. |
| Python3.10 `ast.parse` on both changed Python files | Passed syntax; not an actual Python3.10 runtime check. |

New scenarios: constant-clock verified downgrade while the repository page is in flight;
constant-clock downgrade while older installation metadata is in flight; waiting continuation
cancelled and replaced durably with a fresh generation; successful installation validation
followed by access-token404, with immediate exclusion of single-grant repositories and
continued access through a second valid installation. Tests also verify the replacement
finishes without restoring write permissions. All requests remain injected synthetic transport.

The five HTTP errors remain `PermissionError: [Errno1] Operation not permitted` from
loopback socket bind. Coordinator must rerun the full suite outside that sandbox restriction.
No live App credentials, OS-vault integration or live GitHub connectivity is claimed. Existing
runtime/dependency and listener/consumer integration limitations documented above still apply.
No owned background process remains.

### R1 submission

Source base/HEAD before local delta commit: `64231ae16456fbd2c05aba26821ec27bf59c76fd`.
`source-manifest-r1.json` binds the exact six final package/test files; the original manifest
is retained as historical evidence. Local scoped staging/commit outcome follows below.
Next action: coordinator submits this delta for exact-commit independent quality/security
re-review. It is not approved or integrated by this handoff.

R1 scoped staging was attempted once with only the two changed Python files and the
three R1 task artifacts named above. It exited128:

`fatal: Unable to create './.git/worktrees/opendevin-m1-github/index.lock': Operation not permitted`

No R1 commit was created, no permission bypass was attempted and HEAD remains
`64231ae16456fbd2c05aba26821ec27bf59c76fd`. The two code/test modifications and task
artifacts are preserved in the assigned worktree; coordinator must commit this delta
in a permitted context, then bind independent re-review to that new exact commit.
