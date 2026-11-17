# Builder handoff — M2-ADAPTER-FOLLOWUPS

## Identity

- Author/harness and session ID: Claude (Claude Code subagent), integration engineer persona. No nested agents.
- Persona, branch and worktree: integration; `task/m2-adapter-followups`; `../opendevin-m2-adapter-followups`.
- Base SHA and submitted commit SHA(s): base `1653d74` (card commit `4c061b4`); source fix `5450030`; this handoff is the commit after it.
- Task card and requirement IDs: `docs/agents/runs/M2-ADAPTER-FOLLOWUPS/task.json`. Source: `M2-ADAPTER-SPIKE/review-r2.md` minor findings 2 and 3, also listed as the open follow-ups in `review-r3.md`.
- Status: review.

## Outcome

Changed files, all within the card's write scope:

- `repoask/execution/adapter_process.py`
- `repoask/execution/claude.py`
- `tests/test_execution_adapter.py`
- this handoff

`repoask/sessions/attempt.py` is **not** changed. It already passes `timeout_seconds=min(wall, remaining)`, and the adapter now applies that value as one deadline for the whole attempt, metadata queries included. No contract, schema or manifest changes.

**Fix 1: prelaunch metadata observes stop and shares the deadline (r2 finding 2).**
- `_run_attempt` sets `deadline = monotonic() + timeout_seconds` once, after argument validation.
- `_check_auth_profile` and `_disabled_plugins` take optional `stop_event`/`deadline` keywords and pass them to `_metadata`.
- Each query gets `min(10 s cap, remaining)`.
- The session Event reaches `run_stream` only through a local `_ObservedStop` view. That matters because `run_stream` sets its stop object on every exit, and setting the real Event there would cancel the agent before it launches.
- After the query process has been contained, `_metadata` raises an internal `_PrelaunchInterrupted` in two cases:
  - a stop was observed: `"cancelled"`;
  - the session deadline, not the per-query cap, cut the query short: `"timeout"`.
- `_PrelaunchInterrupted` deliberately is not an `OSError`/`ValueError`, so the per-query `except` blocks cannot turn it into `authentication_unverified` or `customization_unverified`.
- `_run_attempt` projects this through the same code path as a stop or timeout seen just before the agent spawns: one `adapter_result` event; `status` `cancelled` or `failed`; `code` `cancelled` or `timeout`; `exit_code=None`; `stop_confirmed=True`; usage and cost `None`.
- The agent `run_stream` receives only the remaining time. If none is left, it returns `timeout` without spawning.
- Callers that pass no Event/deadline keep their current behaviour, caps and codes: `preflight()` and `repoask/providers/claude_cli.py`.

**Fix 2: error mapping narrowed to the spawn boundary (r2 finding 3).**
- `run_stream` now raises two new exception types:
  - `ProcessSpawnError(OSError)`, only when `Popen` itself fails (OSError or ValueError, with the original as `__cause__`);
  - `ProcessLimitsError(ValueError)`, only when limits are rejected.
- Both subclass the old types, so existing `except OSError/ValueError` callers (`claude_cli.py`, metadata helpers) behave as before.
- `ClaudeAdapter.run` drops the blanket `except OSError` → `cli_unavailable` and `except ValueError` → `invalid_limits`. Now:
  - at the agent `run_stream` call, `ProcessSpawnError` → `cli_unavailable` and `ProcessLimitsError` → `invalid_limits`;
  - spawn preparation (private temp dir, cwd, plugin cache, prompt stdin file) runs in an `ExitStack` before any callback can run, and its `OSError` → `cli_unavailable`.
- Exceptions from `emit`, `on_inventory_verified` and `on_started` now propagate with their own identity. `run_stream` contains the process group before they propagate. An unconfirmed stop still becomes `ProcessContainmentError`, which `run()` returns as `containment_failure` with `stop_confirmed=false`.
- Unchanged:
  - `LeaseLost` propagation;
  - "the Event is set on every exit" (`run()`'s `finally`);
  - "a raised error always means a contained exit".

## Verification evidence

Checks were run with `./.venv/bin/python`. Everything uses fixture fake-CLI scripts and real subprocesses; there was no model, network, Docker or account access.

| Requirement | Command or scenario actually run | Result / evidence |
| --- | --- | --- |
| Fix 1: stop during each prelaunch query returns promptly | `test_stop_during_each_prelaunch_query_returns_promptly` (subtests `auth status`, `plugin list --json`; query sleeps 30 s, stop set once it starts) | Pass. Returns in under 3 s with `cancelled`/`cancelled`, `stop_confirmed=True`, a single `adapter_result`, no agent launch, query pid gone. Fails on base. |
| Fix 1: stop already set | `test_stop_already_set_skips_every_prelaunch_query` | Pass. No `run_stream` call; cancelled projection. Fails on base. |
| Fix 1: session Event not closed by metadata | `test_metadata_queries_do_not_close_the_session_event` | Pass. Event is open after both metadata queries and set after the agent run. |
| Fix 1: slow metadata cannot push the agent past the deadline | `test_slow_metadata_cannot_push_the_agent_past_the_session_deadline` (query sleeps 2 s, `timeout_seconds=5`, agent hangs) | Pass. The agent launches, the result is `timeout`, and the attempt finishes in under 6.3 s; on base it takes 7 s or more. Fails on base. |
| Fix 1: metadata exhausting the deadline | `test_metadata_exhausting_session_deadline_is_timeout_not_auth_error` (`timeout_seconds=1`, query hangs) | Pass. `timeout` in under 4 s, not `authentication_*`/`customization_*`, with no agent launch. Fails on base. |
| Fix 1: preflight unchanged | `test_preflight_metadata_keeps_its_own_caps_and_codes` | Pass. 10 s cap, no stop, old code. |
| Fix 2: callback ValueError/OSError keep their identity; LeaseLost unchanged | `test_callback_value_and_os_errors_keep_their_identity_after_containment` (`on_inventory_verified`/`emit` raising ValueError, OSError and LeaseLost while a descendant is running) | Pass. The same exception object propagates, it is not an `AdapterError`, the Event is set and the descendant is gone. ValueError/OSError cases fail on base (`invalid_limits`/`cli_unavailable`); the LeaseLost case passes on both. |
| Fix 2: final emit error | `test_final_emit_error_is_not_cli_unavailable` | Pass. Fails on base. |
| Fix 2: spawn errors still mapped | `test_spawn_boundary_errors_still_map_to_stable_codes` (Popen PermissionError and ValueError) and the existing `test_actual_popen_failure_is_stable_and_closes_event` | Pass. `ProcessSpawnError` with `__cause__`; `cli_unavailable`; Event set. |
| Fix 2: spawn preparation | `test_spawn_preparation_os_error_is_cli_unavailable` | Pass. |
| Updated existing test | `test_spawn_and_helper_limit_errors_are_stable_and_close_event` now injects `ProcessSpawnError`/`ProcessLimitsError` | It used to inject a bare OSError/ValueError from `run_stream`, which is exactly the behaviour being removed. |
| Adapter suite | `python -m unittest tests.test_execution_adapter -v` | **44 tests OK** in about 24 s (34 before plus 10 new); run three times in a row, all OK. Against base sources: 13 errors and 2 failures in the new tests. |
| Sessions suites | `python -m unittest discover -s tests -p 'test_sessions*.py'` | **56 tests OK, 3 skipped** (Docker-dependent) in 49.9 s. |
| Full suite | `python -m unittest discover -s tests` | **533 tests OK, 9 skipped** (Docker-dependent), 238.1 s, on the `5450030` sources. |

Timing note: the first draft used sub-second margins and failed once inside the full adapter file, though it passed in isolation. Newly written fake-CLI executables can start slowly on macOS under load. Margins were widened so the old and new behaviour stay clearly separated (for example, at least 7 s vs. under 6.3 s).

## Risks and next action

- Known gaps:
  - If temp-directory cleanup fails after a contained run, that `OSError` now propagates raw. It used to be relabelled `cli_unavailable`. `attempt.py` records it as `agent_error` with `stop_confirmed=True`, which is accurate because the group was contained.
  - A stop that arrives while spawn preparation is running is caught by `run_stream`'s pre-spawn check, so nothing is launched.
  - Real Docker and real-model runs remain M2 milestone evidence gates. They were not run here.
- Migrations/configuration needed: none.
- Background processes still running: none owned. All fixture processes are verified gone by the tests.
- Reviewer and requested review scope: Codex (opposite harness).
  - `5450030` against `1653d74`, covering `adapter_process.py`, `claude.py` and the adapter tests.
  - Focus points: the `_ObservedStop` view, the `_PrelaunchInterrupted` projection, and the spawn-boundary exception types (also check that the `claude_cli.py` provider path is unchanged).
- Blocker owner: none.

Not integrated, approved or published; the coordinator records those outcomes.
