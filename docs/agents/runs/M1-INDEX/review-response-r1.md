# M1-INDEX response to independent Claude R1

Reviewed submission: `d8f1005eeb13f544c3fc465ff2fc66acaa2c4a7d`.
Author fixes only; this is not independent approval. No blocking/major finding is
being accepted as product scope. All five are addressed in code and precise checks.

| Finding | Correction | Executed regression |
| --- | --- | --- |
| B1 defaults / cache charge / one-chunk degradation | Byte caps remain bytes. Embedding and context budgets use explicitly documented UTF-8/4 token estimates; successful provider-reported input tokens supersede estimates. Normal windows are <=8192 bytes (~2048 estimated tokens), default batches <=8192 estimated tokens, total embedding allowance 8,388,608 tokens against 16 MiB source cap plus overlap. Only cache misses are charged. Skipped semantic chunks retain FTS and do not erase completed vectors; partial coverage reports exact semantic chunk/skip counts. | Default fixture >500,000 bytes stays ready/hybrid with all chunks vectorized; next snapshot with token cap1 and monetary cap0 uses cache without a call/charge. Nine-KB windows split; one 80-KB line skips only its vector. A 10-token budget preserves two affordable chunks around an unaffordable one. Context budget25 admits 100 ASCII bytes; budget24 does not. |
| B2 real provider transient errors | Normalize provider_rate_limited/provider_timeout/provider_unavailable to stable index domain codes and enqueue durable waiting continuations with retry_at / bounded exponential delay. Preserve current staging/cursor. Fenced pre-call lease extension fits ordinary 60s provider timeouts within the queue's finite lease cap; it never revives an expired lease. | Real ProviderService through injected 429 (Retry-After7), TransportTimeout after advancing fake time60s, and503. Each waits, has a unique continuation, respects delay, reopens both databases, and completes on retry. |
| M1 policy exclusions vs partial | Policy skips remain reported; only file/tree/source/chunk or semantic budget limits, or reader limited flag, mark partial. | Dotfile, vendor, secrets, binary and configured skips leave ready/nonpartial coverage. Lowering files to1 reports partial. Existing boundary test updated to assert ready while retaining all skip and nontransmission assertions. |
| M2 selection-change retry | Preserve selection_changed error, including actual ProviderService cancellation after policy change. Retry/resume discards dirty staging, clears phase/checkpoints and pins the same immutable revision for a fresh snapshot. Retained/active source is untouched. | Mid-embedding setter change fails once; retry succeeds with a different snapshot, no excluded files and no dirty staging rows. Old excluded citation hides immediately; other old citations remain exact. Real ProviderService cancellation follows the same path. |
| M3 worker / elapsed continuations | Worker-capacity and elapsed boundaries enqueue unique delayed jobs, rather than requiring manual resume. Ingestion stores cursor/counts/skips; embedding gets its own time slice and stores vector/charge cursor. Every slice makes bounded progress. Default readers avoid refetching retained file bodies when replaying. | Synthetic elapsed clock forces multiple ingestion and embedding slices; they complete without manual resume, duplicate chunks or false partial coverage. Two occupied live leases cause a third run to wait and then complete automatically when capacity frees. |

Additional requested corrections:

- Stale failed/cancelled run retry while a newer active run exists returns
  `IndexError('active_run_conflict')` before touching jobs or staging, rather than SQLite IntegrityError.
- Purged demo reselection returns `demo_registration_required`; explicitly re-registering
  demo data then selecting it succeeds. Purge markers still block reselection.
- New indexing requests clean abandoned unactivated staging metadata/FTS and vectors,
  retaining reusable repository/namespace content cache. A regression verifies one staged
  vector is removed, cache is reused, and prior active citations are preserved. Cleanup
  is deferred when vector dependencies are unavailable; source remains inaccessible.
- Chunker is version2. Old namespaces are queried with their recorded chunker version;
  old active citations remain exact. Resumed old staging starts clean, keeping its pinned revision.
- Approved additive `set_exclusions(repository_id, exclusions)` validates bounded relative
  path/glob patterns and current eligibility for GitHub/local/demo; it writes policy only.
  Current search/source/activation fences hide excluded paths immediately, including old
  citations. A real GitHubService regression proves both selection flags stay unchanged.

No shared migrations, manifests, entrypoints, platform disk/WAL accounting or other
worker paths changed. No live model/account calls, package installation or agent spawn.
Existing signatures stay stable. No additional schema or contract change is requested;
the coordinator-approved setter is the only added public method. Coverage adds bounded
semantic counts/accounting labels; existing response fields remain intact.
