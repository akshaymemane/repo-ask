# Builder handoff — M1-INDEX, Claude R1 fixes

## Identity and ancestry

- Author/harness: Codex, retrieval-engineer; no spawned agents or author approval.
- Branch/worktree: `task/m1-index`, `/Users/apple/workspace/vibe-coding/opendevin-m1-index`.
- Original assignment base: `db85564688f25ab7345cdcd689fe18fd160c6d7a` (task.json remains the original assignment).
- Coordinator-applied schema5 prerequisite / implementation parent: `e7c4a5e328b69207804cbbbbf3fdcae7deb0f4bd`.
- Actual original submission reviewed by independent Claude: `d8f1005eeb13f544c3fc465ff2fc66acaa2c4a7d`.
- These are sequential ancestors, verified with local log and both `git merge-base --is-ancestor` checks.
- R1 revision base: `d8f1005eeb13f544c3fc465ff2fc66acaa2c4a7d`.
- R1 submitted commit: none — sandbox denied Git index.lock. HEAD remains d8f1005; exact error in commit-result.md, current contents in files.sha256.
- Requirements: F02 IX-01 through IX-11. Status: author fixes ready for independent resubmission; not approved/integrated.

## Outcome

Both blocking findings B1/B2 and all major findings M1/M2/M3 are fixed; none is being
accepted as product scope. `review-response-r1.md` maps each fix to precise behavior
checks. The original service remains a persistent, permission/lease-fenced immutable
snapshot pipeline with FTS and real APSW/sqlite-vec hybrid retrieval. Existing public
signatures and retained source identities remain stable.

Embedding/context budgets now use explicit token estimates, independent of byte limits.
Normal chunks fit default batches, and default total embedding budget accommodates
realistic repositories (regression >500 KB). Cache hits cost zero calls/tokens; actual
provider input usage is recorded when reported, otherwise estimates are labelled.
An oversized or unaffordable chunk skips semantics for that chunk; other staged vectors
remain usable and partial semantic coverage is disclosed. Token estimation is a planning
estimate, not a model tokenizer or an exact monetary guarantee. Unknown pricing still
pauses before paid/source calls; cache-only reuse does not need pricing.

Real ProviderService429/timeout/unavailable errors schedule durable continuation jobs.
Worker/time slices also continue durably, with pinned revision and checkpoint progress.
Policy exclusions count as exclusions rather than resource loss. Changed exclusions
hide old source immediately; retry starts a clean staging snapshot with the original
resolved revision. All model/network/Git acquisition stays outside Store transactions;
worker writes still validate current run/job, lease owner/token/expiry, cancellation and
permissions. Timeout lease extension is bounded by the existing queue maximum and is
strictly fenced; expiry/replacement still prevents all stale writes.

Approved additive method:

```python
service.set_exclusions(repository_id, exclusions)
```

It returns the existing public RepositoryState, validates relative path/glob patterns
and current eligibility, changes only source exclusions for GitHub/local/demo, and never
changes GitHub selection flags. No additional contract/schema change is needed. Pass
an empty list to clear configured exclusions; built-in secret/binary/symlink policy stays.
Ineligible or purging sources cannot be reselected through this setter.

Stale-run retry has a stable active_run_conflict error. Purged demos require explicit
re-registration before enabling. Abandoned staging cleanup removes only staging vectors,
source/chunks/FTS and snapshot metadata, preserving reusable cache and all active/retained
citations. Cleanup defers if vector dependencies are unavailable; purge remains fenced
and retryable. Chunker version changes restart staging but keep original pinned revision;
retained namespaces query using their own chunker identity.

## Files and integration

Exclusive scope: `repoask/indexing/**`, `tests/test_indexing_*.py`, and task-local documents.
Changed service/safety/readers/vectors/package protocol docs; added
`tests/test_indexing_review.py`; extended existing indexing/GitHub checks. The independent
review supplied in review-claude-r1.md is preserved. No board, shared migration, entrypoint,
manifest, API/web/Ask/backend worker path or platform disk/WAL implementation changed.

Consumed actual F02 `docs/features/02-repository-indexing.md`, m1-services.md,
m1-indexing.md and ADR0002. The task card retains its original stale F02 filename as
assignment history. Schema5 is coordinator-owned and already precedes the reviewed code.
Default GitHub acquisition remains the accepted tree/blob **API-cache departure** from
planned local Git fetch/cache. Injected readers keep the same three-argument signature;
optional private `_ingested_paths` lets them emit ordered replay markers without fetching
already retained bodies. Reader protocol is in `repoask/indexing/__init__.py`.

HTTP registration, Ask integration, worker lifecycle and independent review remain with
the coordinator. Handler is `{'index.run': service.run_index}`. Construct one service
per application so GitHub eligibility/purge hooks register once; stop workers before
`service.vectors.close()` at shutdown.

## Verification evidence

| Check actually run | Result |
| --- | --- |
| Dependency interpreter `-m unittest discover -s tests -p 'test_indexing_*.py'` | 34 tests passed; no skips; real SQLite/APSW/sqlite-vec with injected source/provider transports |
| `python3 -m unittest discover -s tests` | Attempted during revision: 139 tests; only five HTTP bind PermissionErrors; 18 optional-dependency skips; no assertion failures |
| Dependency interpreter `-m unittest discover -s tests` | 140 tests: 135 passed, five HTTP errors solely at sandbox-denied socket bind; no skips/assertion failures |
| Dependency interpreter `docs/agents/runs/M1-INDEX/verify.py --without-http` | 135 passed; exactly five socket-dependent HTTP tests explicitly excluded |
| Dependency interpreter `-m compileall -q repoask/indexing tests/test_indexing_review.py`; `git diff --check` | Passed |

Dependency interpreter: `/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python`.
Review regressions and requirement coverage are detailed in review-response-r1.md.
Existing immutable changed/deleted source, old citations, restart/lease/revocation,
namespace SQL scope, purge interruption, lexical fallback and provider privacy checks
continue to pass. The labeled synthetic retrieval evaluation remains in evaluation.md;
no real-model quality or F03 abstention readiness is claimed.

## Risks / next action

- Independent reviewer must review the new exact commit (or the hashed preserved file
  packet if Git is sandbox-blocked). Author verification is not independent approval.
- Coordinator reruns the five HTTP tests where loopback listeners are permitted; no
  permission bypass was requested. Shared platform WAL accounting remains root-owned.
- Source/embedding token estimates are approximate until provider reports usage; source,
  disk, file and batch counts remain independently bounded. Cost/disk pauses still
  require resolving their cause; worker/time pauses no longer require manual action.
- Semantic neighbors still require F03 answerability evaluation. API-cache GitHub source
  acquisition is not local Git fetch support. Existing catalog_candidates lazy registry
  registration behavior was not broadened/refactored in this findings-focused revision.
- No live Ollama/account calls, external source transmission, downloads, package changes,
  credentials, pushes, PR operations or background service processes. Test-owned Git
  subprocesses are bounded and reaped. No agents spawned.
