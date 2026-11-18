# LAUNCH-PERF-BASELINE

- Author: Codex, retrieval builder; coordinator/reviewer: Claude.
- Branch: `task/launch-perf`; worktree: `.`; base: `2ec7383`.
- Assignment: current user task; PRD §11 responsiveness, F01 catalog / F03 routing.
- State: ready for Claude review; implementation commit `c039ca7`, final evidence updates
  uncommitted because Git index-lock creation was denied. Both measured gates and focused smoke pass.
  Full regression exits 1 (644 tests: 69 failures, 101 errors, 9 skips), with sandbox
  restrictions documented in handoff. No owned background checks remain running.
- Exclusive scope: `scripts/`, `tests/test_benchmark_latency.py`, this run directory,
  `docs/LAUNCH-CHECKLIST.md`. No shared service/contract edits.
