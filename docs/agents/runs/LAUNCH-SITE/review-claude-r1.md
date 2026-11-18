# LAUNCH-SITE review r1 (Claude)

- Reviewed commit: `98bb310` on `task/launch-site` (Codex-authored, coordinator-committed).
- Verdict: **approved with one LOW**.

## Checks run

- Browser render (Chrome via Playwright, served by `python3 -m http.server` from `site/`): all 13 pages at
  390×844 and 1440×900, light and dark. No page-level horizontal overflow and no element wider than the
  viewport outside `pre`/tables. Screenshots of the landing and sessions pages inspected.
- Keyboard: first Tab focuses "Skip to content" → `#main`; `aria-current` marks the active docs page.
- Claims spot-checked against code: UI labels (Keep everything on this computer, Pull request author, Allow
  sending repository source, Test execution profile, Stop session, Retry as a new attempt, Delete session
  content, Delete local index, Use in Ask, Generate plan) exist in `repoask/web/`; CLI flags `--repo`,
  `--model`, `--data-dir`, `--port 8765`, `--ollama-port` match `repoask/__main__.py`. Isolation wording
  matches README (agent on host, brokered tools into a `--network none` container).
- `python3 -m unittest tests.test_site`: pass.

## Findings

- LOW: no favicon, so every page load logs a 404 for `/favicon.ico`. Add a small local icon and
  `<link rel="icon">` on each page.

## Round 2 (076bb58)

- LOW resolved: `site/assets/favicon.svg` linked from all 13 pages; `tests/test_site.py` requires it; tests pass.
- New disk-limit copy in indexing and troubleshooting matches `task/launch-perf-100k` behavior
  (4 GiB live-page cap, 1 GiB free-space reserve, Delete local index then Resume).
- Verdict: **approved**. Integrate after LAUNCH-PERF-100K so the docs never describe unshipped behavior.
