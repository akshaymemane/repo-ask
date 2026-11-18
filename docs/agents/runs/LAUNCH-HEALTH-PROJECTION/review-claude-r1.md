# LAUNCH-HEALTH-PROJECTION review — Claude, round 1

Verdict: **APPROVED** (one advisory)

- Reviewed commit: `25f0e8f` (+ handoff `7b65cce`), rebased onto `dbfa110` without conflicts. Author: Codex platform builder.
- Reviewer: Claude (launch-wave coordinator), opposite harness.

## Assessment

- `apply_service_health` projects persistent index counts by state, latest failure code, ask/planning role status
  (adapter, destination kind), and an execution summary. Every free-form value passes `_health_code`
  (`[a-z][a-z0-9_]{0,63}` or a fallback), so no paths, names, source or exception text can reach health output.
- The m0.1 envelope keeps its existing keys; the legacy index projection is replaced only when persistent indexing runs.
- Docker/agent codes report `not_checked` rather than inferring availability — honest; probing them would reintroduce
  startup/health latency (see LAUNCH-STARTUP-RECOVERY).

## Advisory

1. **Minor — repeated failed refreshes append duplicate lines/buttons.** `repoask/web/settings.js` `systemHealth()`
   error path appends a new "Health status is unavailable" paragraph and another "Refresh health" button on each
   failure instead of replacing the card contents. Follow-up: use `box.replaceChildren(...)` on the error path.

## Checks run (outside the author's sandbox)

- Python 632 tests OK (9 skipped); UI 299/299; `git diff --check` clean.
