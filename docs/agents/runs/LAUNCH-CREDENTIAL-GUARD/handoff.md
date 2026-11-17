# Builder handoff — LAUNCH-CREDENTIAL-GUARD

## Identity

- Author/harness and session ID: Codex (session ID unavailable).
- Persona: retrieval/platform builder; coordinator: Claude.
- Branch: `task/index-credential-guard`.
- Worktree: `/Users/apple/workspace/vibe-coding/opendevin-index-credential-guard`.
- Base SHA: `437ef2626cb8fe01815f494df48fb6cf9ac15e17`.
- Submitted implementation SHA: `6d35b04f78e7830c7a7d0ef0624f8f23d2e675c2`.
- Task card: user-assigned LAUNCH-CREDENTIAL-GUARD; F02 IX-03/AC4, F12 AC7, Master PRD §10 Privacy.
- Status: review pending independent review arranged by Claude.

## Outcome

One standard-library credential module now supplies detection and redaction to indexing,
session redaction/acquisition, and plain-text plan export. Ordinary source containing
any supported credential is excluded before snapshot source, chunk/FTS storage or
embedding calls. Private-key blocks include generic PEM, RSA, EC, OPENSSH, DSA and
ENCRYPTED, including incomplete blocks. Token families cover all five GitHub prefixes,
GitHub PAT, AWS, OpenAI/Anthropic/project keys, all five Slack prefixes and Google API keys.
Word boundaries preserve ordinary identifiers; session/export key-value, bearer (session)
and host-path rules remain local and unchanged.

Changed files, all within exclusive assignment:
- `repoask/platform/credentials.py` (new)
- `repoask/indexing/safety.py`
- `repoask/sessions/redaction.py`
- `repoask/ask/common.py` (`export_text` only)
- `tests/test_credential_detection.py` (new)
- `docs/agents/runs/LAUNCH-CREDENTIAL-GUARD/` (status and handoff)

Contracts consumed: existing accepted `docs/contracts/m1-indexing.md`; no data/API,
migration or configuration changes. Canonical GitHub PAT detection retains the broader
one-or-more-character suffix of existing exports (sessions/indexing consequently become
more conservative for short PAT-like values). No contract deviation requiring consumer migration.

## Verification evidence

Interpreter for all unittest commands: `/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python`.

| Requirement | Command or scenario actually run | Result / evidence |
| --- | --- | --- |
| F02 IX-03/AC4; F12 AC7 | `-m unittest discover -s tests -p test_credential_detection.py` | Exit 0; 4 tests passed, 29 supported-format subcases. Real migrated SQLite/IndexService/Worker and injected source/provider I/O. Only ordinary source persisted to snapshot/chunks/FTS and transmitted to embedding fake; positive embedding control passed with vector dependencies available. |
| F02 regression | `-m unittest discover -s tests -p test_indexing_service.py` | Exit 0; 19 tests passed. |
| Scope/whitespace | `git diff --check` | Exit 0. |

Requested full suite actually run: `/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python -m unittest discover -s tests`.
Exit 1; **618 tests in 350.891s; failures=69, errors=99, skipped=9**.
Errors include sandbox-denied socket operations (`PermissionError: [Errno 1] Operation
not permitted`) in HTTP, broker/adapter and provider-network fixtures, plus denied
`/bin/ps` in runtime recovery. Execution-profile/session fixtures also report failed
startup, missing fixture attributes, failed states and timeouts; transport teardown
reports descriptor-count failures. These broad runtime failures were not individually
baseline-compared or fully triaged. No full-suite green claim is made. No credential
or indexing test failure was reported. No UI bridge-specific suite was separately run.

## Risks and next action

- Known gaps: pattern-based detection covers recognizable supported formats, not arbitrary secrets. Tests use synthetic credentials and fake provider I/O; no live provider calls.
- No retrospective purge/rebuild of existing indexes is implemented; coordinator should assess rebuilding any preexisting index created under the old guard.
- Migrations/configuration needed: none.
- Background processes: unittest process exited; no builder services started. Sandbox denies process enumeration, so remaining child processes could not be independently audited.
- Reviewer: independent reviewer assigned by Claude; review implementation SHA above and final handoff commit against the assigned privacy requirements. Not approved, integrated or published by this builder.
- Handoff commit blocked: `git add` twice failed creating the shared worktree Git metadata `index.lock` outside writable roots (Operation not permitted). Implementation commit succeeded earlier; handoff/status updates remain uncommitted. Coordinator must commit these two task-local artifacts from an authorized checkout.
- Next owner: Claude coordinator for independent review and integration/regression checks in the combined branch.
