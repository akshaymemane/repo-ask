# M2-SESSION-UI independent quality review — round 1

Verdict: **APPROVED**, with one acceptance item explicitly deferred to F06, for
candidate `74cac0e` (handoff `8736d27`).

Reviewer: Claude independent quality reviewer, 2026-11-15. Read-only. No model, Docker
or account calls. No edits to the author's branch.

The candidate's `repoask/web/sessions.js`, `repoask/web/ask.js` and
`tests/ui/session.test.mjs` are byte-identical to `work/opendevin-integration` at
`1fa296f`. They entered integration before this review, by user decision. The
approved UI-REDESIGN branch (`b830f7a`) has since replaced the session page layout,
keeping the request, polling, unknown-outcome and redaction logic reviewed here. This
review covers that logic and its fit to the integrated backend.

## Evidence

- On the integration checkout, with the real backend present:
  `REPOASK_TEST_PYTHON=.venv/bin/python node --test tests/ui/session-services.test.mjs tests/ui/session.test.mjs`
  passed **15/15**. This includes the two real-service tests that could not pass
  before M2-SESSIONS integrated:
  - immutable launch, durable message replay, diff and checks, retry, and access redaction;
  - real execution-profile limits, local-only enforcement and deletion history.

  That closes the main open item in the author's self-evaluation. Note that the
  integration checkout also contains Codex's uncommitted execution wiring at review
  time; it does not change these modules.
- Field-by-field check of the UI against `SessionService` projection
  (`repoask/sessions/service.py:612-635`) and `attempt._usage`. These all match:
  - `limits.runner` and `limits.agent`;
  - `execution.*` plus `destination`;
  - `usage.tokens`, `reported_cost_usd` and `observed_model`;
  - `pending_question {id, prompt, redacted}`;
  - `runner.containment`, `capabilities`, `source_available` and `successor_id`;
  - events `next_seq` and `has_more`;
  - validations `command`, `output_redacted` and `fully_validated`.
- The UI's terminal-state set equals `service.TERMINAL`.
- Launch sends exactly `{plan_version_id, content_hash, idempotency_key}`, keeps one
  key per saved version, and reuses it after an unknown outcome.
- Source revocation clears diff, checks, messages, questions and activity, and replays
  redacted history.

## Acceptance

| Card criterion | Result |
|---|---|
| Replay, refresh, stop and check outcomes are distinguishable | Met (fixture and real-service tests) |
| Real session service connected before review | Met on integration |
| PR preview/publication action and failure status use the real F06 service | **Deferred.** F06 (M2-PRS) is not built. The UI shows the saved publication policy and says publishing is unavailable. |

## Notes (non-blocking)

1. Stop is disabled for a terminal session unless containment is `failed`. The
   backend writes `terminated` or `containment_failed` together with the terminal
   state (`attempt.py:976`), so terminal plus `pending` should occur only in
   crash-recovery windows. Allowing a repeat stop for terminal sessions whose
   containment is `pending` or `unknown` would be safer.
2. A pending message draft is kept in `sessionStorage`. It holds the user's own text,
   not repository source. It is cleared when revocation is observed while the page is
   open, but not when revocation happens while the page is closed.
3. The full Python suite still stalls in `tests/test_ask_shutdown.py`
   (`services.close()` waiting on `thread.join()`). This is pre-existing and not caused
   by this UI, but it remains an integration gate.
