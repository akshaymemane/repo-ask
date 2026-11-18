# Runtime/operations review R3

## Verdict

**APPROVE exact commit for the reviewed change.** R1 and R2 findings are resolved; no additional blocking finding identified. This is not a claim that the process-dependent regression suites passed: the integrator still needs an unrestricted rerun before treating their runtime acceptance as verified.

## Reviewed commit

`7679c70fd6e8f985b21e3ec21d9c407c6ebb142c` on `task/startup-recovery`, independently reviewed by Codex. HEAD matched before and after checks. Inspected `git diff bed98b7..HEAD` and the whole task `git diff 5730fca..HEAD`, including asynchronous application recovery, startup inventory gating, profile-test reconciliation and cancellation synchronization. Read AGENTS.md, workflow, quality-reviewer persona, master PRD, F05/F06/F07 specs, durable-session contract, R1/R2 reviews and the handoff's Round-2 response. No separate task card exists in this run directory; the current user assignment and handoff define this review's scope.

## Findings

No new actionable findings.

- **R1 resolved:** startup keeps its original lease semantics and includes execution-profile check history in the inventory predicate (`repoask/sessions/runtime.py:195`). Zero sessions alone no longer suppresses the profile-test orphan sweep. The check row precedes provisioning, so a crash before recording the container ID retains inventory eligibility.
- **R2 resolved:** after confirmed containment at startup, a nonlocal owner's leased profile test is fenced to `needs_reconciliation`, with the observed owner and leased state in the SQL predicate (`repoask/sessions/runtime.py:276`). The refreshed job then reaches the producer's supported reconciliation state and resolves immediately. The preceding live-local/non-startup lease guards remain intact; unconfirmed containment does not enter the new fencing path. Normal startup recovery is called while runtime leadership is held, before runtime workers start. The producer continues to clear private runtime metadata only after confirmed containment and never requeues the uncertain test.
- Whole-task inspection found no additional blocking change to the earlier conclusions about background recovery ordering, shutdown synchronization, queued execution fencing or recovery-error retention. Recovery and shutdown can still wait on bounded control calls as disclosed in the handoff.

## Checks

Inline checks used the existing real SQLite/jobs/profile services with `SessionCase`, `ProfileTestRecoveryTests.setUp()` and `FakeRunner`. No process mocks, real harness, Docker or provider calls were used. Runtime leadership was explicitly acquired before reconciliation; no worker threads were started. Every case had zero sessions.

| Inline reproduction | Actual result |
| --- | --- |
| Instance-owned `job_profile_probe` container, existing profile-check history, no container-ID recovery metadata; `reconcile(startup=True)` | PASS: containers remaining 0, orphans removed 1 |
| Genuinely unused execution workspace: zero sessions and zero profile checks, recording runner factory; startup reconciliation | PASS: runner constructions 0 |
| Dead owner `runtime:deadbeef:0`, 600000ms unexpired test lease; provision job-labelled container, record only private instance ID (crash before recording container ID or starting harness) | PASS: harness absent, container terminated, confirmed=true, reconciled=true; job failed, check interrupted, error execution_test_interrupted; containers 0, provision count 1, agent runs [] |
| Same dead-owner case, lease expiry set to clock()-1 | PASS: same contained, immediately terminal outcome; no rerun |

All requested suites ran concurrently with `PYTHONDONTWRITEBYTECODE=1` and the exact command form `/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python -m unittest discover -s tests -p <file>`:

| File | Actual result |
| --- | --- |
| `test_sessions_recovery.py` | FAILED: 7 tests, 3 failures, 3 errors, 17.712s (1 passed) |
| `test_sessions_review.py` | FAILED: 24 tests, 14 failures, 3 errors, 26.444s (7 passed) |
| `test_application_services.py` | PASS: 10 tests, 0.518s |

Recovery-suite errors explicitly deny executing `/bin/ps`. Failures are recycled PID classified unverified rather than absent, expired-session state failed rather than interrupted, and timeout waiting for an edit checkpoint. The unused-workspace startup test passed. Review-suite errors likewise deny `/bin/ps` in all three profile-test harness setup paths, including the new unexpired-lease regression. Its failures concern completion/reviewable outcomes, consent/access/privacy/stop states, identity classification and question progress; attempts often end failed/internal before tools run. Both session suites emitted an unclosed Unix-socket ResourceWarning. These outcomes closely match R2, with the new profile test adding one process-inspection error; they do not independently establish a regression from this change and are not passing acceptance evidence. The inline checks independently verify the requested container/lease-state cases, but do not prove real harness termination.

`git diff --check bed98b7..HEAD` passed. Filesystem writes are restricted to workspace/temp roots, network access is restricted, and approval escalation is unavailable. `/bin/ps` denial was observed here; socket-binding denial was recorded in R1 and was not separately reprobed in R3. No live Docker, GitHub or inference integration was attempted. Integrator owns the unrestricted process/socket-dependent rerun. Only this review file was written; no source edits or commit were made.
