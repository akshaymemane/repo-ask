**APPROVED: exact commit `8d5ce2f66286613635fe8a32f69077bcde178965`** (base `041901a`). No major findings.

I only read and searched the review packet and the code around it. I did not run any tests. The 230/230 pass and the passing 8-second shutdown test are the author's reported results from `checks.txt`, not my own.

**What I verified**
- **Cancel relay:** while a provider call is in flight, the lease-renewal thread checks `getattr(context,'shutdown_requested',False)` on every attempt (`conversations.py:172`). On shutdown it records `JobInterrupted` and sets `event`, which is the same object passed to the provider as `cancel_event`.
- **No failed answer:** `ProviderService._send` turns a transport cancel, or a response that arrives after cancel, into `ProviderCancelled` (an `Exception`). The context manager's `except Exception` swaps that for `errors[0]`, which is `JobInterrupted` (a `BaseException`). That skips both the `except (LeaseLost,CancelledError)` and the `except Exception` failure paths in `run_answer`, so no `failed` row is written.
  - If the provider returns normally after shutdown was flagged, line 202 still raises `JobInterrupted`. That path is also covered.
  - Other `BaseException`s pass through `finally` with `stop.set(); thread.join()`, so the renewal thread is always joined.
- **Requeue:** `ask.answer` jobs are created with the default `effect='safe'`. On `JobInterrupted`, `Worker` calls `release_safe`, which sets the job back to `queued`, gives back the attempt (`attempts-1`), and cancels instead if a cancel was already requested. `answer_runs` stays `running`. That is not a terminal job state, so it won't be marked failed or cancelled. On restart the fence lets the run proceed, and the existing user message is reused, so you get exactly one user and one assistant message.
- **Lease rules unchanged:** each renewal attempt still fences before heartbeating, and there is still no path that revives an expired lease. The StorageBusy retry and `stop.wait` exits are unchanged.
- **Source policy unchanged:** citation and eligibility checks before sending source and at finalize are untouched.
- **API back-compat:** `ShutdownContext.shutdown_requested` is a new read-only property. Direct `Worker`/`JobContext` callers don't have it, and the `getattr` default of False keeps them working. Existing members (`checkpoint`, `cancel_requested`, `queue`, `lease`, `lease_ms`) are unchanged.
- **New budget tests:** they check behaviour, not implementation.
  - Chat-only requests have no `format` field.
  - With no evidence, the schema allows only an empty `citation_ids` list (`maxItems:0`, no `enum`).
  - Plan requests have no `format`, stay within the prompt budget, and save one plan.

**Non-blocking notes (follow-up for the coordinator)**
1. **Minor: the 8-second proof uses only the fake transport.** The production `UrllibTransport.send` (`providers/transport.py:103-109`) only checks `cancel_event` inside `_read_bounded`, which runs after response headers arrive. A non-streaming chat call blocks in `opener.open` until the model finishes or `timeout_seconds` runs out. So in production, `close()` is limited by the provider timeout, not by about 5 seconds. This is outside this diff (transport card). Either record it as a known gap or have the transport card make connect/header-wait cancellable.
2. **Minor: the test has little timing headroom.** With `lease_ms=120000`, the renewal interval is 5 seconds, so shutdown is noticed after up to 5 seconds against an 8-second limit. It could flake on a slow CI machine. Also, `self.fail` inside the transport callback runs on the worker thread. That failure would show up as a `ProviderUnavailable` error and a failed run, not as a direct test failure. It's still caught by the later assertions, just less clearly.
3. **Info: a shutdown that lands just as a provider call succeeds discards that result.** After restart the run sends the request to the provider again. This fits the `safe` job semantics (no duplicate messages), but it can mean one extra billed call. Worth documenting.

Integration decision is the coordinator's. I made no edits, spawned nothing, and made no account calls.
