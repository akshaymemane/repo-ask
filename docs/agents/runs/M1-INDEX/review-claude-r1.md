**Recommendation: CHANGES REQUESTED** for exact commit `d8f1005eeb13f544c3fc465ff2fc66acaa2c4a7d` (base `e7c4a5e`). There are two blocking findings and three major ones.

I did read and search only. I ran no tests and no git commands. The reproductions below are traced from the code, not executed. Your run of 126 Python tests passing is your evidence, not mine.

**Identity and scope**
- Packet: `.git/opendevin-runtime/reviews/d8f1005e…/`. Task M1-INDEX, branch `task/m1-index`, author Codex retrieval-engineer.
- **Base SHA mismatch:** `task.json`, `status.md` and `handoff.md` all say base `db85564…`, but the manifest says `e7c4a5e`. This fits the coordinator applying migration5 (`13c3dde`) before the commit, but I can't check the ancestry. The integrator should confirm it.
- The handoff still says "Submitted SHA: none", which is stale now that the commit exists.
- The diff only adds files inside the assigned paths. No migration, shared entrypoint or board file is touched. Good.
- I could not compute the manifest SHA256 hashes with my tools; the integrator rechecks them.

## Blocking

**B1 — With the default limits, semantic (hybrid) search can't work on realistically sized repositories (IX-05, AC5).**
- `safety.py:9-11` sets the defaults `embedding_tokens=250000` and `batch_tokens=8192`, both counted as UTF-8 bytes. `safety.py:27` lets callers only *lower* limits, never raise them.
- `service.py:456-460`: once the running byte total passes 250,000, the run sets `namespace_id=None` and the whole snapshot is activated lexical-only. `service.py:456` also counts chunks whose vectors came from the cache, so reindexing never gets past the cap.
- The chunker (`safety.py:92-104`) allows chunks up to 12,000 bytes, which is bigger than the 8,192-byte batch cap. At `service.py:447-452`, a single oversized chunk produces an empty batch, and the whole snapshot falls back to lexical-only.
- **Repro (cap):** index any repository with more than about 250 KB of chunk text, using the defaults and an embedding profile. Result: `mode='lexical_only'` with degradation code `embedding_token_limit`, and nothing the caller sets can change it.
- **Repro (oversized chunk):** add one file of 60 lines × 150 characters (about 9 KB, no `def`/`class` lines). The whole repository goes lexical-only.
- The degraded mode is labelled honestly, but the only hybrid evidence is a 3-file fixture.
- **Fix:** make the defaults consistent (chunk size ≤ `batch_tokens`, and an embedding cap sized against `source_bytes`), don't count cache hits against the token cap, and split or skip oversized chunks rather than dropping semantics for the whole repository. Add a test at default limits with more than 250 KB of source.

**B2 — The handoff says rate limits schedule a retry; that is only true for the test fixture, not the real provider service.**
- `service.py:295-297` keeps only the error codes `rate_limited` and `timeout`. The real `ProviderService` raises `provider_rate_limited` and `provider_timeout` (`providers/errors.py:99, 109`).
- Result: a real HTTP 429 from the embedding provider leaves the run `failed` with `index_failed`. No continuation is scheduled and the provider's `retry_at` is ignored.
- The test that covers this (`test_indexing_service.py:382`) has a fake raising `IndexError('rate_limited')`, so the real error path is never exercised.
- **Repro:** use the real `ProviderService` with an injected transport that returns 429 → the run ends `failed`, not `waiting`.
- **Fix:** map the provider codes (`provider_rate_limited`, `provider_timeout`, `provider_unavailable`) to retryable handling, and test through the real ProviderService with an injected 429 transport.

## Major (should be fixed or explicitly accepted by the coordinator)

**M1 — `partial` coverage is over-reported, so almost no real repository can ever show `ready`.**
- `service.py:408` sets `partial=bool(skips)`, so any skipped file counts.
- `safety.py:60` treats every dotfile as sensitive, so `.gitignore`, `.github/` and similar always produce a skip. The test at `test_indexing_service.py:102` relies on this.
- **Fix:** set `partial` only for skips caused by limits (files, bytes, chunks, tree size, elapsed time, embedding budget, sources marked limited). Report policy exclusions in the skip counts without making the snapshot partial.

**M2 — Retrying after an exclusion change fails forever.**
- When selection changes mid-run, `service.py:453-455`, `476-477` and `501-502` raise `selection_changed`. Line 296 turns that into `index_failed`, which hides the real cause.
- `_continue` (`service.py:172-174`) keeps the same `phase`, `snapshot_id` and staged files. Each retry replays the same now-excluded rows and fails again.
- **Fix:** on `selection_changed`, start a fresh staging snapshot (or reset phase and checkpoint), and keep `selection_changed` as an error code.

**M3 — Several limits pause the run and need someone to resume it by hand, which stalls background indexing.**
- `service.py:332-335`: a third worker pauses its run with `worker_limit` and nothing ever resumes it.
- `service.py:329`: the elapsed-time clock `started` is shared by ingestion and embedding. Ingestion that hits 120 s cuts off coverage (line 361). Embedding then pauses with `elapsed_limit` after its first batch, and again every 120 s after each resume.
- **Fix:** for worker and elapsed limits, schedule a continuation with a later `run_after` (as the rate-limit path does) instead of a manual pause.

## Minor
- `service.py:174`: calling `retry` on an old cancelled or failed run while a newer run is active hits the `index_run_active` unique index and raises a raw `IntegrityError`.
- `service.py:699`: purge sets a demo source's `metadata_json` to `'{}'`. If it is re-enabled via `set_local_selection` without calling `register_demo` again, `_snapshot` hits a `KeyError` on `revision`.
- Staging snapshots, chunks, FTS rows and vectors from failed or abandoned runs are only removed by purge. ADR0002 says unactivated staging is repaired or discarded on recovery.
- `db.py:72`: the disk check doesn't count the WAL file.
- `catalog_candidates` writes an `index_sources` row for every eligible GitHub repository during a read.

## Checked, no finding
- **Lease fencing:** every write checks the domain run's `job_id`, the lease owner, token and expiry, and cancellation under the Store lock (`service.py:232-247`). Vector writes happen inside that fenced transaction. The provider cancel guard re-checks before and after the call. Model, network and Git work runs outside transactions.
- **Source access and exclusions:** files are excluded before fetch, FTS and provider calls. Local Git reads use bounded, immutable objects with hooks and fsmonitor disabled and no shell. GitHub checks `require_access` before every tree and blob, and size-checks blobs before fetching them. Search, source reads and activation re-check current exclusions and revocation.
- **Namespace and KNN scope:** vector tables are per namespace (identity includes profile version, dimensions and chunker). Each KNN query has its snapshot constraint inside the SQL (`vectors.py:98`). Query namespaces are re-validated.
- **Citations:** chunk IDs are per snapshot, old retained snapshots are readable by exact snapshot, and `source()` caps range and context.
- **Purge and restart:** purge writes a tombstone first, purges vectors, then removes metadata. It is retryable and blocks reselection until finished.
- **Lexical-only fallback:** explicitly labelled.

**Blocker owner:** author (M1-INDEX builder) fixes on `task/m1-index`; this approval would then bind to the new commit. Coordinator decides whether to accept M1–M3. Integrator should rerun the full suite and the five HTTP tests that need loopback sockets.
