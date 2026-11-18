# Runtime/operations review R2

Verdict: **CHANGES_REQUESTED**

Reviewed commit: `bed98b7876404f9e28e439d9da4ce0ff8a8753ee` (`task/startup-recovery`). HEAD matched. Reviewed both `git diff 2c75fae..bed98b7` and `git diff 5730fca..bed98b7`. Independent Codex runtime/operations reviewer; no source changes or commits.

## Findings

1. **Medium (P2): A contained dead-owner profile test with an unexpired lease remains falsely running after startup.** Primary location: `repoask/sessions/runtime.py:276–282`; producer guard: `repoask/execution/profiles.py:748–751`. Preserving `startup` now correctly admits this test to containment, but `_recover_tests()` passes its still-leased job directly to `reconcile_test()`. The producer rejects every leased job with `execution_test_active` when unexpired. Recovery records `confirmed=True, reconciled=False`, while the durable job stays `leased` and the check stays `running`. `request_test()` returns that existing running job instead of permitting a fresh check (`profiles.py:383–392`). Recovery therefore waits for lease expiry despite having already contained the dead runtime's resource. This is the remaining truthful-state/reconciliation part of R1 and F05/F07 restart recovery, not an unsafe-container skip. The same producer guard existed at the prior commit; R2 exposes the incomplete response to the requested unexpired case.

   Reproduction run inline using `ProfileTestRecoveryTests.setUp()` and `FakeRunner`, with **zero sessions**, no process mocks and no real harness: claim the queued `execution.test` as `runtime:deadbeef:0` with `lease_ms=600000`; provision its job-ID-labelled container; set its check to `running` with `result_json={"private_runtime":{"instance_id":<current instance>}}`; call `runtime.reconcile(startup=True)`. This models a crash after provisioning and before recording the container ID or starting a harness. Actual: containers=0, harness=`absent`, container=`terminated`, confirmed=true, reconciled=false, reason=`execution_test_active`, job=`leased`, check=`running`, provision_count=1, runs=[]. Repeated with `lease_expires_at=clock()-1`: confirmed=true, reconciled=true, job=`failed`, check=`interrupted`, error=`execution_test_interrupted`, containers=0, provision_count=1, runs=[]. An initial assertion expecting the unexpired case to resolve failed; a subsequent diagnostic run completed both cases and confirmed these results.

   Requested fix (author/coordinator): under established startup leadership, fence the verified dead owner's lease through the queue's supported reconciliation path before producer resolution; preserve protection for local live owners and non-startup valid leases. Add the unexpired case alongside the existing expired test and verify immediate terminal job/check state without rerun. No queue/producer source was edited by this reviewer.

## Checks

- R1 inline orphan reproduction rerun with `SessionCase`/`FakeRunner`: provision instance-owned `job_profile_probe`, zero sessions, existing profile-check history, then `reconcile(startup=True)`. **PASS:** containers_remaining=0, orphans_removed=1. No private container-ID metadata was needed. The R1 inventory skip is fixed.
- Genuinely unused workspace: remove fixture profile-check history after orphan cleanup, confirm zero sessions, replace the runner factory with a call recorder, then `reconcile(startup=True)`. **PASS:** runner constructions=0. The requested recovery suite's no-history startup test also passed.
- Dead-owner unexpired/expired profile-test checks: actual results above. Both contain the fake container; only the expired case resolves immediately. No real harness identity/termination proof is claimed by these checks.
- Read AGENTS.md, workflow, quality-reviewer persona, master PRD, F05/F06/F07 specs, session contract, R1 review and handoff response. Reviewed the whole task diff, including asynchronous application recovery and cancellation synchronization. No additional blocking finding beyond the remaining reconciliation case.

All requested suites ran concurrently with `PYTHONDONTWRITEBYTECODE=1` and `./.venv/bin/python -m unittest discover -s tests -p <file>`:

| File | Actual result |
| --- | --- |
| `test_application_services.py` | PASS: 10 tests, 0.631s |
| `test_sessions_recovery.py` | FAILED: 7 tests, 3 failures, 3 errors, 18.256s |
| `test_sessions_review.py` | FAILED: 23 tests, 14 failures, 2 errors, 27.280s |

Recovery errors explicitly deny `/bin/ps`; failures are recycled PID returning `unverified`, expired-session state `failed` rather than `interrupted`, and shutdown checkpoint timeout. Review-suite errors likewise deny `/bin/ps` in both profile-test harness setup paths. Its failures concern expected completion, consent/privacy/stop states, identity error classification, checkpoint/question progress and reviewable artifacts; observed attempts often terminate `failed/internal` before tools run. Both suites emitted an unclosed Unix-socket ResourceWarning. These sandbox-limited suite outcomes are neither passing evidence nor independent proof of regressions in this change. The inline unexpired-lease finding requires neither process inspection nor socket binding and is independent of those limitations.

Filesystem writes were restricted to the workspace/temp roots, network restricted, and approval escalation unavailable. `/bin/ps` execution was denied in this run; socket binding was denied in R1 and was not independently reprobed here. No live Docker, GitHub or provider integration was attempted. The integrator must rerun process/socket-dependent suites in a suitable environment. Only this review file was written; no commit was made.
