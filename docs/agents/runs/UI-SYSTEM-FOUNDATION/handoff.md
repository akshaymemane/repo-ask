# Builder handoff — UI-SYSTEM-FOUNDATION

## Identity

- Author/harness and session ID: Codex, `/root/build_ui_foundation`
- Persona, branch and worktree: experience; `task/ui-system-foundation`; `opendevin-ui-system-foundation`
- Base SHA and submitted commit SHA(s): `8c04dff` (the assignment commit supersedes the card's earlier `6a1cea8` base); submitted SHA below
- Task card and requirement IDs: `UI-SYSTEM-FOUNDATION`; F11
- Status: review

## Outcome

Unified the shell foundation without changing route modules. Sessions now owns a stable navigation slot whose pending state preserves layout and whose unavailable state collapses only after a definitive 404. The shell exposes the sole visible route title while the route H1 remains in the accessibility tree and focusable; session detail titles remain visible. Shared control, tone, sizing, radius and typography tokens replace competing button primitives and obvious shared hard-coded colors. Legacy button names remain compatibility aliases. Broad persistent-Ask selectors are limited to direct, unclassed fallback elements, and provably overridden session rules were removed.

Review round 1 corrections keep focused route H1s visually hidden so focus never duplicates the shell title, and retain each route's visible lede as useful guidance. Regression coverage checks focus, shell-title state and lede presence across navigation.

Changed files, all within assigned scope: `repoask/web/index.html`, `repoask/web/styles.css`, `repoask/web/shell.js`, `repoask/web/app.js`, `tests/ui/app.test.mjs`, `tests/ui/shell.test.mjs`, and this handoff. No API or data contract changed.

## Verification evidence

| Requirement | Command or scenario actually run | Result / evidence |
| --- | --- | --- |
| F11 shell/nav/title invariants | `REPOASK_TEST_PYTHON=/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python node --test tests/ui/shell.test.mjs` | 12/12 passed |
| F11 UI regression | `REPOASK_TEST_PYTHON=/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python node --test tests/ui/*.test.mjs` | 281/281 passed |
| Static asset serving | `/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python -m unittest tests.test_web_assets` | 2/2 passed |
| Patch hygiene | `git diff --check` | passed |

## Risks and next action

- Known gaps: no live-browser visual pass was run; route-level layout and interaction cleanup intentionally remains for the dependent UI cards.
- Migrations/configuration needed: none.
- Background processes still running: none.
- Reviewer: independent exact-commit reviewer should focus on stable Sessions capability semantics, route-title focus visibility, legacy compatibility aliases, and CSS cascade regressions.
- Next action: exact-commit review, then coordinator integration and dependent `UI-INTERACTION-CONSISTENCY` work.
