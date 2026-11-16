# M2-PRS round 1 findings (consolidated by the coordinator)

Reviewed commit: `a273ab2` (cherry-pick of Codex candidate `741251e`), base `97f8c30`.
Reviewers: Claude quality-reviewer and Claude security-reviewer (independent sessions, read-only).
Both verdicts: **request changes**. Line numbers refer to `a273ab2`.

## Must fix (HIGH)

1. **Purge/exclusion do not fence an in-flight run.** `authority()` only calls
   `_check_access` (write grants + `get_repository`); `GitHubService.purge_repository` only sets
   `index_enabled=0`. The purge hook marks the row `blocked/repository_purged`, but `_state()`
   (234-235) silently ignores writes to a terminal row and `run()` never checks it or
   `context.cancel_requested`. A purge mid-run still creates blobs, tree, commit, branch and a draft
   PR with no local record. Snapshot/exclusion/source eligibility is read only once.
   Fix: before every external write re-read the row (abort if terminal or not the expected state),
   re-validate snapshot eligibility (purge, exclusion, source availability, containment) and honor
   `context.cancel_requested`; `_state` raises on a concurrent terminal transition; the purge hook
   cancels queued jobs and the run stops at the next fence; any remote branch/commit created before
   the fence is recorded as a content-free identifier. Test: purge or exclude between blob and tree
   → no further ref/PR calls.
2. **Resume path loses PR outcome.** `creating_branch` resume (307-315) calls `create_pull_request`
   with no unknown-outcome handling and no `authority()` first; a timeout becomes terminal `failed`.
   Fix: one shared branch→PR helper used by every path, with `authority()` before the write and
   timeout/unavailable → `reconciling` + `UnknownOutcomeError`. Test: lost PR on the resume path.
3. **Failures after PR create are terminal and untracked.** If `_confirm_pr`'s GET fails (timeout,
   5xx, rate limit) or the 201 body lacks a usable number, the run ends `failed`/`blocked` and the
   PR number is never stored. Fix: persist the provider number/id as soon as known; any failure
   after a create that may have succeeded → `reconciling`; `reconcile()` confirms via the recorded
   number or `_find_pr`.
4. **Lease expiry / restart has no recovery path.** A dead worker leaves the job
   `needs_reconciliation` and the row in an active state; `reconcile()` only handles `reconciling`,
   so `retry()` enqueues without remote proof and a slow stale worker can race it. The old job is
   never resolved (`jobs.resolve_reconciliation`), so workspace health stays `degraded` forever.
   Fix: a recovery entry point (e.g. `recover()` the coordinator calls at startup and that `retry`
   uses) moves non-terminal rows whose job is `needs_reconciliation`/expired to `reconciling`, runs
   the GitHub read path for any state with commit/branch/PR identity, treats `queued`/`preparing`/
   `creating_objects` (no ref yet) as safely resumable, and resolves the old job before enqueueing.
   Test: lease expiry → recover → retry → exactly one ref and one PR, no job left
   `needs_reconciliation`.

## Must fix (MEDIUM)

5. **Transient errors before the ref write are terminal.** One 502/rate limit on base read, compare,
   blob, tree or commit makes the session unpublishable forever (one intent per session). Make
   safe pre-ref failures resumable (non-terminal, retry allowed).
6. **Run-time snapshot binding is partial.** `_remote` (241-252) checks only `diff_hash` and
   `base_sha`. Also require `repository_id`, `checkpoint_artifact_id`, `patch_artifact_id`,
   `base_branch` and `policy` to equal the row, and re-run `_automatic_ok` for `on_success_draft`
   before minting a token and at each fence.
7. **Preview base observation and head name.** `base_observation` is hard-coded null and
   `head_branch` returns `session_branch`, which publish never creates. Coordinator decision:
   preview does a read-only base/compare observation with a **read-scoped** token when access
   permits and reports overlap/`divergence_unknown` as blockers; if access fails, observation stays
   null and the access blocker is reported. Return the real head-name pattern.
8. **Renames escape the overlap check** (321). Include `previous_filename` in remote paths. Test.
9. **Compare `status` ignored** (client 256-267). Require the session base to be an ancestor
   (`status in ('ahead','identical')`), else `divergence_unknown`.
10. **Test gaps** (quality reviewer): restart/lease expiry; purge/exclusion mid-run; manual
    failed-check disclosure in the PR body and that it publishes; an `on_success_draft` success path
    reaching `published`; frozen commit message/identity/date reused on resume; negative PR
    confirmation (draft=false, wrong head sha/ref, repo, base, URL, missing id); `stale_diff` at
    publish and run; rejected paths; missing commit identity; `create_ref` never targets the
    base/default branch; fakes that honor head/base/number filters; `refresh`.

## Coordinator decisions on LOW items (fix all)

11. Read-only calls (`refresh`, reconciliation reads, preview observation) mint a read-scoped token
    (`contents:read`, `pull_requests:read`). Temporary write scope granted: `repoask/github/service.py`
    — a `permissions` parameter on `mint_installation_token` only, defaulting to today's behavior.
    `refresh` must not require the source snapshot.
12. Purge tombstones `title`, `body` and `commit_message` (schema requires non-empty: use
    `"[purged]"`) in addition to artifact ids. Test.
13. `get()` includes a content-free check summary as the contract requires.
14. Reconcile finding our branch name pointing at a foreign commit: durably choose a fresh suffix
    (contract), not terminal `branch_collision`, when our ref was provably never created.
15. Path hygiene: reject `.git` components (case-insensitive), empty/trailing components, a path
    both changed and deleted, and file/directory prefix clashes → `session_snapshot_invalid`.
16. Type-check GitHub response shapes in `_confirm_pr`/`_find_pr` → `pull_request_invalid`.
17. Handoff identity: record base `97f8c30` / round-1 commit `a273ab2`.
