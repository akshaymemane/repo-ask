# Builder handoff — LAUNCH-SESSION-PURGE

## Identity

- Author/harness and session ID: Codex API session, LAUNCH-SESSION-PURGE.
- Persona, branch and worktree: platform/runtime; task/session-purge; /Users/apple/workspace/vibe-coding/opendevin-session-purge.
- Base SHA: dbfa1103eeb2ba923f868843c87dcabadda52c56. Submitted SHA: pending commit attempt.
- Task card and requirements: user-assigned LAUNCH-SESSION-PURGE; F12 OP-10, F05 retention projections, M2 publication identity.
- Status: review (not approved/integrated).

## Outcome

Terminal-only per-session purge atomically redacts retained SQLite context, events, guidance/questions, artifact bytes/hashes, validation commands/environment, session manifests and publication prose/events. Active sessions and nonterminal publications block with stable 409 codes. outcome_json stores a durable, idempotent purged_at tombstone without a migration. Retained identity includes session/state/timestamps, plan version, repository/base SHA, publication id/state/PR URL/number. Publication remote reconciliation identifiers remain intact.

A bounded directory-descriptor helper removes data_dir/sessions/<id> without following symlinks; interrupted cleanup retries after restart without restoring content. Current session artifacts are SQLite-backed; the documented per-session disk tree is the retention convention. Purged content endpoints return explicit 409 purged; get/list return minimal identity. New guidance and retry are blocked after purge.

The finished-session UI offers a native keyboard-accessible confirmation, describes deletion and retained identity/PR behavior, uses >=44px action targets and displays deletion date in detail/list. Purged views clear cached content and fence late plan responses. README adds the requested retention line; F12 remains accurate.

Changed paths (all exclusive scope): repoask/sessions/service.py, repoask/sessions/purge.py, repoask/session_api.py, repoask/web/sessions.js, append-only repoask/web/styles.css, tests/test_sessions_purge.py, tests/ui/session.test.mjs, docs/contracts/m2-sessions.md, README.md, task-local run documents. runtime.py, services.py, migrations, manifests, board and other task paths are unchanged.

Contracts consumed: m2-sessions.md and m2-publication.md at base; additive retention contract documented as assigned. No schema or external-effect deviation.

## Verification evidence

| Requirement | Command or scenario actually run | Result / evidence |
| --- | --- | --- |
| OP-10 service/API | /Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python -m unittest discover -s tests -p test_sessions_purge.py | 5 passed; terminal/active matrix, publication state blockers, PR identity, content redaction, isolated disk deletion, symlink target preservation, cleanup retry, database reopen, idempotency, API shapes and purged endpoint responses. |
| API regression | Same Python, -m unittest discover -s tests -p test_session_api.py | 4 passed. |
| UI | REPOASK_TEST_PYTHON=/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python node --test tests/ui/*.test.mjs | 299 tests: 297 passed, 2 failed in session-services bridge synthetic execution-profile bootstrap. Purge detail/confirmation/list tests pass. |
| Python regression | Same Python, -m unittest discover -s tests | Running; final result to be recorded. |
| Sandbox | Direct AF_UNIX socket bind probe; ps process listing | Socket bind fails PermissionError EPERM; ps denied. No permission-bypass flags used. |
| Patch hygiene | git diff --check | Passed. |

UI tests use the repository DOM harness and synthetic transport, not a real browser or actual inference. No Docker/model/GitHub external writes were attempted. Full-suite failure output is not copied into shared artifacts.

## Risks and next action

- Socket-dependent runtime/profile integration needs rerunning outside this sandbox. No claim that unrelated runtime failures are fixed.
- Disk cleanup is limited to the documented per-session retention tree (10,000 entries, 64 levels); failure leaves content tombstoned and reports an error for retry. Backups and independent plans/repositories require their own controls.
- Migrations/configuration: none.
- Background processes: full Python regression command is still running; no product runtime launched.
- Reviewer: Claude coordinator; review exact commit, purge/publication serialization, non-content identity preservation, deletion boundaries and UI stale-response clearing. Integrator owns board updates and integration.
