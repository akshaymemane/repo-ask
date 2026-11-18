# Builder handoff — LAUNCH-FRESHNESS

## Identity

- Author/harness: Codex, current runtime-builder session (no nested workers).
- Persona: `docs/agents/personas/runtime.md`.
- Branch/worktree: `task/launch-freshness`, `/Users/apple/workspace/vibe-coding/opendevin-launch-freshness`.
- Base SHA: `437ef2626cb8fe01815f494df48fb6cf9ac15e17`.
- Submitted commit SHA: none; sandbox denied creating the linked worktree's Git index lock, so staging and commit are unavailable. HEAD remains the base SHA. Changes are ready to stage; they are NOT staged.
- Task card: user's LAUNCH-FRESHNESS assignment; requirement F04 AC6 / ASK-08 and Launch handoff and freshness.
- Status: blocked on local commit, then exact-commit review by Claude.

## Outcome

Launch observes the planned write branch using the same GitHub service/client
`default_branch_sha` lookup as acquisition. A two-second caller deadline bounds
freshness observation. Equal HEAD proceeds; advanced HEAD returns `base_advanced`
409 without creating a session or job. A deliberate optional `acknowledged_base`
map permits the saved commit and is persisted in session instructions JSON.
Unobservable HEAD records status `unavailable`, retaining the exact plan/base.

Schema 13 adds only a launch-observation table so the first decision survives
restart and same-key replay. Unacknowledged repeats return the original 409 even
after an acknowledged launch; acknowledged success repeats return the same session.
A session retry inherits an existing acknowledgement. No plan revision is changed.

Both conversation and saved-plan Start controls render the shared focused inline
notice, retain the idempotency key for the explicit saved-base action, and use the
conversation plan-generation path for regeneration. Session detail displays
“Started on an older base (acknowledged)”. Existing worker freshness info remains.

Changed files (all inside exclusive scope):

- `repoask/sessions/service.py`
- `repoask/session_api.py`
- `repoask/platform/migrations.py` (append-only migration 13)
- `repoask/web/ask.js`, `plan-view.js`, `sessions.js`, `styles.css` (CSS append only)
- `tests/test_launch_freshness.py`, `tests/ui/launch-freshness.test.mjs`
- `tests/test_provider_claude_cli.py` (migration assertion follows current schema)
- `docs/contracts/m2-sessions.md`
- `docs/agents/runs/LAUNCH-FRESHNESS/{status,handoff}.md`

Contracts consumed: existing M2 sessions plus documented additive launch freshness
fields. No dependency installed, shared entrypoint changed or remote action taken.

## Verification evidence

| Requirement | Command or scenario actually run | Result / evidence |
| --- | --- | --- |
| F04 AC6 backend | `/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python -m unittest discover -s tests -p test_launch_freshness.py` | 6 tests passed; real SQLite/services with GitHub observation doubles. Covers equal, advanced refusal/no row or job, retained acknowledgement, unavailable/timeout, durable replay through a second service, API 409 shape and invalid acknowledgement. |
| F04 AC6 UI | `REPOASK_TEST_PYTHON=/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python node --test tests/ui/launch-freshness.test.mjs` | 6 tests passed: both actions from both Start paths, focus/no silent retry, safe text rendering, session acknowledgement label. DOM fixtures, no real browser or live GitHub pilot. |
| Regression UI | `REPOASK_TEST_PYTHON=/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python node --test tests/ui/*.test.mjs` | Final run: 292 tests, 290 passed, 2 failed. Both failures are existing `session-services.test.mjs` fixtures failing synthetic execution-profile bootstrap (`execution_test_failed`), before freshness launch. |
| Regression Python | `/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python -m unittest discover -s tests` | 620 tests in 487.584 seconds; 70 failures, 99 errors, 9 skips. Socket/process restrictions cause denied binds, denied `/bin/ps`, fixture startup failures, descriptor-leak assertions and timeouts. One failure was a schema-12 constant in the existing provider migration test; corrected afterward and verified by the focused migration run below. Full suite was not rerun after that test-only assertion correction. |
| Migration regression after correction | `PYTHONPATH=tests /Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python -m unittest test_provider_claude_cli.ClaudeCliMigrationTests test_launch_freshness` | 7 tests passed, including v11-to-current upgrade preserving provider profiles and all 6 freshness cases. |
| Sandbox boundary | Direct Python AF_UNIX socket bind in a temporary directory | `PermissionError: [Errno 1] Operation not permitted`; confirms Unix socket restriction affecting execution harness checks. |
| Patch hygiene | `git diff --check`; `node --check repoask/web/ask.js` | Passed. |
| Local Git write | `git add` for assigned code/tests/contract paths | Denied creating `/Users/apple/workspace/vibe-coding/repo-ask/.git/worktrees/opendevin-launch-freshness/index.lock`: Operation not permitted. No bypass attempted. |

## Risks and next action

- The observation's caller deadline is two seconds; its daemon read may finish
  later under the existing GitHub client's network timeouts. Late results never
  change the durable decision or session base. No new runtime dependency.
- A first unavailable observation remains unavailable for the same launch key;
  this is intentional deterministic retry behavior, not live freshness evidence.
- Regeneration uses the existing current-index planning path. It does not fetch
  or reindex a new commit itself; existing index freshness/readiness rules apply.
- Migration 13 must be applied by normal startup; coordinator must serialize its
  identifier if another launch task introduces a migration before integration.
- Full Python regression is not green; unrestricted rerun is required. The observed
  failure categories are consistent with sandbox boundaries, but this run does not
  prove all remaining failures are unrelated. Socket/process integration needs
  rerunning outside this sandbox. No
  live GitHub pilot, actual inference or container integration was performed.
- Background processes: both requested full test commands and focused checks exited.
  The Python suite process was verified absent by its owned PID using `lsof`.
  No application worker was intentionally left running; broader process enumeration
  is denied by this sandbox, so independent child-process inspection is limited.
- Reviewer: Claude; review exact committed snapshot, especially deterministic
  refusal/acknowledgement handling, migration and focused UI choice behavior.
- Blocker owner: coordinator. Stage and commit the ready patch in a writable Git
  context, then review that exact SHA. Suggested Conventional Commit message:

```text
feat(sessions): require explicit acknowledgement of advanced launch bases

Co-Authored-By: Codex <noreply@openai.com>
```

Not integrated, approved, pushed or published.
