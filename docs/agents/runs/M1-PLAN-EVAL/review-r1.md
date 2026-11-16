# M1-PLAN-EVAL independent review — round 1

Verdict: **APPROVED** for exact source commit `727468f` and documentation
head `3c28a74e180c207d786c982eb351989a99e2c797`.

Reviewer: fresh native Codex reviewer, 2026-11-16. I made no product-source
changes, did not read/request/use any provider credential, and did not run live
Groq or other model inference. This approves the evaluation harness and labels;
it does not supply or approve the still-pending live model result.

## Evidence

- `PYTHONPATH=.:tests .venv/bin/python -m unittest tests.test_plan_evaluation -v`
  passed **3/3** in 3.427 seconds.
- The careful scripted planner traverses the actual temporary
  `ApplicationServices` / indexing / routing / conversation / plan stack and
  passes all ten labels. The invented-evidence case is rejected by the real
  server after its one repair attempt and is scored invalid.
- The changed-file scope is additive evaluation data/code and task-local docs:
  `tests/plan_evaluation.py`, `tests/test_plan_evaluation.py`,
  `tests/fixtures/plan_eval/tasks.json`, and `docs/agents/runs/M1-PLAN-EVAL/**`.

## Review conclusions

1. **The gate matches the M1 exit criterion at an appropriate bounded level.**
   It requires at least 8/10 complete per-task scorecards and at least 9/10
   server-valid outputs. A normal plan must use the expected pinned repositories,
   preserve its write target when labeled, cite an expected path, resolve every
   citation to the retained snapshot, contain steps and validation, preserve the
   labeled user constraint, and remain non-ready without execution configuration.
   The two clarify labels require a blocking question or an explicit no-step
   decline.
2. **The labels are internally consistent with the bundled examples.** The corpus
   covers four repositories, single- and cross-repository scope, API/database/UI/
   consumer changes, a write-only cross-repository constraint, an absent feature,
   and a deliberately vague request. Expected paths are alternatives where the
   request reasonably spans adjacent files; the harness does not require invented
   exact line content.
3. **Prompt echo alone is insufficient to pass a normal task.** The lexical
   `must_mention` check can legitimately be satisfied in a plan requirement, goal,
   finding, or step, but the same output must independently pass repository, write,
   citation, source-resolution, steps, validation, readiness, and server schema/
   evidence validation. This is a structural/citation quality gate, not a semantic
   proof that an implementation strategy is optimal.
4. **The production path is represented truthfully.** The harness composes the same
   service types as the CLI, waits for real bundled-example indexing, pins scope,
   sends `intent=plan`, observes durable worker completion, and scores the saved
   immutable plan version produced after `bind_plan` and `PlanService.validate`.
   It therefore covers the server's one repair attempt and evidence-ID binding,
   rather than accepting model JSON directly.
5. **Remote-source and credential handling are appropriately bounded.** Only the
   packaged synthetic examples enter the temporary workspace; local-only is disabled
   only there for a remote evaluation profile. The credential comes from
   `OPENDEVIN_EVAL_API_KEY`, is passed into an in-process ephemeral secret backend,
   and is absent from logs and the returned/written report. The evaluator must still
   be run by the user; the coordinator must never handle the key.
6. **Evidence is suitably content-minimized.** Reports contain states, codes, counts,
   usage, durations, repository roles and cited paths for the synthetic fixtures, but
   no prompts, generated plan prose, evidence snippets, source lines, credential, or
   endpoint. Repository/path metadata is necessary to audit the citation labels and
   is non-sensitive in this bundled corpus.

## Non-blocking limits

- The corpus is deliberately small (ten tasks over seven synthetic files). It proves
  plan structure, scope and citation discipline, not retrieval quality over a large
  real repository or semantic implementation correctness.
- `must_mention` is a trusted-fixture lexical check. It protects labeled constraints
  such as `5`, `400`, `phone`, `published_at`, `blank|empty`, `409`, `10`, and
  `email`; it is not a general natural-language entailment metric.
- The bundled examples lack README/description metadata, so the evaluation pins
  repositories. Unpinned routing is separately covered by
  `tests/test_ask_routing_evaluation.py`; the product's "Which repository?" response
  for an unpinned no-description query remains a documented UX behavior.

The M1 exit gate remains open until the user-generated
`groq-gpt-oss-120b.json` result is present and the coordinator verifies its task hash,
thresholds and content-minimized shape.
