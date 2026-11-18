# Independent review — M2-FOLLOWUPS-AGENT-MODEL

## Verdict

Approve exact commit on code inspection, with one minor test-coverage finding. Integration validation remains pending: the requested suites were run, but broker-dependent checks cannot pass in this sandbox. This is not a claim of successful real Claude Code execution or authorization to publish/merge.

## Reviewed commit

- Reviewer: Codex, independent quality/security reviewer; author identified by assignment as Claude.
- Branch: `task/agent-model`; reviewed HEAD: `5780a2ee1b33501d6766d3efd2eca67f78a58fe6`.
- Base: `b5057f2`; scope: `git diff b5057f2..HEAD`, read from local Git objects/worktree. No separate packet manifest was supplied.
- Read: `AGENTS.md`, `Master PRD.md`, `docs/agents/WORKFLOW.md`, quality/security personas, F07 spec, `docs/contracts/m2-sessions.md`, review template. The user message supplied the review assignment; no task-specific card/handoff was present in the run directory or matching board entry.
- Requirements: F07 AI-08/AI-10 and acceptance 7; additive execution-profile model contract; session retry and finished-session retention contracts.

## Findings

| Severity | File:line | Evidence and fix |
| --- | --- | --- |
| Minor | `tests/test_execution_profiles.py:332` | `test_agent_model_is_optional_validated_and_reaches_the_profile_test` checks storage and rejection only; it never requests/runs a profile test or asserts the adapter's model argument. Add a synthetic profile-test assertion that its adapter receives the chosen model and receives `None` for a legacy version lacking the key. Owner: author. Current production forwarding is present at `repoask/execution/profiles.py:617`; this is a regression-coverage gap, not an observed forwarding defect. |

## Boundary and behavior coverage

- **Argv safety:** both profile and adapter validators use full matching, require an ASCII alphanumeric first character, and bound length to 80. Leading `-`, `--model=opus`, embedded `=`, whitespace, newlines, slashes and oversized values are rejected. `repoask/execution/claude.py:451` appends `["--model", model]` to an argv list. No shell interpolation or argument splitting is involved. Accepted punctuation cannot create another option element; rejecting a leading hyphen addresses parsers that interpret an option-looking value as a flag. No injection defect found. This review did not exercise the installed Claude parser; the added argv test uses a synthetic executable. An unknown but syntactically valid model can still be rejected by Claude; the regex is a syntax boundary, not a model catalog.
- **Immutability:** `ExecutionProfileService.update` inserts a new version at `repoask/execution/profiles.py:260`; old config is untouched. Check inheritance compares config JSON, so changing the model cannot inherit a previous model's passing check. Launch serializes the resolved config model into `profile_snapshot_json`; the worker reads that snapshot via `snap.get('agent_model')`. Retry copies the predecessor's snapshot at `repoask/sessions/service.py:573`, rechecking pinned-version readiness without adopting the active model.
- **API:** `repoask/session_api.py:7` includes `agent_model` in the shared POST/PATCH allowlist. Service validation still rejects unknown configuration keys and invalid model types.
- **Legacy data:** old config JSON requires no migration: profile testing, snapshot construction, adapter invocation and public session projection use `.get`. Updating an old profile normalizes the missing key to `None`. Omitted model leaves `--model` absent, preserving the CLI default.
- **Purge:** `repoask/sessions/service.py:1043` replaces the entire `profile_snapshot_json` with `{}`, clearing `agent_model` along with other frozen execution context. It does not retain a separate model field in the session row.
- **UI:** `repoask/web/sessions.js:1373` preloads `config.agent_model || ''`; the submit body at line 1391 sends trimmed text or `null` for both create and edit. Older profiles render blank. The UI integration test adds a create/persistence assertion; edit preload was inspected in code, not independently exercised in a browser.

## Checks actually run

All Python invocations used `../repo-ask/.venv/bin/python` and `PYTHONDONTWRITEBYTECODE=1`. Each suite used `-m unittest discover -s tests -p <filename>`.

| Check | Result |
| --- | --- |
| `test_execution_profiles.py` | 40 tests; 20 failures, 7 errors. Socket setup errors and downstream probe/containment assertions prevent a green result. |
| `test_execution_adapter.py` | 46 tests; 46 setup errors: broker Unix socket bind raises `PermissionError: [Errno 1] Operation not permitted`. New argv assertions were not reached. |
| `test_sessions.py` | 9 tests; 2 failures, 1 error. Runtime sessions fail before the scripted adapter runs; the new model test consequently indexes an empty run list. |
| `test_session_api.py` | 4 tests passed. |
| `REPOASK_TEST_PYTHON=../repo-ask/.venv/bin/python node --test tests/ui/*.test.mjs` | 306 tests; 304 passed, 2 failed. Both failures are `tests/ui/session-services.test.mjs` service bridge bootstrap probes returning `execution_test_failed`. |
| `git diff --check b5057f2..HEAD` | Passed. |
| Independent inline Python checks using existing fixture services, without worker/CLI execution | Passed: both regexes reject option/equality/newline/path/oversize cases; valid aliases and 80-character boundary accepted; actual service model update creates a new version and preserves the old value; legacy keyless version reads; queued launch remains pinned after active-profile change; stopped predecessor retry retains its model; purge leaves the stored snapshot `{}`. Temporary databases only; no test/source edits. |

## Sandbox limits and integration handoff

The managed sandbox prohibits local Unix socket binding and offers no approval escalation. Adapter tests demonstrate this directly; profile/session/UI failures are consistent with the same broker dependency. These runs do not establish an independent regression in this diff, and they also do not establish passing runtime behavior. No permission bypass, package installation, real inference, Docker execution, external mutation or baseline checkout was attempted.

Integrator should rerun the five requested suites in an environment permitting the local broker sockets, inspect any remaining failures, and verify configured/default model behavior with the supported Claude Code CLI. Actual parser compatibility remains unverified here; switching to `--model=<value>` is not required for injection safety under the current validated grammar. Approval binds only to the exact SHA above. Only this review file was written; no commit was made.
