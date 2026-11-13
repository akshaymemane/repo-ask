# Builder handoff — M0-EXPERIENCE

## Identity

- Author/harness and session ID: Claude (Claude Code, Opus 5.5), session `82ea8cad-ecaa-40a4-8e7d-342e90429085`
- Persona, branch and worktree: experience; `task/m0-experience`; `/Users/apple/workspace/vibe-coding/opendevin-m0-experience`
- Base SHA and submitted commit SHA(s): base `bd8c3afd18a6fe23dd984455c194743595935577`; implementation `9e95d162c5ba7f091589d2227b0e564ca6e11eed`; this handoff/status is in the next commit on the same branch (docs only)
- Task card and requirement IDs: `docs/agents/runs/M0-EXPERIENCE/task.json` (coordinator-owned, left untracked/unmodified); F11 UX-02, UX-03 (hash routes only), UX-07, UX-08, UX-10
- Status: review

## Outcome

Vanilla HTML/CSS/JS only; no npm, build step, new dependency or Python change. Contract consumed: `opendevin.m0/1`
(`opendevin.workspace/m0.x`, `opendevin.health/m0.x`) per `docs/contracts/README.md` §6–§7. No deviations.

- **Navigation (UX-03 partial, UX-10).** `<nav aria-label="Workspace">` list of real links `#/ask` (default), `#/repositories`,
  `#/settings`; `aria-current="page"` on the active link (also bold + accent underline, not color only). Hash changes move
  focus to the view `<h1>` (`tabindex="-1"`); the initial load and deep links do not move focus. Unknown hashes
  (e.g. `#/sessions`) are replaced with `#/ask` and announced politely. Document title follows the view. If `/api/workspace`
  returns `navigation`, entries not listed are hidden (Ask always stays); unknown IDs never create links.
- **Ask preserved (UX-07).** Existing IDs, events, examples, scope picker, conversations, citations, source pane,
  Ctrl/Cmd+Enter and Escape behavior unchanged. Ask stays mounted when switching views, so the conversation and open source
  pane survive navigation. Scope button and conversation toggle are hidden off Ask; Escape is ignored off Ask. The visible
  "Ask your codebase" heading became `h2` (styled identically) under a screen-reader-only `h1` "Ask" used as the focus target.
- **Persistent workspace indicator (UX-02).** Top bar shows "Sample workspace — bundled example repositories" or
  "Local workspace — local Git checkouts" from `workspace.mode`, else derived from `/api/repos` `every(demo)`; unknown mode
  shows "Workspace mode unknown" (the reserved `connected` value is never rendered as connected). Below 1240px the detail
  text is visually hidden but kept for screen readers.
- **Repositories view.** Read-only table from the real `/api/repos`: name, revision (7 chars, or "Sample" for demos), files,
  index status ("✓ Indexed" / "! Index limit reached: some files were not indexed"), source line and, when the workspace
  route exists, the GitHub not-available reason. No buttons.
- **Settings view (UX-08).** Read-only cards: Workspace, Answer model (with `--model NAME` hint when not configured; model,
  adapter and loopback destination when configured; "not checked yet" because `probed:false`), Provider profiles, GitHub,
  Implementation sessions (server-provided reasons), Storage (in-memory / persistent + schema / disabled / schema mismatch),
  Credentials (unavailable shown as a setup state, not a fault), Health (overall, per component, job counts,
  reconciliation and expired-lease warnings, recent failures showing only kind/code/time). One functional control:
  "Refresh status". No controls for absent features.
- **Status vocabulary.** Every state = icon + text (`✓ OK/Available/Configured`, `○ Not configured/Disabled`,
  `— Not available in this version`, `⊘ Unavailable`, `! Degraded`). Values outside each field's known set render
  `? Unknown` in the neutral tone, never success.
- **Fallback and failures.** `/api/workspace`/`/api/health` 404 with a legacy body (`error` and no `code`) → Settings shows
  only "Status unavailable in this build." Network failure, 5xx, non-JSON, a coded 404 or a wrong `contract` prefix →
  a distinct error ("Could not load workspace/health status. …") with "Choose Refresh status to try again."
  `/api/repos` failure → error on Ask (existing) and Repositories, indicator "Workspace unavailable".
  Status is fetched in parallel with `/api/repos` and never blocks Ask; refetched on entering Settings.
- **Live regions.** New announcements go through one polite `#app-status` (refresh results, unknown route). Error blocks
  are not live regions. Pre-existing regions (`composer-status`, `source-panel`, `repo-count`) are unchanged.
- **Brand.** Product headings/title say OpenDevin. Server-owned strings in `repoask/__main__.py` (e.g. the 403 bodies
  "…printed by Repo Ask") are outside this scope and unchanged.

Changed files (all within exclusive scope `repoask/web/`, `tests/ui/`, `docs/agents/runs/M0-EXPERIENCE/`):

- `repoask/web/index.html`, `repoask/web/app.js`, `repoask/web/styles.css`
- `tests/ui/dom.mjs` (minimal DOM stand-in, test-only), `tests/ui/app.test.mjs` (14 behavior tests)
- `docs/agents/runs/M0-EXPERIENCE/status.md`, `docs/agents/runs/M0-EXPERIENCE/handoff.md`

Fixtures are used only as test inputs in `tests/ui/`; the shipped UI contains no fixture data or hardcoded responses.
No new static asset file was added, because `ASSETS` in `__main__.py` (coordinator-owned) serves only three files.

## Verification evidence

| Requirement | Command or scenario actually run | Result / evidence |
| --- | --- | --- |
| Acceptance 6: JS syntax | `node --check repoask/web/app.js` (Node v20.19.5) | exit 0 |
| Acceptance 6: baseline Python | `python3 -m unittest discover -s tests` (Python 3.12.0 local; no Python changed) | `Ran 4 tests … OK` |
| Contract fixtures | `python3 -I docs/agents/runs/CONTRACT-01/check_fixtures.py` | `OK: 3 workspace, 4 health, 3 error fixtures consistent` |
| UX-02/03/07/08/10 behavior | `node --test tests/ui/` | 14 tests, 14 pass, 0 fail |
| Test sensitivity | Temporarily mutated app.js (no focus move; any 4xx treated as fallback; unknown enum → OK), ran `node --test tests/ui/`, then reverted | 4 tests failed under mutation (1, 3, 4, 9); 14/14 pass after revert |

What `tests/ui/app.test.mjs` exercises (real `index.html` + real `app.js`, fake `fetch` serving contract fixtures):
navigation by link activation with `aria-current`, single visible view, focus moved to each view `h1`, no focus theft on load
or deep link; `ui.legacy_fallback` (no invented values, not an error); network + 500 errors distinct from fallback, polite
failure announcement, refresh recovery with focus kept; coded 404 / wrong contract as errors; render expectations for
`workspace.demo_memory`, `workspace.local_with_model_persistent` + `health.persistent_ok`, `health.degraded_reconciliation`
(no repo names in Health), `health.no_platform`; unknown enums → Unknown; Repositories for demo and local data;
`/api/repos` failure; unknown hash; full Ask flow (example → focus, picker narrows scope → POST body repos, citation → exact
`/api/source` params, source survives navigation, Escape scoped to Ask and returns focus to citation, Ctrl+Enter submits);
ask 400 shown and question restored.

### Not run (honest limits)

- **No real browser run.** Launching headless Chrome was denied by this session's sandbox (non-interactive approval).
  The DOM stand-in does not model layout, CSS, actual Tab order, `:focus-visible`, `<dialog>` focus trapping, contrast or
  screen readers. Its event/focus model is simplified (e.g. synthetic `click()`), so it proves app logic, not rendering.
- **No live-server smoke.** A stdlib script to serve the new assets from the real legacy `RequestHandler` on an
  ephemeral loopback port was also denied. The legacy 404 body `{"error": "Page not found."}` was confirmed by reading
  `repoask/__main__.py` only. CSP compatibility was checked by inspection: no inline script/style/handlers added; `app.js`
  still a single same-origin module.
- **Contrast:** not machine-measured. Colors added: `#8bdabb`, `#f0c674`, `#ffb86b`, existing `--muted #a1a7bb`, on
  `#161820`/`#1d202a` surfaces; all are light-on-near-black and estimated well above 4.5:1, but unverified.
- Python 3.10 itself was not run (only 3.12 available); no Python file changed.

### Manual checklist for coordinator/reviewer (real browser, `python3 -m repoask`)

1. Tab from page start: history toggle (narrow only) → nav links Ask/Repositories/Settings → scope button → sidebar → composer. Visible focus ring on each.
2. Enter on Settings link: URL `#/settings`, heading focused, title "Settings · OpenDevin"; before M0-INTEGRATE it shows only "Status unavailable in this build."
3. After M0-INTEGRATE: Settings shows demo cards; stop the server and press Refresh status → distinct error and polite announcement, focus stays on the button.
4. Ask: example, ask, open citation, go to Repositories, browser Back → source pane and conversation still present; Escape closes source and returns focus to the citation.
5. Narrow widths (≤860px, ≤640px): nav wraps to a second row; sidebar/inspector overlays still sit below the top bar.
6. VoiceOver/NVDA: nav announced as "Workspace navigation", current page announced; status chips read as text (icons hidden).

## Risks and next action

- Known gaps, failing checks and unsupported behavior: real-browser, layout, contrast and screen-reader checks not run (above).
  `#/ask` focus target is a visually hidden `h1`, so its focus ring is invisible by design. The scope button's pre-load label
  "Repositories" matches the nav link label until repos load (then "N repositories"); it carries a distinguishing `title`.
  UX-03 conversation/plan URL persistence is out of M0 scope; only view hashes persist.
- Migrations/configuration needed (no secrets): none. M0-INTEGRATE wires `/api/workspace` and `/api/health`; no UI change
  needed for that. If the coordinator later serves additional static files, nothing here depends on it.
- Background processes still running, if any: none started. A non-executed helper script was left at
  `/tmp/od-m0-exp-smoke/smoke.py` (outside the repo; safe to delete). Probe dir `/tmp/od-m0-chrome-probe` was never created.
- Reviewer and requested review scope: quality-reviewer (Codex). Review `bd8c3af..9e95d16` against contract §7 and the
  fixtures' `ui.render_expectations`; please run the manual checklist in a real browser.
- Blocker owner and unblock action, if applicable: none blocking. The coordinator (or reviewer) needs to run the real-browser
  checks this sandbox denied.
