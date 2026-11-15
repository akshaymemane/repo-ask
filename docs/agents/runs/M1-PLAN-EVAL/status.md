# M1-PLAN-EVAL status

State: review candidate (harness). Live gate evidence pending.

| Provider | Result | Evidence |
|---|---|---|
| Scripted model (offline test) | 10/10, gate passed | `tests/test_plan_evaluation.py` |
| Groq `openai/gpt-oss-120b` | pending: run by the user with their key | `groq-gpt-oss-120b.json` |
| Local Ollama `llama3.1:8b` (CPU) | baseline, pending | — |

Related fixes found while setting up the Groq provider (each needs independent review):

- `475f451` on integration (`task/provider-user-agent` `54fd24f`): provider requests
  send `User-Agent: OpenDevin-local`. Cloudflare in front of api.groq.com returned 403
  (error 1010) to urllib's default User-Agent, which the service reports as
  `provider_auth`. Cherry-picked onto integration by user decision before review.
- `task/provider-quick-form` `ae02d59` (not integrated): the quick "Add OpenAI-compatible
  provider" form declares structured output and offers an explicit source-sharing
  opt-in for remote base URLs.
