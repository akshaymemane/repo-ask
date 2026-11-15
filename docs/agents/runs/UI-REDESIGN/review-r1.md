# UI-REDESIGN independent review — round 1

Verdict: **CHANGES REQUESTED** for exact commit
`44b8b6d6489959448cbe405bea21baa02412964f`, base
`d3c0681520a00c3267afadcceeca79d9f118dca9`.

Reviewer: fresh native Codex quality/security reviewer. The immutable review packet's
57 files matched their SHA-256 manifest. `git diff --check` passed, 42 focused Python
tests passed, and the UI suite passed 167 of 169 tests. The two UI failures were the
known missing `test_sessions_fixture` dependency from the unintegrated M2 session
backend. The acceptance report's 157/159 count was stale. No direct `innerHTML`, `eval`,
or equivalent XSS sink was found.

## Required findings

1. **Major — visible unsaved plan edits can launch the old immutable version.**
   `repoask/web/ask.js:323-345` mutates the in-memory plan for ordinary fields without
   setting the draft flag. Start therefore refetches and launches the prior saved plan
   while the edited text remains visible. Every plan mutation must share one dirty-state
   path; Start/navigation must require successful save or explicit discard.
2. **Major — queued repository toggles can disagree with the server.**
   `repoask/web/repositories.js:69-97` queues work but sends mutable `row.target`. A
   fail-first, queued-second sequence can reset the target, send false/false, then commit
   the second switch visually as true. Queue immutable desired snapshots, coalesce
   safely, or freeze both row controls until the mutation settles; add the race test.
3. **Major — transient secure-store failure consumes manifest callback state.**
   `repoask/github/service.py:121-129` pops CSRF state before checking storage. A locked
   vault returns `secret_store_unavailable`; retry after unlock returns
   `manifest_state_invalid` before any conversion request, orphaning the created App.
   Validate without consuming, check storage, then claim exactly once immediately before
   conversion. Test lock/unlock retry and concurrent callbacks.
4. **Major — 200+ repository support is incomplete.** `repoask/web/setup.js:26-38` and
   `repoask/web/repositories.js:179-195` inspect only the first 100 records. Onboarding can
   falsely report no indexed repository when the indexed record is on page two. Add
   cursor traversal or authoritative aggregate status, catalog paging, and the approved
   owner/fork/archived filters.
5. **Major — the approved redesign is materially incomplete.** Its own acceptance file
   records a two-column Sessions page instead of the required persistent three panes, a
   full-page plan editor instead of the Ask side panel, reused legacy provider/context
   controls, and missing catalog filters/full paging. It refers to `Ruling:` entries that
   do not exist in the design, plan, or acceptance documents. These are implementation
   gaps, not approved scope changes.
6. **Moderate — removing a repository does not stale an existing plan.**
   `repoask/web/ask.js:199-203` calculates removals but marks stale only for additions.
   Any scope change must require plan review/regeneration.

## Remaining acceptance gates

After fixes, rerun the full UI and touched/full Python suites, then perform the omitted
keyboard-only and 390px browser pass. Real session-service acceptance waits on the
reviewed M2 backend. Live GitHub Manifest acceptance is a separately authorized external
operation and was not performed by this review.
