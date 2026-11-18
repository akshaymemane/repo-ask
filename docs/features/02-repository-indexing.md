# F02 — Repository context, RAG and hybrid retrieval

Status: Draft | Milestone: M1 | Parent: [Master PRD](../../Master%20PRD.md)

## Outcome and boundaries

Build persistent, commit-aware repository context in the background so Ask can retrieve useful evidence without preparing 200 checkouts interactively. Retrieval-augmented generation (RAG) supplies selected source excerpts to a model; generated summaries remain derived context, not ground truth.

Initial scope indexes the default branch and on-demand plan/session bases. Full history, all branches, binary assets and execution of repository scripts are excluded.

## Indexing lifecycle

1. Persist discovery metadata so a repository becomes searchable immediately.
2. Read README and bounded manifests/configuration for a lightweight repository profile.
3. Obtain a source snapshot at a resolved commit with bounded fetches. (First release: GitHub tree/blob APIs with immutable source persisted in SQLite, per `docs/contracts/m1-indexing.md`; explicit local checkouts are read with safe bounded Git operations. A local Git cache remains a later option.)
4. Filter files, chunk eligible source, persist FTS entries and generate embeddings.
5. Generate an evidence-linked repository summary, including likely components, entry points and validation commands marked as observed or inferred.
6. Atomically activate the new snapshot after its required indexes are consistent.

Priority order: explicitly requested repository, repositories used by active plans, recent user activity, then remaining selected repositories. Provide pause, resume, retry and priority controls. Metadata remains usable while deeper context is incomplete.

## Functional requirements

- **IX-01:** Persist jobs, checkpoints, snapshots and source hashes; restart resumes work without duplicating active chunks.
- **IX-02:** Bound fetch size, eligible files, file size, source bytes, tokens, disk use, provider cost and concurrent workers. Show skipped counts/reasons and partial coverage.
- **IX-03:** Exclude secrets, credentials, binaries, symlinks, vendor/build outputs and configured patterns before embedding or model calls. Indexing never installs dependencies or runs repository code.
- **IX-04:** Chunk source with language/symbol boundaries where practical; fall back to bounded line windows with overlap. Every chunk records repository, commit, path, lines, content hash and parser version.
- **IX-05:** Combine lexical retrieval for exact identifiers with semantic retrieval for intent. Merge and deduplicate ranked results within a configurable context budget.
- **IX-06:** Namespace embeddings by provider, model identity, dimensions, normalization and chunker version. Never compare vectors from incompatible namespaces.
- **IX-07:** Update incrementally for changed/deleted paths; reuse unchanged embeddings by content hash. A force push or branch change creates a new snapshot rather than rewriting cited history.
- **IX-08:** Store summary provenance and generation metadata. Low-evidence summaries must describe gaps instead of inventing architecture or test commands.
- **IX-09:** During reindexing, keep the previous valid snapshot available with a freshness indicator, except after access revocation or exclusion.
- **IX-10:** Retrieve only eligible repositories and snapshots. Retain source required by saved citations under F12 retention rules; never resolve an old citation against current HEAD.
- **IX-11:** A missing embedding provider allows a labeled lexical-only mode. Source-backed plan launch requires a usable code snapshot even when semantic indexing is incomplete.

## Data and interfaces

`RepositorySnapshot`: repo ID, commit, branch, coverage, file manifest hash, activated time. `CodeChunk`: snapshot, path, start/end lines, source hash, text/symbol metadata. `EmbeddingNamespace`: immutable model/chunker identity. `IndexJob`: phase, lease, cursor, attempt, progress, failure and next retry. `RepositorySummary`: snapshot, evidence references, model profile/version, generated text.

Proposed routes: `POST /api/repositories/{id}/index`, `GET /api/index-jobs/{id}`, `POST /api/index-jobs/{id}/pause`, `POST /api/index-jobs/{id}/retry`, `POST /api/search`, and snapshot-specific `GET /api/source`.

Job states: `queued → running → completed | failed | cancelled`; running jobs can enter `paused` at checkpoints, then return to queued. Worker loss returns an expired leased job to queued after reconciliation. Repository status distinguishes `metadata_only`, `indexing`, `ready`, `partial`, `stale`, `failed` and `excluded`; partial is a coverage attribute as well as a visible status.

## Failure behavior

Provider failure does not erase FTS results. A dimension/model mismatch schedules a new namespace; switching activates it only after validation. Disk pressure pauses new work and offers cleanup. Deleted chunks disappear from active search while retained older snapshots keep their original citations. Exclusions and revocation override snapshot retention visibility immediately.

External embeddings and summaries can transmit source. Show destination and estimated scope before indexing; explicit external-processing configuration is required, and local-only settings block remote calls.

## Acceptance criteria

1. First connection begins background work while Ask and repository browsing remain responsive.
2. Worker interruption resumes from a durable checkpoint without duplicate active chunks.
3. A changed file updates retrieval; a deleted file leaves active retrieval; an old retained citation still opens its original source.
4. A secret fixture is excluded before provider transmission, and configured exclusions apply to lexical and vector indexes.
5. Exact identifier and paraphrased feature queries both retrieve relevant source in a labeled evaluation set; hybrid results are compared with the FTS baseline.
6. Incompatible embedding models cannot share a query namespace; failed replacement indexing leaves the previous valid index usable.
7. A large repository reports partial coverage and skipped reasons rather than a misleading ready/full state.
8. Purge deletes chunks, summaries, vectors and cached source, with repository scope verified after restart.

## Dependencies and measures

Depends on F01, embedding/generation slices of F07, and F12. Measure eligible coverage, retrieval recall@10, indexing cost, incremental work avoided, queue latency and disk growth. Select the vector backend through a measured spike; SQLite remains the metadata source of truth.
