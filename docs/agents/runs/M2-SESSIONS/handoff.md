# Builder handoff — M2-SESSIONS

## Identity

- Author/harness: Claude (Claude Code, Opus 5.5), session-runtime persona (`docs/agents/personas/runtime.md`). No nested agents and no model invocations.
- Branch/worktree: `task/m2-sessions`, `/Users/apple/workspace/vibe-coding/opendevin-m2-sessions`.
- Base SHA: `28343c3a6a5223bb6195678d2d55203692cdbc14`.
- Candidate dependency, cherry-picked as instructed and not root-integrated: adapter `6789421` → local `595d6b7`, `9de6eeb` → local `952a1b4`. These belong to the adapter card and are not M2-SESSIONS work.
- Submitted implementation commit: the commit after `952a1b4` on this branch that adds `repoask/sessions/**` (the SHA is in `git log`; the reviewer packet must bind to it).
- Task card: `docs/agents/runs/M2-SESSIONS/task.json`. Covers F05 SE-01..12 (SE-12 only as a recorded policy snapshot) and F12 OP-02/03/05/06/08/10/12.
- Status: review. Not integrated, not approved and not published.

## Outcome

`repoask/sessions/` implements the accepted `docs/contracts/m2-sessions.md` `SessionService(platform,index,github,providers,plans,execution_profiles,*,runner_factory=None,adapter_factory=None,clock=now_ms)` against the exact frozen schema 9/10 SQL field names. There are no migrations, schema edits or shared entrypoint edits.

- **service.py**: `preflight` (read-only, 5 s cached, no Docker or model probes), `launch`, `retry`, `get`, `list_sessions`, `events`, `artifacts`, `diff`, `validations`, `send_message`, `stop`, `purge_repository`, plus an eligibility listener.
  - `launch` recomputes plan readiness, checks the exact hash and that the version is still latest/not deleted, and runs its own preflight even if the PlanService hook isn't wired.
  - In one `BEGIN IMMEDIATE` transaction, launch rechecks the idempotency key (same intent returns the same session; different intent → `idempotency_conflict`), plan latest/hash, the active-session count against `execution_settings.max_active_sessions` (default 1), and unresolved containment. It then freezes the profile snapshot, limits, instructions (prompt sha256) and publication policy, and creates the session, its `session_repositories` rows, one `session.run` job (external, `max_attempts=1`) and event seq 1.
  - Before provisioning, launch rejects: empty or multiple write targets, local/demo writes, missing citations, blocking questions, `local_only`, profile external-source denial, and implementation not permitted.
  - Read repositories are recorded as role `read`. They are NOT provisioned, and the warning `read_context_not_provisioned` says so.
- **attempt.py**: `run_session` on the dedicated runtime worker. Every durable write is fenced by the live lease token/expiry plus `session.job_id`. A lost lease kills the container and writes nothing more.
  - Before any source leaves storage, the attempt rechecks `local_only`, `require_usable` (same frozen version id, image id and consent), the plan prompt hash, the CLI version from `adapter.preflight()` and the runner image preflight.
  - It then acquires the pinned source through the GitHub tree/blob API with a transient `contents:read` token, provisions the container and takes an empty baseline checkpoint.
  - The broker guard stays closed until `on_inventory_verified`. Each attempt gets a fresh stop Event. User cancellation is decided from the durable `stop_requested`/`stop_reason`, never from the Event, because the adapter sets the Event on every exit.
  - The guard checks reason, shutdown, deadline, quota, lease, stop flag, job cancel and live write access before every tool and before any result is returned. A heartbeat/monitor thread renews the lease and re-runs the full access check about every 2 s.
  - Post-agent trusted checkpoint/validation keeps checking authority without reopening the model gate.
- **workspace.py**: bounded regular-file acquisition.
  - Recorded as omitted: excluded/sensitive/generated paths, symlinks, submodules, oversize files and secret-content files.
  - Truncated trees, over-budget files/bytes/tree entries and malformed entries fail visibly (`source_tree_truncated`, `source_over_budget`, …) before provisioning.
  - The base manifest keeps sha256/size/mode/blob per file plus omitted paths/directories and exclusions. Omitted paths are passed to the broker as escaped `excluded_paths`, so writes cannot shadow them.
  - `publication_rejection()` and `review_changes()` reject `.git`, hook dirs, shadowed omissions and excluded paths no matter how a change was made (tool or command). Rejected content is never retained.
  - The patch is per-file unified diff JSON with modes. The checkpoint holds changed-file content only. Nothing is extracted on the host.
- **Events and artifacts**:
  - Events use a transactional per-session sequence. Payloads are sanitized, redacted and ≤8 KiB. Private runtime keys (container id, socket/token paths, pid) are dropped.
  - Mappings: `tool_started/finished/denied` → `tool.*`; adapter inventory/ready/assistant/result → `agent.summary`; plus `usage`, `checkpoint`, `validation.*`, `question.asked`, `message.delivery`, `stop.requested`, `containment`, `session.state`, `error`.
  - Event count is capped; checkpoint/patch artifacts are kept latest-only under a byte quota. Exhausting either is a visible `budget_exhausted`.
- **Validation**: plan commands run as `['sh','-c',command]` inside the same container through `runner.run_command`, never through a host shell. Statuses `passed/failed/timeout/error/unavailable/not_run` stay distinct (exit 126/127 or network hints → `unavailable`). The exact argv, environment summary, exit code, redacted log artifact and timing are recorded. Steps not run are recorded as `not_run` with a reason.
- **Questions and messages**:
  - `ask_user` persists the question and moves to `waiting_for_user`. The wait is bounded and watches stop, lease and deadline. Only a matching answer is delivered (`delivered`), and it becomes `acknowledged` when the broker returns that tool result. That is a broker acknowledgment, not a model acknowledgment.
  - Generic follow-ups stay `queued` (`follow_up_unsupported`) and are rejected at the end. They are never faked as delivered.
  - Material scope/grant/publication wording is rejected as `plan_amendment_required`. This uses a conservative regex; grants are never changed by messages in any case.
  - The same client key returns the same message; different content → `idempotency_conflict`.
- **Stop**: commits `stop_requested` plus `stopping`, or `cancelled` immediately for an unclaimed queued job, and returns at once. It then signals the local attempt, which sets the Event and stops the container on a background thread. Repeated stop is idempotent. Unverified containment ends as `failed/containment_failed`, the runner stays `containment_failed`, and new launches are blocked (`containment_unresolved`).
- **runtime.py**:
  - Data-directory `flock` leadership. A second process gets `runtime_in_use`, does not recover/kill, and preflight reports `runtime_in_use`.
  - Dedicated worker threads (default concurrency 1) handle `session.run` and the producer's `execution.test`.
  - Shutdown: `close()` terminates the active attempt, contains it, marks it `interrupted`, and the worker records the job `needs_reconciliation`.
  - Recovery and periodic reconcile:
    - Contain recorded harness process groups, but only when the OS start identity matches (a recycled PID is never signalled; own process/group never).
    - Stop/discard label-owned containers.
    - Mark stale sessions `interrupted`, or `cancelled` if the user stopped them.
    - Convert dead-owner leases to `needs_reconciliation` and resolve them to `failed` only after verified containment.
    - Never rerun automatically.
- **Purge**: a GitHub purge hook `sessions` stops active attempts and NULLs artifact content, source-bearing event payloads, message/question text, manifests and validation commands. It keeps a minimal state/containment/usage history. After revocation/purge, any in-flight checkpoint or summary is refused or redacted. Reads (`diff`, source-bearing events, question prompts, validation output) use live permission checks and current exclusions.

Changed files (exclusive scope only): `repoask/sessions/{__init__,errors,redaction,workspace,prompt,processes,service,attempt,runtime}.py`, `tests/test_sessions{,_fixture,_control,_recovery,_adapter,_docker}.py`, and `docs/agents/runs/M2-SESSIONS/{status,handoff,broker-followup-proposal}.md`. Root-authored `task.json`/`coordinator.md` are left untouched and uncommitted.

## Verification evidence

| Requirement | Command or scenario actually run | Result / evidence |
| --- | --- | --- |
| Full regression | `python3 -m unittest discover -s tests` | OK, 350 tests, 32 skipped (30 pre-existing + 2 opt-in Docker), 109.6 s |
| Session suites | `python3 -m unittest discover -s tests -p 'test_sessions*.py'` run three times | OK each time: 31 tests, 2 skipped, ~23 s |
| SE-01 / OP-06 | `LaunchTests` | Same key → one session/job; conflicting reuse → `idempotency_conflict`; second key while active → `session_active`; frozen snapshot unaffected by a later profile change; hash/superseded rejected |
| SE-02/03/04 | `RunTests.test_full_session…` | Source only via `contents:read` tokens; 4 regular files; `.env`/token/node_modules/symlink/secret-content omitted and remembered; pre-inventory tool call denied without touching the runner; `.git` and omitted-path writes denied; `session_branch` recorded; prompt contains no excluded content |
| SE-05/06, OP-05 | same, plus paginated `events(limit=7)` | Contiguous seq 1..N equal to the single-page replay; state order queued→provisioning→running→validating→completed; no tokens/container ids/socket paths/secrets in events, get, diff, validations or artifacts |
| SE-07 | `QuestionTests` | Real broker `ask_user` callback answered through `send_message(question_id)` → delivered → acknowledged; generic follow-up stays queued then rejected; force-push wording → `plan_amendment_required`; idempotent client key |
| SE-08 | `StopTests`, `test_stop_while_waiting…` | Ack <2 s; cancelled with containment confirmed <10 s; no `tool.started` after `stop.requested`; harness process dead; verified checkpoint diff kept; unverified container stop → `containment_failed`, launches blocked |
| SE-09 | `AuthorityTests` | Adapter-reported budget → failed/budget_exhausted with checkpoint preserved and validation `not_run`; runner wall deadline caps adapter timeout; revocation mid-run → later tools denied, blocked/access_revoked, diff `source_unavailable`, source events redacted |
| SE-10 | full + `test_failed_and_unavailable…` | `passed`/`unavailable`(127)/`failed` stay distinct; secret-like output redacted; publication not eligible when there are no changes |
| SE-11, OP-12 | `RecoveryTests` | Crash state with a real orphan-like harness: restart kills it only on identity match, removes the container, marks interrupted, resolves the job to failed after containment, no rerun; unverifiable containment stays visible and blocks launches until reconciled; recycled PID not signalled; second data-dir process → `runtime_in_use`; shutdown → interrupted plus needs_reconciliation, then restart resolves; expired lease fenced, then reconciled to interrupted |
| OP-10 | `PurgeTests` | After GitHub purge, session tables contain no source, answer, command or path markers; no artifact content; minimal state history kept |
| Adapter protocol | `test_sessions_adapter.py` (real `ClaudeAdapter` + `adapter_process` + MCP stdio bridge + broker, FAKE CLI) | Inventory gate denies a pre-init call; tools/call read/write through the bridge; thinking/tool inputs not persisted; real process-group cancellation through `stop()` within budget. **Not inference.** |
| Docker | `OPENDEVIN_SESSION_DOCKER=1 python3 -m unittest discover -s tests -p 'test_sessions_docker.py' -v` | **NOT RUN**: the sandbox denied the command here. Root should run it (needs cached `python:3.12-slim`, no pulls). |
| Real Claude coding | — | **NOT RUN.** No model invoked; root has not granted the reserved slot. |

Fixture-only behavior: `FakeRunner` (an in-memory stand-in, not isolation proof), `ScriptedAgent` (a real broker-socket client plus a real harness process, no model) and `FakeProfiles` (persists real schema-9 rows; root-clarified flat `require_usable` shape, because the sibling `profiles.py` was not present when read).

## Risks and next action

- **Coordination questions for root:**
  1. Confirm the profile `config` keys (`image`, `allow_external_source`, `runner_limits`, `agent_limits`) and that `check.capabilities` is a dict carrying `ask_user`.
  2. Recovery under held leadership writes `jobs` directly to turn dead-owner leases into `needs_reconciliation`, because `JobQueue` has no API for this. Accept, or add a `JobQueue` method.
  3. "Missing citations" is implemented as `citations_required` (the plan has no citations).
  4. `blocked` is treated as terminal (no resume); retry creates a successor.
  5. HTTP mapping for `SessionError.code` (see `errors.py`), including `details` for `plan_not_ready`.
- **Root wiring:**
  - `SessionService(..., data_dir=...)` for leadership.
  - `PlanService.execution_preflight = sessions.preflight`.
  - `start()` after composition and `close()` before store close.
  - `stop(id)` returns a stop view.
  - `send_message(id, content, client_request_id, question_id=None)`.
- **Known gaps:**
  - The runner uploads files as 0644, so executable bits are lost in the container. Modes are retained in the manifest/patch; this belongs to the runner owner.
  - Read-only contexts are not mounted.
  - No generic follow-up delivery (a broker proposal is in `broker-followup-proposal.md`; the broker was not edited).
  - A hard kill can lose edits after the last verified checkpoint; this is disclosed through `edits_since_last_checkpoint_may_be_lost`.
  - Linux `/proc` start identity is implemented but not run on Linux.
  - The material-change filter is heuristic.
  - HEAD freshness is recorded as `base_is_head`, never blocking.
- Not done: no publication (F06 consumes the patch/checkpoint artifacts later), no HTTP/UI, no push or remote mutations, no package installs, no model overrides, no auth copies.
- Background processes: none left running; test harness children are killed and reaped in cleanup.
- Reviewer: a fresh opposite-harness (Codex) exact-commit boundary review is requested. Focus: fencing/lease semantics, stop/containment truthfulness, recovery's direct job writes, purge completeness, and the source acquisition/publication path policy.
