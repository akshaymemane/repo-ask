# M1-INDEX status — R2 resubmission

Phase: R2 implementation verified; Git staging sandbox-blocked; awaiting coordinator commit and new exact review.
Original db85564 -> schema5 e7c4a5e -> original d8f1005 -> R1 fix / R2 review base
469954f9a6bedc003d7de1e61c3074f2b5a711b7. Current HEAD is that reviewed commit.

N1 fixed: three consecutive transient failures terminal; ten rate-limit automatic
retries maximum, honoring retry_at; separate durable counters; progress may reset
transient streaks. Worker/time waits30s/5s do not inflate network backoff. Small
profile contexts skip only oversized vectors before calls with honest coverage.

41 focused checks pass (all original34 preserved);142 socket-independent regressions
pass. Both full147-test suites attempted; only the five sandbox socket-bind errors.
Default Python additionally skips optional dependency checks; dependency interpreter
has no skips/assertion failures. Compileall and diff whitespace checks passed.

Public signatures stable. No shared platform/WAL/Ask/API/web/board edits; root's
898eaae is separate. No agents, packages, accounts or live source/model calls.
Awaiting coordinator commit if Git remains sandbox-blocked, then new exact review.
