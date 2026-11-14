# Builder handoff — M1-INDEX, Claude R2 fixes

## Identity / submission history

- Author: Codex retrieval-engineer; branch `task/m1-index`.
- Worktree: `/Users/apple/workspace/vibe-coding/opendevin-m1-index`.
- Original assignment base: `db85564688f25ab7345cdcd689fe18fd160c6d7a`.
- Coordinator schema5 prerequisite: `e7c4a5e328b69207804cbbbbf3fdcae7deb0f4bd`.
- Original submission / R1 reviewed code: `d8f1005eeb13f544c3fc465ff2fc66acaa2c4a7d`.
- Actual R1 fix submission / R2 reviewed code / this revision base:
  `469954f9a6bedc003d7de1e61c3074f2b5a711b7`.
- Prior worker sandbox failures were followed by coordinator commits; the earlier
  "no submitted commit" statements do not describe these actual reviewed submissions.
- Current R2 submission: no new commit — sandbox denied Git index.lock; HEAD remains469954f. See commit-result.md and files.sha256.
- Requirements: F02 IX-01–11, R2 N1 and requested context/churn follow-ups.
- Status: author fixes verified, requiring new exact-commit independent review.
  No independent approval or integration is claimed.

## Result

Persistent transient failures are now bounded independently of ordinary continuation
jobs. Three consecutive source/model timeout/unavailable failures cause terminal
failure, with stable timeout/upstream_unavailable code and null retry_at. A previously
valid active snapshot and its immutable citations remain available. Incomplete staging
is never activated. The active-run slot is released for an explicit new request.

Rate limits allow at most ten automatic retries per explicit attempt while honoring
upstream retry_at. Their counter persists through successful progress and phase changes.
Consecutive transient streaks reset on persisted progress; worker/time continuations
neither alter streaks nor inflate backoff. Ordinary waits are30s for capacity and5s for
time slices. Transient waits are2s/4s; rate-limit backoff is independently capped300s,
unless the provider specifies a later reset. Explicit retry of terminal failure starts
a fresh bounded attempt; pause/resume and waiting retries retain accounting.

Small-context embedding profiles are checked before source transmission. A vector
that cannot fit profile.context_limit is skipped individually, with exact partial
coverage/degradation counts, while other vectors, lexical evidence and retained source
remain usable. No current public signature changes; the previously approved
set_exclusions(repository_id, exclusions) remains unchanged.

Detailed code/policy/test mapping is in review-response-r2.md. Existing immutable
snapshots, namespace-scoped KNN, token/cache budgets, current exclusions/revocation,
lease/job/cancellation fencing, staging cleanup and purge behavior are preserved.
All original34 focused regressions still pass.

## Scope / integration

This revision changes only `repoask/indexing/service.py`, adds
`tests/test_indexing_retry_limits.py`, and updates this task's handoff/status/review
artifacts. No shared schema/migration, manifests, platform, API/web/Ask/backend or board
files changed. Root's separate WAL fix898eaae is root-owned; it is not edited or applied
by this worker. No new contract/schema change is requested.

The public IndexService constructor/methods and existing fields are stable. Coverage
adds a bounded embedding_context_limit skip reason; run progress may include bounded
retry counters. Retry counters live in existing private checkpoint JSON. No new job
payload source/path/credential data is introduced. HTTP/Ask wiring remains coordinator
work; handler stays `{'index.run': service.run_index}`.

Consumed actual F02 `docs/features/02-repository-indexing.md`, m1-indexing/services
contracts, ADR0002, and both independent review files. API-cache GitHub acquisition
and injected-reader protocol remain as in the reviewed implementation. No claim of
local GitHub Git fetch/cache or live semantic-model quality is made.

## Actual verification

Dependency interpreter: `/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python`.

| Command / check | Result |
| --- | --- |
| Dependency interpreter `-m unittest discover -s tests -p 'test_indexing_*.py'` |41 passed, no skips; original34 plus seven precise R2 regressions |
| `python3 -m unittest discover -s tests` |147 tests attempted; five HTTP socket-bind PermissionErrors,25 optional-vector skips; no assertion failures |
| Dependency interpreter `-m unittest discover -s tests` |147 attempted;142 passed, only five sandbox socket-bind errors; no skips/assertion failures |
| Dependency interpreter `docs/agents/runs/M1-INDEX/verify.py --without-http` |142 passed; exactly five socket-dependent HTTP tests explicitly excluded |
| Dependency interpreter `-m compileall -q repoask/indexing tests/test_indexing_retry_limits.py`; `git diff --check` |Passed |

Synthetic provider/source data only. Real ProviderService transports, real local SQLite
and APSW/sqlite-vec are exercised. No live model/account call, credentials, download,
package change, external source transmission, remote mutation or agent spawn occurred.
No background application/worker processes remain.

## Next action / limitations

New independent review must bind to the new exact committed revision. If sandbox Git
administration remains blocked, commit-result.md records the exact error and files.sha256
identifies the preserved packet for coordinator commit before independent review.
The coordinator must rerun the five HTTP tests in an environment permitting loopback
listeners and apply its separate WAL fix at integration. No approval bypass was attempted.

Token estimates remain explicitly approximate until the provider reports usage; no
real-model answerability or F03 routing readiness is claimed. Retry exhaustion is an
inspectable terminal failure, not silent semantic or citation degradation. Cost/disk
pauses still require resolving their cause; worker/time waits continue automatically
with the documented delays. Root's Ask/UI work can use the same public interface.
