# Builder handoff — LAUNCH-HEALTH-PROJECTION

## Identity

- Author/harness and session ID: Codex, current platform-builder session (no externally supplied session ID).
- Persona, branch and worktree: platform; task/launch-health; /Users/apple/workspace/vibe-coding/opendevin-launch-health.
- Base SHA: 5730fca72c976cb0b0d0f48a5268a4dcb97af742. Submitted commit: pending commit attempt.
- Task card and requirement IDs: user assignment LAUNCH-HEALTH-PROJECTION; F12 OP-09/OP-11, launch spec-gap audit non-blocking #2. Board backlog is superseded by the explicit task assignment; board unmodified.
- Status: review pending exact commit and Claude review; not integrated or published.

## Outcome

Health uses persistent-index state counts and latest failure code, Ask/planning provider assignments, runtime worker state and active-session counts. Settings System health renders these fields in plain words and offers refresh. Legacy-only health remains supported. No active model/runtime probes, repository records, provider URLs, model names, credential references, recovery payload or source content are copied into the added projection.

Changed files, all within exclusive scope:
- repoask/platform/workspace.py: service projection and code-only filtering.
- repoask/__main__.py: health composition import/call only (assigned hotspot).
- repoask/web/settings.js: System health builder only.
- tests/test_health_projection.py and tests/ui/health.test.mjs.
- docs/agents/runs/LAUNCH-HEALTH-PROJECTION/{status,contract,handoff}.md.

Contract remains opendevin.health/m0.1 with additive fields, preserving existing keys. Exact bucket precedence and runtime limitations are documented in contract.md. No schema/configuration changes. Feature spec remains accurate and was not edited.

## Verification evidence

Commands use /Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python; UI uses that same path through REPOASK_TEST_PYTHON.

| Requirement | Command or scenario actually run | Result / evidence |
| --- | --- | --- |
| OP-09/11 legacy, persistent, privacy | `<python> -m unittest discover -s tests -p test_health_projection.py` | 4 tests pass. Real SQLite/IndexService/provider roles; actual RequestHandler GET composition without socket; failed/queued/ready/unindexed buckets; disabled retained snapshot; legacy --model cannot override provider roles; serialized-output privacy assertions. |
| OP-09 execution counts | Same focused Python command | Real SessionService/PlanService/index/catalog fixtures launch queued session and stop it; active count changes 1 → 0. Synthetic runner/profile, no real Docker or inference claim. |
| OP-09 health rendering/refresh | `node --test tests/ui/health.test.mjs tests/ui/settings.test.mjs` | First run 12/12 pass; subsequently added legacy refresh case included in final full UI run. |
| UI regression | `REPOASK_TEST_PYTHON=<python> node --test tests/ui/*.test.mjs` | Final: 291 tests, 289 pass, 2 fail. Both tests/ui/session-services.test.mjs:22,55 fail synthetic profile bootstrap with execution_test_failed, matching prior launch review evidence. All new health UI tests pass. |
| Python regression | `<python> -m unittest discover -s tests` | Running; final result to be recorded below. |
| Scope/format | `git diff --check` | Pass. |
| Sandbox evidence | Python socket.bind on AF_INET loopback and AF_UNIX /tmp test address | Both denied with PermissionError errno 1. ps also denied. No permission bypass requested or used. |

Full test logs remain local /tmp/launch-health-python.log and /tmp/launch-health-ui-final.log; no full captures committed.

## Risks and next action

- Current services.execution_status() returns runtime worker state only. Docker/agent codes explicitly report not_checked; a running worker is not proof of either availability. Additional cached availability evidence requires a coordinator-owned service/runtime contract change outside this assignment. No Docker probe added.
- Index ready bucket means an active saved snapshot exists, not complete coverage/freshness. Counts and latest failure semantics are documented in contract.md.
- Full UI regression is not green in this sandbox. Reviewer/integrator should rerun service/runtime integration with socket access.
- No migrations, installation, background server, delegated agents, push, PR or merge.
- Reviewer: Claude; review exact submitted commit, privacy boundaries, additive compatibility, health UI and runtime limitation. Integrator owns combined regression rerun/integration.
