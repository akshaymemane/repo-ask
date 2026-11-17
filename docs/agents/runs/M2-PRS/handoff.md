# Builder handoff — M2-PRS round 2

## Identity

- Author: Codex runtime builder, original author; no delegated agents or independent approval claimed.
- Branch/worktree: `task/m2-prs-r2`, `../opendevin-m2-prs-r2`.
- Integration base: `97f8c30`; round-1 reviewed commit/start: `a273ab2`.
- Submitted implementation SHA: `1631858` (followed by documentation-only evidence commit).
- Contract: `docs/contracts/m2-publication.md`; task: `docs/agents/runs/M2-PRS/task.json`.
- Requirements: PR-01–PR-11, OP-02, OP-06, OP-12. Status: candidate for independent review.

## Outcome and scope

Publication now fences writes against current snapshot eligibility, immutable intent,
job ownership/lease, cancellation and concurrent terminal transitions. Confirmed
remote identifiers survive purge; source-bearing intent fields are tombstoned.
A shared PR path reconciles uncertain creation/confirmation, and public `recover()`
resolves expired external jobs before retry. Read operations use read-scoped tokens.
Preview observes divergence and returns the generated head pattern. Compare clearance
requires ancestry and includes rename sources. Paths and provider shapes fail closed.

Changed scope: `repoask/publication/service.py`, publication portions of
`repoask/github/client.py`, `tests/test_publication_service.py`, publication tests in
`tests/test_github_client.py`, task-local handoff/status. GitHubService already accepts
`permissions=None` with its unchanged read default at this baseline; no edit needed.
No migration, session, shared application, API, or web edits.

## Finding-to-evidence map

Test names below are in `tests/test_publication_service.py` unless stated otherwise.
All use real SQLite migrations/jobs and fake session/GitHub boundaries. PR fakes
filter exact head/base/number and ref reads filter branch names.

| Finding | Change | Passing test(s) |
| --- | --- | --- |
| 1 | Revalidate snapshot/access and leased job at each write; cancel queued/leased purge jobs, reject terminal transitions, retain confirmed remote IDs | `test_purge_and_exclusion_mid_run_fence_writes`, `test_cancellation_between_blob_and_tree`, `test_confirmed_commit_survives_purge_during_response` |
| 2 | Shared `_publish_pr` for new and resumed branches, authority before create and uncertain response reconciliation | `test_resume_lost_pr_and_confirmation_timeout_are_recoverable` |
| 3 | Persist number immediately; missing number and transient confirmation read reconcile | `test_confirmation_get_timeout_keeps_number`, `test_missing_create_number_reconciles_exact_pr` |
| 4 | No-argument `recover()` expires leases, observes remote facts, resolves old jobs; retry invokes recovery; stale worker fenced | `test_expired_lease_recovery_fences_old_worker_and_retries`, `test_resume_lost_pr_and_confirmation_timeout_are_recoverable` |
| 5 | Safe object-stage GitHub failures enter reconciliation, resume frozen intent | `test_transient_objects_resume_frozen_identity_message_and_date` |
| 6 | Bind repository, artifact IDs, base branch/SHA, diff and policy; automatic gate before token and every write | `test_all_snapshot_bindings_and_automatic_gate_rechecked` |
| 7 | Preview read observation/compare and real generated branch pattern | `test_preview_observes_rename_conflict_and_real_head_pattern`, `test_preview_is_read_only_and_publish_is_atomic_idempotent` |
| 8 | Include previous filename in divergence overlap | `test_preview_observes_rename_conflict_and_real_head_pattern` |
| 9 | Compare clearance only for ahead/identical status | `tests/test_github_client.py::test_publication_compare_requires_ancestor_status` |
| 10 | Added recovery/fencing/policy/identity/negative confirmation/stale/path/refresh coverage; manual failed validation disclosure cannot be removed by editing body | Tests above plus `test_manual_failed_checks_body_and_automatic_success`, `test_negative_pr_confirmation_and_shapes`, `test_path_hygiene_stale_preview_rejected_paths_and_identity`, `test_refresh_without_source_uses_read_scope` |
| 11 | Read-scoped tokens for preview/reconcile/refresh; refresh independent of source | `test_refresh_without_source_uses_read_scope`, `test_preview_is_read_only_and_publish_is_atomic_idempotent`; recovery tests exercise read path |
| 12 | Tombstone title/body/commit message with `[purged]` | `test_purge_and_exclusion_mid_run_fence_writes` |
| 13 | Public content-free validation status summary, unavailable after source loss | `test_manual_failed_checks_body_and_automatic_success` |
| 14 | Unconfirmed foreign branch collision chooses durable fresh suffix | `test_recovery_foreign_branch_selects_fresh_suffix` |
| 15 | Reject .git components, empty/trailing components, changed/deleted duplicates, prefix clashes before writes | `test_path_hygiene_stale_preview_rejected_paths_and_identity` |
| 16 | Validate list/PR nested response shapes and identity before adoption | `test_negative_pr_confirmation_and_shapes`, `test_malformed_find_response_blocks_instead_of_creating_pr` |
| 17 | Correct base and round-1 identity | Identity section above and status.md |

## Commands actually run

Interpreter for all commands: `./.venv/bin/python`.

- `-m unittest discover -s tests -p 'test_publication*.py'`: final focused run, 32 tests, OK, exit 0.
- `-m unittest discover -s tests -p 'test_github_*.py'`: 69 tests, OK, exit 0.
- `-m unittest discover -s tests`: first run, exit 1; 553 tests in 349.709s, 69 failures, 89 errors, 9 skipped. Second run including final added tests: exit 1; 556 tests in 366.643s, 69 failures, 89 errors, 9 skipped. No publication or GitHub test appears in the failure/error headings.
- Additional diagnostic `-m unittest discover -s tests -f -v`: exit 1; 10 tests in 0.789s, one error. First failure is `test_ask_composition.AskCompositionTests.test_cli_model_seeds_missing_roles_without_inference_or_overwriting_saved_choices`, at `listener.bind(('127.0.0.1',0))`: `PermissionError: [Errno 1] Operation not permitted`.
- `git diff --check`: exit 0.

## Risks / next action

Coordinator must wire `recover()` once at startup, retain the documented service
signatures and registered purge hook, and run combined integration checks. An
independent reviewer must review the exact submitted commit; author approval is not
claimed. No packages installed, network requests, push, reset, clean, force, or live
GitHub pilot performed. No background application launched. The full suite is not green: TCP and Unix socket bind permission errors and
downstream session timeouts/`failed/internal` assertions are present. These failures
are outside this task’s write scope; they have not all been independently triaged.
Raw full-suite output stays in local `/tmp/m2-prs-r2-full.log`, not shared artifacts. Live disposable GitHub pilot
remains a separate coordinator/user-authorized acceptance gate.

## Self-evaluation (ecc:agent-self-evaluation)

Accuracy 4/5: focused boundary checks pass; live provider behavior is untested.
Completeness 4/5: all 17 findings mapped; independent review and app integration
remain coordinator gates. Clarity 4/5: explicit mapping is lengthy but reviewable.
Actionability 4/5: startup hook is supplied; coordinator wiring is outside scope.
Conciseness 4/5: test matrix repeats some scenario names to keep findings traceable.
Overall 4.0/5. Highest impact next steps: exact-commit independent review, combined
startup/recovery integration, then authorized live pilot. The user should agree with
this assessment because it distinguishes fake-boundary evidence from release gates.


## Round 3 — N1–N8

Start commit: `722e56790c1ca2a3b785b748b2364073cc7da065` (round-2 findings baseline).
Round-3 implementation commit: `8d8ecb3` (evidence committed separately).
Integration base remains `97f8c30`; round-1 reviewed commit remains `a273ab2`.
Original Codex author, same assigned worktree and branch; no delegation. Public
constructor/run/preview/publish/get/retry/refresh/settings/update_settings/recover
signatures and registered purge hook remain compatible. No migration changes.

| Finding | Change | Proof in tests |
| --- | --- | --- |
| N1 | Retry uses only recovery's reached state; enqueue transaction refuses unresolved current jobs, retaining the old job link until resolved | `test_retry_pending_read_never_orphans_old_job` exercises a first timeout, second successful recovery, zero unresolved jobs and exactly one ref/PR |
| N2 | Process-wide reentrant lock serializes recover/reconcile/retry across service instances; recovery conditionally rechecks job identity/state inside its write transaction, tolerates already resolved jobs, and isolates per-row errors; concurrent terminal errors return safe state | `test_overlapping_recovery_retry_and_leased_worker`, `test_purge_during_recovery_does_not_abort_startup` |
| N3 | Persist only fully_validated boolean in publication.checks event at publish; public reads/state transitions never fetch snapshots. Blob step reuses its bound capture with per-file job/access fences; full eligibility checked before/after blob step outside write transactions. Real producer inspected at 23e836c | `test_public_reads_persist_checks_without_snapshot_and_legacy_unavailable`, `test_snapshot_loads_are_constant_for_blob_step_outside_write_lock`, `test_blob_step_rechecks_lightweight_source_policy`; round-1 purge/exclusion/cancellation tests remain passing |
| N4 | Refresh rejects non-dict and nonmatching/noninteger numbers, returning safe prior row | `test_refresh_malformed_or_wrong_number_returns_safe_state` |
| N5 | Compare rejects previous_filename except absent, null or string | `test_publication_compare_previous_filename_shape` in test_github_client.py |
| N6 | Fake records PR body; manual failed-check test asserts published and both failed/unavailable disclosure in actual create call | `test_manual_failed_checks_body_and_automatic_success` |
| N7 | No-commit reconciliation returns queued before token mint or remote reads | `test_no_commit_reconciliation_needs_no_remote_access` |
| N8 | Legacy publications without a persisted summary return checks.status=unavailable without touching source; summaries remain available after source loss | `test_public_reads_persist_checks_without_snapshot_and_legacy_unavailable` |

Round-1 map above remains applicable except finding 13: check summaries are now
persisted publication facts rather than live snapshot reads. Source unavailability
does not erase an already recorded validation boolean; legacy missing summaries
are explicitly unavailable. Blob capture verification cost is constant in file
count (one bound capture per step); bytes are not loaded by get/_public/_state.
Where the session boundary provides source_policy, per-blob fences additionally
check that lightweight live policy without decoding artifacts.

Round-3 commands actually run (same specified venv interpreter):

- `-m unittest discover -s tests -p 'test_publication*.py'`: final run 40 tests, OK, exit 0.
- `-m unittest discover -s tests -p 'test_github_*.py'`: 70 tests, OK, exit 0.
- `-m unittest discover -s tests`: 564 tests in 386.880s, 69 failures,
  89 errors, 9 skipped, exit 1. No publication/GitHub test occurs in the
  failure/error headings. First error is AskCompositionTests at socket bind;
  execution/session errors include PermissionError: [Errno 1] Operation not
  permitted and session assertions. Broader failures are not all independently
  triaged. Local raw output: `/tmp/m2-prs-r3-full.log` (not committed).
- `git diff --check`: exit 0.

The initial focused run exposed a test using nonexistent JobQueue.lease; corrected
to the real claim API before the passing runs reported above. No runtime defect
was hidden by changing a fake boundary.

Known limits: recovery serialization is within the single local coordinator process;
this is not a distributed recovery-leader implementation. Coordinator still owns
startup invocation, combined app integration and exact-commit independent review.
No network, packages, remote writes or live GitHub pilot were performed.


Round-3 self-evaluation using ecc:agent-self-evaluation: accuracy 4/5 (40
publication and 70 GitHub checks pass; live GitHub remains untested), completeness
4/5 (all N1–N8 mapped; independent review remains external), clarity 4/5 (explicit
legacy-summary behavior, but long inherited evidence map), actionability 4/5
(coordinator must invoke recover at startup), conciseness 4/5 (finding tables
repeat some tests for traceability). Overall 4.0/5. Highest-impact next actions:
exact-commit independent review and combined startup integration; live pilot
remains separately authorized. Would the user agree: this assessment distinguishes
local fake-boundary proof from integration and live-provider acceptance.
