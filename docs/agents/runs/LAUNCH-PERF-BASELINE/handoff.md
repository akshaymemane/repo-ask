# Builder handoff — LAUNCH-PERF-BASELINE

## Identity

- Author/harness: Codex, retrieval builder; session: current assigned task session.
- Branch/worktree: `task/launch-perf`, `.`.
- Base SHA: `2ec7383c01fafdb01f0530f24fe1f005e2cdff17`.
- Submitted SHA: pending local commit attempt; final response identifies outcome.
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
| Regression | `../repo-ask/.venv/bin/python -m unittest discover -s tests` | Running; final outcome to be recorded. |
| Whitespace | `git diff --check` | Exit 0. |

## Risks and next action

- Only 25 synthetic README chunks, lexical-only, not 100,000 chunks or real source
  trees; no claim of PRD reference-scale validation. CPU count 12; RAM/storage not
  verified. HTTP/browser and other Repositories page endpoints not measured.
- First-use is not OS-cold. Warm routing persists decisions; no result cache added.
- Full suite overlapped measurement; possible shared-host contention is disclosed.
- Migrations/configuration needed: none. No new package dependencies.
- Background processes: regression check still running at draft handoff time.
- Reviewer: Claude. Review exact submitted commit and fixture/method qualifications;
  coordinator owns integration and board status. No self-approval claimed.
