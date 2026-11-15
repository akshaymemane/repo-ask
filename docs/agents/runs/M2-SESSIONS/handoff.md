# Builder handoff — M2-SESSIONS (round 2, after review-r1)

## Identity

- Author: Claude (Claude Code, Opus 5.5), session-runtime persona. No nested agents and no model invocations.
- Branch/worktree: `task/m2-sessions`, `/Users/apple/workspace/vibe-coding/opendevin-m2-sessions`. Base: `28343c3`.
- Dependency cherry-picks (explicit dependencies, NOT root-integrated):
  - adapter `6789421`→`595d6b7`, `9de6eeb`→`952a1b4`, `73a682f`→`3c71442`, `ea7de6d`→`870ec9d`
  - profiles `b5ca0c4`→`ccc1469`, `551e988`→`8a0b712`
  - broker reader fix `0f30216`→`4eb9f6e`
- M2-SESSIONS commits:
  - `37a4a4a`: round 1, reviewed with changes requested.
  - `6b3c5fd`: runner slice (`repoask/execution/runner.py` file modes and read-only context, plus `tests/test_execution_runner_context.py`), under the coordinator's scope extension.
  - The commit that follows `6b3c5fd`: session fixes and features plus these docs. It is the review target.
- Status: review. Not integrated, not approved, not published.

## Outcome

`review-r1-resolution.md` maps each of the 7 majors and each required gap to its fix and regression test. Summary:

- Privacy and stop fixes:
  - Pinned per-repository exclusion hashes and a live `source_policy` gating every source-bearing projection. Public `source_available` and `source_unavailable_reason` let the UI hide source it already rendered.
  - Revocation and purge reasons durably fence later writes (validation, manifest, checkpoint, events).
  - Transactional tool admission.
  - Process identity fails closed.
  - Live `local_only`, profile consent and image checks during the run.
  - Validation edits are tracked until a verified capture.
  - Retry is pinned to the predecessor's immutable snapshots via `require_version_usable`.
- Features:
  - Generic follow-ups through the session-owned `SessionBroker`. `delivered` means dispatched; `acknowledged` requires an observed model marker.
  - `list_messages(id, limit, cursor)`.
  - GitHub read-only related contexts mounted under `/context/<alias>`.
  - Executable modes preserved, with mode changes captured for publication.
  - Profile-test recovery and orphan-sweep protection.
- Runner change (assigned slice only):
  - `provision(..., file_modes=None, context=None)`.
  - `snapshot(..., include_modes=False)` returns `(files, modes)` when asked.
  - `parse_workspace_tar(..., modes=None)`.
  - Context populated as uid 0 without capabilities, locked to `0555`/`0444`, then probed as the actor. Default APIs are unchanged; other runner areas are untouched.
- Schema 9/10 unchanged. No HTTP, main or broker edits.

## Verification evidence

| Check | Command | Result |
| --- | --- | --- |
| Full regression | `python3 -m unittest discover -s tests` | OK: 418 tests, 34 skipped (opt-in Docker/live), 338 s |
| Session suites | `python3 -m unittest discover -s tests -p 'test_sessions*.py'` | OK (includes 19 review regressions and 3 real-adapter protocol tests) |
| Runner suites | `python3 -m unittest tests.test_execution_runner` and `discover -p 'test_execution_runner_context.py'` | OK: 41 with 4 skipped, and 7 with 1 skipped (Docker) |
| Real adapter path | `test_sessions_adapter.py`: real `ClaudeAdapter`/`adapter_process`/MCP bridge/`SessionBroker`, FAKE CLI | Inventory gate; tools; follow-up dispatch and marker ack; prompt on stdin, not argv; process-group cancellation. **Not inference.** |
| Profiles integration | `ProfileTestRecoveryTests` with the real `ExecutionProfileService` | Dead test contained, then `reconcile_test` → job failed, check interrupted, private runtime not public; live local test untouched |
| Docker | `OPENDEVIN_DOCKER_TESTS=1 …test_execution_runner_context`; `OPENDEVIN_SESSION_DOCKER=1 …test_sessions_docker.py` | **NOT RUN** (sandbox denial). Root to run with cached `python:3.12-slim`; no pulls. |
| Real Claude/model | — | **NOT RUN.** Awaiting root's reserved fourth slot. |

## Risks and next action

- **Root API wiring:**
  - `GET /api/sessions/{id}/messages` → `list_messages`.
  - Surface `source_available` in the UI.
  - `stop(id)` unchanged.
- The ack marker is an instruction to the model. Some models may never echo it, in which case messages truthfully stay `delivered/ack_unknown`.
- `material` message filtering is still heuristic.
- Recovery still writes the `jobs` table directly for dead-owner session leases (from round 1; awaiting root's decision).
- The `/context` actor probe uses the first file found; permission bits are the primary guarantee.
- Not done: no publication (F06), no live Docker or inference proof, no push or remote writes.
- Background processes: none left running.
- Reviewer: fresh Codex exact-commit review of the final commit, with the runner slice included.
