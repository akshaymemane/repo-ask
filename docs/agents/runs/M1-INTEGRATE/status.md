M1 integration in progress. GitHub/provider services independently approved; 117 combined Python checks pass after HTTP wiring and cooperative shutdown revision. Real local Ollama chat, structured JSON generation and two768-dimensional embeddings passed with synthetic content. No GitHub App credentials configured; no live account indexing or PR claimed. Index/catalog UI builders active. F03/F04 and runner milestones remain.

## M1 exit gate

- Routing evaluation: `tests/test_ask_routing_evaluation.py` passes.
- Plan evaluation: Groq `gpt-oss-120b` passed 9/10 tasks with 9/10 valid outputs; gate **PASSED** (`docs/agents/runs/M1-PLAN-EVAL/groq-gpt-oss-120b.json`).
- Known limitation: `vague-request` ended `invalid_output`.
- User real-use acceptance: GitHub is connected, and Ask and plans work on the user's repositories with Groq.
