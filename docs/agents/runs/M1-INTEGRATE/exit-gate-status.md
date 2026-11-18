# M1 exit-gate status

> Historical record of the M1 exit gate. M2 has since been completed; see `docs/agents/board.json` for current state.

Date: 2026-11-16

M1 implementation and independent component reviews are complete. Final sign-off is
waiting only for the user-generated Groq plan-evaluation artifact. The coordinator
does not request, read or handle the user's API key.

## Current green evidence

- Provider User-Agent post-merge review: approved; 42/42 provider/transport tests.
- Provider quick form: approved after binding source-sharing consent to the exact
  endpoint; focused 11/11 and author full UI 182/182.
- M1 plan-evaluation harness: independently approved; offline real-stack tests 3/3.
- M1 context operations: independently approved; focused Python 28/28 and Ask-recovery
  UI 18/18.
- Labeled repository routing evaluation:
  `PYTHONPATH=tests:. .venv/bin/python -m unittest tests/test_ask_routing_evaluation.py`
  — passed in 47.712 seconds.
- Combined integration regression after all approved M1 changes:
  - Python: 511 passed, 9 environment-dependent skips, 177.699 seconds.
  - UI: 182 passed, 0 failed, 11.739 seconds.
- The user reports the live connected app works smoothly on real repositories. The
  coordinator did not restart or inspect the live app/data on port 8765.

## Pending final evidence

The user runs the approved harness with their Groq credential and writes the
content-free result to:

`docs/agents/runs/M1-PLAN-EVAL/groq-gpt-oss-120b.json`

The gate requires at least 8/10 tasks passed and at least 9/10 valid outputs. Until
that artifact is present and verified, M1 remains `running`, not signed off.

## Open UX note (non-blocking, by design)

An unpinned Ask across repositories that have neither README nor description metadata
can route to “Which repository?” instead of guessing from code. The labeled plan
evaluation pins repositories because the bundled examples intentionally lack those
metadata fields. This preserves the product rule that ambiguous/absent routing must
not silently select writable scope; improving code-aware unpinned routing is a future
UX/retrieval enhancement, not an M1 correctness failure.

## Priority boundary

M2 and M3 are on hold by user direction. The clean M2-PRS candidate is parked without
review or integration, and no M2 pilot, publication wiring, M3 shaping or external
GitHub write is authorized by this checkpoint.
