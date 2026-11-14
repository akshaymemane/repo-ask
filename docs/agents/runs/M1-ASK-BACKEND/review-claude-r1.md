# Review of M1-ASK-BACKEND at commit 3918ebddfaaff7745a0ef495176eaba04a8088e4: changes requested

**Review details:** base c0e15ea; packet `.git/opendevin-runtime/reviews/3918ebdd…/`; branch `task/m1-ask`. Reviewer is an independent Claude quality/security reviewer. I only read and searched code; I ran no tests. Every finding below comes from tracing the code. The reproductions are proposed checks for root to run. Dependency APIs (`IndexService`, `JobQueue`, `Worker`, `ProviderService`, schema6) were read from the author worktree `opendevin-m1-ask`, which carries candidate index d8f1005. Approving that index candidate is a separate gate and is not covered here.

## Blocking / major findings

**1. Major (security): source can be sent to a remote provider that forbids it.** `repoask/ask/conversations.py:215`
- The code passes `contains_source=bool(evidence)`. But the `prior_conversation` history (lines 186–206) includes earlier assistant answers that cite source and may quote excerpts.
- When the current search returns no hits, the flag is False. `ProviderService._enforce_policy` (`providers/service.py:452`) then skips the `allow_external_source` check, so source-derived history goes to a remote destination that forbids external source.
- Reproduction:
  1. Assign a remote profile with `allow_external_source=false` to the `ask` role.
  2. Send turn 1 so it completes with cited content (for example, with a local profile first, then switch).
  3. Send turn 2 with a prompt that matches no chunks, e.g. "can you rephrase that".
  4. Expected: blocked by policy. Traced: it is sent.
- Fix: set `contains_source=True` whenever `evidence` or any included history message has citations (or simply whenever scope is non-empty). Add a focused test.

**2. Major: the lease is not renewed during model generation, so long generations are lost and runs get stuck.** `conversations.py:211–237`
- The heartbeat (`context.checkpoint`) runs only before `generate`. The default lease is 30s (`DEFAULT_LEASE_MS`) but the default provider timeout is 60s (`validation.py:15`).
- Any generation over the lease fails the fence at line 237 with `LeaseLost`. The output is thrown away and the Worker swallows the error.
- Each reclaim regenerates and sends the source to the provider again.
- After `max_attempts`, `_reconcile` marks the job `failed` (`jobs.py:149`). The `answer_run` stays `running` forever because the `LeaseLost` path at line 268 never records a domain outcome. The `answer_active` unique index plus the guard in `send` (line 94) then block the conversation until the user cancels by hand.
- The existing lease test (`test_ask_services.py:113–117`) confirms this: it has to call `cancel` manually.
- This will affect root's real-model smoke test on local Ollama planning.
- Fix:
  - Renew the lease during generation (a heartbeat thread, or a bounded generation timeout below `lease_ms`).
  - Reconcile domain runs whose job is terminal (on `get_run`/`send`, or on the final attempt).
  - Test with a fake transport that sleeps past the lease.

**3. Major: any message between 4000 and 16000 bytes always fails.** `conversations.py:81` vs `routing.py:14` and `indexing/service.py:554`
- `send` accepts up to 16000 bytes. `RoutingService.route` rejects anything over 4000 (`text(prompt,4000)`), and `IndexService.search` rejects queries over 4000 characters.
- Such a message (a pasted stack trace, say) is recorded as `failed/invalid_output` without any provider call. `retry` fails the same way.
- Reproduction: `send(conv, 'trace '*1000, 'r')`, run the work, then check: state is `failed` and `transport.calls == 0`.
- Fix: limit `send` to the routing bound, or build a bounded retrieval query that is separate from the full prompt sent to the model.

**4. Major (routing, RT pins/explicit): any slash token is treated as a repository name.** `routing.py:34` and `routing.py:72–75`
- The regex `[\w.-]+/[\w.-]+` matches file paths and words like "src/worker.py", "read/write", "I/O", "client/server".
- Any such match that is not a candidate name forces `selected=[]`, `needs_selection` and `explicit_repository_unavailable`. This overrides valid pins, which the contract says should win.
- Reproduction: `route('Fix retries in src/worker.py', pinned_repository_ids=[repo])` gives `status=needs_selection` and `selected=[]`. An unscoped prompt "Explain acme/mail-worker retry in lib/retry.py" loses automatic scope adoption.
- The evaluation fixture has no path-bearing prompts, so the 100% recall does not exercise this.
- Fix:
  - Treat a qualified mention as explicit only if it matches the owner/name shape of a known catalog name.
  - Never let an unresolved mention override valid pins.
  - Add path-containing tasks to the evaluation.

## Minor findings (record with owner)

- `conversations.py:121`: `_stop` updates the `jobs` row directly instead of going through `JobQueue` semantics. A cancelled queued job gets no `finished_at`, which drifts from the queue contract.
- `conversations.py:244–246`: revocation mid-run fails as `invalid_output` instead of a scope/availability code, so the error code is misleading.
- `common.py:79–81`: `export_text` HTML-escapes and backslash-escapes the text. Rendered output is fine, but the raw implementation prompt gets mangled identifiers (`snake\_case`, `&quot;`). Revisit before M2 feeds it to an agent.
- `conversations.py:321–326`: conversation export covers only the first 100 messages and offers no way to export the rest.
- `conversations.py:60–64`: `get(conversation)` loads all runs with no limit.

## Verified by tracing (no blocking issues found)

- **Strict schema:** unknown keys and types are rejected; customization lists must be empty; path safety and the bool `blocking` check work; no ready or state fields are accepted.
- **Citations:** every citation is checked through `index.source` against the exact revision, scope and snapshot. Model plan citations must equal the evidence IDs. Evidence is rechecked before sending and again inside the final transaction.
- **Plan versions:** the server computes a SHA256 hash of the canonical content. Saving a new version checks the parent with compare-and-set. Old versions are immutable, superseded state is derived, every version pins `scope_revision`, and readiness is recomputed on read.
- **Readiness blocks on:** multiple write targets, blocking questions and `execution_not_configured`. Local repositories never report `implementation_enabled`.
- **Fencing:** checks cover `job_id`, token, owner and expiry, plus cancellation, scope revision and deletion. `JobInterrupted` is a `BaseException` and is not swallowed. Replay after commit but before acknowledgement does not duplicate the plan.
- **Deletion and purge:** content is redacted to tombstones. Routing re-reads drop revoked candidates.
- **Evaluation:** limitations are disclosed honestly (development set; the 24% README-mode result is kept).

Recommendation: changes requested. The author should fix findings 1–4 on `task/m1-ask` and resubmit a new commit for re-review. The minor items need an owner assigned by the coordinator.
