# LAUNCH-SESSION-PURGE review — Claude, round 2

Verdict: **CHANGES_REQUESTED** (one small efficiency fix)

- Reviewed commit: `71a5720` (rebased onto `6127819`). Round-1 findings 1 and 2 are resolved: Retry/Stop are hidden on
  purged sessions, a saved-plan link replaces them, and the deletion date appears once.

## Finding

1. **Minor — opening a purged session scans every saved plan.** `repoask/web/sessions.js` (purged branch of refresh):
   when the tombstone lacks `plan_id`, the UI pages through `/api/plans` and requests
   `/api/plans/{id}?version_id=…` for each plan until it finds the version — O(number of plans) requests every time a
   purged session is opened. The `sessions.plan_id` column is retained by the purge. **Fix:** add `plan_id` to the
   purged projection in `SessionService.get()` (additive field; note it in docs/contracts/m2-sessions.md), cover it in
   tests/test_sessions_purge.py, and remove the client-side scan.
