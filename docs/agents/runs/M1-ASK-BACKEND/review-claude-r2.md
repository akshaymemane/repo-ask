**Verdict: approve `dd2931fff0ec4fba334cfe14ba7b5c3cd20b5dcd` against base `3918ebd`, with one condition.** Root's full 169-test run with sockets enabled must pass before integration. I only read and searched; I ran no tests. Every point below comes from tracing the code. The test counts are the author's claims, and I have not seen root's rerun result.

Task M1-ASK-BACKEND, branch `task/m1-ask`. I traced the packet's `diff.patch`, `snapshot/` and `ask_api.py`, plus these dependencies in the `opendevin-m1-ask` worktree: `jobs.py`, `worker.py`, `db.py`, `providers/service.py`, `providers/validation.py` and `indexing/service.py`.

## The four major findings: all resolved

1. **Source in history: fixed.** `conversations.py:301` now passes `contains_source=bool(scope or evidence or history_has_source)`.
   - Any non-empty scope always sets the flag. A run with no scope can't carry cited history, because lines 271–272 drop any message citing outside the scope.
   - History citations and scope are checked again just before the call (lines 295–299).
   - `_enforce_policy` (`service.py:452`) runs before the transport. The test shows zero calls reach the transport, and the opt-in test shows the earlier answer is actually sent.

2. **Lease renewal and stuck runs: fixed.**
   - A renewal thread (lines 163–186) heartbeats every `lease_ms/3`, capped at 5 s. It re-checks the lease, owner, expiry, cancellation and scope under the shared lock before each heartbeat, so an expired lease is never revived. It is joined before returning.
   - It can't deadlock: the lock is re-entrant, `read()` doesn't open a transaction, and the provider holds no lock while sending.
   - `Worker` has no heartbeat thread of its own, so the 1.5 s-against-1 s test really exercises the Ask renewal.
   - When ownership is lost, the cancel event fires and the provider call is cancelled. The fence in the error handler then raises `LeaseLost`, so nothing is written.
   - `_reconcile_run` maps finished queue states correctly: `cancelled` → cancelled, failed with `lease_expired` → failed/`lease_expired`, anything else → `job_terminated`. It runs on `get_run`, `list_runs`, `get`, `send` and `retry`.
   - A run that finishes before the queue acknowledgement is already completed, so reconciliation never touches it.

3. **Long messages: fixed.** `retrieval_query` cuts to 3000 bytes without splitting a UTF-8 character. That fits under routing's 4000-byte check and the index's 4000-character limit. The model gets the full prompt of up to 16000 bytes. The plan's `user_request` limit is also 16000, so a plan can echo it back. Oversized input is rejected before anything is saved.

4. **Slash tokens: fixed.** Slash tokens count as an explicit repository only if they exactly match a current catalog name. They are left out of short-name matching and catalog search terms. Pins win (line 73), and the conversation scope becomes the pins. The tests cover paths, read/write, I/O, client/server, an unknown `owner/repo` with a pin, and scope adoption.

## Owned minor findings: all resolved

- Cancelling a queued job now sets `finished_at` and clears old errors in the same transaction.
- Mid-run revocation now reports `scope_unavailable`.
- Export text is no longer escaped, so identifiers come through intact.
- `export(limit, cursor)` returns a `next_cursor` you can pass back.
- `list_runs` is paginated, and `get` caps runs at 100 with `runs_truncated`.
- Run lookup for messages is limited to the returned page.
- Public provenance exposes only `kind` and `host`. Endpoint validation rejects user/password in the URL (`validation.py:76–78`), so `host` can't leak credentials. Retry clears old provenance.

The earlier plan, citation and version checks are unchanged (`plans.py` isn't in the diff). The root HTTP adapter (`ask_api.py:28–33`) wires export and `runs` with validated `limit`/`cursor` and returns JSON.

## New minor issues (none block approval)

1. **An unknown `owner/repo` mention is now silently dropped** (`routing.py:41–76`, RT-02 "report missing access"). `catalog_candidates` skips repositories the user can't access, and the old `explicit_repository_unavailable` path was removed. Example: with `owner/billing` connected and no pins, "Fix billing invoices in acme/billing" auto-selects `owner/billing`, and nothing says `acme/billing` wasn't found. Suggested fix: if an unresolved slash token's last part matches a candidate's short name, skip the short-name auto-select and set a degradation code. Owner: author, as a follow-up.

2. **A temporary storage error during renewal aborts generation** (lines 177–178). A `StorageBusy` from `heartbeat` sets the cancel event even though the lease is still valid. The run then fails with the provider's cancellation code, which is misleading. Suggested fix: retry once within the interval before aborting. Owner: author.

3. **The plan export test is weaker.** The checks for `<script>` and ```` ```hidden ```` were removed (`test_ask_services.py:802`). The output is still called `markdown`, but it is now raw text. That is safe only while the UI shows it as plain text. Suggested fix: add a check that markup comes through verbatim. Owner: root/UI.

## Tracing vs test runs

- **Traced by me:** all of the above.
- **Author's claims, not seen run by me:** 27 focused tests passed, 162 of 169 in the full run, and the routing results in `routing-results-r1.json`. The 7 errors are the known sandbox socket-bind failures in the HTTP tests.
- **Root's job:** the full 169-test run with sockets enabled, which has started but has no result yet. If it shows any failure, this approval is void until it's fixed.
- Index d8f1005 and real-model quality remain separate gates and are not covered by this approval.
