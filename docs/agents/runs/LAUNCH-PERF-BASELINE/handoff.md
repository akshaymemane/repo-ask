# Builder handoff — LAUNCH-PERF-BASELINE

## Identity

- Author/harness: Codex, retrieval builder; session: current assigned task session.
- Branch/worktree: `task/launch-perf`, `.`.
- Base SHA: `2ec7383c01fafdb01f0530f24fe1f005e2cdff17`.
- Implementation commit: `c039ca7`. Final evidence updates remain uncommitted: the
  follow-up `git add` was denied while creating the worktree Git index lock.
  The initial commit succeeded and includes the requested Co-Authored-By trailer.
- Task card: user assignment LAUNCH-PERF-BASELINE; requirement: Master PRD §11
  responsiveness gates, with F01 catalog and F03 routing fixture inputs.
- Status: review pending with Claude; not integrated or published.

## Outcome

Added `scripts/benchmark_latency.py`, `tests/test_benchmark_latency.py`,
`docs/agents/runs/LAUNCH-PERF-BASELINE/{status.md,results.md,measurements.json,handoff.md}`
and updated `docs/LAUNCH-CHECKLIST.md`, all within exclusive scope. No service,
manifest, API contract or migration changes. Reproduces evaluate() setup without
modifying its consumers. JSON report includes first-use/warm percentiles, counts,
environment, query/page and prompt breakdowns. `--assert` alone enables gate failures.

## Verification evidence

| Requirement | Command or scenario actually run | Result / evidence |
| --- | --- | --- |
| PRD §11 latency baseline | `../repo-ask/.venv/bin/python scripts/benchmark_latency.py --catalog-reads 100 --routing-repeats 5 --assert` | Exit 0; catalog warm p95 1.350388 ms / 700 reads; routing 315.220533 ms / 250 calls. See results and measurements. |
| Benchmark smoke | `../repo-ask/.venv/bin/python -m unittest discover -s tests -p test_benchmark_latency.py` | Exit 0; 1 test, 3.508s. |
| System Python smoke | `python3 -m unittest discover -s tests -p test_benchmark_latency.py` | Exit 0; 1 test, 3.397s. |
| Regression | `../repo-ask/.venv/bin/python -m unittest discover -s tests` | Exit 1; 644 tests in 366.535s, failures=69, errors=101, skipped=9. |
| Whitespace | `git diff --check` | Exit 0. |

## Risks and next action

- Only 25 synthetic README chunks, lexical-only, not 100,000 chunks or real source
  trees; no claim of PRD reference-scale validation. CPU count 12; RAM/storage not
  verified. HTTP/browser and other Repositories page endpoints not measured.
- First-use is not OS-cold. Warm routing persists decisions; no result cache added.
- Full suite overlapped measurement; possible shared-host contention is disclosed.
- Full regression is not green in this sandbox: 88 tracebacks explicitly report
  denied operations (principally socket binding), plus six `/bin/ps` denials.
  Execution/session assertions also failed; not every failure was independently
  diagnosed. Benchmark smoke passed within the suite and in both focused runs.
  Coordinator should run full regression in an environment permitting its runtime
  checks; no unrelated runtime changes are included in this task.
- Migrations/configuration needed: none. No new package dependencies.
- Background processes: none left running by this task.
- Reviewer: Claude. Review exact submitted commit and fixture/method qualifications;
  coordinator owns integration and board status. No self-approval claimed.
