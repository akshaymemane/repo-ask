# UI-MODERNIZATION handoff

## Assignment

- Branch: `task/ui-modernization`
- Base: `2481314` (board commit on integration; code base `880a681`)
- Persona/harness: experience / Codex
- Contract: `docs/agents/runs/UI-MODERNIZATION/design-contract.md`

## Delivered

- Reframed the workspace as a calm technical command center using graphite surface layers, a restrained mint active/status accent, inset highlights, and compact hierarchy.
- Added dark/light palette parity, font smoothing, balanced/pretty wrapping, tabular live metrics, and selection styling.
- Modernized rail navigation, active-route treatment, sticky route bar, workspace/status indicators, shared controls, Ask intro/examples/messages/composers, side panels, dialogs, tables, filters, Settings surfaces, and Session states.
- Added explicit hover/press transitions without `transition: all`, plus reduced-motion behavior.
- Added compact navigation, 44 px shared control targets, truncated toolbar metadata, and a width constraint for the legacy persistent Ask grid item.
- Updated the text mark to `OD`; no external font, icon, image, or runtime dependency was added.

## Behavioral boundaries

- No JavaScript, API, routing, execution, publication, permission, or state-copy behavior changed.
- Existing semantic colors, labels, focus rings, keyboard behavior, source citations, and legacy/demo fallback DOM remain intact.

## Checks run

- `REPOASK_TEST_PYTHON=/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python node --test tests/ui/*.test.mjs` — 285/285 passed.
- `/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python -m unittest tests.test_web_assets` — 2/2 passed.
- `git diff --check` — passed.
- Coordinator browser preflight: desktop coherent; compact overflow isolated to `.persistent-ask` and corrected. Final two-viewport artifacts and evidence checker remain an integration/review prerequisite.

## Review focus

- Confirm the legacy Ask hover no longer inherits the old lavender color and all accent use is token-derived.
- Confirm 390/500 px compact layouts have no horizontal overflow after the `.persistent-ask` constraint.
- Confirm sticky rail + route bar do not occlude focused content on compact viewports.
- Confirm light mode contrast and reduced-motion behavior.
- Confirm no CSS change obscures error, permission, partial-data, or execution-state messaging.

## Harness note

Claude CLI was invoked for the requested cross-harness design critique but returned its weekly-limit message before inference. The result is therefore Codex-authored and requires independent review; it must not be reported as Claude-authored or Claude-approved.

## Claude follow-up

- Claude performed the planned cross-harness critique after review-r2 (`review-claude.md`).
- Fixed: ≤760px `.inspector.has-source` and `.session-tabs` now offset to 118px below the sticky rail + route bar; ≤1000px `.session-pane` uses `overflow: clip` so Session tabs pin instead of overlapping the first section; primary hover mixes toward `--text` instead of white.
- Verified in headless Chromium at 390x844 and 900x844; measurements and before/after artifacts are in `review-claude.md` and `evidence/`.
- Required before integration: independent re-review of the Claude fix commits.

## Claude route polish pass (ECC frontend-design-direction + make-interfaces-feel-better)

Audited Ask, Sessions list/detail, Plan, Repositories and Settings (GitHub/Models/Coding agent) at 390x844 and
1440x900 in headless Chromium (dark). CSS-only changes:

- Repositories "More filters" had no styles (browser-default selects/inputs, run-on labels). Now a token-styled
  disclosure with a labelled inline control row; inline layout because Chrome wraps `<details>` content in
  `::details-content`, so grid/flex on the details element cannot reach the controls.
- Filter chips no longer wrap mid-label; they wrap as whole chips at compact widths.
- Settings section tabs no longer break "Coding agent"/"System health" over two lines at 390px; 44px targets;
  active tab gets the same mint edge language as the rail (left edge desktop, underline compact).
- Switches keep the 34x20 track but get a 44x44 hit area through `::before`.
- Sessions date popover anchors right so it no longer extends past a 390px viewport.
- Models role fields go full width at compact widths (previously 8px past the viewport).
- Compact inputs/selects/summaries in Repositories, Sessions and Settings get 44px minimum heights.

Evidence: `evidence/repo-filters-{1440x900,390x844}.png`. All routes report `scrollWidth === clientWidth` at 390px.
Not covered: light-mode route sweep; loading/error/success states beyond what the fixtures render.

## Claude response to review-r3

1. **Switch target overlap (major) — fixed and rendered.** At ≤760px `.switch` reserves `margin-block: 12px`, so the
   44px target is real layout space. Hit test at 390x844 with an "Allow changes" switch cloned into every cell
   adjacent to a "Use in Ask" switch (the sample workspace has none): `2ac7089` CSS → 55 of 1848 probes inside a
   switch's target landed on a different switch; now 0. 1440x900: 0 before and after.
2. **Light-mode shadows (minor, inherited) — fixed.** New `--shadow-hover`, `--shadow-float`, `--shadow-panel`
   tokens with light variants replace the hard-coded alphas on button hover, composers (incl. `:focus-within`),
   `.side-panel` and the Sessions date popover. Rendered light Ask: composer computes to `#15202b1f 0 12px 32px`
   (`evidence/ask-light-1440x900.png`). The `#0001` card shadow is left as-is (7%).
3. **Light-mode text (minor, inherited) — partly fixed.** `.session-facts dt` now uses `var(--muted)`. The
   `.brand-mark`/`.intro-icon` accent-on-tint pair (≈4.45:1) is logo text and left unchanged.
4. **Extra, found during the light pass:** there was no base link colour, so unclassed links (Ask "Choose…",
   "Choose a model in Settings") rendered browser blue/purple. Added `:where(a) { color: var(--accent) }` (zero
   specificity). Rendered check: every visible link on Ask/Sessions/Repositories/Settings computes to a token colour
   (`--text`, `--muted` or `--accent`) in both schemes.

Checks: UI 286/286 (the two `session-services` failures in review-r3 come from the reviewer sandbox failing the
synthetic execution bootstrap; they pass here), web assets 2/2, `git diff --check` clean.
