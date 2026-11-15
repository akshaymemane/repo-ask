# UI-REDESIGN acceptance

Branch `task/ui-redesign` (worktree `opendevin-ui-redesign`), base `d3c0681`.
Spec: `docs/superpowers/specs/2026-11-15-ui-redesign-design.md`.
Plan: `docs/superpowers/plans/2026-11-15-ui-redesign.md`.
Executor: Claude, native, with the user's authorization, 2026-11-15.
Round-one review: `docs/agents/runs/UI-REDESIGN/review-r1.md` on the integration branch,
against `44b8b6d`.

## Round-one findings and what changed

| # | Finding | Disposition | Commit |
|---|---|---|---|
| 1 | Unsaved plan edits could launch the old version | Fixed. Every plan mutation goes through one dirty state. Start is disabled until the edits are saved or explicitly discarded, and it rechecks the pinned profile version and source consent before launch. Test: `any visible plan edit blocks Start until saved or explicitly discarded`. | `b84226d` |
| 2 | Queued repository switch saves could disagree with the server | Fixed. Each save sends a frozen snapshot of the intended state, and a failed earlier save resets the target only if it is still the latest intent. Race test added. | `b84226d` |
| 3 | A locked secret store spent the manifest callback state | Fixed. The state is checked, then storage, then the state is claimed once under the lock before the conversion code is spent. Tests: lock, unlock and retry; two concurrent callbacks. | `b84226d` |
| 4 | Only the first 100 repositories were read | Fixed. Repositories and first-run setup follow every cursor. Owner, language, fork and archive filters apply across all loaded pages. Test with 205 repositories. | `b84226d` |
| 5 | The redesign was materially incomplete | Plan editor: moved to the Ask side panel (`b84226d`). Sessions: now the three-pane page from plan Task 17 (`e881e02`). Repository detail: native controls replace the embedded legacy context panel (`d29e6eb`). Catalog filters and paging: see #4. The "Ruling:" references are removed; nothing here claims an approved scope change. What remains is listed under "Open for the reviewer". | see left |
| 6 | Removing a repository did not mark the plan stale | Fixed. Additions and removals both mark it stale, and Start stays disabled until the plan is regenerated. | `b84226d` |

## Automated checks (run on `010199a`)

| Check | Command | Result |
|---|---|---|
| All UI tests | `node --test tests/ui/*.test.mjs` | 176/178 pass. The 2 failures are the baseline `session-services.test.mjs` cases. They need `test_sessions_fixture` from the unmerged M2-SESSIONS backend (`ModuleNotFoundError`). |
| Python, touched areas | `.venv/bin/python -m unittest` over web_assets, workspace_mode, context_api, http_foundation, provider_discovery, providers_service, feature_api, github_manifest, github_service, github_client, application_services, repoask | 129 tests OK |
| Parse | `node --check repoask/web/*.js` | OK |
| Whitespace | `git diff --check` | OK |

The full `python -m unittest discover -s tests` run was not repeated. It has a known stall in the Ask shutdown tests (see the M2-SESSION-UI handoff).

## Real-browser checks

Earlier desktop pass (Chrome, scratch data dir): shell, Ask landing, + picker, first send, the "Which repository?" card, Repositories, Settings sections and the first-run checklist were all verified.

Round-one pass, on a scratch data dir at `127.0.0.1:8898`, with the DevTools viewport emulated:

| Check | Result |
|---|---|
| 390×844 (mobile emulation): no sideways page scroll on Ask, Repositories, Settings, Settings → Models, Settings → Privacy and Sessions | Pass after a fix (`010199a`). The Repositories table had pushed the layout viewport to 409px. It now scrolls inside its own box, with tighter cell padding under 480px. |
| Keyboard: Repositories row → Enter opens details with focus in the panel → Tab reaches "Reindex now" with a visible 2px focus ring → Escape closes the panel and returns focus to the row | Pass |
| Keyboard: composer → Tab to + → Enter opens the picker with focus in search → Shift+Tab stays trapped in the dialog → Escape closes it and returns focus to + | Pass |
| Keyboard: typing `@orders` → ArrowDown → Enter adds the `orders-db` chip, removes the token and keeps focus in the composer | Pass |

## Not run (needs the user or a dependency)

- **Live GitHub App Manifest flow.** It creates a GitHub App on the user's account, so it waits for the user's approval.
- **Sessions against a real backend.** M2-SESSIONS is not integrated (its round-two review requests changes). The three-pane page is covered by fixture tests only. In the browser, this build shows the honest "Sessions aren't available in this build" state.

## Open for the reviewer

- **Session question choices.** The session contract defines `pending_question` as `{id, prompt, redacted, created_at}`, with no offered choices. The card renders choice buttons only if the server sends `options`. Otherwise it offers "Reply…", which targets the composer at that question.
- **Session progress.** The backend reports no per-step completion. The Progress tab lists the saved plan's steps, states that, and points to activity and checks for confirmed progress. Activity groups show "Worked for N s · M steps in K files". Per-group `+A −D` is not derivable from events, so the diff totals appear in the Diff tab.
- **Legacy provider profiles.** The short "Add OpenAI-compatible provider" form and the role dropdowns are the primary Models UI. The old profile list remains under "All provider profiles (advanced)" for editing existing profiles. Removing it is a product decision, not a code gap.
- `repoask/web/context.js` is no longer used by the app. It is still served and still has its own tests. It can be deleted in a cleanup change.

## R2 handoff verification

Fresh verification on the complete candidate `7196ec0` (2026-11-15):

- `node --test tests/ui/*.test.mjs` — 176/178 passed. The only failures are the two
  `session-services.test.mjs` bridge cases whose Python dependency
  `tests/test_sessions_fixture.py` belongs to the not-yet-integrated M2 Sessions
  candidate. Both fail at import before exercising UI code.
- Focused Python boundary suite covering the manifest, static assets, workspace mode,
  context API, provider discovery/service, feature API, GitHub service/client,
  application composition and legacy app — 124/124 passed in 14.270s.
- The worktree contains no source changes beyond the committed R1 dispositions;
  untracked `.venv` is a local environment and is intentionally excluded.

This is builder evidence, not independent approval. The live GitHub Manifest flow and
real session-service browser acceptance remain gated exactly as documented above.
