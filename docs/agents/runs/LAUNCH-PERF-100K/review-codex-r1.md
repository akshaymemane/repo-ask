# LAUNCH-PERF-100K — independent Codex review, round 1

Verdict: **changes requested**

- Reviewer: Codex, independent quality + security reviewer personas.
- Author: Claude; branch `task/launch-perf-100k`.
- Exact reviewed commit: `452419646e1ed923ad57a7ce75f3d3ebde60b9d2`.
- Parent/base: `b8a0ab423e7faa9531e8e9527f33c78c70e1c75a`.
- Worktree: `.`. Reviewed `git show 4524196` and commit-matching product/scripts/tests. No separate immutable review packet/manifest was supplied.
- Inputs: AGENTS.md, workflow, both reviewer personas, review template, Master PRD §11, F02/F03 specs, and `docs/contracts/m1-indexing.md`. No LAUNCH-PERF-100K task card or author handoff was present in the board/run directory inspected; the user's assignment supplies scope and acceptance concerns.
- Existing modification to `measurements.json` was preserved. Measurement claims below refer to the committed Git object, not that mutable file.

## Findings

### HIGH — Existing disk-paused runs retain the old default indefinitely

Location: `repoask/indexing/safety.py:12`; persisted-limit consumers at `repoask/indexing/service.py:167`, `:189`, `:454`.

Raising DEFAULTS only affects newly created runs. Each run stores the fully expanded defaults in `limits_json`; resume never updates them, and `_run_index` reads the stored values. `request_index` also returns an existing paused run instead of creating a replacement. Consequently, the workload already paused around 38k chunks with the old 512 MiB limit can remain paused at that limit after this upgrade. The new UI's resume advice cannot give that run the new 4 GiB headroom. Live-page accounting may briefly allow progress, but it does not remove the persisted ceiling.

Independent reproduction used a tiny prior default to avoid creating a large database: create a run with DEFAULTS temporarily set to disk_bytes=1, restore the current 4 GiB default, execute, request indexing again, resume, and execute again. The new request returned the same run; the final state remained `paused/disk_limit`, with persisted disk_bytes=1.

Requested fix: provide an explicit recovery path to adopt a larger cap or replace the paused run without purging unrelated usable context. Preserve intentionally lowered user limits; do not indiscriminately rewrite all stored caps. Verify upgrade/recovery from a run created under the previous default. Owner: author/integrator. Requirement: task's existing disk_limit blockage; IX-01/IX-02 recovery.

### MEDIUM — Free-space inspection errors fail the run rather than pause it

Location: `repoask/platform/db.py:99`, called by `repoask/indexing/service.py:447`.

`shutil.disk_usage` can raise OSError, including FileNotFoundError if the data directory disappears between opening SQLite and inspecting the filesystem. The new call propagates through `_disk_exhausted`; the general run handler maps it to `failed/index_failed`. A transient filesystem/statvfs failure therefore loses the actionable disk-pressure diagnosis and Resume behavior. Treating unknown free space as unrestricted would also undermine the reserve.

Independent reproduction patched only `repoask.platform.db.shutil.disk_usage` to raise OSError while running a real small indexing fixture through Worker. Observed result: `failed/index_failed`. A direct FileNotFoundError probe also propagated from `free_bytes`.

Requested fix: handle inability to establish free space explicitly and fail closed into a recoverable, content-free disk/storage pause, then verify continuation after the probe recovers. Owner: author/integrator. Requirement: F02 disk-pressure pause/cleanup behavior and IX-01/IX-02.

### LOW — `--source-chunks` silently rounds the requested workload down

Location: `scripts/benchmark_latency.py:79`.

Integer division assigns the same chunk count to all 25 repositories and discards the remainder. Independent `fixture(26)` produced 25 chunks. Inputs below 25, including negative values accepted by argparse, also fall back to 25 README chunks. This conflicts with the option's description as a total chunk count and the generator's exact-target intent. The reported actual chunk count is honest, and 100000 divides evenly, so this does not invalidate that particular workload size.

Requested fix: validate the supported range and either distribute the remainder or reject unsupported totals clearly. Owner: author. Requirement: benchmark workload accuracy.

## Coverage and independent checks

Commands run with `../repo-ask/.venv/bin/python`:

| Focused unittest discovery pattern | Result |
| --- | --- |
| `test_indexing*.py` | 44 passed |
| `test_github_service.py` | 30 passed |
| `test_storage_usage.py` | 1 passed |
| `test_ask_routing_evaluation.py` | 1 passed |

Additional ephemeral probes, with no product/test edits:

- WAL autocheckpoint disabled, followed by eight small job writes: logical used bytes grew by 98,304 bytes and stayed identical after WAL truncation/checkpoint. Thus uncheckpointed logical pages are included. This metric intentionally omits repeated historical WAL frames and reusable free pages; it is not physical file usage. The physical workspace reporting method remains unchanged.
- In-memory Store returned used_bytes=0 and free_bytes=None, preserving its existing disk-accounting exemption.
- Free-space failure and persisted-old-default recovery reproductions described above.
- Only a 26-chunk benchmark fixture was constructed; no full latency benchmark or workload above 1000 was run.

Security/quality inspection found no new eligibility or exclusion bypass: `_ELIGIBLE` is the exact prior SQL predicate, missing initial repository IDs still raise NotFound, and deletion between the two reads now returns false instead of the prior missing-map-key error. The lexical exclusion cache is local to one search and keyed by repository and path. Final eligibility/snapshot/exclusion revalidation remains under the Store lock after provider I/O. `VectorStore.used_bytes` uses the same RLock as vector writes, queries, purge and close; no new unlocked APSW connection access was introduced there. These concurrency conclusions are code inspection, not a stress-test result.

The reserve deliberately pauses persistent indexing on runners with less than 1 GiB available; the focused tests passed on this machine, but no low-capacity CI volume was exercised. The added reserve test restores actual machine free space before expecting completion, so it depends on sufficient host space. UI wording broadly explains the two triggers, though the threshold is 1 GiB and is checked against projected incoming bytes. Deleting rows releases logical cap headroom; it need not shrink database files enough to restore volume free space.

Synthetic source generation has a stable per-repository PRNG seed and sorted vocabulary, and passes through production ingestion/chunking. It intentionally draws words from repository profiles and labeled prompts, so it is useful for a lexical latency workload, not independent real-code retrieval-quality evidence. Snapshot IDs/chunk IDs remain newly generated, so tie ordering is not guaranteed identical across fixture builds. Committed results explicitly disclose synthetic source, zero embedding models, service-only timing, hardware, and the limited meaning of cold measurements. The committed before/after measurement files are identical; they do not establish an optimization speedup. I did not independently reproduce the 100k timing or reference hardware gate.

## Integration recommendation

Return the HIGH/MEDIUM recovery findings to the author before approval. Re-run affected focused checks and add behavior coverage for persisted-limit recovery and failed free-space inspection after fixes. A new exact-commit review is required. This review neither integrates changes nor authorizes publication.
