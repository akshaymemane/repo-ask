# Builder handoff — LAUNCH-SITE

## Identity

- Author/harness: Codex, current LAUNCH-SITE session (no external Claude session launched).
- Persona: experience builder; reviewer/integrator: Claude.
- Branch: `task/launch-site`; worktree: `.`.
- Base SHA: `b8a0ab423e7faa9531e8e9527f33c78c70e1c75a`.
- Submitted commit: none, per assignment. All changes are uncommitted for Claude to review and commit.
- Task card: user-provided LAUNCH-SITE brief; requirements 1–8. No separate board card was found.
- Status: ready for review, with browser verification outstanding.

## Outcome

Static landing page and 12 user-manual pages, one shared CSS file and no JavaScript or build step. The landing page includes the exact repository screenshot, source-first workflow, setup, privacy boundaries, limitations and roadmap. Documentation covers all requested subjects with consistent sidebar navigation and previous/next links. All local destinations name HTML files explicitly for file browsing and Pages subpaths.

Changed files (exclusive scope only):

- `site/index.html`, the twelve `site/docs/*.html` pages listed below.
- `site/assets/styles.css`, `site/assets/ask.png` (byte-identical to `docs/images/ask.png`).
- `.github/workflows/pages.yml`, `tests/test_site.py`.
- `docs/agents/runs/LAUNCH-SITE/status.md`, `handoff.md`, `contrast.json`.

Consumed current M1 indexing/Ask contracts and M2 session/publication contracts. No contracts changed. Repository implementation takes precedence over older proposed feature behavior: GitHub API snapshots rather than a claimed Git cache; host Claude CLI with brokered tools rather than a claim that the CLI runs inside Docker; network-disabled containers rather than configurable network access; one writable repository; M3 customization explicitly unbuilt.

Interpretation: “relative links only” applies to site navigation and resources. The explicitly requested GitHub links are HTTPS external navigation to the repository URL verified in README and pyproject. Every other href/src is relative. No external resources load. There is no external font, script, analytics, tracker, pricing, testimonial or benchmark claim.

The CSS uses the app’s page/surface/raised/text/muted/tint colors, radii (6/9/14px), and 11/13/15px small type scale, using system font fallbacks without loading font files. Light accent is slightly darkened from `#087d66` to `#087a63` so small active-navigation text passes 4.5:1 on the tinted background. Desktop grids collapse at 680px; documentation sidebar becomes a static two-column navigation list. Code blocks and tables scroll internally. Semantic landmarks, skip links, focus styles, active nav, balanced headings, alt text and reduced-motion rules are included.

## Verification evidence

| Requirement | Check actually run | Result |
| --- | --- | --- |
| 1, 2, 7 | `python3 -m unittest tests.test_site -v` | PASS: 3 tests, all 13 HTML pages; landmarks/metadata, link and fragment resolution, shared stylesheet, image alt text, external-resource and workstation-path checks. Last run 0.124s. |
| 3 | `python3 -m repoask --help`; inspection of CLI main, provider validation, storage, plan defaults, runtime and publication source | Ports, flags, in-memory default, persistence, role seeding, 60s/600s timeout distinction and manual-draft default verified. No provider or GitHub calls made. |
| 4 | WCAG relative-luminance calculation for main text, muted text, links, active-nav text and primary-button text in both themes | PASS, all checked pairs ≥4.5:1; see `contrast.json`. This is arithmetic checking, not a browser accessibility audit. |
| 2 | SHA-256 comparison of copied screenshot to repository image; visual inspection of existing screenshot | PASS; original dimensions 2880 × 1720 correctly declared. |
| 5 | Search of all site text files for product name | Thirteen HTML files listed below; no name-derived CSS classes, IDs or site filenames. |
| 6 | Manual workflow inspection | Dispatch or main pushes touching `site/**`; official actions checkout v4/configure-pages v5/upload-pages-artifact v3/deploy-pages v4; read contents plus deployment pages/id-token permissions; artifact path `site`; GitHub Pages environment and concurrency. No workflow dispatched. |
| Scope | `git diff --check`; `git status --short` | PASS whitespace check; only assigned paths added. |

Browser/render attempts actually made:

- Browser connector `new_page` was denied because it requires approval while this sandbox’s approval policy is never.
- Local installed Chrome headless, using a task-owned temporary profile and no sandbox bypass flags, exited 134 before rendering. No screenshot was produced.
- Therefore desktop/390px rendering, browser overflow checks, keyboard walkthrough, light/dark rendering and file/HTTP/Pages-subpath browser navigation are **not verified**. Static paths and CSS were checked, but are not claimed as equivalent evidence. These are the next checks for the coordinator in a browser-capable environment. No packages were installed and no permission bypass was attempted.

Full regression evidence:

- `python3 -m unittest discover -s tests` was attempted. It reported error/failure progress markers and resource warnings, then was interrupted with Ctrl-C (exit 130) while `tests/test_sessions_control.py:193` waited for agent startup. It did not complete; no final count or pass claim is available.
- `python3 -m unittest discover -s tests --failfast` then completed with **11 tests, 1 error** (0.508s). First failure: `test_ask_composition.AskCompositionTests.test_cli_model_seeds_missing_roles_without_inference_or_overwriting_saved_choices`, `tests/test_ask_composition.py:44`: loopback socket bind raises `PermissionError: [Errno 1] Operation not permitted`. This confirms at least one sandbox restriction in the broader suite; other errors/failures from the interrupted run were not diagnosed or claimed to have the same cause.
- Existing product tests were not modified. Coordinator should rerun the complete regression suite outside this restricted sandbox. No raw terminal captures with workstation paths are included in this handoff.

## Page provenance

These are repository-relative source paths used for copy; feature/PRD targets are not treated as shipped behavior when current contracts or code differ.

| Page | Sources |
| --- | --- |
| `site/index.html` | `README.md`, `SECURITY.md`, `CHANGELOG.md`, `Master PRD.md`, `docs/LAUNCH-CHECKLIST.md`, `repoask/__main__.py`, `repoask/ask/plans.py`, `repoask/execution/runner.py`, `repoask/execution/claude.py`, `repoask/web/styles.css` |
| `site/docs/index.html` | `README.md`, `SECURITY.md` |
| `site/docs/getting-started.html` | `README.md`, `CONTRIBUTING.md`, `repoask/__main__.py`, `repoask/index.py`, `pyproject.toml` |
| `site/docs/github.html` | `README.md`, `docs/contracts/m2-publication.md`, `repoask/__main__.py`, `repoask/github/service.py` |
| `site/docs/indexing.html` | `docs/contracts/m1-indexing.md`, `docs/features/02-repository-indexing.md`, `repoask/indexing/service.py`, `repoask/web/repositories.js` |
| `site/docs/asking.html` | `README.md`, `docs/contracts/m1-ask-plans.md`, `docs/contracts/m2-sessions.md`, `repoask/ask/plans.py` |
| `site/docs/sessions.html` | `README.md`, `SECURITY.md`, `docs/contracts/m2-sessions.md`, `repoask/execution/runner.py`, `repoask/execution/claude.py`, `repoask/sessions/service.py` |
| `site/docs/pull-requests.html` | `README.md`, `docs/contracts/m2-publication.md`, `repoask/publication/service.py` |
| `site/docs/models.html` | `README.md`, `repoask/__main__.py`, `repoask/providers/validation.py`, `repoask/providers/service.py`, `docs/features/07-providers-and-agents.md` |
| `site/docs/configuration.html` | `repoask/__main__.py`, `repoask/platform/db.py`, `docs/contracts/m2-sessions.md`, `CONTRIBUTING.md` |
| `site/docs/troubleshooting.html` | `README.md`, `repoask/__main__.py`, `repoask/providers/validation.py`, `docs/contracts/m2-sessions.md`, `docs/contracts/m2-publication.md` |
| `site/docs/security.html` | `SECURITY.md`, `README.md`, `repoask/__main__.py`, `repoask/execution/runner.py`, `repoask/execution/claude.py` |
| `site/docs/faq.html` | `README.md`, `SECURITY.md`, `Master PRD.md`, `docs/LAUNCH-CHECKLIST.md`, `docs/contracts/m2-sessions.md` |

The models page’s timeout claims were checked in `repoask/providers/validation.py` and CLI seeding in `repoask/__main__.py`. Pull-request manual default was checked in `repoask/ask/plans.py`; body defaults and publication exclusions were checked against the M2 publication contract and service. Storage filename and persistence were checked in `repoask/platform/db.py`. UI action names were cross-checked in README and current web modules, including repository indexing controls.

## Name occurrences / rename inventory

The exact product name occurs only in visible text and titles in these site text files:

- `site/docs/asking.html`
- `site/docs/configuration.html`
- `site/docs/faq.html`
- `site/docs/getting-started.html`
- `site/docs/github.html`
- `site/docs/index.html`
- `site/docs/indexing.html`
- `site/docs/models.html`
- `site/docs/pull-requests.html`
- `site/docs/security.html`
- `site/docs/sessions.html`
- `site/docs/troubleshooting.html`
- `site/index.html`

The copied `site/assets/ask.png` also visibly includes the product name as pixels; it must be refreshed if the product is renamed. It is the exact user-requested source image, not a new asset with invented branding. This handoff itself contains the name when describing the rename inventory. `status.md`, `contrast.json`, the workflow, test and stylesheet do not contain the exact product name. Existing lowercase technical identifiers (`opendevin`, branch prefix, database name) occur only as visible command/documentation content; they reflect implemented interfaces and must change only with the product rename itself.

## Risks and next action

- No unverified product claim intentionally included. README’s shipped behavior, current contracts and code ground the copy. Planned M3/M4 work is labeled planned.
- Rendering remains unverified due the environment limitations above; no responsive or keyboard test is reported as passed.
- No product runtime was changed. No migrations or package installs needed for the site.
- No site server or coding agent was launched. The broad test session is stopped (exit 130), and the fail-fast command has exited. OS process enumeration was denied by this sandbox, so a complete descendant-process inventory could not be verified.
- Publishing remains a maintainer/coordinator action. Pages settings must be configured for GitHub Actions when ready; this task did not publish, push, create a PR or commit. Adding this workflow to main does authorize future automatic deploys for matching site pushes, as requested.
- Claude should review the exact uncommitted diff, prepare the reviewable commit and run browser checks before integration/publication. This handoff does not claim approval or integration.
