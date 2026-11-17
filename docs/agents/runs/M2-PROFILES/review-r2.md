# Independent review R2 — M2-PROFILES

## Decision

**APPROVED** for exact candidate
`8e3cd21e36bb6d50e60c10eca9fbc89fb2b67b92`.

No blocking or major findings remain from the prior review. This approval covers
the execution-profile service candidate; integration, shared HTTP wiring, and real
Docker/Claude acceptance remain coordinator gates.

## Review identity and scope

- Reviewer: fresh native Codex quality-review session `/root/review_profiles_r3`;
  not the author session.
- Worktree/branch: `../opendevin-m2-profiles`;
  `task/m2-profiles`.
- Assigned base: `28343c3a6a5223bb6195678d2d55203692cdbc14`.
- Prior submitted candidate: `551e98823f59b468432c69e158eab96612c747cf`.
- Corrective source commit: `4f8f698aa77a7d1f5beed0acb04e5ca37db6df2f`.
- Reviewed candidate/evidence commit: `8e3cd21e36bb6d50e60c10eca9fbc89fb2b67b92`.
- Requirements: F07 AI-08, AI-10, AI-11, AI-12; F12 OP-02,
  OP-04, OP-08; accepted `docs/contracts/m2-sessions.md` execution-profile
  slice.

## Prior finding resolution

1. **Pre-runtime policy/shutdown failure:** resolved. `run_test` first proves the
   exact live lease without permitting stopped policy, then records a content-free
   failed check inside the transaction when current policy/shutdown rejects the
   attempt. No runner or adapter factory is called, no private recovery state is
   created, and a later explicit test can run.
2. **Callback exception containment:** resolved. The adapter process boundary
   terminates/reaps its child before propagating ordinary callback errors.
   `ProcessContainmentError` remains the explicit unverified branch and yields
   `needs_reconciliation`; ordinary callback failure yields a safe failed check.
3. **Image-reference validation:** resolved. URL schemes, userinfo-like references,
   malformed digests, invalid ports and empty components are rejected. Registry
   host/port, tags, local references, bare image IDs and repository digests remain
   accepted without permitting executable paths, environment or Docker options.
4. **Cursor overflow:** resolved. Decoded timestamps are bounded to signed SQLite
   int64 before query binding.
5. **Presentation rename check retention:** resolved. Only a consecutive chain of
   byte-equivalent adapter/auth/config versions inherits the nearest check. A
   material change or revert breaks inheritance, a new failed check is not bypassed,
   and an in-flight rename keeps one job/private recovery record.

## Checks actually run

From the exact candidate worktree, using the integration worktree interpreter:

```text
./.venv/bin/python \
  -m unittest discover -s tests -p 'test_execution_profiles.py' -v
```

Result: **39 tests passed in 15.008 seconds**. The run covered immutable versions,
live privacy/deletion gates, synthetic-test idempotency, lease loss/renewal,
cancellation, containment/reconciliation, private projection, budgets, image and
cursor validation, and completed/in-flight rename inheritance.

Read-only review also inspected the exact `551e988..8e3cd21` source/test diff,
the execution schema, worker exception classes, adapter process containment
boundary, task card, handoff, prior response, F07 spec and accepted M2 contract.
`git diff --check` passes for the reviewed candidate.

## Evidence limits and follow-ups

- These tests use real SQLite and the local broker protocol but injected runner and
  adapter fixtures. They do not prove Docker availability, Claude authentication,
  model inference, managed-host policy support, or remote account behavior.
- The candidate intentionally supports only `claude_code` + `cli_login`; API-key,
  managed/enterprise profiles and other adapters fail closed.
- Existing broker AF_UNIX `ResourceWarning` evidence is a dependency follow-up,
  not introduced by this profile diff.
- Coordinator must rerun the affected combined suite after cherry-pick and retain
  the separately reviewed adapter dependencies. A real synthetic profile test is
  still required before calling the runtime operational.
