# F06 — Branch publication and pull requests

Status: Draft | Milestone: M2 | Parent: [Master PRD](../../Master%20PRD.md)

## Outcome and boundaries

Turn reviewable session changes into a traceable GitHub draft PR. Users see what changed, which checks ran and what remains unresolved. M2 publishes one PR for the session's single writable repository. No automatic merge or cross-repository atomic publication is included.

## Publication policy and user experience

Default: show **Open draft PR** after a reviewable outcome. A user can explicitly choose automatic draft publication when starting a session. Record that choice on the session; skills, plugins or repository instructions cannot enable it.

Before manual publication show repository, base/head branches, diff summary, checks and proposed title/body. Users can edit title/body. Publication must not require another confirmation when the user already authorized the exact automatic publication policy and all its conditions hold.

## Functional requirements

- **PR-01:** Verify repository capability, unchanged write scope, plan/session linkage and availability of the session branch before pushing.
- **PR-02:** Produce commits attributable to the configured identity and tied to the session ID. Never include credentials or unapproved local artifacts.
- **PR-03:** Push only the session branch. Do not force-push or modify the default/protected base branch automatically.
- **PR-04:** Open a draft PR with title, user-facing behavior, implementation summary, validation results, limitations and session/plan references where shareable.
- **PR-05:** Record repository, branch/head SHA, PR provider ID/number/URL, base branch, publication intent and last synchronized status.
- **PR-06:** Use a durable publication operation and idempotency key. After an uncertain response, look up the recorded branch/PR before retrying.
- **PR-07:** Label failed, skipped and unavailable checks accurately. Automatic publication requires completed work, successful required validations and no unresolved blocking issue. Manual draft publication may include disclosed failures.
- **PR-08:** Detect empty diffs and show “No changes to publish” without creating an empty PR.
- **PR-09:** If the base branch advances, report divergence and compare current changes. Do not silently rebase or rewrite published history. Conflicts block publication until resolved in an explicit successor session or authorized amendment.
- **PR-10:** Reconcile PR open/closed/merged state through polling or refresh. GitHub CI status remains distinct from local session validation.
- **PR-11:** Keep a patch/export path available if pushing fails. Retrying publication does not rerun implementation.

## Publication states and contracts

`not_requested → preparing → pushing → creating_pr → published`. Failure can become `blocked`, `failed` or `reconciling`; unknown external outcome always reconciles before repeating the write. “Published” means the PR exists, not that it is approved or merged.

Proposed routes: `POST /api/sessions/{id}/publication-preview`, `POST /api/sessions/{id}/pull-requests`, `GET /api/publications/{id}`, and `POST /api/publications/{id}/retry`. Preview is read-only. Publication mutation includes the expected head SHA and intent version to prevent publishing a stale preview.

PR descriptions must not expose private source from unrelated repositories, local filesystem paths, secrets or inaccessible local session URLs as if they were public links. Use a plain session identifier when no shareable URL exists.

## Failure behavior

A successful push followed by PR failure retains the remote branch and retries only PR creation after reconciliation. A created PR followed by a lost response is found by repository/head/base and durable operation metadata. Permission loss yields reconnect or access guidance. Branch-name collisions generate a new session-specific name before push; existing unrelated branches are never overwritten.

## Acceptance criteria

1. A completed session can create a draft PR against its intended base with an accurate diff and validation summary.
2. Double-click, timeout after PR creation and application restart each leave exactly one matching PR.
3. Failed push preserves local artifacts; failed PR creation after push does not create duplicate branches or commits.
4. Empty changes do not create a PR. Protected/default branches are never pushed directly.
5. Automatic publication remains disabled unless explicitly selected, and does not run when required validation fails.
6. Permission revocation blocks publication even if planning and implementation previously succeeded.
7. A stale expected head or newly conflicting base yields a visible blocked state rather than an automatic history rewrite.

## Dependencies and measures

Depends on F01 credentials/capabilities and F05 artifacts, with F12 reconciliation. Measure publication success, duplicate rate, time to draft PR and unresolved status reconciliation. M4 coordinated PRs require a separate partial-failure design.
