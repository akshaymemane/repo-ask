# M2-SESSIONS review-r1 resolution (author response; not an approval)

Review target was `37a4a4a`. Every fix below has a regression in `tests/test_sessions_review.py`, unless another file is named.

| # | Finding | Fix | Regression |
| --- | --- | --- | --- |
| 1 | Exclusion change during a run: the agent could still read the newly excluded file, and old events/questions/validations still showed it | Each repository's exclusion set is pinned (patterns + sha256) in `source_manifest_json` at launch. `Attempt.policy()` compares live exclusions to the pin on every tool admission, in the monitor, and before results return; a change stops the session with `policy_changed`. `SessionService.source_policy()` (live access + pinned exclusions for every bound repo) now gates every source-bearing projection: diff, source event types, question prompts, validation commands and output, and message content. A public `source_available` flag (plus a reason) is exposed so the UI can hide source it already rendered. | `test_r1_exclusion_change_stops_tools_and_hides_every_projection` |
| 2 | A purge while the agent was active was undone later: validation rows re-inserted the full command, and validations showed it publicly | Revocation and purge reasons (`access_revoked`, `repository_purged`, `policy_changed`) now durably override an earlier stop reason. Each fenced transaction checks that reason. Under it: checkpoints and manifest updates are refused; validation rows store `{"redacted":true}` with no log artifact; source-bearing events are stored redacted; the outcome keeps `source_redacted`. Validation commands and output are hidden whenever live access fails. | `test_r2_purge_during_active_run_fences_all_later_source_writes` |
| 3 | Stop admission race: a stop committed between the guard and the tool start, yet the tool still started and reached the runner | `tool.started` is now written in an admission transaction that rechecks lease, durable stop flag, state, live policy and the event budget. If admission fails, the broker's emit fails, so the broker never calls the runner. The denial is recorded as `tool.denied` with `phase: admission`. | `test_r3_stop_between_guard_and_admission_never_starts_the_tool` |
| 4 | Missing process identity: a live PID with no recorded identity was reported as absent | `contain_recorded` now returns `unverified` for a live PID with no identity. If identity capture fails at `on_started`, the attempt terminates and ends `failed`/`runtime_identity_unverified`, the runner stays `containment_failed`, and new launches are blocked until a reconcile proves the process is gone. | `test_r4_live_pid_without_identity_is_unverified_not_absent`, `test_r4_identity_capture_failure_…` |
| 5 | `local_only` was checked only at startup | The live policy check covers `local_only` (every tool and admission) plus pinned-profile consent and the image (full check every 2 s), then stops and contains the run. | `test_r5_local_only_enabled_mid_run…`, `test_profile_consent_revoked_mid_run…` |
| 6 | Validation edits were lost when the following snapshot failed, yet the outcome looked clean | Before any validation command runs, the attempt marks edits unverified; only a verified, persisted capture clears that mark. If capture fails, the outcome is `result: incomplete` with `artifacts_stale` and `edits_since_last_checkpoint_may_be_lost` set, `fully_validated` false, publication ineligible, and a failed-checkpoint event. | `test_r6_validation_mutation_with_failed_capture_is_never_clean` |
| 7 | Retry adopted the newest profile version, and a harmless profile update blocked an already-queued attempt | Retry now copies the predecessor's profile, limits, instructions and publication snapshots. It rechecks the pinned version through `require_version_usable`: deletion, consent and test status must still pass, the image must be unchanged, and the prompt hash must match. Attempts resolve their pinned version id, not the active one. | `test_r7_retry_keeps_predecessor_version_limits_and_instructions`, `…harmless_active_update…`, `…retry_still_requires_fresh_permission` |

## Required gaps (also finished, not left as warnings)

- **Generic follow-up updates (SE-07):**
  - `SessionBroker` is a session-owned subclass of `ToolBroker`. It calls `super().call()` for the guard, tool, events and checkpoint, and keeps the same 7 tool names and socket protocol. After an allowed, successful result (and a fresh authority check) it appends up to 3 queued updates within a bounded size.
  - Status `delivered` means the update was sent to the agent bridge (`sent_to_agent_bridge`). `acknowledged` is recorded only when the model's reply contains the private `[message:<id>:ack]` marker (`model_marker_observed`). The marker is stripped from the text shown in the UI.
  - Updates still queued at the end become `rejected/terminal_before_delivery`. Updates delivered but never acknowledged keep `delivered/ack_unknown`.
  - `ask_user` answers follow the same rule: the broker reply counts as dispatched, not as an acknowledgement.
  - New `list_messages(id, limit, cursor)`; message content is hidden when source is unavailable.
  - Tests: `FollowUpTests`, `QuestionTests`, and the real `ClaudeAdapter` + MCP bridge test `test_real_adapter_mcp_follow_up_dispatch_and_observed_ack`.
- **Read-only related contexts:**
  - Only GitHub read repositories are supported. Each is acquired through the same API boundary at its pinned revision, using its pinned exclusions. Local or demo read contexts block preflight with `read_context_unsupported_kind`.
  - Files are mounted under `/context/<stable alias>` through the runner's `context=` parameter: a root-owned `0555`/`0444` noexec tmpfs that is verified unwritable by the session user and is never under `/workspace`. The prompt lists the aliases; the model reads them with `run_command`.
  - Read access and index eligibility are part of the live policy check.
  - Tests: `ReadContextTests`, and `tests/test_execution_runner_context.py` for the runner side.
- **Executable modes:** the regular 0644/0755 base modes in the manifest are passed as `file_modes`. Checkpoints capture modes through `snapshot(include_modes=True)` (a mode-aware runner proxy also serves the broker's own checkpoints). The patch records `old_mode`, `mode` and `mode_changed`. Test: `ModeTests`.
- **Profile-test recovery:**
  - The runtime leader calls `pending_runtime_tests()`. A dead-owner test is contained only when its recorded identity matches, its containers are stopped and discarded by label (`session_id = job_id`), and `reconcile_test(..., containment_confirmed=...)` is called.
  - Live local tests are never touched, nor is any unexpired lease outside startup.
  - Containers belonging to any queued, leased or needs-reconciliation `execution.test` job are excluded from the orphan sweep.
  - Tests use the real `ExecutionProfileService`: `ProfileTestRecoveryTests`.

## Not yet proven (unchanged)

- Real Docker runs: `tests/test_execution_runner_context.py` with `OPENDEVIN_DOCKER_TESTS=1`, and `tests/test_sessions_docker.py` with `OPENDEVIN_SESSION_DOCKER=1`. The sandbox here denied these; root must run them.
- Real model inference and clarification proof wait for root's reserved fourth agent slot.
