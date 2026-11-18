# LAUNCH-FRESHNESS review — Claude, round 1

Verdict: **CHANGES_REQUESTED**

- Reviewed commit: `28b08f5` (author: Codex runtime builder); handoff `1ceeaaa`.
- Reviewer: Claude (launch-wave coordinator), opposite harness.

## Findings

1. **Major — Retry dead-ends once the base branch advances.** `repoask/sessions/service.py` `retry()` → `_create()` →
   `_launch_observation()`. A retry inherits only the predecessor's `acknowledged_base`; a session first launched on a
   current base and retried after HEAD moved raises `base_advanced`, but `POST /api/sessions/{id}/retry`
   (`repoask/session_api.py:~100`) accepts only `idempotency_key`, maps the error like any other, and the Sessions
   "Retry as a new attempt" control has no acknowledge path. Probe (SessionCase fixture): launch at HEAD `c…`, fail the
   session, `retry(id,'k2')` with HEAD `d…` → `RETRY BLOCKED base_advanced`. Users can then only regenerate a plan to
   recover from an interrupted session, which contradicts the README recovery instructions.
   **Fix:** let retry carry the same optional `acknowledged_base` (validated against the pinned revision, persisted,
   idempotent), return the same 409 shape from the retry route, and reuse `renderBaseAdvanced` in
   `repoask/web/sessions.js` for the retry control ("Retry on the saved base" / "Regenerate plan" or "Open plan").
   Add service, API and UI tests for retry-after-advance with and without acknowledgement.
2. **Minor — notice styling bypasses theme tokens.** `repoask/web/styles.css` `.base-advanced-notice` uses
   `currentColor` borders/outline. Use the warning token (`var(--warning)` border, a tinted `color-mix` background,
   `var(--radius)`), keep the `:focus-visible` ring consistent with other controls, and give the two actions the
   shared `.btn` classes (they already come from `button()`; check spacing at 390px).

## Checks run (outside the author's sandbox)

- `python -m unittest discover -s tests` — OK (9 skipped). `node --test tests/ui/*.test.mjs` — 292/292.
- `git diff --check` clean. Retry probe above.
- Design otherwise sound: bounded 2s observation, persisted per idempotency key (no repeat GitHub calls, restart-safe),
  no session row on refusal, acknowledgement validated against the pinned revision, unavailable never blocks.
