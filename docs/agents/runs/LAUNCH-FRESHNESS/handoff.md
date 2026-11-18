# Builder handoff — LAUNCH-FRESHNESS

## Identity

- Author/harness: Codex, current runtime-builder session (no nested workers).
- Persona: `docs/agents/personas/runtime.md`.
- Branch/worktree: `task/launch-freshness`, `../opendevin-launch-freshness`.
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
| F04 AC6 backend | `./.venv/bin/python -m unittest discover -s tests -p test_launch_freshness.py` | 6 tests passed; real SQLite/services with GitHub observation doubles. Covers equal, advanced refusal/no row or job, retained acknowledgement, unavailable/timeout, durable replay through a second service, API 409 shape and invalid acknowledgement. |
| F04 AC6 UI | `REPOASK_TEST_PYTHON=./.venv/bin/python node --test tests/ui/launch-freshness.test.mjs` | 6 tests passed: both actions from both Start paths, focus/no silent retry, safe text rendering, session acknowledgement label. DOM fixtures, no real browser or live GitHub pilot. |
| Regression UI | `REPOASK_TEST_PYTHON=./.venv/bin/python node --test tests/ui/*.test.mjs` | Final run: 292 tests, 290 passed, 2 failed. Both failures are existing `session-services.test.mjs` fixtures failing synthetic execution-profile bootstrap (`execution_test_failed`), before freshness launch. |
| Regression Python | `./.venv/bin/python -m unittest discover -s tests` | 620 tests in 487.584 seconds; 70 failures, 99 errors, 9 skips. Socket/process restrictions cause denied binds, denied `/bin/ps`, fixture startup failures, descriptor-leak assertions and timeouts. One failure was a schema-12 constant in the existing provider migration test; corrected afterward and verified by the focused migration run below. Full suite was not rerun after that test-only assertion correction. |
| Migration regression after correction | `PYTHONPATH=tests ./.venv/bin/python -m unittest test_provider_claude_cli.ClaudeCliMigrationTests test_launch_freshness` | 7 tests passed, including v11-to-current upgrade preserving provider profiles and all 6 freshness cases. |
| Sandbox boundary | Direct Python AF_UNIX socket bind in a temporary directory | `PermissionError: [Errno 1] Operation not permitted`; confirms Unix socket restriction affecting execution harness checks. |
| Patch hygiene | `git diff --check`; `node --check repoask/web/ask.js` | Passed. |
| Local Git write | `git add` for assigned code/tests/contract paths | Denied creating `./.git/worktrees/opendevin-launch-freshness/index.lock`: Operation not permitted. No bypass attempted. |

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

## Round 1 response

- Responds to Claude's `review-claude-r1.md`, CHANGES_REQUESTED on `28b08f5`.
  Revision starting HEAD: `d96ad19`; same `task/launch-freshness` worktree and runtime
  builder. No nested agents, new migration, dependency installation or remote action.
- Major finding: retry accepts optional `acknowledged_base`, validates its type and
  pinned revision, persists it on the linked successor, and reuses migration 13's
  durable observation. Omission still inherits predecessor acknowledgement; explicit
  empty maps remain unacknowledged. A refusal creates no successor or job. Same-key
  unacknowledged replay preserves the original refusal even after acknowledged
  success; identical acknowledged replay returns the successor after service restart.
- Retry API returns launch's exact `base_advanced` 409 shape. Sessions preserves
  error details and reuses `renderBaseAdvanced` with “Retry on the saved base” and
  “Open plan”; the choice retains its key and survives polling without auto retry.
- Minor finding: append-only CSS overrides use `var(--warning)`, tinted `color-mix`,
  `var(--radius)` and the existing accent focus-visible ring. Shared notice actions
  receive `.btn`; wrapping text and block margins accommodate narrow layouts.
- Changed files: `repoask/sessions/service.py`, `repoask/session_api.py`,
  `repoask/web/{sessions.js,plan-view.js,styles.css}`, `tests/test_launch_freshness.py`,
  `tests/ui/launch-freshness.test.mjs`, `docs/contracts/m2-sessions.md`, and this run's
  handoff/status. All within assigned scope. Requirement: F04 AC6 / ASK-08 recovery
  and pinned-base handoff; both round 1 findings addressed, pending exact-SHA review.

### Round 1 verification

- Focused Python: `./.venv/bin/python -m unittest discover -s tests -p test_launch_freshness.py`
  — 8 tests passed. Covers refusal/no successor or job, invalid acknowledgement,
  saved observation after service restart, acknowledged successor/pinned base,
  acknowledged and unacknowledged replay, retry API 409 payload and 202 replay.
- Full UI: `REPOASK_TEST_PYTHON=./.venv/bin/python node --test tests/ui/*.test.mjs`
  — 294 tests, 292 passed, 2 failed. Both `session-services.test.mjs` bridge fixtures
  fail at synthetic execution-profile bootstrap (`execution_test_failed`), before
  freshness behavior. All 8 freshness UI tests pass, covering both initial Start
  paths, safe rendering, persisted acknowledgement, retry refusal/no silent retry,
  both explicit retry-notice actions, same key/map and preservation through refresh.
- `node --check repoask/web/sessions.js`, `node --check repoask/web/plan-view.js`,
  and `git diff --check` passed.
- Direct AF_UNIX bind in a temporary directory: `PermissionError: [Errno 1]
  Operation not permitted`. No permission bypass attempted.
- Staging attempt denied creating the linked worktree's Git `index.lock` under
  `./.git/worktrees/`; changes remain unstaged.
- Known gaps: no real browser/390px visual measurement, live GitHub, inference or
  container pilot. Responsive spacing is a CSS change and DOM behavior is tested;
  it is not presented as rendered-browser evidence. Independent Claude re-review
  and unrestricted regression checks remain coordinator-owned next steps.
- Follow-up markup check: the ended-session wrapper is a `div` so it can contain
  the notice section; the notice takes a full flex row, with min-width zero.
  Full UI rerun after this adjustment: same 294 / 292 pass / 2 fixture failures.
- Requested commit attempted with title `fix(sessions): acknowledge advanced bases when retrying`
  and final trailer `Co-Authored-By: Codex <noreply@openai.com>`; Git reported no
  changes staged following the index-lock denial. No new commit was created.
- Full Python (completed): `REPOASK_TEST_PYTHON=./.venv/bin/python ./.venv/bin/python -m unittest discover -s tests`
  — 622 tests in 408.505s; 69 failures, 99 errors, 9 skipped. No freshness test
  failures. The log contains socket/process permission denials, fixture-startup
  failures, resource warnings and runner timeout/assertion fallout, consistent with
  the known sandbox restriction; a green unrestricted suite is not established.
  Compared with the prior handoff's 620-test run, the two new backend tests pass and
  the prior schema-constant failure is absent. Full suites and focused processes
  exited; no application worker was intentionally started. Sandbox limits prevent
  claiming unrestricted process-tree inspection or containment verification.
- Round 1 submission: no new commit; changes remain unstaged on `d96ad19` due to
  staging denial. Coordinator should commit in a writable Git context, run the
  unrestricted suites and request Claude review of that exact commit.
