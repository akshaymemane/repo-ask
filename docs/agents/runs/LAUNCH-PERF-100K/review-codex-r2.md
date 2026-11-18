# LAUNCH-PERF-100K — independent Codex review, round 2

Verdict: **changes requested**

- Reviewer: Codex, independent quality and security reviewer personas. Author: Claude.
- Exact reviewed range: `452419646e1ed923ad57a7ce75f3d3ebde60b9d2..e6001d0d78b2548d1e55b96579c35296d7f6d5f0`, including fix `3937423` and results commit `e6001d0`.
- Branch: `task/launch-perf-100k`; worktree: `.`; HEAD matched the submitted commit. Inspected the requested diff and the earlier branch product changes where relevant.
- Inputs: AGENTS.md, Master PRD (especially §11), F02/F03, indexing contract, workflow, quality/security personas, review template, round 1 review, results and both measurement files. No task card, author handoff or immutable review packet/manifest was present for this task; the user assignment supplies review scope.
- Only this review file was written. No product, test or measurement changes; no publication or integration.

## Finding

### MEDIUM — Resume silently raises an explicitly lowered 512 MiB cap

Location: `repoask/indexing/service.py:216–219`; related claim: `docs/agents/runs/LAUNCH-PERF-100K/results.md:37`.

Requirement: IX-02 and the indexing contract's caller-lowerable finite caps; round 1 explicitly required preserving intentionally lowered limits.

The migration identifies an old default solely by its numeric value. Under the new 4 GiB default, `request_index(..., limits={'disk_bytes': 512*1024**2})` is a valid explicit reduction. Any resume or retry changes that cap to 4 GiB, even for a newly created run. There is no creation-version or explicit-limit provenance check. The results claim that user-lowered caps are kept is therefore false for this supported value.

Independent behavior reproduction used the real SQLite/Worker indexing fixture, an explicit 512 MiB cap, and injected logical used-byte accounting of 600 MiB to avoid allocating a large database. The first worker paused with `disk_limit`. After `resume`, the stored cap was **4,294,967,296 bytes**, and the second worker **completed** while accounting still reported 600 MiB. Only accounting was injected; run creation, persistence, pause, resume and ingestion used production behavior. The existing preservation test uses a cap of 1 byte and misses this collision.

Requested fix (author/integrator): distinguish explicit caps from inherited defaults, or provide an explicit cap-adoption/replacement recovery action for ambiguous legacy runs. Preserve the cap on ordinary resume/retry for an explicitly limited new run, including exactly 512 MiB. Add behavior coverage for that case and retain legacy-default recovery coverage. Update the results claim to match the final behavior. This remains a release-blocking limit-preservation issue for this review.

## Round 1 disposition and behavior evidence

| Round 1 finding | Disposition | Independently run evidence |
| --- | --- | --- |
| HIGH: old persisted default prevents recovery | Recovery works, but preservation requirement remains incomplete | `test_resume_adopts_current_default_for_superseded_cap` passed: persisted 512 MiB becomes current default and real worker completes. `test_user_lowered_cap_survives_resume` passed for 1 byte. Additional explicit-512-MiB probe reproduced the finding above. |
| MEDIUM: free-space inspection errors fail the run | Resolved | `test_unreadable_free_space_pauses_instead_of_failing` passed, including continuation after FileNotFoundError recovery. Additional probe patched `repoask.platform.db.shutil.disk_usage` to raise generic OSError: worker produced `paused/disk_limit`, then completed after restoring the probe and resuming. |
| LOW: source workload silently rounds down | Resolved for CLI contract | Independent `fixture(26)` and `fixture(49)` produced exactly 26 and 49 persisted chunks. `source_total` rejected -1, 1, 24 and 250001. The focused benchmark tests also passed, including the 250-chunk subprocess. Remainders are distributed and supported CLI totals are explicitly constrained. |

## Focused checks run

All commands used `../repo-ask/.venv/bin/python`:

| Command arguments | Result |
| --- | --- |
| `-m unittest discover -s tests -p 'test_indexing*.py'` | 47 passed |
| `-m unittest discover -s tests -p 'test_github_service.py'` | 30 passed |
| `-m unittest discover -s tests -p 'test_storage_usage.py'` | 1 passed |
| `-m unittest discover -s tests -p 'test_benchmark_latency.py'` | 2 passed |

Total: **80 passed**, no reported skips. Additional probes were ephemeral interpreter scripts using existing fixtures; no test files were added. No full regression discovery was run. No benchmark or fixture above 1000 source chunks was run; the largest executed benchmark fixture was 250 chunks.

## Measurement and claims audit

Read both committed JSON files and compared fixture, method, aggregate, per-page and per-prompt summaries with `results.md`.

- Both files report 250 repositories, 25 indexed repositories, 100,000 chunks, 5,025 files, 50 labelled prompts and zero embedding models. Seven catalog pages × 100 reads give 700 warm samples; 50 prompts × 5 repeats give 250 warm routing samples. Cold counts are 7 and 50. Per-page/per-prompt sample totals agree.
- After results match the table at its displayed precision: catalog cold p50/p95/max = 0.759236/1.874188/1.874188 ms; warm = 0.609421/1.631689/1.878083 ms. Routing cold = 785.952677/920.061885/1190.954712 ms; warm = 782.833537/936.043545/977.782177 ms.
- Before warm routing is 1007.481468/1409.681458/1883.294945 ms. The prose's p50 1,008 differs by about 0.5 ms (nearest integer is 1,007); this does not affect the conclusion. The worst sample is 116.705055 ms below 2,000, consistent with “within 120 ms.” This is a worst-sample observation, not the p95 gate margin.
- Database sizes are 1,103,454,208 and 1,103,486,976 bytes, consistent with 1.10 decimal GB. Indexing times 80.6 and 90.2 seconds support the rounded 81–90 s statement. Database bytes are page-count accounting, not all physical database/WAL/vector storage.
- Both stored warm p95 values satisfy the respective strict gates. The JSON files now differ and support an observed before/after improvement on this host. They do not establish causality or a hardware-normalized speedup from one pair of runs. I did not rerun the 100k workload or independently reproduce its timings or exit status.
- The stated synthetic lexical-only, service-only scope, uncontrolled cache, larger host and overlapping host activity appropriately limit the performance claim. These results do not prove the 8-core/16-GiB reference hardware gate or retrieval quality. The JSON confirms OS/Python/SQLite/CPU count; RAM, SSD and overlapping activity are author-provided context, not independently measured here.
- “Full distributions” is imprecise: the files contain aggregate and per-page/per-prompt summaries, not raw timing samples. Consequently I could verify reported summaries and counts, but could not recompute aggregate percentiles from raw samples.
- “Production reader → chunker → FTS” should be read narrowly: the benchmark injects its synthetic snapshot reader; it exercises production ingestion/chunking/FTS, not production GitHub/local source acquisition. Real-repository chunk-size ranges, the ~38k pause point and the 5,220 eligibility-call profile are not independently substantiated by these two JSON files. They remain author observations, not measurements reproduced in this review.
- The cap-preservation claim is contradicted by the behavior probe above and needs correction with the fix.

## Other coverage and integration recommendation

Inspection of the earlier branch eligibility SQL, per-search exclusion cache and logical storage accounting found no additional concrete regression beyond the finding above. The eligibility predicate remains unchanged; final retrieval eligibility/exclusion checks and vector locking remain in place. This is inspection plus the focused suites, not a concurrency stress test or a broad security certification.

Return the cap-preservation issue to the author. After fixing it, rerun the affected focused checks and obtain review of the new exact commit. The free-space and workload-count findings are closed; legacy recovery is operational but cannot be considered fully resolved while it overrides an explicit cap. This review does not integrate the branch or authorize publication.
