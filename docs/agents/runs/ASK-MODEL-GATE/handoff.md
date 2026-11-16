# Ask model gate handoff

- Author and role: Claude, experience
- Branch: `task/ask-model-gate`
- Base: `59fc5c0` (integration)
- Origin: the one behavior from `task/devin-inspired-ask-ux` (`4e6b8f0`) that the integrated
  redesign lacks. That branch is otherwise superseded (it reworks the pre-redesign Ask page and
  conflicts in `ask.js` and two UI tests) and is not merged; the user agreed to port only this.
- Status: ready for review

## Behavior

An unassigned `ask` or `planning` role used to fail only after sending
("no model is set for answering questions"). Now the composer disables **Ask** and/or
**Generate plan** up front, links them to a notice via `aria-describedby`, and shows
"No model is set for … Choose a model in Settings" (`#/settings/models`). Enter does not
send an unavailable intent. Only the `unassigned` status gates; other statuses keep the
existing server-side errors.

- `composer.js`: `setUnavailable(intents, {message, link})`; `setBusy` no longer re-enables
  an unavailable action.
- `ask.js`: `gateModels` maps `answer→ask`, `plan→planning`. Conversations reuse the existing
  model-roles read. The landing page gates from the setup card's role reads, so "Use these"
  re-enables Ask without a reload, with its own read as fallback when setup is unavailable.
- `setup.js`: `onRoles(roles)` callback on every render.

## Verification

- UI suite 192/192 (`node --test tests/ui/`); Python `tests.test_web_assets` OK.
- New tests fail without the change (ask-chat gate test fails on the base `ask.js`).
- Chromium against a fresh throwaway store on port 8799: landing showed Ask and Generate plan
  disabled with the notice; "Use these" assigned Ollama models and both re-enabled with the
  notice gone, no reload. The user's 8765 instance was not touched.
