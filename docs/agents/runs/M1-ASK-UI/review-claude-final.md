# Re-review: M1-ASK-UI at `2d5d2fa811b9198d13b13217f7a502b9a2ee4092`

**Verdict: APPROVED for this exact commit.** No blocking findings. Previous commit `c2482553`; I read the R1 response, handoff, coordinator browser note, diff and the snapshot `ask.js`/`app.js`. Review was read/search only. I ran no tests or browser; the author's 56/56 Node result is their claim, and the root's rerun, Chrome check and full regression are still pending.

## Previous findings

- **M1, a failed send blocking all future sends: fixed.**
  - `http()` (`ask.js:243-248`) now attaches the HTTP status to errors, even when the error body isn't JSON.
  - `send` (`:159-161`) clears the pending attempt on any 4xx and keeps the user's text. Network errors and 5xx keep the same client ID across retry and reload.
  - A visible "Discard pending request" button (`:49-54`) states truthfully that it doesn't cancel work the server may already have accepted.
  - Against the backend: the duplicate-client-ID check in `send` runs before the "Answer already active" check (`conversations.py:88-95`). So retrying an accepted-but-uncertain request reuses the same run instead of hitting a 409.
- **M2, a failed first load breaking the app: fixed.**
  - Only a 404 on `/api/conversations` falls back to legacy Ask (`:10`).
  - `onMount` (`:233`, `app.js` diff) hides the legacy content and wires up the guard before any saved-page read.
  - `load()` catches failures and shows a Retry / history recovery state (`:224-229`). No rejected promise escapes to `app.js`.
- **m1, old controls staying live: fixed.**
  - `load()` clears the body and source pane and advances both request counters immediately (`:216-218`).
  - `button()` ignores clicks on removed buttons or buttons from an older load (`:29-31`).
  - Error messages are only shown if the URL hasn't changed (`:34`).
- **Minors: all addressed.**
  - Pagination removes the old "More" control and deduplicates entries (`:64-66`, `:109-116`).
  - Repository search no longer counts as unsaved work (`:100`).
  - Confirming discard clears both the prompt and scope drafts (`:48`).
  - A scoped repository whose context fails is shown as unavailable (`:93`).
  - "Use candidate" adds the candidate to the scope draft and requires an explicit save (`:148`).
  - Focus is restored after re-render (`:37-40`).
  - Repeated exports replace a single display (`:211-212`).

## Coordinator browser note

- **NodeList:** every array-only call on `querySelectorAll` now spreads the NodeList first (`:38`, `:64`, `:109`). The remaining `controls.forEach` (`:210`) is fine, because real NodeLists have `forEach`. No unconverted uses remain in `ask.js` or `app.js`.
- **main/H1:** the panel is now a `<main>` labelled by a focusable `<h1>` (`:13-14`). It sits beside the hidden legacy `<main>` inside the `view-ask` `<div>`, and other views are hidden, so only one main landmark is visible. `showRoute` focuses the new H1 when the persistent panel is active (`app.js:429-432`). There are no other references to the old `ask-title`.

## Non-blocking follow-ups

1. **Medium, introduced by the focus fix: finished answers no longer load automatically.**
   - This hits keyboard users, and Chrome mouse clicks, since Chrome focuses a clicked button.
   - Repro: press Ask. `load()` rebuilds the page, but the "Ask" button is now disabled because a run is active. So focus restoration (`:38-40`) falls back to the page's `h3` heading.
   - When polling sees the run finish, the "is focus inside the page" check (`:176`) is true. The page then shows "Generation finished. Reload saved conversation…" instead of loading the answer.
   - The message is truthful and one click recovers, but it's a step backwards from `c248255`.
   - Suggested fix: only skip auto-reload when focus is in an editable control (textarea, input or select), and restore focus after the reload.
2. **Minor:** the fallback focus match by button label (`:38`) can land on the wrong row's "Remove entry" in plan lists. Matching by row position or a data attribute would fix it.
3. **Open coordinator request, not part of my R1:** coverage, freshness and destination still appear as raw JSON (`:92`, `:95`, `:127`, `:148`, `:184`). The browser note asked for readable file/chunk counts and "local/remote + host" for the destination. The root should decide whether that gates final browser acceptance.

## Remaining gates (owned by root)

- Actual Chrome check, including narrow layout, keyboard and screen reader.
- Registering the `ask.js` asset and live service composition.
- Full Python/Node regression.
- Backend and index candidate approvals.

This approval covers only `2d5d2fa811b9198d13b13217f7a502b9a2ee4092`.
