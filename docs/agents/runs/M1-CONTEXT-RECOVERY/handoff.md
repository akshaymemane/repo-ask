# Builder handoff — M1-CONTEXT-RECOVERY

## Identity

- Author/harness: native Codex `/root/context_recovery`, explicitly assigned platform and experience recovery slice.
- Branch/worktree: `task/m1-context-recovery`, `../opendevin-m1-context-recovery`.
- Base: `95b8f1e6c9db58365941fa7ea5486b1dfbbe81ab`. Submitted SHA: coordinator can resolve task branch HEAD after commit.
- Task/requirements: `task.json`; F02 IX-03/IX-10/purge restart acceptance; F11 UX-08/UX-10/UX-11.
- Status: candidate for independent exact-commit review. No integration or approval claim.

## Delivered behavior

Completed context purge retains a content-free `{"purged":true}` registry marker. Ordinary demo registration preserves that marker and cannot repopulate cached source. Public repository state adds boolean `purged` and `purging` flags. Startup skips purged/purging mirrors and scheduler markers; other sources remain usable. Failed purge can be retried while Enable remains blocked.

ApplicationServices keeps only configured identities/paths and a trusted demo-loader factory, rather than a snapshot restore cache. Explicit Enable rereads the configured local committed snapshot or bundled demo and restores its filtered legacy mirror. A purged source absent from current application configuration cannot restore. Unknown HTTP fields, including host paths, remain rejected. Pending selection/purge operations are serialized by an application lock. GitHub selection remains authoritative; a new eligibility grant clears a completed marker, while pending cleanup remains blocked.

`ContextAPI` and `FeatureAPI` add an optional `select_context` callback. ApplicationServices provides that callback; direct adapter consumers retain their previous raw IndexService selection behavior. `IndexService.register_demo(snapshot, *, restore=False)` adds an internal explicit-restore flag. Root's existing `request_index` and `_public_run` methods are untouched. No schema, dependencies or shared main changes.

`CodeIndex.restore(snapshot, exclusions=())` rebuilds a single enabled mirror from filtered source. Initial legacy mirrors now also apply the existing indexing path/inline-secret policy before FTS insertion. Bootstrap supports `CodeIndex([])` and restores only eligible, unpurged sources. Coordinator plans to switch shared main to empty initial mirrors; until then current main builds and bootstrap removes purged transient mirrors before serving requests.

Exclusion saves capture the submitted draft, disable textarea/discard while pending, and clear a draft only if its value still matches that submission. Newer programmatic edits survive successful completion; failures restore editing and retain the draft.

## Changed scope

- `repoask/{api.py,context_api.py,services.py,index.py}`.
- `repoask/indexing/service.py`, excluding root-owned `request_index`/`_public_run`.
- `repoask/web/context.js`; `tests/ui/context.test.mjs`.
- New `tests/test_context_purge_recovery.py`.
- Coordinator-approved single stale expectation in `tests/test_indexing_review.py`: explicit `restore=True` after purge.
- This task's own artifacts only.

## Verification

Final exact-tree counts will be appended below. Earlier focused run: 17 Python checks passed, covering six new recovery scenarios plus existing metadata/API/legacy checks. Existing 40 Node checks passed, including two new pending-save regressions. An earlier 185-test Python run passed before the final ordinary Exclude → restart → Enable regression; final full run includes that sixth scenario.

Recovery checks use real migrated SQLite, durable close/reopen, IndexService/ApplicationServices/FeatureAPI, real local Git committed snapshots, and synthetic bundled fixtures. They cover target-only erasure, another source surviving, explicit restoration, invalid/unconfigured restoration, failed cleanup/retry, GitHub re-selection, and disabled-source mirror restoration. No model, network or live-account success is inferred. No new browser layout/assistive-technology acceptance was run; root owns browser verification.

## Risks and next action

- Independent reviewer must check this exact commit, especially erasure/re-enable, shared composition and UI pending requests.
- Coordinator should switch main to `CodeIndex([])` before bootstrap, release startup snapshot references after bootstrap, and record the additive service contract changes.
- Source originals (user's checkout and packaged demo files) are retained; purge removes workspace-derived records/mirrors. Secure erasure of SQLite free pages, WAL/backups and operating-system storage remains the broader F12 retention responsibility.
- No migration/configuration secrets needed. No push, PR or account mutation performed. No owned service background processes were started; only bounded tests.

## Self-evaluation — ecc:agent-self-evaluation

Applied this skill to the multi-file recovery change.

| Axis | Score | Evidence / improvement |
| --- | --- | --- |
| Accuracy | 4/5 | Real close/reopen and API selection regressions pass; independent exact-commit review remains pending. |
| Completeness | 4/5 | Both assigned failures covered with failure/retry cases; coordinator-owned main startup change remains to avoid transient mirrors. |
| Clarity | 4/5 | Public flags, internal explicit restore and callback are documented; services.py still carries several legacy compatibility responsibilities. |
| Actionability | 4/5 | Scoped commit and reproducible tests ready for reviewer; root must integrate and run browser verification. |
| Conciseness | 4/5 | One restoration helper avoids duplicated filtering; six lifecycle tests add length because their failure conditions differ. |

Overall 4.0/5. Highest-impact next step: exact-commit review, then shared-main empty-mirror startup and browser acceptance. User-facing erasure behavior is covered; broader product milestones remain coordinator-owned.

## Final exact-tree verification

- `../repo-ask/.venv/bin/python -m unittest discover -s tests`: **186 tests, all passed**, 19.376 seconds.
- `node --test tests/ui/`: **40 tests, all passed**, 4.080 seconds.
- `PYTHONPATH=tests ../repo-ask/.venv/bin/python -m unittest test_context_purge_recovery test_context_api test_legacy_context_bridge test_context_metadata_refresh`: **17 tests, all passed**.
- `git diff --check` and `node --check repoask/web/context.js`: passed.

No test sessions remain running. All implementation checks precede independent review.

## Independent review correction R1

The reviewer found that the demo loader and recovery tests used project-root `examples`, while packaged fixtures live under `repoask/examples`. The original demo tests therefore exercised empty snapshots, and their earlier passing counts did not establish successful real demo restoration. Corrected the loader to the package directory and the test fixture path independently.

Recovery now explicitly requires nonempty demo snapshots and four files for orders-api. It verifies exact OutboxPublisher.java content in both the restored legacy mirror and cached metadata, then runs the real indexing worker and resolves stored source containing `public class OutboxPublisher` and `public void publishPending()`. Six focused recovery tests pass with these assertions; the corrected full run passed all 186 Python tests in 57.992 seconds. No other production scope changed.
