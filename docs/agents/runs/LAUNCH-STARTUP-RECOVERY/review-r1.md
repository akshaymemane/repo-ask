# Runtime/operations review R1

Verdict: **CHANGES_REQUESTED**

Reviewed commit: `2c75faeeb139dee495832cdb4214a93fa67a644c` on `task/startup-recovery`, authored by Claude. Base: `5730fca`; reviewed `git diff 5730fca..2c75fae`. HEAD matched the submitted commit. Reviewer: independent Codex runtime/operations reviewer. No source changes or commits made.

## Findings

1. **High (P1): Empty sessions does not prove absence of runtime-owned containers; the optimization also disables startup semantics for profile-test recovery.** `repoask/sessions/runtime.py:195–211` (primary location: line 199). Ordinary session execution is ordered safely: the session/job transaction commits in `sessions/service.py:560–583`, and `session_runners` is recorded in `sessions/attempt.py:739–741` before `runner.provision()` at line 746. However, execution-profile probes are another container producer. `execution/profiles.py:166–174` uses the same durable runtime instance ID, and `run_test()` records private recovery metadata and provisions a container using `job.id` at lines 586–590 without creating any sessions row. A crash during the first profile check can therefore leave a container while sessions is empty. This patch sets `startup=False`, avoids constructing/listing the runner, and passes the changed flag to `_recover_tests()`. An unexpired dead-owner test lease is then treated as live at `runtime.py:263`; an expired test cannot have container containment confirmed because the runner/inventory is absent. Containers whose producer metadata no longer points to them also lose the startup orphan sweep, and ordinary maintenance does not initiate an orphan-only inventory. This violates F05/F07 containment and restart recovery and the master PRD recovery requirement.

   Concrete evidence: an inline check using the existing `SessionCase`/`FakeRunner` fixture provisioned an instance-owned `job_profile_probe` container with zero sessions and invoked `reconcile(startup=True)`. Result: sessions=0, `_recover_tests` received runner=None and startup=False, containers_remaining=1, orphans_removed=0. Source tracing above establishes the production producer path; this check used no real Docker.

   **Fix:** keep the original startup flag immutable and calculate a separate inventory/sweep predicate. Skip Docker only when durable history/recovery state from all container producers, including execution-profile checks, proves there is no possible owned resource. Include profile-test recovery needs in runner construction. Add focused cases for a first profile-test crash before any session exists (both unexpired dead-owner and expired leases), and a labelled leftover after provisioning before its container ID was recorded. Verify containment, truthful job/check reconciliation, and that a genuinely unused workspace still avoids Docker. Owner: author/coordinator.

## Other review conclusions

- Background recovery runs before the application worker's first `run_once()`, so that worker cannot claim jobs while publication recovery is still executing. Session runtime workers can start first, but their handlers are restricted to `session.run` and `execution.test`; they do not claim publication jobs. Publication recovery/retry is serialized by `RECOVERY_LOCK` and rechecks durable identity. Exceptions are caught and retained as content-free recovery error codes; successful job iterations preserve that error. A later recovery error can replace an earlier one, but the service remains degraded.
- `Runtime.start()` and `Runtime.close()` serialize with the runtime lock. The extra stop-event check/close in `_recover()` covers shutdown occurring after the initial stop check but before runtime startup. With the concrete runtime, repeated close is safe. Shutdown can still wait for a blocked recovery control call, as the handoff acknowledges. No additional blocking race identified by inspection; deterministic close-during-recovery coverage is absent from the added test.
- Launch before runtime readiness durably queues work; recovery leaves a queued session with a queued job alone. Stop durably records revocation/cancels queued work, and attempts recheck the durable stop flag. Leadership still fences actual execution. The early API availability does not itself authorize a second runtime to execute.
- Workspace execution status reports `starting` throughout the combined recovery interval. Health counts the live background thread as a worker while recovery is pending and has no recovery error until recovery completes; this is thread liveness, not proof that jobs are being processed. Afterwards recorded recovery errors degrade health through the existing handler. No separate readiness guarantee was established by the new test.
- The Claude cancellation test now waits for the fake generation call to record its PID instead of a fixed startup delay; auth/version/plugin probes do not write that call log. It still asserts cancellation and disappearance of the actual process. Its ten-second polling deadline shares the strict ten-second overall assertion, so extreme startup slowness can still fail the test, but the normal fixed-delay race is addressed. The requested test file passed.

## Checks run and limits

All five requested commands used `./.venv/bin/python -m unittest discover -s tests -p <file>`, with `PYTHONDONTWRITEBYTECODE=1`. Independent files were run concurrently.

| File | Actual result |
| --- | --- |
| `test_application_services.py` | PASS: 10 tests, 1.449s |
| `test_sessions_recovery.py` | FAILED: 7 tests, 3 failures and 3 errors, 22.117s; one test passed |
| `test_provider_claude_cli.py` | PASS: 9 tests, 8.235s |
| `test_http_foundation.py` | BLOCKED: 5 errors, all socket bind denied with `PermissionError: [Errno 1] Operation not permitted` |
| `test_publication_service.py` | PASS: 39 tests, 8.660s |

Session-recovery errors explicitly deny executing `/bin/ps`. Its failures were: recycled PID returned `unverified` instead of `absent`; lease-expiry case returned `failed` instead of `interrupted`; shutdown case timed out waiting for an edit checkpoint. The run also emitted an unclosed-socket ResourceWarning. The sandbox blocks process inspection and socket binding needed by these paths; these failures do not establish a regression in this commit and are not passing evidence. The new no-session-history test passed within that run.

Also ran the inline fake-container reproduction described in finding 1; it confirmed the unsafe skip without network, Docker, or process-inspection privileges. Inspected AGENTS.md, workflow, quality persona, master PRD, F05/F06 specs, handoff, exact diff, session insertion/provisioning/recovery paths, execution-profile producer/recovery metadata, publication serialization, and health integration. No live Docker/GitHub/Claude integration was attempted. Approval escalation is unavailable in this sandbox; unrestricted HTTP/process-containment reruns remain for the integrator after the fix. Only this review file was written.
