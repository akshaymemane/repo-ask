# M2-ADAPTER-SPIKE containment fix — independent review round 3

Verdict: **APPROVED** for exact commit
`698ead78093801bb7117928f3503a20889991606`.

Reviewer: fresh native Codex boundary reviewer, 2026-11-15. This reviewer did
not author the fix. Review was local and read-only except for this review record;
no Docker/model/account calls or live application ports were used.

Scope: the round-two major finding in `review-r2.md`, against
`docs/contracts/m2-execution-spike.md`. Base is integration commit
`1fa296f951a63d22d4f6d9d764a601b502e7b9ec`.

## Major finding disposition

**Resolved.** `run_stream` now catches every failure from the process-group
termination primitive, attempts a final group `SIGKILL`, and raises
`ProcessContainmentError` because absence was not verified. It never lets that
failure escape as an ordinary `OSError` that a caller could interpret as a
contained CLI exit.

`ClaudeAdapter.run` converts `ProcessContainmentError` from either metadata or
the agent process into a failed result with `code=containment_failure` and
`stop_confirmed=false`. `preflight` likewise preserves containment failure as a
stable containment error instead of `cli_unavailable`. Other callback errors
still propagate only after `run_stream` has completed its containment path, so
the session layer's existing invariant remains valid without swallowing
`LeaseLost`.

The regression reproduction launches a leader and child that both ignore
`SIGTERM`, injects an `OSError` from `_LeaderExit.ready` after cancellation,
asserts `ProcessContainmentError`, and verifies that the descendant is gone.
The adapter-level regression verifies the unconfirmed result projection.

## Independent checks

| Check | Result |
|---|---|
| Exact candidate and diff inspection | Commit matches `698ead7`; only the two adapter modules and adapter tests change |
| `test_execution_adapter.py` | 34/34 passed in 12.225 s |
| `test_execution*.py` | 147 passed, 6 Docker-dependent skips in 31.141 s |
| `test_sessions*.py` | 56 passed, 3 Docker-dependent skips in 48.322 s |
| `git diff --check 1fa296f..698ead7` | Passed |

The suites emitted existing resource warnings for intentionally supervised
subprocess/socket paths; they did not fail and no descendant from the injected
failure reproduction survived.

## Remaining follow-ups

The two round-two minor findings are unchanged and are not regressions in this
candidate:

1. Prelaunch auth/plugin metadata queries do not yet share the session stop event
   and deadline.
2. Blanket `OSError`/`ValueError` mapping can still misclassify trusted callback
   failures.

They remain owned follow-ups for M2 integration hardening. Real Docker and real
model runs remain milestone evidence gates. Neither is a blocker to integrating
this exact major containment fix.
