# LAUNCH-PERF-100K — independent Codex review, round 3

Verdict: **approve exact commit `30ac755b7114a46b7aacdb0a48ff50091d46ed76`**

- Reviewer: Codex, independent quality and boundary/security reviewer personas. Author: Claude.
- Reviewed range: `e6001d0d78b2548d1e55b96579c35296d7f6d5f0..30ac755b7114a46b7aacdb0a48ff50091d46ed76`, with earlier branch context as needed. Branch: `task/launch-perf-100k`; worktree: `.`; HEAD matched the submitted commit; working tree initially clean.
- Inputs: AGENTS.md, round 2 review, Master PRD, F02/F03, indexing contract, workflow, quality/security personas, review template, submitted diff and relevant implementation/test/UI paths. No task-specific handoff or immutable packet/manifest was supplied; the user assignment supplies review scope and Git objects identify the reviewed changes.
- Requirements: IX-01/IX-02, caller-lowerable finite limits, durable continuation, bounded public progress/coverage and unchanged reader/API contracts.

## Findings and prior issue disposition

No findings after the focused behavior checks and boundary inspection below. The round 2 MEDIUM finding is resolved: newly created runs persist provenance separately from the effective limits passed to ingestion. Both resume and retry retain an explicit 512 MiB cap. Unmarked legacy runs with the superseded 512 MiB default adopt 4 GiB once and receive the marker. Other stored caps remain unchanged.

The updated results text accurately describes this distinction and corrects the previously identified measurement wording/rounding issues. Unmarked runs created during an intermediate 4 GiB-default revision cannot distinguish explicit 512 MiB from the legacy default; the documented migration applies to all unmarked runs. This is consistent with the submitted creation-boundary policy, rather than a claim that historical explicit intent can be recovered.

## Independently reproduced behavior

Ephemeral interpreter probes used the real migrated SQLite/IndexService/Worker fixture from `test_indexing_service.py`. Only logical used-byte accounting was replaced with 600 MiB, avoiding large allocation. No test or product files were edited.

| Case | Stored cap after continuation | Second worker result |
| --- | --- | --- |
| New explicit 512 MiB, resume | 536,870,912 bytes | paused / disk_limit |
| New explicit 512 MiB, retry | 536,870,912 bytes | paused / disk_limit |
| Unmarked legacy 512 MiB, resume | 4,294,967,296 bytes | completed |
| Unmarked legacy 512 MiB, retry | 4,294,967,296 bytes | completed |

All four initially paused with disk_limit at 600 MiB. Legacy rows were simulated by removing the provenance marker from persisted limits; retry cases additionally changed the domain run to failed after the first worker released its job. Thus retry continuation was exercised, but failure generation itself was not under test. Each continued row persisted defaults_version=2.

The reader wrapper asserted that defaults_version was absent on every acquisition call (two calls per case). Probes also asserted its absence from request/continuation/get_run responses, get_state, catalog_candidates, persisted progress/checkpoints and snapshot coverage; completed legacy cases additionally checked search responses and their snapshot coverage. The marker remained confined to internal limits_json.

Inspection traced all indexing limits_json reads: creation/continuation persist the marker; `_run_index` removes it before calling `_snapshot`, building progress, checkpoints or coverage. `_public_run` exposes selected fields and progress, never limits_json. ContextAPI forwards these public service outputs for run actions, catalog/state and search. UI consumers in `repoask/web/context.js` and `repoask/web/repositories.js` use those public responses; neither accesses internal limits. Caller validation rejects defaults_version as an unknown limit. These checks support absence from the UI data path; no browser rendering test was run.

## Focused checks run

All commands used `../repo-ask/.venv/bin/python`:

| Command arguments | Result |
| --- | --- |
| `-m unittest discover -s tests -p 'test_indexing*.py'` | 48 passed |
| `-m unittest discover -s tests -p 'test_index_*.py'` | 5 passed |
| `-m unittest discover -s tests -p 'test_benchmark_latency.py'` | 2 passed |

Total: **55 passed**, no reported skips. The indexing suite reran the explicit-512-MiB preservation, legacy recovery, lowered-cap and unreadable-free-space cases. Additional probes above ran with the same interpreter. No full regression suite or benchmark above 1000 source chunks was run; the benchmark test uses 250 source chunks. The 100k timings remain author-provided evidence with the limitations recorded in round 2; this review did not reproduce them.

## Integration recommendation

The reviewed fix closes the remaining round 2 blocker. The integrator may apply the exact reviewed commit and rerun affected combined checks. Only this review file was written; code, tests and results were unchanged. Approval does not imply integration, establish the reference-hardware performance gate, or authorize remote publication.
