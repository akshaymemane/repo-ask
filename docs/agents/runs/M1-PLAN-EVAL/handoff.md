# M1-PLAN-EVAL builder handoff

## Identity and scope

- Task: labeled plan evaluation for the M1 exit gate ("cited routing and plan
  evaluation pass", Master PRD §6). Routing is already covered by
  `tests/test_ask_routing_evaluation.py` (250 repositories, 50 tasks).
- Branch/worktree: `task/m1-plan-eval` / `opendevin-m1-plan-eval`
- Base: integration `bc35e4e`, plus cherry-picked `763b0f2` (= integration `475f451`,
  provider User-Agent fix).
- Author: Claude native, user-authorized, 2026-11-16. Review required; this handoff is
  not approval.

Changed only new files: `tests/plan_evaluation.py`, `tests/test_plan_evaluation.py`,
`tests/fixtures/plan_eval/tasks.json` and this run folder. No product code.

## What the harness does

- Composes `ApplicationServices`, `IndexService`, `RoutingService`, `PlanService` and
  `ConversationService` as `repoask/__main__.py` does, on a temporary data directory,
  with an in-process secret backend. Only the bundled examples are indexed.
- Pins each task's repositories (routing does not resolve the examples unpinned: they
  have no README/description, so the product asks "Which repository?" by design), then
  sends the prompt with `intent=plan` through the real worker, including server-side
  `bind_plan` / `PlanService.validate` and the single repair attempt.
- Scores per task: valid output; expected repositories; write target; a citation to an
  expected path; every citation resolves to existing source lines; steps and
  validation present; user requirement terms preserved (whole-token match); readiness
  never `ready` (no execution configured). Clarify tasks must ask a blocking question
  or produce no steps.
- Gate: at least 8/10 passed and at least 9/10 valid output.
- Evidence is content-free: states, codes, counts, cited paths, roles, usage, seconds.
  No prompts, plan text or source.
- A remote provider is allowed only inside the temporary workspace (local-only is
  turned off there because the corpus is synthetic). The key comes from
  `OPENDEVIN_EVAL_API_KEY` and is held only in process memory.

## Verification

- `PYTHONPATH=.:tests .venv/bin/python -m unittest tests.test_plan_evaluation`: 3 passed.
  A scripted careful model passes 10/10 through the real stack; a model that cites an
  evidence ID it was not given is rejected by the server (`invalid_output` after one
  repair) and scored invalid.
- Live runs: see `status.md`.

## Review focus

1. Do the labels and checks measure plan quality fairly, without rewarding a model for
   echoing the prompt? `preserves_requirements` checks goal, requirements, steps and
   findings, which include text the model writes.
2. Is turning off local-only inside the throwaway workspace acceptable given only the
   bundled examples are indexed?
3. The corpus is small (7 source files, 130 lines). It tests plan structure,
   citation discipline and scope behavior, not retrieval over large repositories.
