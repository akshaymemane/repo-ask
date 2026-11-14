# M1-INDEX response to independent Claude R2

Reviewed commit / revision base: `469954f9a6bedc003d7de1e61c3074f2b5a711b7`.
Author fixes and checks only. A new independent exact-commit review is required;
this response does not constitute approval or integration.

## N1: finite automatic retries

Coordinator policy is implemented without changing public signatures or schema:

- A run fails on its **third consecutive timeout/unavailable failure**, in either
  source acquisition or embedding. This is an initial attempt plus at most two
  automatic continuations without successful progress. Stable terminal codes remain
  `timeout` or `upstream_unavailable`; terminal `retry_at` is null.
- Consecutive failures are durable checkpoint data, independent of `continuation`
  (which is just the unique job sequence). Persisting new source/policy-cursor or
  vector progress, or completing acquisition, resets the transient streak. Merely
  scheduling or resuming an ordinary worker/time slice never resets or increments it.
- Rate limits permit **at most ten automatic retries** for an explicit run attempt:
  initial request plus at most ten subsequent calls; the eleventh consecutive429
  becomes terminal `rate_limited`. This counter survives progress and phase changes;
  ordinary worker/time continuations do not affect it. Provider `retry_at` is honored:
  the next job is never scheduled before it. No earlier wall-clock retry is forced.
- An explicit user retry of a terminal failed/cancelled run begins a new bounded
  automatic attempt while retaining source/vector progress. A new request after
  terminal failure also has the normal fresh-run budget. Waiting-state retries do
  not erase counters; pause/resume and automatic scheduling do not erase them.
- Timeout/unavailable delays are2s then4s, based on their own streak. Rate-limit
  delays use their own counter (2s exponential, capped at300s) or a later upstream
  retry_at. Worker capacity waits30s; elapsed slices wait5s. Neither creates a
  one-second scheduling loop or inflates network backoff.
- Terminal failure leaves the previous valid active snapshot/citations intact and
  releases the unique active-run slot. Incomplete staging never becomes active.
  N1 uses the review's permitted terminal-failure option rather than falsely
  declaring incomplete embeddings complete.

Retry counters are private checkpoints with bounded public progress counts;
source text, private paths, credentials and lease tokens are not added to job fields.
All writes remain under the existing lease/job/permission fences. No changes to
JobQueue or shared platform/WAL code were made.

## Small-context follow-up

Before a cache-miss embedding call, each chunk must fit both its token/batch budget
and immutable profile.context_limit. Oversized vectors are skipped, not transmitted;
other chunks retain semantics. Coverage includes exact embedding_context_limit skips,
semantic count and partial/degradation labels. Exact retained source and lexical FTS
remain available. Budget checks retain precedence when a chunk exceeds both limits,
preserving the existing34 regression expectations. Cache hits require no model call.

## Executed regression evidence

New checks are in `tests/test_indexing_retry_limits.py` and use real SQLite/APSW
and real ProviderService with injected transports, never a live account/model.

| Scenario | Measured result |
| --- | --- |
| Persistently unavailable real transport, including DB reopen | Exactly3 calls /3 jobs; two continuations then terminal upstream_unavailable; no future job; old active snapshot and exact source unchanged |
| Persistently timing-out real transport, including DB reopen | Exactly3 calls /3 jobs then terminal timeout; old active context preserved |
| Ingestion GitHub-style network failures | Exactly3 reader calls then terminal upstream_unavailable |
| Persistent real429 with Retry-After600, including DB reopen | Exactly11 calls/jobs: initial +10 retries; each wait >= upstream reset; then terminal rate_limited with no queued continuation |
| Real512-token profile,2048-char and2049-char boundaries | Two vectors retained, exactly one oversized vector excluded before transport; partial hybrid coverage; skipped source still exact |
| Two failures, vector progress, two failures, vector progress | Completes; streak resets on persisted progress; delays remain2s/4s |
| Worker-capacity wait + actual ingestion time slices + first provider failure | Waits30s/5s; first network error remains streak1 with2s backoff despite prior continuation jobs |

Full verification:41 focused tests pass (all original34 preserved),142 socket-independent
regressions pass. Both full147-test commands were attempted: only the same five existing
HTTP socket-bind PermissionErrors; default Python also skips25 optional dependency checks.
Dependency interpreter full run has no skips/assertion failures. Compileall and diff
whitespace checks pass. No remote/network account access, packages or spawned agents.
