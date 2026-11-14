Review finished. Verdict: **APPROVED** for exact commit `b6e0d50` (base `95b8f1e`).

**Original issue fixed.** Before this change, `request_index` could hand back a concurrent explicit run pinned to a revision. The scheduler only compared `profile_version_id`, so it saved the catalog signature against someone else's run. Now:
- The scheduler creates a fresh intent (`new_id("schedule")`, giving `schedule_<24 hex>`), which passes the service format check.
- It saves the signature only if the run it gets back has both the same `profile_version_id` and the same `scheduling_intent` (`scheduling.py:44-46`).
- If a run is already active, `request_index` returns it unchanged (`service.py:144-146`). That run has a NULL intent or an older intent, so the check fails, no signature is saved, and the scheduler returns False.

**Intent ownership.** Only a run inserted by this call can carry this intent (`service.py:152`). An old background run's intent won't match a new one, because each call makes a fresh intent. Pause, resume and retry are untouched, and `_public_run` still returns the same keys, so the intent never appears in public responses.

**Migration 8.** It is appended after 7, so earlier checksums don't change. It is a single `ALTER TABLE ... ADD COLUMN scheduling_intent TEXT`, nullable with no default, so existing rows get NULL. It runs through the normal runner, which takes a backup first and rolls back on failure.

**No HTTP exposure.** In `context_api.py:59`, the POST index allowlist is still `{'revision','priority','embedding_version_id','limits'}`. The parameter is also keyword-only and format-checked.

**No auto-retry loop.** Losing the race returns False and saves nothing. While the explicit run is active, `get_state` reports `active_run` and blocks new scheduling. Once that run ends, at most one background request per repo happens per bounded `run_once` tick. The explicit pinned revision never counts as the current catalog, which matches the contract.

**Test.** The new test triggers the race for real against the actual `IndexService`. It checks that no signature is saved, then ends the competing run and checks that the next run is the scheduler's own (no pinned revision, intent starts with `schedule_`). That is enough to cover the fix.

**Minor, not blocking.** If providers are configured but the scheduler passes `None` while the service fills in a version, the signature is never saved. That behaviour already existed before this commit; the scheduler takes its version from the same `providers.roles()` lookup, so it is unlikely in practice.

**Limits.** I only read and searched files. I did not run any tests myself. The test pass counts (4 scheduler, 41 indexing, 29 platform) come from `checks.txt`, so the integrator should confirm them on this exact commit.
