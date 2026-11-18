# LAUNCH-ROUTE-CONSUMED independent review

## Verdict

**APPROVED** for the exact commit below. Round-2 finding 2 is resolved. No new actionable findings within the assigned scope. Integration remains the coordinator's responsibility; this review does not certify release CI.

## Reviewed commit

- Commit: `aed15f089c8426fbdec368e352d58c521a71f321`, branch `task/route-consumed`; author: Claude; reviewer: independent Codex.
- Diff: `git diff dbfa110..aed15f0`. HEAD matched the submitted commit.
- Inputs: AGENTS.md, workflow, quality-reviewer persona, Master PRD, F03/F04, M1 Ask contract, board's LAUNCH-ROUTE-CONSUMED card, launch handoff, review-r2 finding 2 and review-r3. The user's assignment defines this review's scope. Coverage: RT-02/05/06/07/09/10, ASK-01/02, migration integrity and deletion/purge privacy.

## Findings and assessment

No blocking, major or minor defects found in this diff.

- **Migration correctness and append-only integrity:** migration 14 appends an INTEGER nullable consumption marker and a transactional backfill; migrations 1–13 retain identical versions/checksums compared with `dbfa110`. The runner still validates recorded checksums before applying pending migrations and atomically records migration/checksum/user_version. Independently executed the real runner from schema 13 through 14 and reopened it idempotently. Existing foundation tests cover mismatch/failure handling and backup behavior.
- **Backfill safety (`repoask/platform/migrations.py:49`):** normal routing only stores `resolved` when selection is nonempty, so `status='resolved' AND selected_json='[]'` distinguishes the interim status-only retirement from genuine resolutions. All production selection writes use canonical JSON; valid resolved and pinned selections remain unchanged. Missing/revoked pins can have empty selection, but their normal status is `needs_selection`; if the interim code retired them, the backfill correctly restores that state and retains pins. Purge/delete blank the prompt and set `no_match`; the additional nonempty-prompt predicate also protects blank resolved tombstones. Independent upgrade fixtures covered interim, real resolved, valid pinned, interim missing pinned, purged and blank resolved rows.
- **Historical limitation:** the interim code discarded whether an empty-selection decision originally had `no_match` or `needs_selection`. Migration 14 conservatively uses `needs_selection` and uses decision creation time as the consumption marker; this is not a recovered selection time or an exact reconstruction of the original outcome. The consumed marker prevents either case resurfacing. This is an unavoidable limitation of those old rows, not a new runtime regression.
- **Historical API/consumption:** `update_scope` records consumption without changing outcome/selection, and preserves the first marker. `pending_route` checks the marker on the latest decision without falling back to older routes. Independent real-service add → clear probes now return historical `needs_selection`, empty selection, `select_repositories`, and the selection question, with no pending route. A separate original `no_match` decision stays `no_match`; a fresh unresolved route becomes pending normally. This resolves the inconsistent `resolved`/empty-selection output from r2/r3. Existing eligibility filtering in `routing.get()` remains intact.
- **Privacy:** delete and repository purge still redact prompts, candidates, pins and selection regardless of status/consumption. Independent consumed add → clear → delete and add → clear → purge probes verified empty historical prompt/arrays and no pending route. No consumption-dependent purge bypass was found.
- **Contract note (`docs/contracts/m1-ask-plans.md:182`):** correctly distinguishes consumption from routing outcome for new decisions. Its “never rewritten” wording is scoped to choosing repositories; existing eligibility rechecks, privacy redaction and the one-time legacy backfill still apply. No API promise of immutable access to revoked source is introduced.

## Checks

All Python commands used `PYTHONDONTWRITEBYTECODE=1` and `./.venv/bin/python`, without installing packages.

- `-m unittest discover -s tests -p test_platform_foundation.py`: **17 passed**, 0.744s.
- `-m unittest discover -s tests -p test_provider_claude_cli.py`: **9 passed**, 8.312s; migration-upgrade assertions use `LATEST_VERSION` and pass at 14.
- `-m unittest discover -s tests -p 'test_ask*.py'`: **46 tests, 45 passed, one error**, 115.246s. `test_cli_model_seeds_missing_roles_without_inference_or_overwriting_saved_choices` fails at `tests/test_ask_composition.py:44` on loopback bind with `PermissionError: [Errno 1] Operation not permitted`, matching r2/r3's sandbox restriction. Both changed Ask tests pass. This suite is not reported green; unrestricted confirmation remains with the coordinator.
- Independent real schema-13 → schema-14 upgrade/reopen, prior checksum comparison, backfill matrix, real Ask add → clear/history/fresh-route and consumed delete/purge probes: **passed**. Scratch databases were temporary/in-memory; provider transport/source were injected test fixtures, not live inference.
- `git diff --check dbfa110..aed15f0`: **passed**.

Only this review file was written by the reviewer. No source/test edits, commit, publication or merge. No hosted CI, live model, Docker, browser acceptance or concurrency stress testing performed.
