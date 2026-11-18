# Builder handoff — M2-FOLLOWUPS-REPO-OFF

## Identity

- Author/harness: Codex (this task session).
- Persona: platform/retrieval; branch `task/repo-off-status`; worktree `.`.
- Base SHA: `9766f5a750fc5596decc8a32d6e8e65cb75e9939`.
- Submitted commit: `acc985f` (test/investigation). Final evidence updates remain uncommitted: the subsequent `git add` and `git commit` were denied creating the worktree Git `index.lock` (Operation not permitted).
- Task card: user assignment for M2-FOLLOWUPS-REPO-OFF; no separate card exists in this checkout.
- Requirement coverage: GH-03, GH-05, GH-08, IX-01, IX-09, IX-10.
- Status: review; pilot defect remains unreproduced.

## Outcome

Could not reproduce the pilot's persistent `Off` status. No backend or UI fix is
claimed or made. A failing regression was sought first; all lifecycle probes passed
against the unchanged backend. Added `tests/test_repo_off_status.py` to preserve the
investigation as a behavioral regression check rather than invent a root cause.
Changed records are confined to this task directory; all edits are within scope.
Consumed the existing `docs/contracts/m1-indexing.md` contract; no contract changes.

The synthetic fixture exercises actual GitHubService, persistent SQLite, jobs,
IndexService and ContextAPI. Source acquisition is injected immutable source; GitHub
transport is the existing synthetic fixture. Each ordering completes an index and
checks the same snapshot remains searchable and visible through two successive
`GET /api/context/repositories` projections:

- source registered while Use in Ask is off, then selection enabled;
- source created after the enable notification;
- indexing listener installed after selection is already enabled;
- catalog Sync, verified installation callback and another Sync;
- Allow changes on/off/on with Use in Ask retained;
- authoritative empty discovery (selection stays on, eligibility false, snapshot
  hidden and search rejected), followed by rediscovery and recovery;
- close SQLite/vector stores and reconstruct services from persisted state;
- disable/re-enable Use in Ask after restart, confirming source is hidden while off.

All observed selected/access-enabled source rows retain `index_enabled=1`.
`index_sources.index_enabled` defaults to 1, so missing the initial eligibility
notification before lazy source creation does not alone explain the pilot.
The false listener branch cancels active index runs rather than setting this bit to
0. In scoped production code, GitHub source bits are set to 0 by purge, not refresh
or Allow changes. These observations are not proof of the pilot's actual state.

## Verification evidence

| Requirement | Command or scenario actually run | Result / evidence |
| --- | --- | --- |
| GH-03/05/08, IX-01/09/10 | `../repo-ask/.venv/bin/python -m unittest discover -s tests -p test_repo_off_status.py` | PASS, 1 test with three lifecycle orderings, 2.797 seconds (final focused run) |
| Existing GitHub/indexing integration | `../repo-ask/.venv/bin/python -m unittest discover -s tests -p test_indexing_github.py` | PASS, 1 test |
| Existing catalog regressions | `../repo-ask/.venv/bin/python -m unittest discover -s tests -p test_github_service.py` | PASS, 30 tests, 14.188 seconds |
| Existing regressions | `../repo-ask/.venv/bin/python -m unittest discover -s tests` | INTERRUPTED, exit 130 after repeated errors/failures and long session waits; interrupted in `test_lost_lease_fences_every_later_write`, waiting for agent start. No complete totals |
| First full-suite error isolation | `../repo-ask/.venv/bin/python -m unittest discover -s tests -f` | FAIL, 11 tests, 1 error: `test_cli_model_seeds_missing_roles_without_inference_or_overwriting_saved_choices`, `tests/test_ask_composition.py:44`, loopback bind denied with `PermissionError: [Errno 1] Operation not permitted` |
| Patch hygiene | `git diff --check` | PASS |

No live GitHub calls, browser pilot or UI changes; UI test not required. No test
failed with the reported backend mismatch, so there is no red-to-green fix evidence.

## Risks and next action

- Pilot issue is unresolved. Claude should compare the affected running app's
  content-free catalog/context flags and purge markers with these passing scenarios.
  Useful fields: catalog index/access flags, connection/installation states, source
  index bit and purging/purged markers. No private source or credentials needed.
- Existing UI already labels catalog `access_state=inaccessible` as `No access`.
  No new label was introduced without reproducing the contradictory state.
- No migrations or configuration changes; no publication or integration performed.
- Reviewer: Claude; review the exact submitted commit and the limits of this evidence.
- Both test command sessions have exited. Process inventory via `ps` was denied by
  the sandbox; no claim is made that an independent child-process inventory passed.
- The full suite is not green; remaining errors/failures were not individually
  diagnosed. Only its first isolated error is established as a sandbox restriction.

## Coordinator follow-up (Claude)

- Ran the current integrated code's status projection offline (no server, no GitHub calls, no keychain) against a copy
  of a post-pilot workspace database containing the pilot repository `gh:1460459675` (5 sessions, 1 publication):
  `eligible=True`, `status=ready`, active snapshot present, `github.is_eligible=True` → the Repositories page shows
  "Indexed", not "Off". Content-free flags: catalog index on, access accessible, source index on, no purge markers.
- An older workspace (pre-pilot) shows repositories whose installation was revoked; those render "No access", not "Off".
- Conclusion: not reproducible on the integrated code with the pilot's own data or in the lifecycle orderings above.
  Keep the added lifecycle test as regression coverage; reopen with the content-free flags if it recurs.
