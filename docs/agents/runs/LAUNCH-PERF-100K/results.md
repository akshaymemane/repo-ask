# LAUNCH-PERF-100K measured results

Measured 2026-11-18 on branch `task/launch-perf-100k`. Author: Claude; reviewer: Codex.

Command, from the worktree root with the repository virtual environment:

```sh
python scripts/benchmark_latency.py --catalog-reads 100 --routing-repeats 5 --source-chunks 100000 --assert
```

Exit 0 on both runs. Aggregate, per-page and per-prompt summaries: [measurements.json](measurements.json) (after the routing fix) and
[measurements-before.json](measurements-before.json) (same workload, before it).

## Reference workload (Master PRD §11)

250 repository metadata records, 25 indexed repositories, **100,000 chunks** (4,000 per repository) in 5,025 files,
fed by an injected synthetic snapshot reader through the production ingestion, chunker and FTS path. Database 1.10 GB. Indexing all 25 took 81–90 s
(lexical only; no embeddings). All 50 labelled routing prompts, 5 warm repeats each; catalog as in LAUNCH-PERF-BASELINE.

| Operation | Phase | Samples | p50 (ms) | p95 (ms) | max (ms) | Gate |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| catalog | cold | 7 | 0.8 | 1.9 | 1.9 | |
| catalog | warm | 700 | 0.6 | 1.6 | 1.9 | p95 < 1,000 ✅ |
| routing | cold | 50 | 786 | 920 | 1,191 | |
| routing | warm | 250 | 783 | **936** | 978 | p95 < 2,000 ✅ |

Before the routing fix, warm routing was p50 1,007 / p95 1,410 / max 1,883 ms: passing, but one prompt was within
120 ms of the gate.

## Defects found and fixed by this run

1. **The reference workload could not be indexed.** The index disk cap (512 MiB) measured the whole app database and
   could only be lowered. 100,000 chunks of typical code take about 1.1 GB, so indexing paused with `disk_limit` at
   ~38,000 chunks. Real repositories in this workspace average 0.7–2.3 KB per chunk; the fixture uses ~2.4 KB, about the
   same as this repository. Fix: 4 GiB default, live-page accounting (a deleted index frees headroom), a 1 GiB
   free-space reserve, and plain-language pause copy. Runs created before this change carry no provenance marker; on
   resume or retry they adopt the new default in place of the old 512 MiB default. Runs created after it keep every
   stored cap, including an explicit 512 MiB.
2. **Routing recomputed eligibility for every repository per candidate and per hit** (5,220 full-map builds for 10
   routes at 20,000 chunks, about half of routing time). `is_eligible` now checks one row. Search also evaluates path
   exclusions once per file instead of per chunk.

## Limits of this evidence

- Synthetic source: deterministic generated Python whose identifiers mix the repository's own profile words, labelled
  prompt words and generic code terms. This is a lexical latency workload, not retrieval-quality evidence.
- No embeddings, so semantic search time is not included. Model, network, clone and container startup are excluded,
  as the PRD requires.
- Host: macOS 15.7 x86_64, 12 logical CPUs, 32 GiB RAM, internal SSD; Python 3.12.0, SQLite 3.42.0. The PRD reference
  is 8 cores / 16 GiB; this host is larger. Disk cache state was not controlled. Codex's review (focused unit tests) overlapped part of the
  final measurement, so it is a shared-host result.
- Service-level timing only: no HTTP, JSON or browser rendering.
