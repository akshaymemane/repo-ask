# LAUNCH-STARTUP-RECOVERY handoff

- Branch `task/startup-recovery`, base `5730fca`. Author: Claude (coordinator), found by the first GitHub CI run.

## Problem

GitHub macOS runners failed `test_actual_cli_serves_then_sigterm_exits_cleanly_without_demo_files` and
`test_cli_model_seeds_missing_roles…`: the real CLI did not become ready within 10s. A diagnostic job
(`ci/macos-startup`, run 44226861646) measured 35.4s to readiness. Root cause: session-runtime startup recovery always
calls `docker ps` (orphan sweep) before the HTTP server reports ready, and Docker control calls wait up to
`CONTROL_TIMEOUT` (30s) when a Docker CLI exists but its daemon does not answer. Reproduced locally with
`DOCKER_HOST=tcp://10.255.255.1:2375`: 30.5s to ready. Any user with Docker installed but not running would wait 30s+
for the UI even to use Ask.

## Fix

1. `repoask/sessions/runtime.py` `reconcile(startup=True)`: when nothing is stale or pending and the workspace has never
   recorded a session, skip the Docker orphan sweep (no containers of this instance can exist).
2. `repoask/services.py`: session-runtime start and publication recovery run on the background job thread before it
   claims jobs, so the web app serves immediately; `execution_status()` reports runtime `starting` meanwhile; recovery
   failures are kept as `recovery_error` codes (not overwritten by the job loop); a shutdown that races recovery closes
   the runtime once it starts.
3. `tests/test_provider_claude_cli.py`: the cancel test waited a fixed 1s before cancelling, racing fake-CLI startup
   under load (seen while integrating LAUNCH-FRESHNESS); it now cancels after the fake CLI records its start.

## Checks

- Unreachable Docker daemon: in-memory ready 0.8s, `--data-dir` ready 0.3s, shutdown immediate (was 30.5s).
- New tests: `test_slow_session_recovery_does_not_delay_serving`,
  `test_startup_without_session_history_never_waits_on_docker`; existing composition test waits for recovery.
- Full suites: see commit message / coordinator log.

## Known gaps

- A workspace with session history and an unresponsive Docker daemon still spends up to 30s recovering in the background,
  and shutdown during that window waits for it (runtime lock). The UI is served meanwhile.
