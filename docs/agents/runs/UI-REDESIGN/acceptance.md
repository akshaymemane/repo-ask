# UI-REDESIGN acceptance

Branch `task/ui-redesign` (worktree `opendevin-ui-redesign`), base `d3c0681`.
Spec: `docs/superpowers/specs/2026-11-15-ui-redesign-design.md`.
Plan: `docs/superpowers/plans/2026-11-15-ui-redesign.md`.
Executor: Claude, native, with the user's authorization, 2026-11-15.

## Automated checks (run on the final commit)

| Check | Command | Result |
|---|---|---|
| All UI tests | `node --test tests/ui/*.test.mjs` | 157/159 pass. The 2 failures are the baseline `session-services.test.mjs` cases that need the unmerged M2-SESSIONS backend (`test_sessions_fixture`). |
| Python, touched areas | `.venv/bin/python -m unittest tests.<file>`: web_assets, workspace_mode, context_api, http_foundation, provider_discovery, providers_service, feature_api, github_manifest, github_service, github_client, application_services, repoask | All OK |
| Parse | `node --check repoask/web/*.js` | OK |
| Whitespace | `git diff --check d3c0681 HEAD` | OK |

The full `python -m unittest discover -s tests` run was not repeated. It has a known stall in the Ask shutdown tests (see the M2-SESSION-UI handoff).

## Real-browser checks (Chrome, `127.0.0.1:8897`, scratch data dir, desktop width)

| Flow | Result |
|---|---|
| Shell: rail, header, Settings pinned at the bottom, Recent between the nav and Settings | Verified |
| Ask landing: "What are we working on?", composer with + / Ask / Generate plan | Verified |
| + picker: search, groups, status badges, Add N | Verified |
| First send creates a titled conversation, navigates, sends; header pills show the repo and the model | Verified |
| Question with no repos → "Which repository?" card → choosing it scopes the conversation and sends ("Added notifications-worker") | Verified |
| Repositories: merged table, status badges, switches, keyword-only banner | Verified (demo data; this QA server had no GitHub connection) |
| Settings: section nav, Connect GitHub card, manual App form behind a disclosure | Verified |
| First-run checklist on the Ask landing page | Verified |

Screenshots are in the local Chrome screenshot directory, `screenshot-1794734550091-19.jpg` through `screenshot-1794735991682-28.jpg`. They were not committed.

## Not run (needs the user or a dependency)

- **Live GitHub App Manifest flow.** It creates a GitHub App on the user's account, so it waits for the user's approval. GitHub's docs neither allow nor forbid a loopback `redirect_url`; this live run settles it.
- **Keyboard-only pass and 390px width in a real browser.** Keyboard behavior is covered by unit tests (focus trap, Escape, arrow keys, focus restore) but was not walked through in a browser.
- **Session pages against a real session backend.** M2-SESSIONS isn't integrated.

## Known gaps (see the "Ruling:" lines in the ledger)

- Sessions page is restyled (two columns, honest unavailable state), not yet the tabbed three-pane design.
- The plan view stays a full page rather than the side panel.
- The legacy provider panel and per-repo context controls are reused inside the new sections rather than rebuilt.
- Repositories has no owner/fork/archived filters and loads the first 100 repositories.
