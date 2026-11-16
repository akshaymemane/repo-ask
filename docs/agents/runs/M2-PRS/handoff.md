# Builder handoff — M2-PRS round 2

## Identity

- Author: Codex runtime builder, original author; no delegated agents or independent approval claimed.
- Branch/worktree: `task/m2-prs-r2`, `/Users/apple/workspace/vibe-coding/opendevin-m2-prs-r2`.
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

Interpreter for all commands: `/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python`.

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
