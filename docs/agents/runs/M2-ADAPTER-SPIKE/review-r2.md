# M2-ADAPTER-SPIKE independent boundary review — round 2

Verdict: **CHANGES REQUESTED** for exact source commit
`73a682f8a4a1b9139972005ac86992ea218c18f4` (handoff head `ea7de6d`).

Reviewer: Claude independent boundary reviewer, 2026-11-15. Read-only. No model,
Docker or account calls. No edits to the author's branch.

Scope: `repoask/execution/claude.py`, `repoask/execution/adapter_process.py` and
`tests/test_execution_adapter.py`, against `docs/contracts/m2-execution-spike.md` and
`review-r1-resolution.md`. These three files are byte-identical on
`work/opendevin-integration` at `1fa296f` (they landed with commit `c4b9597`). Any fix
must therefore also land on the integration branch, not only the spike branch.

Checks: `python3 -m unittest tests.test_execution_adapter` passed 31/31 on the spike
head. I also ran the reproduction below. I did not repeat the real probe.

## Round-one resolution

| R1 item | Status |
|---|---|
| M1: the stop Event closes on every public exit | Resolved. `run()` requires a `threading.Event` and sets it in `finally`. Prelaunch, spawn and parser paths are covered by tests. |
| M2: proof SHA mismatch | Resolved. The probe fingerprints source against HEAD, and the handoff records the untouched digest at `73a682f`. |
| m1: metadata queries ran in a shared cwd | Resolved. Each query uses a fresh empty `0700` directory with `--setting-sources ""`. |
| m2: prompt was passed in argv | Resolved. An unnamed `0600` `TemporaryFile` is passed as stdin, with no feeder thread. |
| m3: init customization fields | Resolved. Plugins, commands and skills are rejected. Only known built-in agent names are accepted, and the exact seven-tool gate is unchanged. |
| m4: duplicate result event | Resolved. |

Contract points verified:
- Restricted flags, an empty built-in tool set, strict MCP config, no persistence and an exact trusted inventory before the broker gate opens.
- Tool inputs and reasoning are discarded.
- Unknown usage and cost stay `None`, never zero.
- The CLI environment is an allowlist.
- Managed-policy hosts and non-personal auth profiles are refused.
- The broker endpoint must be owned with `0600`/`0700` permissions.
- The prompt never appears in argv.

## Findings

1. **Major — an exception during group termination escapes as a non-containment error, and the session records the stop as confirmed.**
   `adapter_process.py:194-205`: if `_terminate_group()` raises anything other than a
   `ProcessContainmentError`, the exception leaves `run_stream` with the process group
   unverified. For example, `_LeaderExit.ready()` can raise `OSError` from
   `kqueue.control` or `os.waitid`. `ClaudeAdapter.run` (`claude.py:221`) then maps that
   `OSError` to `AdapterError('cli_unavailable')`. `repoask/sessions/attempt.py:789-795`
   converts any adapter exception into `stop_confirmed: True`. Its comment states the
   invariant that this path breaks: "AdapterError/LeaseLost propagate only after
   run_stream contained the group".

   Reproduction: patch `_LeaderExit.ready` to raise `OSError` once the stop Event is
   set, then run `run_stream(["/bin/sh","-c","trap '' TERM; sleep 30"], ...)` and set
   the Event. The `OSError` escapes. `pgrep -g <pgid>` then shows both group members
   still alive. They received SIGTERM, ignored it, and SIGKILL was never sent.

   Impact: rare, because it needs a supervision-primitive failure. When it happens, a
   live CLI with an open broker endpoint and model access is reported as contained.
   The session then finishes as an ordinary failure instead of `containment_failed`.

   Fix:
   - In `run_stream`'s `finally`, treat any exception from `_terminate_group` as
     unconfirmed. Make a best-effort `killpg(SIGKILL)`, then raise
     `ProcessContainmentError`.
   - Have `attempt.py` assume `stop_confirmed: True` only for `AdapterError` (and
     `LeaseLost`). Any other exception should be treated as unconfirmed.
   - Add a regression test for each change.

2. **Minor — prelaunch CLI metadata queries ignore stop and can overrun the session deadline.**
   `_run_attempt` runs `auth status` and `plugin list --json` (10 s cap each) before
   `run_stream`, and neither query watches `stop_event`. `attempt.py:778` passes
   `timeout_seconds=min(wall, remaining)` with only a 10 s margin. A slow CLI can
   therefore push the agent about 10 s past the session deadline, and delay a user stop
   by up to 20 s before launch. Fix: pass the Event and a shared deadline to the
   metadata queries, or subtract their elapsed time from the run timeout.

3. **Minor — callback exceptions are misclassified.**
   `run()` maps every `ValueError` to `invalid_limits` and every `OSError` to
   `cli_unavailable`. That includes errors raised by the trusted `emit` and
   `on_inventory_verified` callbacks, such as a persistence failure. Limit validation
   already raises `AdapterError('invalid_limits')` directly, so the blanket mapping can
   be narrowed to the spawn boundary.

## Fix status

The user asked the reviewer to fix finding 1 directly. That fix is commit `698ead7` on
branch `task/adapter-containment-fix` (worktree `opendevin-adapter-containment-fix`),
based on integration `1fa296f`. Because the reviewer wrote it, it needs a fresh
independent review before integration.

- `attempt.py` is unchanged. Instead, the adapter now guarantees the invariant that
  `attempt.py` relies on: a raised error always means a contained exit. Narrowing
  `attempt.py` to `AdapterError` would have swallowed the `LeaseLost` that callbacks
  raise through the adapter.
- Findings 2 and 3 are not addressed.
- Verification: adapter suite 34/34, with three new regressions that fail before the
  change. Session and execution suites: 210 tests OK, 9 skipped.

Not findings: real Docker containment and real-model runs remain M2 release evidence
gates, as recorded for M2-SESSIONS.
