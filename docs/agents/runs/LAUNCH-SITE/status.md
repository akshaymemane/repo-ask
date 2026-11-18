# LAUNCH-SITE status

- State: review — Claude r1 approved commit `98bb310` with one LOW; favicon fix and requested disk-limit copy are now ready for review as uncommitted changes.
- Author: Codex, experience builder; reviewer/integrator: Claude.
- Branch: `task/launch-site`; worktree: `.`.
- Base: `b8a0ab423e7faa9531e8e9527f33c78c70e1c75a`.
- Assignment: user-provided LAUNCH-SITE brief, requirements 1–8.
- Original exclusive scope: `site/**`, `.github/workflows/pages.yml`, `tests/test_site.py`, this run directory.
- Delivered: landing page, 12 manual pages, shared CSS, copied screenshot, Pages workflow, stdlib tests, provenance and rename inventory.
- Checks: focused site suite passes (3 tests). Contrast calculations pass. Full regression interrupted after errors/failures; fail-fast reproduces denied loopback socket bind (11 tests, 1 error).
- Rendering: Claude r1 subsequently verified all 13 pages at desktop and 390px, light/dark, with keyboard and overflow checks; see `review-claude-r1.md`. This follow-up did not rerun browser checks.
- Handoff: `docs/agents/runs/LAUNCH-SITE/handoff.md`.
- No commits, publication or remote writes made; changes remain uncommitted for coordinator review.

## Review follow-up (2026-11-18)

- Current scope: `site/**`, `tests/test_site.py`, `docs/agents/runs/LAUNCH-SITE/**`.
- Added a local SVG slash-mark favicon and relative icon links on all 13 pages; extended the per-page test to require the shared SVG.
- Added disk-limit troubleshooting and a short indexing note: 4 GiB live-page cap, 1 GB free-space floor, Delete local index to free headroom, then Resume.
- Content dependency: `task/launch-perf-100k` is not integrated; inspected its indexing safety/vector logic and Repositories recovery text. Coordinate landing this copy with that branch.
- Checks run: `python3 -m unittest tests.test_site -v` — PASS, 3 tests (0.092s); `git diff --check` — PASS.
- Follow-up base: `9b70f2a`; no follow-up commit, publication or remote write. Changes remain uncommitted as requested.
