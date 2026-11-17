# LAUNCH-READINESS handoff

- Branch: `task/launch-readiness`, base `437ef26`. Author: Claude (experience/coordinator for the launch wave).
- Scope: open-source release files, public README, Ask pending-route recovery, route-bar overflow.

## Delivered

- `40d84de` CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, THIRD_PARTY_NOTICES, CHANGELOG, `.github` CI (Python 3.10/3.12/3.13
  on Ubuntu and macOS, UI tests, package build + wheel smoke), issue/PR templates, Dependabot, pyproject metadata,
  public README, relative paths in `docs/agents` records.
- `d3902bd` Conversation.get `pending_route`; UI restores a question waiting for a repository choice after reload or
  restart, keeps its intent, shows matched evidence on each choice; routing reasons drop filler words; the focus-only
  Ask heading appears only on keyboard focus.
- Round-1 response (this commit):
  1. Isolation wording corrected everywhere: the Claude Code CLI runs on the host with its own tools, hooks, plugins,
     settings and memory disabled, acting only through brokered tools into the network-less container
     (`repoask/execution/claude.py:436-446`, `repoask/execution/broker.py:1-11`, `repoask/execution/runner.py:715-721`).
  2. Choosing repositories durably marks open routing decisions resolved (`update_scope`), so clearing the scope later
     never resurrects the question. Regression covers add → clear, abandoned prompt → choose → clear, and a fresh
     question afterwards. No migration (avoids colliding with LAUNCH-FRESHNESS).
  3. `docs/images/ask.png` committed (real llama3.1:8b answer with citations, source panel open).
  4. README model roles: chat roles vs embedding-capable providers; Claude CLI is chat only
     (`repoask/providers/service.py:230-237`).
  - Also: route bar stays one row with the source/side panel open (pills truncate, workspace detail and mode label
    hide when narrow); `tests/ui/services.test.mjs` honours `REPOASK_TEST_PYTHON`; CHANGELOG "Fixed" entries;
    README step 4 reflects automatic profile selection when exactly one tested profile exists.

## Checks run (author machine, outside any sandbox)

- `python -m unittest discover -s tests` — 615 tests OK (9 skipped, opt-in Docker).
- `node --test tests/ui/*.test.mjs` — 288/288.
- `git diff --check` clean. Python 3.10 grammar parse of all tracked `.py` files — clean.
- Real browser (headless Chromium) against a persistent instance with Ollama llama3.1:8b: cited answer, citation
  opens source pane; pending choice restored after server restart and page reload at 1440 and 390 px; route bar
  measured single-row at 1440/1100/390 with the source panel open.
- Wheel build + clean-venv install of the wheel serves `/`, `/styles.css`, `/api/workspace`; foreign Host and
  cross-origin POST return 403.

## Known gaps / for the maintainer

- CI has not run on GitHub yet (needs a push); Python 3.11 is not in the matrix.
- SECURITY reporting channel (GitHub private vulnerability reporting) must be enabled in repository settings.
- Product name: the PRD records that "OpenDevin" collides with the earlier OpenDevin project (now OpenHands); public
  naming review is required before announcing.
