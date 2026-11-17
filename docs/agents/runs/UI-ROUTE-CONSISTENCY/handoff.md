# Builder handoff — UI-ROUTE-CONSISTENCY

## Identity

- Author/harness and session ID: Codex experience builder, `/root/build_ui_routes`
- Persona, branch and worktree: experience; `task/ui-route-consistency`; `opendevin-ui-route-consistency`
- Base SHA: `4b02d6e` (board-only commit `7042582` is also present)
- Task card and requirement IDs: UI-ROUTE-CONSISTENCY; F04, F05, F11
- Status: review

## Outcome

- Repositories now uses task-language filters, a named catalog region, mobile stacked rows with visible data labels, quieter load copy, and a direct GitHub Settings empty-state link.
- The Ask conversation retains its semantic/focus heading without repeating the shell title visually. The plan editor calls its disclosure “Plan metadata,” distinguishing it from the read-only document's “Version details.”
- The Sessions detail pane starts at its actual tablist instead of repeating a decorative Workspace banner.
- GitHub callback status is scoped to the GitHub Settings section and cannot leak into Privacy, Models, Agent, or Health.
- Legacy Ask and Settings fallback loaders are unchanged. Plan launch safety, session mutation behavior, and API contracts are unchanged.

Changed files: `repoask/web/{ask,repositories,sessions,settings}.js`, `repoask/web/styles.css`, and focused UI tests.

## Verification evidence

| Requirement | Command or scenario actually run | Result / evidence |
| --- | --- | --- |
| Route-focused behavior | `node --test tests/ui/repositories.test.mjs tests/ui/settings.test.mjs tests/ui/session.test.mjs tests/ui/ask.test.mjs` | 57/57 passed |
| Full UI regression | `REPOASK_TEST_PYTHON=./.venv/bin/python node --test tests/ui/*.test.mjs` | 284/284 passed |
| Asset registration | `./.venv/bin/python -m unittest tests.test_web_assets` | 2/2 passed |

## Risks and next action

- Responsive table presentation is covered structurally; a reviewer should inspect the CSS breakpoint and data-label mapping in a real browser.
- The global shell “Refresh status” remains unchanged because removing it safely requires a separate app-shell behavior slice; legacy status retry behavior still depends on it.
- No migrations, configuration changes, background processes, or live-app changes.
- Independent reviewer should verify hierarchy, fallback preservation, mobile table accessibility, and that Ask/plan/session safety logic is untouched.
