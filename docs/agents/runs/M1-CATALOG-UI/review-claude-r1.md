# M1-CATALOG-UI review: changes requested for `94ad03efd6360eda57a1fab77fb3d70fc5b2c8cf`

The three issues you asked me to check are fixed. I can't approve yet because one major problem from the same family is still open in the GitHub settings panel.

**Basis:** I only read code. I compared the packet snapshot and the diff from `b82d811`, and read `task.json`, the review files and handoffs in the packet, F01/F11 in `docs/features`, `docs/contracts/m1-services.md` and `repoask/api.py`. My only tools were read and search: I ran no tests, edits, browsers, subagents or live account calls. I did not recompute the manifest hashes.

**Test results, as reported by others:** the author reports 28 of 28 UI checks passing, and that three delayed-response tests failed before the fix. Your root rerun outside the sandbox and the final Chrome check are still pending. I did not see either result.

## Earlier findings: fixed

1. **Stale provider loads** (`app.js:1031-1051`, `1094`): each load gets a number and drops its response if a newer load started. Every provider change, including tests, makes older loads out of date. Reloads are skipped while a change is in progress, and errors from old loads are ignored. This fixes the duplicate and stale forms. Tests at `catalog.test.mjs:149-183` cover it in a meaningful way.
2. **Permission save race** (`app.js:1011-1022`): both checkboxes are disabled while the save is pending. Their values are then taken from the server's validated true/false response before "Selection saved" appears. They are re-enabled whether the save succeeds or fails, and later edits show "Unsaved selection". Covered by `catalog.test.mjs:185-199`.
3. **Read-only textarea** (`app.js:885-892`): the code now sets `type` only on `<input>` elements. The test DOM makes `textarea.type` read-only, matching browsers, and `catalog.test.mjs:128-145` checks this. Your Chrome recheck should still confirm it renders.

## Major finding: blocks approval

**M1 — GitHub panel has the same overlapping-load bug as the old provider panel** (`app.js:912-958`)
- `loadGitHub()` clears the panel and then waits for its request. Nothing marks which load is newest, so every response that arrives adds its content to the panel (`921-956`).
- Any two loads running at once therefore duplicate the panel, whatever order they finish in. You get two copies of the setup guidance, duplicate connection boxes with Connect/Refresh/Disconnect buttons, and two "Save App configuration" forms.
- If the older response arrives last, it adds old connection state next to the current state.
- Easy ways to trigger it:
  - Click "Reload GitHub status" (`915`) while the first load on page start is still running (`1143`).
  - Click Reload while an App configuration save is pending. The save reloads the panel when it finishes (`954`), and the earlier reload may have read the state from before the save.
- This breaks UX-08/UX-09 (honest, current state) and UX-04. The stale and duplicate copies show real actions.
- **Fix:** use the same numbering guard as `loadProviders`, and either block or mark reloads that happen during a pending configure.
- **Test needed:** two overlapping loads resolved newest-first should leave exactly one form and one set of connection boxes.

## Medium findings: not blocking, should be tracked

- **N1 — the GitHub setup-return message is never shown** (`app.js:1140-1143`). The message is added to `githubPanel`, but `loadGitHub()` immediately clears the panel when it starts (`913`). After the GitHub callback, including failures like `?github=setup_failed`, the user sees nothing about the outcome. This gaps UX-08 and GH-01. The test at `catalog.test.mjs:105-109` doesn't check for the message. **Fix:** add it after `replaceChildren`.
- **N2 — the catalog can reload during a pending repository save** (`app.js:937`, `973`, `975`, `971-972`). "Reload catalog", "Apply filters", Next/Previous and GitHub Refresh/Disconnect all clear and reload the rows while a save is pending. The new read may return the values from before the save, without any "Selection saved" message. That is a narrower form of the old finding 2. **Fix:** block catalog reloads while a save is pending, as the provider panel now does.

## Minor findings

- **m1 — Reload does nothing silently during a pending provider change** (`app.js:1044`). Clicking Reload gives no feedback.
- **m2 — keyboard focus is lost after saves and status refreshes.** After a provider save, the whole panel is rebuilt (`1046`) and focus drops to `body` (UX-10). `refreshStatus` → `renderSettings` (`473`, `822-825`) also removes and re-adds the panels, which drops focus from any field being edited.
- **m3 — invalid install link errors can echo the link** (`app.js:931`). If `new URL()` fails, `GitHub unavailable`/`status` shows the browser's error text, and some browsers include the URL in it. It is shown as plain text, so there is no injection risk, only a possible echo of the link.

## Security spot-checks: no blockers found

- All rendering uses `textContent`, never `innerHTML`.
- The install link must be on `https://github.com` under `/apps/` and uses `rel=noreferrer`.
- Server error messages are reduced to a code that must match `[a-z_]{1,64}`.
- The PEM key and provider credential fields are cleared on submit and the copies kept in memory are removed afterwards. They are never stored or retried.
- The route pattern only accepts a bounded `?github=` code, and its value is never displayed.
- Request payloads match the fields `api.py` accepts.

**For the coordinator:** M1 goes to the author (Codex experience persona) to fix, and N1/N2 should be fixed or tracked. Integration should wait for the M1 fix, your root rerun of the 28 UI checks and Chrome checks at desktop and narrow widths. The narrow-width CSS is `styles.css:637-650` in the diff, which I checked only by reading.
