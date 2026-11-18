# M2 draft publication contract

Status: accepted by the coordinator for implementation. F06, with F01/F05/F12.
Migration 11 is reserved for this slice. Publication is limited to one writable
GitHub repository and one draft pull request per terminal session. It never merges,
force-pushes, rebases, updates the default branch, or gives GitHub credentials to the
runner or coding adapter.

## Ownership and trust boundary

The publication builder owns `repoask/publication/**`, publication tests, and only the
GitHub client methods explicitly needed below. The coordinator owns migration 11,
`PublicationAPI`, shared service composition, session export wiring, and final UI
registration. Session code supplies a trusted immutable publication snapshot; the
publisher never reconstructs files from a displayed patch or model output.

GitHub installation tokens are minted by `GitHubService` at the last possible moment,
for exactly one repository and only `contents:write` plus `pull_requests:write`. Tokens
stay in the publisher call stack and never enter SQLite, artifacts, events, logs,
prompts, containers, command arguments, or browser responses. Every external step
rechecks current repository access, implementation permission, the recorded session
policy, and the granted GitHub capabilities.

App permissions (coordinator decision with user approval, M2-PILOT, 2026-11-17): the GitHub App manifest
requests `contents: write`, `pull_requests: write` and `metadata: read`. Apps created before this read
only; their owner must raise those two permissions on GitHub and accept them on the installation.
Installation tokens stay narrower per call (read scope for reads, the two writes only inside `run`), and
writes remain limited to repositories with implementation enabled.

## Session handoff

`SessionService.publication_snapshot(session_id)` is a trusted internal method, not an
HTTP response. It returns:

`{session_id,plan_id,plan_version_id,repository_id,base_sha,base_branch,session_branch,
diff_hash,checkpoint_artifact_id,patch_artifact_id,checkpoint,patch,policy,outcome,
validations,source_available}`.

The checkpoint contains bounded base64 file bytes, deletions, regular Git modes
`100644`/`100755`, and rejected paths from the latest verified capture. The patch and
checkpoint hashes must match the recorded session repository and artifacts. The method
fails if source is unavailable, the repository was purged or excluded, artifacts are
missing/redacted/stale, the runner is not verifiably contained, the session is not
terminal, or any changed path is rejected. It reuses the current live source policy and
returns no host path or runner identifier. Exported path keys must be canonical relative
paths; non-canonical keys fail with `rejected_paths`. Secret-content detection fails
with `sensitive_content`, without file contents or diagnostic details.

Generated artifacts (coordinator decision, M2-PILOT, 2026-11-17): a rejected path whose
reason is `excluded_generated` **and** whose status is `added` (a new untracked artifact such as
`__pycache__/`, `node_modules/` or build output created while working or validating) is omitted from
publication, never uploaded, and listed by path in the snapshot (`omitted`), the preview
(`omitted_paths`) and the default PR body. It does not count as a rejected path for eligibility.
Every other rejection — any other reason, or a generated-pattern path that is `modified` or `deleted`
(a tracked file) — still fails the snapshot with `rejected_paths`.

Manual publication may disclose failed/unavailable checks in the PR body. Automatic
`on_success_draft` publication additionally requires session state `completed`, outcome
`reviewable`, `publication_eligible=true`, all required validations passed, current
artifacts, confirmed containment, and no blocking issue. A model, skill, plugin,
repository instruction, or session follow-up cannot change the frozen policy.

## Public service contract

`PublicationService(platform,github,sessions,*,clock=now_ms)` provides:

- `preview(session_id)`: read-only. Returns repository/base/head names, current diff
  hash and stats, checks, policy, a bounded default title/body, `intent_version=1`,
  current base observation/divergence, capability blockers, and `publishable`. It never
  creates a database row, mints a write token, or changes GitHub.
  Default fields (M2-FOLLOWUPS-PR-DEFAULTS, PR-04/PR-07): the publisher reads only
  `plan_versions.content_json` matching the snapshot's `plan_id` and `plan_version_id`,
  never the latest plan. The editable `title` is the goal normalized to one line,
  capped at 256 characters with trailing periods removed; absent goals retain the
  existing session-title fallback. The editable Markdown `body` contains the goal
  (1,000 characters), up to 20 plan step titles, up to 20 recorded validation
  commands with passed/failed/not run outcomes, and up to 20 omitted generated paths
  with the total count. Step/command/path text is capped at 150 characters; omitted
  entries are counted explicitly. Non-passed runtime statuses map to not run except
  `failed`. Missing validation records, unsuccessful checks, incomplete validation,
  or truncated check lists produce an explicit `Limitations:` line. All text passes
  through session credential/host-path redaction before truncation; the body is capped
  at 12,000 characters and excludes source contents, patches and validation output.
  Preview retains `omitted_paths` as a list; the review UI displays its total and up
  to 20 paths (300 characters each) before publication. This changes no request shape.
- `publish(session_id,title,body,expected_diff_hash,intent_version,idempotency_key)`:
  atomically validates the exact preview/session state, stores one immutable intent,
  and enqueues an `external` `publication.run` job with `max_attempts=1`. Same key and
  same request returns the existing operation; reuse with different intent conflicts.
  A session has at most one publication intent.
- `get(publication_id)`: safe public state, repository/base/head, diff hash, check
  summary, PR number/URL/state, error code, and timestamps. It omits tokens, source,
  object request bodies, local paths, and private GitHub responses.
- `retry(publication_id,idempotency_key)`: only after reconciliation proves the prior
  outcome. It resumes from durable remote facts and never reruns implementation or
  changes the immutable title/body/commit.
- `run(job,context)`: performs the state machine below. Unknown branch/PR outcomes enter
  `reconciling` and raise `UnknownOutcomeError`; they are never blindly repeated.
- `refresh(publication_id)`: reads current branch and PR state without mutating them.
- `purge_repository(repository_id)`: blocks in-flight work, clears any source-bearing
  local payload still referenced by publication, and retains only remote identifiers
  and content-free audit state.

HTTP routes are `POST /api/sessions/{id}/publication-preview`,
`POST /api/sessions/{id}/pull-requests`, `GET /api/publications/{id}`, and
`POST /api/publications/{id}/retry`. Preview is a read-only POST with an empty body.
Publish accepts exactly `title`, `body`, `expected_diff_hash`, `intent_version`, and
`idempotency_key`. Retry accepts exactly `idempotency_key`. Mutation bodies and list
fields remain bounded by the shared API limits.

Coordinator additions (M2-INTEGRATE, 2026-11-16) so the browser can recover state and set the
required commit identity: `GET /api/sessions/{id}/publication` returns that session's one
publication or `not_found`; `POST /api/publications/{id}/refresh` (empty body) reads current PR
state through `refresh`; `GET`/`PATCH /api/settings/publication` read and set exactly
`commit_name` and `commit_email` through `settings`/`update_settings`. None of these mint a write
token except `refresh`, which reads only.

## Deterministic remote state machine

1. Revalidate the snapshot and mint the repository-scoped token.
2. Resolve the recorded base commit and its **tree object SHA**. `base_tree` is never the
   commit SHA. If the base branch no longer points at the session base, compare the
   session base with current base. Any overlap with changed paths blocks. A comparison
   with 300 file results or otherwise incomplete file coverage is `divergence_unknown`
   and blocks; M2 does not silently rebase.
3. Create blobs for changed files, then a tree based on the exact base tree. Deletions
   use a null tree-entry SHA. Omitted/excluded/rejected files never enter the tree. Git
   object creation is content addressed and may be reconciled by its recorded SHA.
4. Create one deterministic commit whose single parent is the session base. Freeze the
   message, author/committer name and email, and ISO-8601 timestamp before the first
   write so a retry produces the same commit SHA. Publication settings require an
   explicit valid commit name/email; no identity is invented from local Git config.
5. Create a unique `refs/heads/opendevin/<session-id>-<suffix>` pointing directly to the
   commit. Never update the default/protected branch and never pass `force=true`.
   On a 422/collision, read the ref: adopt it only when it already points to the frozen
   commit for this operation; otherwise durably choose a fresh suffix before writing.
6. Create a draft PR with the frozen title/body, head branch, and recorded base branch.
   If the response is lost, look up open/closed PRs by exact repository/head/base and
   adopt only a matching head SHA. A successful branch followed by PR failure retains
   the branch and retries only PR creation after reconciliation.
7. Record `published` only after a fetched PR confirms repository, head SHA, base,
   `draft=true`, provider ID/number, and safe GitHub URL. PR open/closed/merged refresh
   is distinct from local validation and never triggers merge behavior.

Empty diffs become `no_changes` before any token or external write. A stale expected
diff, changed permission, changed exclusion, purge, missing write permission, base
conflict, or unverified containment becomes `blocked` with a stable content-free code.

## Persistence and recovery

Migration 11 defines `publication_settings`, `publications`, and
`publication_events`. A publication references the immutable checkpoint and patch
artifacts used for the operation. State, object SHAs, branch and PR identity are updated
after each confirmed step. Event sequences are append-only per publication. The job is
an external effect: lease expiry becomes `needs_reconciliation`; a recovery leader first
reads GitHub using the durable operation, branch, commit and PR identities, then either
marks the step confirmed, blocks it as conflicting, or leaves reconciliation pending.

Allowed states are `queued`, `preparing`, `creating_objects`, `creating_branch`,
`creating_pr`, `reconciling`, `published`, `blocked`, `failed`, and `no_changes`.
`published`, `blocked`, `failed`, and `no_changes` are terminal for that intent.
Retry creates a new external job for the same intent only after reconciliation says the
next step is safe.

## GitHub API constraints

The implementation keeps the existing `2022-11-28` API version until a separately
reviewed upgrade. Official GitHub contracts require `contents:write` for Git tree/ref
writes and `pull_requests:write` for PR creation. A create-tree request inherits files
only when `base_tree` is the existing tree SHA. Reference updates default to non-force;
M2 creates a new reference and does not update it. Compare results expose at most 300
changed files for the comparison, so that bound is treated as incomplete for conflict
clearance. Installation tokens are scoped to the one repository and requested
permissions rather than inheriting every installation grant.

## Acceptance gate

Tests must prove exact snapshot binding, empty diff, current permission and exclusion
checks, deterministic objects, executable modes/deletions, collision handling, base
advance overlap/unknown bounds, lost branch response, lost PR response, restart
reconciliation, double-click idempotency, manual failed-check disclosure, automatic
policy gating, purge redaction, and no force/default-branch write. M2 completion also
requires a user-authorized pilot in a disposable GitHub repository that creates one
real draft PR with actual changes and recorded checks. Fakes alone do not satisfy that
pilot, and no pilot may reuse Git CLI credentials.

## Primary references

- [Git tree endpoints](https://docs.github.com/en/rest/git/trees?apiVersion=2022-11-28)
- [Git commit endpoints](https://docs.github.com/en/rest/git/commits?apiVersion=2022-11-28)
- [Git reference endpoints](https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28)
- [Pull request endpoints](https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28)
- [Authenticating as a GitHub App installation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation)
- [Compare-two-commits response bounds](https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28#compare-two-commits)
