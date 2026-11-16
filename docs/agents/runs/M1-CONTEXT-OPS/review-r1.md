# M1-CONTEXT-OPS independent review — round 1

## Verdict

**APPROVED**

Reviewed these already-integrated commits:

- `3da764c65507d26a608d518ce77f3ee5e6b91654`
- `95b8f1e6c9db58365941fa7ea5486b1dfbbe81ab`
- `b6e0d5056081e8515d8e45f8045dde422b894ac8`
- `259a31a1f179da407fa85dd6fe3b6b9b96047b87`

The author was Codex coordinator work; this review was performed by a fresh,
independent Codex reviewer. No product source was changed during review.

## Findings

No major or minor findings.

## Review evidence

### Lifecycle and shutdown

- `ApplicationServices` freezes composition before worker start, registers only
  configured handlers, and the underlying `Worker` claims only those handler kinds.
- Safe work interrupted during shutdown is checkpointed and released without an
  attempt penalty. Work with an external effect is instead moved to
  `needs_reconciliation`; it is not silently replayed.
- The service joins its owned worker before vector/store teardown. The current
  provider interruption path also returns an in-flight Ask job to the durable queue.

### Scheduling state and intent fencing

- Migration 7 adds only content-free reconciliation state: repository ID, signature,
  run reference and request time. Migration 8 adds the scheduling intent used to
  distinguish background work from a concurrent explicit request.
- Queue capacity includes queued, running, waiting and paused runs. A configured
  embedding role must be verified before background scheduling; lexical operation
  remains possible when no embedding role is configured.
- The marker is committed only after the returned run is re-read and matches both
  the selected embedding version and the newly generated scheduling intent. The
  explicit/background race reproduction passes and leaves no false marker.
- Signatures survive restart, change with catalog/profile input, and are invalidated
  by explicit eligibility changes. One repository-domain failure does not prevent
  other eligible repositories from being scheduled.

### Legacy bridge, purge, and saved Ask

- Legacy repository listing, question, search, and exact-source paths consult the
  persistent source selection. Current exclusions and content filtering are applied
  before evidence/source access.
- Local purge disables retrieval first, removes the matching legacy in-memory/FTS
  mirror, deletes scheduling state, redacts saved answers, then performs physical
  cleanup. A cleanup failure leaves retrieval disabled, while a pending purge for
  one source does not prevent unrelated sources from bootstrapping.
- The CLI composes persistent indexing, routing, planning, conversations, and saved
  Ask without overwriting already assigned model roles. Saved conversations survive
  restart, and history/export pagination remains bounded and callable.
- Later context-recovery and Ask-shutdown changes were treated as dependencies in
  the current integrated runtime, not as substitutes for inspection of the four
  candidate commits above.

## Checks run

```text
PYTHONPATH=tests:. .venv/bin/python -m unittest -v \
  test_application_services test_index_scheduling test_legacy_context_bridge \
  test_context_metadata_refresh test_ask_composition test_saved_api_boundary \
  test_ask_shutdown test_index_schema_upgrade
```

Result: **28/28 passed**.

```text
REPOASK_TEST_PYTHON=.venv/bin/python node --test tests/ui/ask-recovery.test.mjs
```

Result: **18/18 passed**.

An earlier package-qualified Python invocation passed the first 26 checks but could
not import `tests.test_ask_shutdown` because that fixture imports
`test_ask_services` as a top-level module. Re-running with the repository's required
`PYTHONPATH=tests:.` completed successfully; this was a command-environment issue,
not a product failure.

## Known scope limits

- This review used synthetic/local stores and transports. It did not access a live
  GitHub account, start a Manifest flow, transmit private source, or touch the live
  application on port 8765.
- Real-model and real-account exit-gate evidence remains separate from this code
  review.
