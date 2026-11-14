**APPROVED** for exact commit `3def367b1875caecf5c542bc23eb7d0feed3c66e` (task M1-INDEX, base `77cd2e8`, branch `task/m1-index`, requirements F02 IX-01–IX-11).

As before, I only read and searched. I ran no tests and no git commands, and computed no hashes.

**What the packet shows about the change**
- `diff.patch` contains exactly one change: a new file, `tests/test_indexing_retry_limits.py` (blob `76bc7cb`, 267 lines). No other file is added, changed or deleted, so `service.py` and all other production code are the same as in 77cd2e8.
- The manifest's SHA256 for that file is `1071f561a65d…a3c996`. That matches the hash already listed in `files.sha256` committed in 77cd2e8.
- The packet copy is line-for-line the same as the worktree file I read last round. It has the same 7 tests:
  1. persistent unavailable provider (real `ProviderService`, database reopened mid-sequence)
  2. persistent timeout
  3. ingestion network failures stop after three
  4. rate limit capped at ten retries and respecting `Retry-After: 600`
  5. small-context profile at the 512-token / 2,048 vs 2,049-character boundary
  6. progress resets the failure streak
  7. worker and time-slice waits leave the failure counter and back-off alone

**Why I'm approving**
- This closes the packaging blocker from my last review.
- No code defects remain from round 1 (B1, B2, M1, M2, M3 and the requested minors) or round 2 (N1 and the small-context follow-up).
- The lease, permission and revocation, KNN snapshot-scope, namespace, purge and lexical-fallback checks are all still in place.

**Test evidence (yours, not mine)**
- Your earlier full 147-test pass ran with this file present but untracked, so it was not on this exact commit tree.
- The focused 41-test rerun on this commit was still running.
- The five HTTP tests that need loopback sockets haven't been rerun yet; they need an environment that allows socket binding.

**Integration conditions (coordinator)**
- Before integrating, recheck the commit and manifest, then rerun on this exact commit: the focused 41, the full suite, and those five HTTP tests.
- Apply the separate root WAL fix `898eaae` when you integrate.

**Non-blocking follow-ups (owner: author or coordinator)**
- `retry()` on a run that is waiting on a rate limit requeues it immediately, ignoring the provider's `retry_at`. The ten-retry ceiling still applies.
- The provider-timeout lease extension writes `jobs.lease_expires_at` directly; a JobQueue method may be preferable.
- Retained snapshots are only cleaned up by purge until F12 retention exists.
