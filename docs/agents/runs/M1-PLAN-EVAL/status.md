# M1-PLAN-EVAL status

State: **gate passed** on Groq `openai/gpt-oss-120b`, 2026-11-16. The harness is
reviewed and integrated; the run used candidate branch `task/m1-fixes` (`2011387`),
whose fixes still need independent review.

| Provider | Result | Evidence |
|---|---|---|
| Scripted model (offline test) | 10/10, gate passed | `tests/test_plan_evaluation.py` |
| Groq `openai/gpt-oss-120b` (free tier, 8192 context / 4096 output) | **9/10 passed, 9/10 valid, gate PASSED** | `groq-gpt-oss-120b.json` (tasks SHA-256 `c4804e41…`) |
| Local Ollama `llama3.1:8b` (CPU) | stopped unfinished; too slow on CPU | — |

The run was started by the user with their own key; the agent never saw it. The
evidence file holds states, codes, counts, cited paths and token usage only.

## Per-task notes

- Every passing plan cited the expected file(s), kept the user's requirement terms and
  stayed `needs_input` (no execution configured). Cross-repository tasks
  (`quantity-limit`, `event-email`) named both repositories with the expected write target.
- `absent-feature` (Stripe refunds in a codebase without billing) completed with no
  citations and a blocking question rather than an invented plan.
- `blank-email`, `checkout-409` and `event-email` hit the free tier's 8000
  tokens-per-minute limit once each and passed after the harness's 30 s retry.
- **Failure: `vague-request` ("Make it better.")** — after a rate-limit retry, both
  model attempts were rejected by server plan validation (`invalid_output`). The model
  tried to plan rather than ask. Known limitation: for a request with no actionable
  goal, the product should ask a clarifying question before planning.

## Fixes found during the run (candidate `task/m1-fixes`, needs review)

- `ebc0a0b`: Groq's 413 "Request too large" → `context_overflow` with an actionable
  message; repair prompt names the failed rule; trailing-slash directory paths are
  normalized; plain-language thread errors.
- `2011387`: harness retries `provider_rate_limited`; CLI defaults sized for free tiers.
- `715bd5e`: deferred plan readability follow-up (`../M1-PLAN-UI-FOLLOWUP/notes.md`).
