**Recommendation: CHANGES REQUESTED** for exact commit `469954f9a6bedc003d7de1e61c3074f2b5a711b7` (base `d8f1005`). All five R1 findings and the minors you requested are fixed in code. The fix for B2, though, created one new blocking problem.

I did read and search only, with no tests or git commands; the reproductions are traced from the code. The author reports 34 focused and 135 socket-independent tests passing. Your full-suite run (140) was still going. Neither result is mine.

## New blocking finding

**N1 — When the provider (or GitHub) times out or is unavailable, the run now retries forever, and there is no way to get lexical-only context instead.**
- `service.py:344-362` maps `timeout` and `upstream_unavailable` to `waiting`. It then schedules another try with `_schedule(…, min(300000, 2000*2**min(continuation,7)))`. There is no attempt limit, so these errors never become a failure and never fall back to lexical-only.
- **Repro:** set up an Ollama embedding profile with Ollama stopped. The transport error becomes `ProviderUnavailable` (`providers/service.py:510-511`), the run waits, retries about every 256 s, and never finishes. The first index never activates, even lexical-only.
- **The user can't get out of it:**
  - `pause` leaves the run in an active state.
  - `request_index` just returns the existing active run (`service.py:133-135`).
  - There is no cancel method.
  - The run stays pinned to its `profile_version_id`, so editing the profile doesn't help.

  This works against IX-11 (lexical-only mode when the embedding provider is missing) and IX-02 (bounded work).
- The GitHub fetch path has the same problem: GitHub's own refresh caps timeouts at 3 attempts, but indexing has no cap.
- The new tests (`test_indexing_review.py:80-`) only check one transient failure followed by success.
- **Fix:** count transient attempts per phase in the checkpoint. After a small limit (for example 3–5):
  - **Embedding phase:** activate lexical-only with a degradation code such as `provider_unavailable` and partial semantic coverage, keeping the vectors already stored. Alternatively, fail with a stable code.
  - **Ingestion phase:** fail with the code.
  - Rate limits that carry a `retry_at` can stay unbounded but should have a ceiling.
- **Regression test needed:** a persistently failing transport through the real `ProviderService` must end in a terminal or lexical-only state within N continuations.

## R1 findings: resolved
- **B1 (token budgets, chunk/batch sizes):**
  - Chunks are now at most 8,192 bytes, about 2,048 estimated tokens (`safety.py:84-106`), which fits the default 8,192-token batch. The estimate is UTF-8 bytes ÷ 4 (`safety.py:109-115`).
  - The default embedding allowance is 8 Mi tokens against the 16 MiB source cap (`safety.py:11`).
  - Only cache misses are charged, and the provider-reported token count replaces the estimate when present (`service.py:532-568`).
  - A chunk that can't be afforded skips only its own vector. Each batch always makes progress (`service.py:531-543`). Vector completeness is checked as stored + skipped = total chunks (`service.py:583-588`).
  - The context budget uses the same estimate.
- **B2 (real provider errors):** `provider_rate_limited`, `provider_timeout` and `provider_unavailable` are now mapped (`service.py:344`) and scheduled as continuations. The lease extension before the call is done under the fence and capped at 600 s (`service.py:557-560`), and `_fence_for_error` still checks expiry.
- **M1 (partial coverage):** only resource limits (file bytes, tree, source, chunks), the reader's limited flag, or embedding skips mark a snapshot partial (`service.py:485-487, 615-617`).
- **M2 (retry after exclusion change):** a policy hash is stored on staging and checked in `_fence` (`service.py:290-294`). It is also checked at acquisition (line 415) and in the error path (lines 354-357). `_continue` throws away the dirty staging, resets phase and checkpoint, and pins the same revision (`service.py:178-184`).
- **M3 (worker/time limits):** worker capacity and elapsed time now schedule continuations instead of pausing. Ingestion and embedding each have their own cursor and time slice, with guaranteed progress (`service.py:385-388, 422-442, 499-526`). Readers skip files already ingested (`snapshots.py:71-73, 112-114`).

## Requested minors: resolved
- `active_run_conflict` is raised before any job or staging changes (`service.py:167-169`).
- A purged demo can't be re-enabled until it is re-registered: `demo_registration_required` (`service.py:206-207`).
- Abandoned staging is cleaned when a new index is requested (`service.py:136-138`). Its vectors go via `discard_snapshot`, and the reusable cache is kept.
- The chunker is now version 2. Old namespaces are queried using the chunker version recorded with them (`service.py:692`).

## `set_exclusions`
Acceptable. It lives at `service.py:211-220`:
- It validates the patterns as safe relative paths, requires the repository to be eligible and accessible, and writes only `exclusions_json`.
- GitHub selection flags are untouched; the author's GitHub test checks both flags.
- Search, source reads and catalog profiles apply current exclusions, including on retained snapshots.
- A run in progress fails with `selection_changed`, which retry now recovers from.

## Existing checks preserved
Lease, token, expiry and job-ID fencing; revocation checks before and after provider calls; KNN filtered by snapshot inside the SQL; per-namespace tables; the purge tombstone; and the lexical fallback when vectors are unavailable.

## Non-blocking follow-ups
- **Small-context embedding models:** the per-chunk charge ignores the profile's `context_limit`. With a 512-token model, any chunk over about 2,048 characters raises `ContextOverflow`, which ends as `index_failed`. The whole run fails, and retrying fails the same way. Cap each chunk at the smaller of `batch_tokens` and `context_limit`, and skip the vector for chunks over it.
- **Job churn:** worker-limit continuations add a new job row every second. They also raise the continuation count, which inflates the later back-off exponent; track transient attempts on a separate counter.
- **Lease extension:** it writes `jobs.lease_expires_at` directly instead of going through the `JobQueue` API. It is fenced and bounded, but the coordinator may want a proper queue method.

**Blocker owner:** author fixes N1 on `task/m1-index`; approval would then bind to the new commit. The integrator should then rerun the full suite and the five HTTP tests that need loopback sockets.
