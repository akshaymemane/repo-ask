# Builder handoff — M2-PUBLICATION-UI

## Identity

- Author/harness and session ID: Claude (Claude Agent SDK subagent, experience persona); no CLI session ID recorded
- Persona, branch and worktree: experience and accessibility engineer; `task/m2-publication-ui`; `/Users/apple/workspace/vibe-coding/opendevin-m2-publication-ui`
- Base SHA and submitted commit SHA(s): base `0695f0c` (card commit `81a52f1`); implementation `c18641b`; handoff commit follows it on the same branch
- Task card and requirement IDs: `docs/agents/runs/M2-PUBLICATION-UI/task.json`; PR-01, PR-04, PR-07, PR-08, PR-10, OP-12
- Status: review

## Outcome

Changed files (all within write scope):

- `repoask/web/sessions.js` — new `createPublicationArea` (the PR tab's "Draft pull request" area) replaces the
  static `renderPublication`; wired into `createSessionPanel` (created per opened session, disposed on
  hash change/close, `sourceLost()` on real source revocation). New `createPublicationIdentity`
  ("Pull request author" card) mounted inside `createExecutionSettings`.
- `repoask/web/styles.css` — appended publication/identity rules only (dark tokens, no new deps).
- `tests/ui/session-publication.test.mjs` — new, 17 tests.
- `docs/agents/runs/M2-PUBLICATION-UI/status.md`, `handoff.md`.

Not changed: `repoask/web/settings.js`, `tests/ui/settings.test.mjs`, `app.js`, any Python.

Scope decision (recorded as requested): the identity card lives in `createExecutionSettings` (sessions.js)
because that function owns the Settings → Coding agent DOM (`settingsPage.setAgent(executionUI.element)`);
its element persists across Settings re-renders, so unsaved typing survives. Consequence: the card shows
only when the Coding agent section is shown (execution profiles API available), and is hidden when
`GET /api/settings/publication` returns 404.

Contract consumed: `docs/contracts/m2-publication.md` including the 2026-11-16 coordinator additions;
exact paths/bodies from `repoask/publication_api.py`; shapes from `PublicationService.preview/_public/settings`.

Behavior:

1. Non-terminal session: "Publishing isn't available yet. You can create a draft pull request after the
   session finishes." plus saved policy (existing session.test assertion still holds). No publication request.
2. On first terminal observation: `GET /api/sessions/{id}/publication`. `not_found` → Create draft PR;
   unrouted 404 (no `code`) → "Publishing isn't available yet in this build."; network/other → "Check again".
   A response is accepted only if `session_id` matches and `state` is a contract state.
3. Create draft PR → `POST .../publication-preview` with `{}` → inline review step (focus moves to its
   heading): repository (or repository_id + "GitHub access not confirmed"), base and head branch, stats,
   changed paths (>6 collapsed in `<details>`), checks (fully validated, or failed/unavailable counts
   disclosed as a warning), labelled title/description prefilled, blockers in plain language with fix links
   (`publication_identity_required` → `#/settings/agent`, any `*permission*` code → `#/settings/github`)
   and raw code in small print. Publish is disabled (and `aria-describedby` the reason) while
   `publishable !== true` or blockers exist. Cancel returns focus to Create draft PR.
4. Publish → `POST .../pull-requests` with exactly `{title, body, expected_diff_hash, intent_version,
   idempotency_key}`; key `pub-<uuid>` created per preview. Double clicks are ignored while in flight;
   a lost response freezes title/body (read-only), keeps the key, offers "Publish again (same request)"
   and silently tries recovery via `GET .../publication`. `stale_diff`/`idempotency_conflict` show plain
   text plus "Preview again" (new preview → new key); `idempotency_conflict` also recovers the existing intent.
5. Following: polls `GET /api/publications/{id}` every `pollMs` while non-terminal and while the session
   page is live; stops on published/blocked/failed/no_changes, hash change, or close. Steps list with
   `aria-current="step"`; announcements via one `role=status aria-live=polite` line, updated only on change.
   Reconciling: "Checking GitHub…", code explanation, Retry → `POST .../retry {idempotency_key}`; fresh key
   per deliberate retry, same key only after an unknown outcome; `reconciliation_pending` explained politely.
   Published: "Draft PR #n" link only when `pull_request_url` matches `^https://github\.com/[^/]+/[^/]+/pull/\d+$`,
   `target=_blank rel="noopener noreferrer"`; otherwise a warning with no link. "Refresh status" →
   `POST .../refresh {}` shows open/closed/merged. Blocked/failed: mapped text, fix link if any, raw code in
   `<small>`. no_changes: explains nothing (branch/commit/PR) was created. No merge control exists.
6. Pull request author card: GET prefill; labelled name/email (`type=email`), client checks matching the
   service rules, inline errors via `aria-describedby` + `aria-invalid`, API `validation`/`bad_request`
   mapped inline (the API does not say which field), success status, unsaved edits not overwritten by reloads.

## Verification evidence

| Requirement | Command or scenario actually run | Result / evidence |
| --- | --- | --- |
| Baseline | `node --test tests/ui/*.test.mjs` before changes | 206 pass, 0 fail |
| PR-01/PR-04 preview + blockers | session-publication: "preview shows repository, branches, …" | pass (fix links, disabled submit, focus in/out) |
| PR-07 exact payload + key reuse | "publish sends exactly the contract fields …", "stale diff offers a new preview …" | pass (1 request on double click; identical resend after lost response; new key + new hash after re-preview) |
| PR-08 follow/published/safe URL | "progress polls to published …", "an unverifiable pull request URL is never linked" (5 unsafe URLs) | pass; polling stops after terminal; no merge control |
| PR-10 reconcile/retry | "reconciling shows Checking GitHub …", "a lost retry response resends the same retry key" | pass |
| Recovery | "reload recovers a published intent …", "idempotency conflict recovers …", "leaving the session page stops publication polling" | pass |
| no_changes / blocked / failed | "no_changes explains …", "blocked and failed outcomes …" | pass |
| OP-12 identity | "Pull request author card saves … validation errors inline", "… hidden when … route is absent" | pass |
| Full UI suite | `node --test tests/ui/*.test.mjs` after changes | 223 tests, 223 pass, 0 fail |
| Focused file stability | `node --test tests/ui/session-publication.test.mjs` x3 | 17/17 pass each run |
| Python regression (no Python changed) | `python3 -m unittest discover -s tests` | Ran 545 tests, OK (skipped=34) |

All UI evidence is fake-DOM/fixture behavior (`tests/ui/dom.mjs`); no real browser, screen reader, or
real GitHub/session backend was exercised. Layout, real tab order and contrast were not machine-checked.

## Risks and next action

- Known gaps:
  - Real-backend integration not exercised: `SessionService.publication_snapshot` (M2-PUB-SNAPSHOT) is not
    implemented yet, so preview `checks` shape is assumed to be `{fully_validated, summary{status:count}, items?}`
    as in the service tests; the UI tolerates missing fields. Needs a check at M2-INTEGRATE.
  - The API's `validation` error carries no field detail, so a server-only rejection marks both identity
    fields; a `details` field in the error payload would allow precise inline errors (backend/coordinator decision).
  - Recovery GET runs once when the session is first seen terminal. An automatic (`on_success_draft`)
    intent created after that read appears only after reload, or when a manual preview/publish hits
    `idempotency_conflict` (which triggers recovery).
  - The review step's key/edits are in memory only; reload during review loses edits (a created intent is
    still recovered by the GET).
  - Unverified PR URL: no link is shown, only a warning; the number is still displayed.
  - The identity card is visible only where the Coding agent section is (execution profiles API reachable).
- Migrations/configuration: none.
- Background processes: none left running.
- Reviewer and scope: Codex (opposite harness) — sessions.js publication area and identity card, appended
  CSS, new test file; also check accessibility claims and the "no merge / safe URL" boundary.
- Outside-scope needs: none required. Optional follow-ups for the coordinator: (a) field-level `details` in
  publication validation errors; (b) a browser/a11y pass at M2-INTEGRATE.
