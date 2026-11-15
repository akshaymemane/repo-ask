# Builder handoff — M2-PROFILES

## Identity

- Author/harness/session: native Codex `/root/transport_cancel`, temporarily assigned platform/execution-profile producer.
- Branch/worktree: `task/m2-profiles`; `/Users/apple/workspace/vibe-coding/opendevin-m2-profiles`.
- Assigned base: `28343c3a6a5223bb6195678d2d55203692cdbc14`.
- Explicit dependency picks: `7d2f363` (original adapter `6789421`), `392ee23` (original adapter evidence `9de6eeb`). These are separate producer candidates, not this task's implementation or approval.
- Source/test commit: `b5ca0c490e70889a40755042187c8b9c072a7237`.
- The subsequent task-evidence commit's exact SHA is delivered directly to the coordinator.
- Review own source against dependency base `392ee23`; integrate only this task's source/evidence commits after independent approval, with separately reviewed adapter dependencies/fixes.
- Task card: `docs/agents/runs/M2-PROFILES/task.json`.
- Requirements: F07 AI-08/AI-10/AI-11/AI-12; F12 OP-02/OP-04/OP-08.
- Status: review; not independently approved or integrated.

## Outcome

`ExecutionProfileService` provides bounded create/update/delete/list/get/get_version,
settings and validated max-active-session updates, immutable config versions, cached
check projections and flat usable-version resolution. Soft deletion preserves
nonsecret history and blocks future use. `require_version_usable(version_id)` keeps
recorded image, budgets and limits while rechecking live global privacy, deletion,
current profile source consent and the pinned version's latest check/job outcome.
Changing defaults cannot silently substitute new execution settings into a retry.

Explicit profile testing enqueues one external `execution.test` job (max_attempts=1)
with IDs only; concurrent repeated requests return the same active job. Its worker
checks local-only policy before detection or launch and continuously fences lease,
shutdown, cancellation and policy. A joined renewal thread cannot renew expired
ownership. Model tools remain closed until the trusted inventory callback, then
close again on every adapter exit, including success. Independent post-model checks
retain authority/deadline gates without reopening model tools.

Passing requires successful mutating broker tools, a changed synthetic POSIX calc.sh,
a trusted independent shell validation command supplied outside editable workspace
tests, and verified process/container/broker cleanup. Detection and a claimed model
success alone fail. Checks pin the resolved image SHA and CLI version, preserve
unknown usage/cost, discard raw model/source/tool output and replace prior success
immediately when another test is queued. Provisioning failures check for labelled
owned containers rather than assuming no returned handle means nothing exists.

Approved private runtime metadata is durably stored while active/uncertain and is
absent from every normal public profile/version/check/list/probe result. Internal
pending_runtime_tests/reconcile_test support runtime-leader recovery, reject live
lease theft, keep ambiguous containment blocked, and resolve known cleanup only as
failed, never requeue. Process identity matches the Session producer exactly:
Linux start ticks or normalized C-locale UTC `ps:` start time.

Exclusive files changed:

- `repoask/execution/profiles.py`.
- `tests/test_execution_profiles.py`.
- This task's task/status/producer-notes/handoff/self-evaluation documents.

Consumed the frozen migration9/10 SQL and m2-sessions contract. Coordinator-approved
additions are summarized in producer-notes.md: settings update, flat versions,
private-runtime recovery and require_version_usable. No SQL, manifest, API/main,
Session, broker or adapter source was changed by this task.

## Verification evidence

Commands ran from this worktree using
`/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python` (`PY` below).
No actual model inference, Docker call, remote account operation or installation
ran. Tests use real migrated SQLite, the real local Unix broker protocol, and
injected runner/adapter fixtures. The fake runner executes only the fixed synthetic
POSIX arithmetic fixture in a temporary test directory; this is not container or
real CLI/auth/inference acceptance evidence.

| Requirement | Command/scenario actually run | Result |
| --- | --- | --- |
| AI-08/AI-10, OP-02 | `"$PY" -m unittest discover -s tests -p 'test_execution_profiles.py' -v` | 31 tests passed in 11.781s. Version history/restart/delete/pagination, settings, concurrent enqueue deduplication, active-version changes, pinned old limits/image and live revocation covered. |
| AI-11, OP-08 | Same focused run: real broker protocol + injected runtime/adapter | Claimed success rejected without inventory/tool/change/independent validation; configured wall/turn/output/USD limits passed through and checked; authentication/detection failure is not a coding pass; unknown token/cost remains null. |
| AI-12, OP-04 | Same focused run: privacy/recovery projections | Unknown executable/env/mount/credential fields rejected; API-key/other adapters unsupported; private runtime exists durably but not in get/list/version/probe output; raw summaries, command output and exception text absent from check cache. |
| OP-02/OP-08 | Same focused run: blocked cancellation/shutdown/policy deletion; long generation; expiry mid-run; orphan provision failure; ambiguous containment and verified recovery | No stale lease renewal or late success; blocked tools denied after authority loss; external interrupted jobs require reconciliation; live leases not stolen; only confirmed recovery permits a fresh test. Owned fixture workers and lease monitors joined. |
| Current regressions | `OPENDEVIN_DOCKER_TESTS=0 "$PY" -m unittest discover -s tests` | **350 tests in 102.233s; OK, five expected Docker-gated skips.** This final run includes require_version_usable and its three new cases. Existing broker emitted AF_UNIX ResourceWarnings, described below. |
| Earlier regression before additive version resolver | Same full command | 347 tests in 102.122s; OK, five skips. Historical check only; final evidence is the 350-test run above. |
| Scope/whitespace | `git diff --check`, then `git diff --cached --check` before source commit | Passed. |

## Risks, dependencies and next action

- **No live product test proof claimed.** Default production factories will invoke
  the real runner/adapter only after explicit profile test authorization and policy
  checks. The coordinator must reserve the inference slot before a live synthetic
  ExecutionProfileService run; no model/Docker work was authorized to this worker.
- **Existing broker cleanup dependency:** the first focused run and both full runs
  emitted ResourceWarning for closed AF_UNIX sockets whose `makefile` reader is not
  explicitly closed in broker._serve_conn. Reported to coordinator; no out-of-scope
  patch or warning suppression was applied. This needs a producer/coordinator fix
  and combined verification before release; ordinary tests still reported OK.
- **Runtime integration belongs to coordinator/Session owner:** register execution.test
  on the dedicated runtime worker and wire pending_runtime_tests/reconcile_test under
  proven runtime leadership. Session candidate read during this task had not wired
  these recovery hooks; that omission was explicitly reported, never waived.
- The adapter dependency is undergoing its own review fixes. Integrator should use
  independently approved producer commits and rerun affected combined checks.
- No migrations/configuration/secrets need adding. Runtime instance/settings records
  initialize through existing frozen tables. No owned test process, model, container,
  worker or renewal thread remains running at handoff.
- Reviewer: fresh independent opposite-harness review requested. Focus on pinned
  version/current-permission separation, external-job fencing, private/public
  projections, containment/reconciliation and honest synthetic proof requirements.
- Coordinator owns review packet, board, integration and final real acceptance.
