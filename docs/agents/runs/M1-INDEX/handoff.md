# Builder handoff — M1-INDEX

## Identity

- Author/harness: Codex, retrieval-engineer; no subagents or independent review run.
- Branch: `task/m1-index`.
- Worktree: `/Users/apple/workspace/vibe-coding/opendevin-m1-index`.
- Base SHA: `db85564688f25ab7345cdcd689fe18fd160c6d7a`.
- Submitted SHA: none — sandbox denied Git index.lock; see commit-result.md and files.sha256.
- Task card: `docs/agents/runs/M1-INDEX/task.json`; F02 IX-01 through IX-11.
- Status: implementation ready for review; not approved or integrated.

## Outcome

Exported `repoask.indexing.IndexService` with the accepted constructor and service
methods. Durable atomically-enqueued index runs checkpoint bounded ingestion and
embedding batches; pause/resume/retry use unique continuation jobs. Rate limits
schedule a durable future continuation. Every worker write checks current domain
job ID, lease owner/token/expiry, cancellation and current selection. Model/network
and Git acquisition occur outside Store transactions. The model cancellation guard
revalidates policy before send and after receive. At most two live index workers
may enter running phases per Store; excess jobs pause with worker_limit.

Snapshots retain exact commit/path/range source across changed and deleted files.
FTS and vector staging activate only after validation; failed replacement keeps the
previous active context. Current revocation/exclusions override retained citations.
Purge first removes visibility and writes a durable purging marker, then removes
repository-scoped vectors/cache, chunks/FTS, summaries/source and snapshots. Interrupted
purge must be retried before reselection. The disabled source registry identity is
retained, including the private canonical local path, so registration stays stable;
this is registry configuration, not retained source context.

APSW/sqlite-vec uses a private vectors.sqlite3, namespace-specific vec0 tables,
snapshot constraints inside every KNN query, finite nonzero dimension validation,
and repository+namespace+content-hash cache keys. Immutable namespaces bind provider
identity, profile version, dimensions, normalization and chunker. The schema's
provider_namespace_key is the SHA256 of provider key+profile version, avoiding its
unique-key collision across immutable profile versions; provider responses are
validated against the original ProviderService namespace key before any vector write.
Missing dependencies/providers produce explicit lexical mode; vector search outage
preserves FTS. Token caps conservatively count UTF-8 bytes, including reused chunks;
embedding cap exhaustion activates explicitly partial lexical context. Unknown
monetary pricing pauses before calls. Disk/elapsed/cost/worker pauses retain checkpoints.

Source policy excludes sensitive names/directories, hidden files, configured paths,
binary/NUL/private-key content, symlinks, submodules and vendor/build outputs before
FTS/provider processing. Local reads use immutable Git objects with bounded streaming
subprocess output, deadlines, no shell/hooks/fsmonitor/replace objects or worktree
execution. Deterministic summaries quote bounded observed headings/metadata, retain
line evidence/generation metadata and explicitly state architecture/validation gaps.
Catalog candidates preserve ID distinctions and evidence-based match reasons.

### Changed files / exclusive scope

- `repoask/indexing/{__init__,service,safety,snapshots,vectors}.py`.
- `tests/test_indexing_service.py`, `tests/test_indexing_github.py`.
- `tests/fixtures/indexing/retrieval.json`.
- This task's task card, status, verification runner, evaluation, self-evaluation,
  handoff and commit-result files.

No migration/shared entrypoint/manifest, other worker path or board was edited.
Consumed m1-services.md, m1-indexing.md and ADR0002 at the base SHA. Actual F02 is
`docs/features/02-repository-indexing.md`; the task card's read_inputs filename is stale.
Default GitHub acquisition is the contract-authorized **API-cache departure** from
the planned local Git cache: resolved tree/blob APIs persist immutable source in
SQLite. No claim of GitHub local fetch/cache support. Injected reader protocol is
fully documented in `repoask/indexing/__init__.py`.

## Verification evidence

| Requirements | Commands/scenarios actually run | Results |
| --- | --- | --- |
| IX-01, IX-09 | Focused suite: pause during ingestion, close/reopen both databases, replay, expired lease before and during provider call, cancelled queue job, failed replacement/retry, rate-limit continuation | Passed |
| IX-02, IX-03 | Lowered file/token caps, unknown cost, binary/secret/symlink/submodule exclusions, current selection change; real bounded local Git and real GitHub tree/blob client via injected transport | Passed; no source sent to live endpoints |
| IX-04, IX-07, IX-10 | Changed/deleted source, exact retained old citations, unchanged embedding reuse, scope/range/traversal checks, mid-flight revocation, purge interruption/reopen with another repository preserved | Passed |
| IX-05, IX-06, IX-11 | Real FTS/APSW KNN, inside-SQL snapshot scope, immutable profile namespace separation, vector outage/lexical fallback, bounded context; real ProviderService through injected transport | Passed |
| IX-08 | Deterministic summary evidence, generation gaps, catalog ID distinction and hiding excluded profile evidence | Passed |
| IX-05 evaluation | Labeled evaluation fixture; exact/paraphrase/ambiguous/absent measured separately | Lexical vs hybrid exact 3/3 vs 3/3; paraphrase 2/3 vs 3/3; ambiguous 1/1 vs 1/1; absent 1/1 vs 0/1; see evaluation.md |
| Focused | `/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python -m unittest discover -s tests -p 'test_indexing_*.py'` | 20 tests passed, real SQLite/APSW/sqlite-vec; no skips |
| Full regressions | `python3 -m unittest discover -s tests` | Attempted: 123 at that stage, only five HTTP socket-binding errors, nine optional-vector skips; no assertion failures |
| Full regressions with dependencies | `/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python -m unittest discover -s tests` | Final broad run: 126 tests, five HTTP errors at sandbox-denied bind, no skips/assertion failures |
| Explicit socket-independent regressions | `/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python docs/agents/runs/M1-INDEX/verify.py --without-http` | 121 passed; exactly five HTTP tests explicitly omitted |
| Syntax | Dependency interpreter `-m compileall -q repoask/indexing` | Passed |

## Risks and next action

- Reviewer: independent reviewer, Claude if available or fresh Codex; review exact
  implementation commit/file packet and permission/recovery/vector boundaries.
- HTTP handlers, worker registration, UI contracts, periodic scheduling, retention
  policy and HTTP regression rerun belong to coordinator integration. Worker handler:
  `{'index.run': service.run_index}`. Construct one service to register GitHub hooks.
- Call `service.vectors.close()` during application shutdown after workers stop.
- No live Ollama calls made; no product/provider quality claimed. Synthetic retrieval
  evaluation is deliberately small. Nearest neighbors cannot establish answerability;
  absent query returns semantic candidates. F03 must implement/evaluate abstention.
- Source acquisition replay may refetch immutable GitHub tree/blob objects; embedding
  reuse avoids unchanged model calls. No cross-database atomicity is claimed; vector
  staging commits first and replay repairs metadata progress.
- A checkpoint pause waits for the leased worker to finish; immediate resume returns
  checkpoint_pending until it does. Disk/cost/worker pauses require addressing their
  cause before resume; caps never silently expand. Revoked access never permits replay.
- If existing on-disk vectors cannot load due to missing dependencies, purge stays
  hidden/pending rather than falsely declaring those vectors deleted.
- No package changes, credentials, live GitHub mutation, remote push or external source
  transmission. No background application/worker/child Git processes left running.
- Socket blocker owner: coordinator; rerun the five HTTP tests in an environment
  permitting loopback listeners. No sandbox bypass requested or attempted.
