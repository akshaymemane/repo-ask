# Builder handoff — M1-ASK-BACKEND

## Identity

- Author/harness: Codex retrieval/backend engineer; no subagents/other harness launched.
- Branch/worktree: task/m1-ask, /Users/apple/workspace/vibe-coding/opendevin-m1-ask.
- Base SHA: c0e15ea59620346a912d986441aa644b77e4bcdb. Integration baseline per assigned card: edb9a9d852feeff0b9a418fb1fb0ae5f5ce1a927.
- Submitted commit: **none**. `git add` and `git commit` both failed before mutation because worktree Git metadata index.lock is outside writable sandbox roots. Approval policy is never; no bypass attempted. Coordinator must create a scoped commit before independent exact-commit review.
- Assigned task: task.json; F03 RT-01–RT-10, F04 ASK-01–ASK-10 backend, F12 persistence/fencing/deletion slice.
- Status: implementation submitted as files/hashed patch; commit and independent review pending, index completion gate pending. Not approved or integrated.

## Outcome

Exports RoutingService, ConversationService and PlanService from repoask.ask. Routing persists evidence/explanations, handles explicit names/pins/collisions, bounded source retrieval, selection ambiguity and live access checks. Conversation requests atomically create user/assistant/run/job records; retries preserve user identity, durable handlers fence job IDs/live leases/scope revisions/cancellation, and completed domain commits replay without duplicate generations or plans. Generation uses actual ProviderService with validated JSON/evidence, one repair, current evidence rechecks and bounded same-scope history. Failures retain user drafts and content-free codes. Shutdown yields via JobInterrupted.

Plans have strict normalization/citation/scope validation, immutable canonical SHA256 versions, optimistic parents, current readiness checks, preserved multi-repository requirements and safe readable Markdown exports. No model field can self-declare readiness or permissions. Readiness requires coordinator preflight, one write target, current permission, a usable pinned snapshot, deliberate retained-base choice and answered blocking questions. Scope revisions pin every conversation-backed version. Deletion/purge conservatively remove duplicated content while preserving minimal identity/hash tombstones.

Changed scope: repoask/ask/{__init__,common,routing,conversations,plans}.py; tests/test_ask_services.py; tests/test_ask_routing_evaluation.py; tests/fixtures/routing/catalog.json; this task's status/evaluation/results/integration notes/self-evaluation/handoff/review-patch artifacts. No shared source, migrations/schema, legacy files, manifests, HTTP, UI, or board edits. Consumed accepted m1-ask-plans.md, m1-indexing.md and schema6 including scope_revision. Candidate IndexService d8f1005 is development dependency only, not approval/integration.

## Verification evidence

| Requirement | Command / scenario actually run | Result |
| --- | --- | --- |
| F03 routing | `PYTHONPATH=. /Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python tests/test_ask_routing_evaluation.py` | 250 synthetic GitHub metadata repositories, 25 source-indexed; 50 tasks top3 recall 100%, basic metadata lexical baseline 98%; 5 multi tasks label/complete coverage 100%. 2 ambiguous, 2 absent, collision/qualified/missing/revoked cases passed. Development-set tuning disclosed in evaluation.md. |
| F04/F12 | Root venv `-m unittest discover -s tests -p 'test_ask_*.py'` | 17 passed (routing evaluation plus 16 service checks). Most recent focused service rerun: 16 passed after cursor bound. |
| Durability and safety | Actual SQLite/IndexService/ProviderService; injected source and HTTP/model transports | Reopen persisted DB/jobs, idempotent requests, repair/retry, late owner, cancel/scope/revocation/lease fences, shutdown yield, commit-before-queue-ack replay, immutable hashes/parents, export markup/recognizable secret filtering, multiwrite, pagination, role_unassigned, plan/conversation purge all exercised. |
| Existing regressions | Root venv `-m unittest discover -s tests` | 157 run: 150 passed; 7 HTTP tests errored at loopback socket bind with sandbox PermissionError. No product assertion failure. Follow-up non-HTTP run recorded in status.md after completion. |
| Scope/format | `git diff --check`; attempted scoped staging/commit | Whitespace check passed; Git writes rejected at worktree index.lock outside writable roots. No commit or staging succeeded. |

No live account, live Ollama/model, credential access, package install, download, external write or repository command execution by product Ask occurred. Existing synthetic GitHub test fixture generates its own test key/vault. Model quality evidence is injected, not real inference. The 30-plan semantic entailment/pilot benchmark was not run; identity validation is not factual entailment proof.

## Risks and next action

- Coordinator: create scoped commit from these files/patch; independent Claude quality/security reviewer must review that exact commit and send corrections. Author cannot approve it.
- Index owner/coordinator: final review/corrections/integration of d8f1005 remain completion gates. Candidate catalog profiles expose filenames rather than README body, so initial README-only local/demo evaluation scored 24% single-task recall (details/evidence retained in evaluation.md). GitHub metadata fixture success does not remove this limitation. No out-of-scope dependency fix attempted.
- Coordinator: wire HTTP and Worker handler, register purge hook and later execution preflight per integration-notes.md; re-run socket-dependent regression checks in a permitted environment. No new migration/package required.
- Exports conservatively suppress recognizable credentials/private host paths and escape active markup. Arbitrary user-written secret strings are not universally detectable; no credential storage is read into output. Root must render Markdown safely.
- Natural-language claim entailment and requirement preservation under real models need independent semantic/pilot review. Synthetic routing labels are a development benchmark, not held-out real-catalog accuracy.
- Background processes: no persistent services/agents/providers launched; bounded test commands only. Final test outcome/process completion is recorded in status.md.
