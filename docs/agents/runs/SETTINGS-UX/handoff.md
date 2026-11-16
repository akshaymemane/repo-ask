# Settings models redesign handoff

- Author and role: Claude, experience
- Branch: `task/settings-ux`
- Base: `29209a3` (integration)
- Submitted commits: `1f29044` (redesign), `bb4a87a` (review fixes)
- Origin: the user asked for a UI/UX review and fix of the whole Settings page, with screenshots
  of the Models section, the add-provider dialog, the advanced profiles, roles and profile form.

## Behavior

- Models top: one "Model providers" card with Ollama, Claude subscription and OpenAI-compatible
  server rows, each with a status pill and one action. Job pickers share one width.
- Add-provider dialog: limits fold under a small "Timeouts and token limits" disclosure, in a
  three-column grid.
- Advanced: a compact profile list (name, version, adapter · model · host, capabilities ·
  credential · source sharing) with Edit, Test and Delete; accessible names include the profile.
  Delete confirms inline.
- Removed from advanced: the four per-role save forms (duplicated the job pickers) and the
  local-only form (duplicated Settings → Privacy).
- Profile form grouped into Capabilities, Limits, optional Pricing and Repository source;
  readable capability names; Embedding dimensions shown and enabled only with Embeddings; URL hint
  follows the adapter.
- The job pickers and the profile list refresh each other after a change; only the newest Models
  load renders. A saved Privacy change refreshes the Coding agent view.
- Older connected forms inside Settings (coding agent, existing GitHub App) restyled to the page's
  type scale; local-only copy in the coding agent points to Settings → Privacy.

No API, contract or schema changes.

## Verification

| Scenario | Command or check | Result |
| --- | --- | --- |
| UI suite | `node --test tests/ui/*.test.mjs` | 205 pass, 0 fail |
| Python suite | `.venv/bin/python -m unittest discover -s tests` | 523 OK, 9 skipped (on `1f29044`) |
| Race test fails without fix | Ran against `1f29044` `settings-models.js` | Fails as expected |
| Chrome, desktop | Models, advanced, dialog, Coding agent | Checked visually |

## Risks and next action

- Not verified: phone width (window could not be resized; the app refuses framing) and light theme.
- Coding agent copy is still long; rewriting it is a separate content task.
