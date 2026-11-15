# M2-PRS builder handoff

## Identity and scope

- Task: M2-PRS — draft publication and uncertain-outcome reconciliation
- Branch/worktree: `task/m2-publication` / `opendevin-m2-publication`
- Base: `1fa296f951a63d22d4f6d9d764a601b502e7b9ec`
- Contract: `docs/contracts/m2-publication.md`
- Author: native Codex runtime builder
- Review: required; this handoff is not approval

Changed only the assigned publication package, publication tests, publication-specific
GitHub client methods/tests, and this task-local evidence.

## Implemented behavior

- Read-only preview over the trusted session publication snapshot; it does not mint a
  write token or persist an intent.
- One immutable intent per session, request-hash idempotency, one-attempt external job,
  explicit commit identity, frozen date/message/title/body/branch.
- Repository-scoped installation token requesting exactly `contents:write` and
  `pull_requests:write`; token remains call-local.
- Deterministic blob/tree/commit construction using the actual base commit's tree SHA,
  regular modes, deletions, and the frozen session base as the sole commit parent.
- Base-advance comparison: overlapping paths and incomplete 300-file coverage block;
  disjoint changes remain based on the recorded parent and are never silently rebased.
- New refs only, no ref update/force/default-branch write. Collisions adopt an identical
  commit or durably advance to a fresh suffix.
- Draft PR confirmation validates repository, head SHA/ref, base, provider ID, exact
  safe GitHub URL, and draft state before recording `published`.
- Lost branch/PR responses enter `reconciling`. Read-before-retry adopts the exact
  branch/PR or resumes only the safe remaining step. Retry keys are idempotent.
- Empty diff before token mint, automatic success-only policy, manual failed-check
  disclosure, permission rechecks between external steps, purge tombstoning, refresh.

## Verification

- `python -m unittest discover -s tests -p 'test_publication*.py'`: 16 passed.
- `python -m unittest discover -s tests -p 'test_github_*.py'`: 38 passed.
- `python -m py_compile repoask/publication/*.py repoask/github/client.py`: passed.
- `git diff --check`: passed.
- `python -m unittest discover -s tests`: 475 passed, 9 skipped in 168.0 seconds.
  The existing AF_UNIX `ResourceWarning` appeared once and did not fail the suite.

The tests use real SQLite migrations/jobs plus injected session and GitHub boundaries.
They are not a live GitHub pilot.

## Integration work and gates

Coordinator-owned work remains:

1. Implement the exact trusted `SessionService.publication_snapshot` handoff with
   artifact/hash/live-policy validation.
2. Register `publication.run`, `PublicationAPI`, service lifecycle/purge wiring, and UI.
3. Run fresh opposite-harness quality/security review against the exact candidate.
4. After approval, run a user-authorized pilot in a disposable repository. Fakes do
   not satisfy the M2 pilot and no Git CLI credential may be reused.

No remote branch, PR, push, account change, package install, or live-port action was
performed.
