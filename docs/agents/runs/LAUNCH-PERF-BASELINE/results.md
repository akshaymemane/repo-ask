# LAUNCH-PERF-BASELINE measured results

Measured 2026-11-18 on base `2ec7383`, branch `task/launch-perf`. Review pending with Claude.

Exact command from this worktree (the supplied interpreter expressed relative to the repository):

```sh
../repo-ask/.venv/bin/python scripts/benchmark_latency.py --catalog-reads 100 --routing-repeats 5 --assert
```

Exit status: 0. Both warm p95 gates passed on this fixture only. Full precision and per-page/per-prompt distributions are in [measurements.json](measurements.json).

| Operation | Phase | Samples | p50 (ms) | p95 (ms) | max (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| catalog | cold | 7 | 0.674 | 1.646 | 1.646 |
| catalog | warm | 700 | 0.518 | 1.350 | 1.548 |
| routing | cold | 50 | 249.647 | 305.642 | 494.441 |
| routing | warm | 250 | 258.648 | 315.221 | 640.739 |

Catalog query/page warm distributions:

| Query | Page | Samples | p50 (ms) | p95 (ms) | max (ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| all | 1 | 100 | 0.967 | 1.008 | 1.097 |
| all | 2 | 100 | 0.976 | 1.019 | 1.114 |
| all | 3 | 100 | 0.503 | 0.511 | 0.620 |
| broad | 1 | 100 | 1.346 | 1.394 | 1.548 |
| broad | 2 | 100 | 0.513 | 0.531 | 0.592 |
| selective | 1 | 100 | 0.458 | 0.539 | 0.609 |
| no_match | 1 | 100 | 0.446 | 0.476 | 0.544 |

## Fixture and method

Reproduces the setup in `tests/test_ask_routing_evaluation.py:evaluate()`: real temporary SQLite data directory, fake GitHub discovery of the same 250 metadata records, and the first 25 repositories indexed through the real IndexService/Worker. Each snapshot contains one synthetic README profile, producing **25 files and 25 chunks**, with lexical-only retrieval and no embeddings or configured models. Uses all 50 labelled `tasks` prompts in fixture order. Does not run the five `multi_tasks`, ambiguous/absent/path evaluations, or evaluation post-processing mutations; this measures latency, not routing quality.

The Repositories page calls the catalog list API through `GitHubService.list_repositories`, with `limit=100`, cursors and optional text query (`repoask/web/repositories.js`). The benchmark covers every page for four representative query values: empty (3 pages), `owner` (2), `billing` (1), and a no-match string (1). The page does not send owner/index-enabled server filters. Arbitrary possible search text is not exhaustively covered. Context/index-status APIs fetched alongside the catalog are not included.

Cold means the first traversal/first call for each prompt after fixture construction. Construction already touches SQLite; no OS or SQLite cache eviction is attempted. Cold samples share one process, and later samples can benefit from earlier calls. Warm means a further complete unmeasured traversal and routing pass, then 100 reads per variant/page and five calls per prompt. There is no added application result cache. Routing includes its normal persisted decision writes; the database grows during the run. Percentiles use nearest rank and `perf_counter_ns`; catalog samples are individual page service reads, not full multi-page traversals.

The benchmark uses no network, clone, inference, or container startup; those times are excluded rather than estimated. Fake transport is used during setup and replaced with a failing transport during measurement. HTTP dispatch, JSON serialization, browser rendering and concurrent-user load are outside scope. The harness adds no dependencies beyond stdlib; it imports the existing application and GitHub test fixture, which require the project environment (including cryptography).

## Environment and limits

Python 3.12.0; SQLite 3.42.0; platform `macOS-15.7.9-x86_64-i386-64bit`; `platform.processor()` returned `i386`; `os.cpu_count()` returned 12.

The PRD reference specifies 250 metadata records, 25 code-indexed repositories, up to 100,000 eligible chunks, SSD, 8 logical CPU cores and 16 GiB RAM. This matches the repository counts but contains only 25 synthetic README chunks, no representative source trees or semantic vectors. CPU count is 12; SSD and RAM were not verified. This is a baseline for the existing evaluation fixture, **not validation at 100,000 chunks or on the specified reference hardware**. Disk cache state is uncontrolled. The full regression suite overlapped this run, so these are shared-host measurements with possible contention, not an isolated machine benchmark.

## Verification

- Full benchmark command above: exit 0, 700 warm catalog reads and 250 warm routing calls.
- `../repo-ask/.venv/bin/python -m unittest discover -s tests -p test_benchmark_latency.py`: 1 test passed in 3.508s; reduced workload uses the same 250/25 fixture, two prompts and two repetitions/reads. No performance threshold assertion.
- Full regression suite: outcome recorded in handoff.
