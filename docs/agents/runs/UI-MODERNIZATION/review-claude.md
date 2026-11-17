# UI-MODERNIZATION review — Claude cross-harness pass

Verdict: **FIXES APPLIED — needs independent re-review of the fix commit**

- Reviewed commit: `968f8f5` (code at `616e6c5`, Codex-approved in review-r2)
- Reviewer: Claude (Opus 5.5), the planned `codex+claude` critique that was unavailable during authoring
- Applied at the user's request while the Codex author/reviewer was out of tokens

## Findings

1. **Major — compact sticky rail occludes the source inspector header and Session tabs.**
   `repoask/web/styles.css` (≤1000px rules) set `.inspector.has-source { inset: var(--top-height) 0 0 auto; z-index: 3 }`
   and `.session-tabs { top: var(--top-height) }`. Before this task the compact rail was static, so 56px cleared the
   route bar. The new ≤760px rail is sticky at `[0,62]` (z 8) and the route bar at `[62,118]` (z 5), so the fixed
   inspector's 52px header — including the **Close source** button — sits entirely under both bars, and sticky Session
   tabs pin behind the route bar. Fixed by offsetting both to `118px` inside the ≤760px block.

2. **Minor — light-mode primary hover drops below AA.**
   `color-mix(var(--accent) 88%, white)` turns `#087d66` into ≈`#268c78`; white `--accent-ink` on it is ≈4.1:1.
   Mixing toward `var(--text)` instead lightens in dark mode (unchanged look) and darkens in light mode (≈#09715e, >5:1).

## Advisory (not changed)

- Composer/side-panel shadows use hard-coded dark alpha (`#0006`, `#0005`); heavy in light mode. Could use `--shadow-*` tokens.
- Dark `--success` now equals `--accent`; success remains textually labelled, so not a contrast/semantics failure.
- The `118px` offset repeats the rail+route-bar sum in three places; a compact-height token would prevent drift.

## Checks run

- Full UI: 285/285 passed (new assertions for both fixes in `tests/ui/shell.test.mjs`).
- Web assets: 2/2 passed. `git diff --check` passed.
- Not run: rendered browser re-capture at 390/500px with a source open or on a Session detail route.
