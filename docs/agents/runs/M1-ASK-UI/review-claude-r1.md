# Review: M1-ASK-UI at `c2482553b7ff85b767ac7e3a2980107d48eaac28`

**Verdict: changes requested.** Two major issues block approval. The base is `7fe71b85` (integration base `afbfd832`), branch `task/m1-ask-ui`. I reviewed by reading files and searching only. I did not run any tests, browser checks or live calls, so pass/fail results are not claimed here.

Sources I read: `task.json`, the author handoff, `checks.txt`, `manifest.json`, the full patch, the snapshot `ask.js`/`app.js`, `docs/contracts/m1-ask-plans.md`, F11 UX-03..11, and the candidate backend in `opendevin-m1-ask-ui/repoask/ask/{conversations,plans}.py`, `providers/service.py` and `api.py` (read to check data shapes).

## Major findings

**M1 — Any failed send permanently blocks all future sends (UX-08, ASK idempotency).**
- **Where:** `ask.js:82-84`, with the saved state at `:16-17`.
- **What happens:** `sendAttempt` is saved to sessionStorage before the POST and cleared only on success. `http()` (`:146`) treats every non-OK response the same, so a definite rejection is kept as an "uncertain" attempt.
- **Server errors that trigger it:** `send` raises `ValueError('Conversation message limit reached.')`, text-length validation, `NotFound('Conversation deleted.')`, and `IdempotencyConflict` (`conversations.py:81-98`).
- **Repro:** Send in conversation A. Delete A from another tab, or hit the 1000-message limit, so the POST returns 4xx. Now any send in any conversation throws "Resolve the uncertain request by retrying the same content…". This survives reload because of sessionStorage, and there is no control to abandon the attempt.
- **Fix:** Keep the client ID only for network errors, timeouts, 5xx or other ambiguous transport failures. Clear it on definite 4xx (show the error and keep the draft). Also add an explicit "Discard pending request" action.
- **Tests:** none of the 5 new tests covers a definite rejection.

**M2 — Reloading a saved URL that fails to load breaks the whole app (UX-03, UX-08).**
- **Where:** `ask.js:141`, which runs `await refreshHistory(); await load();` with no catch, and `app.js:1213`, which awaits it at module top level.
- **Why:** `conversation()` and `plan()` throw on a failed GET (`:43`, `:102`).
- **Repro:** Open `#/ask/does-not-exist`, or a plan URL whose ID 404s, or hit any transient 5xx on `/api/conversations/{id}` or the history page, then refresh. The result:
  - `createAskPanel` rejects after the panel is already attached at `:12`.
  - `persistentAsk` stays null, so the legacy Ask DOM is not hidden and the new panel and legacy UI both show.
  - The `canNavigate` draft guard is never wired up in `showRoute`.
  - Nothing tells the user what failed.
- **Fix:**
  - Catch failures from the first load inside the panel and show a clear "Conversation/plan unavailable" message with links to history or a new conversation.
  - Return the panel handle even when that first load fails.
  - Only fall back to legacy when `/api/conversations` is missing.

## Medium

**m1 — Old content stays clickable while navigation is pending or after it fails.**
- **Where:** `load()` at `:133-139` bumps `epoch` but leaves `body` unchanged until the new GET succeeds. The hashchange handler (`:140`) just shows the error via `.catch(say)`.
- **Effect:** After a failed or slow navigation, the URL points at B while A's controls stay live. Ask, Save scope, Save immutable version and Start still send their requests; only the re-render afterwards is fenced.
- **Fix:** Clear or disable `body` at the start of `load()`, and render an error state on failure.

## Minor (non-blocking)

- **Duplicate history buttons** (`:24-30`): each paginated `refreshHistory(cursor)` adds another "New saved conversation" button. The old "More conversations" button stays, and clicking it again re-appends the same page. "More repositories" in `browse` (`:54`) has the same problem.
- **Search box counts as unsaved work** (`:51`): the catalog search field uses `field()`, so typing a search marks the page dirty. That triggers false discard prompts and blocks the poll auto-reload (`:96`). This works against UX-11's "warn only when edits would be lost".
- **Discard doesn't fully discard:** confirming "discard" resets `draft`, but `promptDrafts` still holds the text, so it comes back next visit. Defensible, but the dialog wording is then wrong.
- **Silent missing repositories** (`:47`): a scoped repository whose context request fails is simply left out. It should show "unavailable" (UX-04).
- **"Use {candidate}" replaces the whole scope** (`:76`) with that one repository, silently dropping other pinned repositories and any unsaved scope-field edits.
- **Focus lost after re-render:** save scope, Use candidate, cancel and retry rebuild `body`, so focus drops to `document.body` (UX-10).
- **Repeated exports** (`:130`): every export click appends another `<pre>` instead of replacing the last one.

## Checked and OK

- **URLs:** `#/ask/{id}` and `#/plans/{id}/{ver}` match `routeFromHash`. Previous/latest version links work, and the server reports old versions as `superseded` (`plans.py:211`).
- **Late responses:** source requests are fenced by both `sourceEpoch` and the navigation `epoch`. Source requests send the exact repository/snapshot/path/range, and stored citations include `snapshot_id`.
- **Plan saves and exports:** saves send `parent_version_id: v.id` and keep the editor open if the save fails. Fields are frozen during the save (the request body is serialized before the await). Exports are checked against both version ID and hash.
- **Start session:** disabled unless server readiness is exactly `ready`; it rechecks readiness and hash before posting. It sends only the reserved body with a persisted idempotency key and navigates only on a server `session_id`. M1 limits are labelled as unavailable.
- **Provenance:** the Settings data shapes (`roles.ask/planning.{model,status,destination}`, `settings.local_only`) match `api.py:116`. Per-answer model/destination is shown as "unknown". The public read doesn't expose them, which is already recorded as a backend gap; the client doesn't misuse anything here.
- **DOM safety:** all model, source and export text goes through `textContent`. Link targets are hash-only and URL-encoded, and no external links are generated.
- **Navigation guard:** the `app.js` `canNavigate` check and the `ask.js` hashchange listener prompt only once. Refusing restores the URL via `replaceState`.
- **Out of scope here:** `#/sessions/{id}` currently falls back to `#/ask` through `app.js:403-405`. That is the root's M2 route work, not this card's.

## Coverage gaps and blocker owners

- No test covers definite-rejection sends, a failed first load or navigation failure. The author should add these alongside the M1/M2 fixes.
- Actual browser, narrow-layout, keyboard and screen-reader acceptance, and live HTTP composition (registering `ask.js` and the worker handlers) are still owned by the root.

M1, M2 and m1 go back to the author. Re-review is needed on the new SHA.
