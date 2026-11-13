# Persistent repository context contract

Accepted coordinator slice for F02, 2026-11-13. Read with m1-services.md and F02.
Migration4 is canonical in `repoask/platform/index_schema.py`; builders must not alter
migrations, provider/GitHub packages, shared entrypoints or legacy index.py.

## Construction and identities

Export `IndexService` from `repoask.indexing`. Constructor:
`IndexService(store, jobs, github, providers, *, data_dir=None, vector_store=None,
snapshot_reader=None, clock=now_ms)`.
Use GitHubService and ProviderService public APIs (inspect actual integrated code),
not credentials copied from CLI configuration. Register GitHub eligibility listeners
and purge hooks. No filesystem/script execution during source acquisition.

`index_sources` is a separate registry: `gh:<numeric>` IDs point to real repositories;
`local:<uuid>` references an explicitly registered local checkout; demo IDs use
`demo:<name>`. Never fabricate GitHub IDs for local/demo data. Preserve local IDs
across restart by canonical path lookup. Local paths are private, never HTTP outputs.
`register_local(name,path,exclusions=())` is coordinator/CLI-only. No arbitrary host
path registration through HTTP. `register_demo(snapshot)` accepts the legacy
Snapshot object; inspect repoask/index.py. Demo revisions use content_hash;
Git sources resolve an immutable commit (40 or64 hex); no branch-name citations.

Default snapshot reader may use GitHubClient's resolved tree/blob APIs, persist
immutable source in SQLite and enforce bounded fetches. Record this API-cache
implementation in handoff: it is a first release departure from the planned Git cache,
not a claim of local Git fetch support. Local read uses safe bounded filesystem/Git
operations with no repository hooks, submodules or dependency installation.
An injected snapshot_reader supports synthetic immutable snapshots for tests; document
its exact protocol in package docstrings. Never traverse symlinks, unsafe paths or
submodules. Tree/blob retrieval and provider calls occur outside Store transactions.

## Service methods

- `request_index(repository_id, revision=None, priority=0, embedding_version_id=None,
  limits=None)` returns a durable run; atomically enqueues `index.run` using
  JobQueue.enqueue_in_transaction. GitHub source registration can be lazy here.
- `get_run(run_id)`, `pause(run_id)`, `resume(run_id)`, `retry(run_id)` return the
  public run. Pause checkpoints at bounded phase/batch boundaries and completes the
  queue job while leaving the domain run paused. Resume/retry creates a continuation
  job with unique run+continuation key. Never reuse one forever-idempotent key.
- `get_state(repository_id)` returns public RepositoryState.
- `set_local_selection(repository_id,index_enabled,exclusions=None)` updates
  local/demo selection; GitHub selection remains authoritative in GitHubService.
- `catalog_candidates(query,pinned_repository_ids=(),limit=20)` returns accessible
  candidates from name/description/topics/profile/summary. Explanations are evidence
  based and collision-safe. Metadata-only candidates allowed, source facts require evidence.
- `search(query,repository_ids,snapshot_ids=None,limit=10,context_token_budget=4000,
  semantic=True)` returns SearchResult. snapshot_ids is optional mapping repoID→snapshotID;
  omitted means active snapshot. Validate all requested scopes before vector/model work.
- `source(repository_id,snapshot_id,path,start_line,end_line,context_lines=5)` returns
  exact retained source. Bound requested line counts and context; reject path traversal.
- `purge_repository(repository_id)` removes all context/vectors/cache for only that
  repository. Idempotent across interruption/restart; remove active reference first.
- `run_index(job,context)` is Worker handler. Inspect WorkerContext and lease fencing.

Public RepositoryState fields: repository_id, name, kind, eligible,
implementation_enabled, status (`metadata_only|indexing|ready|partial|stale|failed|excluded`),
active_snapshot (nullable: id, revision, revision_kind, branch, activated_at, coverage,
mode), active_run (nullable public run). No local paths, secretrefs or raw checkpoints.
Run: id, repository_id, snapshot_id, job_id, state, phase, continuation, progress,
error_code, retry_at, created_at, updated_at. progress/coverage contain bounded counts,
skip reasons and configured limits; never source excerpts/private paths in job fields.
SearchResult: mode (`hybrid|lexical_only`), degradation_code nullable, hits, snapshots,
truncated. Each hit: chunk_id,repository_id,snapshot_id,revision,path,start_line,end_line,
text,rank,methods. snapshots maps repository IDs to exact snapshot identity/coverage.
Source: repository_id,snapshot_id,revision,path,first_line,lines (string array),total_lines.
All citations carry repository+snapshot+revision+path+range. Old citations read old
source; never reinterpret against HEAD. Revocation and current exclusions override
retention and must be checked again on every search/source/activation.

## Persistence, vectors and bounded work

Metadata/FTS use standard Store, vectors use APSW+sqlite-vec in private
`data_dir/vectors.sqlite3` (ADR0002). Memory mode may use isolated in-memory vectors.
Dependency absence degrades explicitly to lexical-only; never silently fake embeddings.
Namespace binds provider's immutable namespace key, profile version, dimensions,
normalization and chunker version. Table identifiers hash validated namespace IDs;
all values parameterized. Query vectors are compatible with each searched namespace.
Apply allowed snapshot constraints inside vector SQL before nearest-neighbor LIMIT,
not after querying global vectors. Cache embeddings by repository+namespace+contenthash.
Commit vectors first; atomically activate metadata last, after required chunks/vectors
are complete. Search may degrade on vector outage while preserving valid FTS.
A failed replacement retains old active context. Activation marks previous snapshot
retained and records immutable manifest+coverage. Avoid holding SQL transactions across
model/network/filesystem work. In each write transaction validate current domain
run.job_id, live queue lease owner/token/expiry and cancellation under same Store lock.
Checkpoint bounded file/batch progress for resume; replay must not duplicate chunks.

Finite default limits and caller-lowerable caps: files, perfile bytes, total source
bytes, chunks, embedding batch/tokens, total embedding tokens, elapsed time and disk.
Track skipped reason counts. A monetary cap with unknown model price pauses with
cost_unavailable; unknown is not zero. Bounded local operation without monetary cap
is allowed. Source exclusions cover secrets/keys/credentials, binary/NUL, symlink,
submodule, vendor/build/generated and configured patterns BEFORE provider or FTS.
On lowering selection/exclusions, immediately hide affected source even during jobs.

Profiles/summaries may start deterministically from bounded README/manifests with
observed evidence and explicit gaps; optional model-generated summary records profile
version/model/generation and validates evidence. Source text is untrusted data.
External-processing destination and explicit profile opt-in/local-only apply through
ProviderService; absence of embeddings permits labeled lexical context and indexing.

## Required behavior checks

Restart/checkpoint/lease fencing; immutable changed/deleted file history; unchanged
embedding reuse; exclusions and revocation before model and source access; no provider
transmission of secret/binary/symlink fixtures; namespace isolation; scoped KNN filter;
failed replacement keeps active context; pause/resume and partial coverage; local/demo
identity persistence; repository-scoped purge including vectors after restart; labeled
exact-identifier/paraphrase retrieval evaluation compared to lexical baseline.
Use injected transports and real local SQLite/vector operations. Run full regressions.
No real account credentials, downloads, package changes or remote mutation in worker.
