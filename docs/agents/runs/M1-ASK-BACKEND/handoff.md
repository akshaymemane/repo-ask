# Builder handoff — M1-ASK-BACKEND R1 corrections

## Identity and scope

- Author/harness: Codex retrieval/backend engineer; no subagents or other harness launched.
- Branch/worktree: task/m1-ask, /Users/apple/workspace/vibe-coding/opendevin-m1-ask.
- Reviewed base: 3918ebddfaaff7745a0ef495176eaba04a8088e4. Original implementation base c0e15ea59620346a912d986441aa644b77e4bcdb.
- Review addressed: review-claude-r1.md, independent Claude changes-requested review. Author makes no approval claim.
- New submitted commit: see status.md for actual commit attempt outcome. If sandbox rejects worktree Git metadata writes, root must commit the scoped patch/files before exact-commit review.
- Requirements: F03 RT-01–RT-10, backend F04 ASK-01–ASK-10, F12 durability/fencing/deletion slice. Accepted schema6 and m1-ask-plans.md/m1-indexing.md remain unchanged.
- Status: implemented and verified; resubmission for independent re-review. Index candidate is still a development dependency, not approved/integrated here. No board, schema, migration, HTTP, provider, index or legacy/shared source edits.

## Review resolution

| Finding | Concrete change | Focused evidence |
| --- | --- | --- |
| Major 1: source-derived history bypassed remote policy | Scoped generation always applies source-sharing policy; cited history also contributes to the flag. History citations/current scope revalidate immediately before transmission. | Real ProviderService first produces a local cited turn, then a zero-hit follow-up with a remote no-source profile is blocked before injected transport; opt-in remote follow-up succeeds and retains actual provenance. |
| Major 2: long generation expiry and stuck terminal domain runs | Ask owns a joined renewal thread during generation, fencing expiry/token/owner/scope/cancel before public JobQueue.heartbeat under the same Store lock. It does not rely on root's wrapper or revive expired leases. get_run/list_runs/get/send/retry reconcile active domain runs backed by terminal jobs. | Real ProviderService transport sleeps 1.5 seconds against a one-second lease; rival cannot reclaim. Forced old-owner reclamation rejects late output. Exhausted final attempt becomes failed/lease_expired without manual cancel. Queue cancelled/succeeded-without-output cases reconcile and permit new sends/retry. |
| Major 3: accepted 4–16KB messages deterministically failed retrieval | Full request remains accepted up to 16000 UTF-8 bytes and is persisted/sent intact. Separate UTF-8-safe retrieval query is at most 3000 bytes. Oversized input is rejected before persistence. | >4000-byte request generates successfully; injected transport receives the entire request and final snake_case/quoted requirement; multibyte query bound and over-limit non-persistence tested. |
| Major 4: path/slash tokens overrode pins/scope | Only slash tokens equal to known current catalog names are explicit identities. Path components are excluded from short-name selection/catalog feature terms. Valid pins and conversation scope remain selected. | Unit paths/read-write/I/O/client-server/conflicting-unknown cases; expanded 12-task labeled path evaluation has exact scope 12/12. |
| Minor: cancellation finished_at | Queued cancellation sets finished_at and clears stale queue errors atomically; leased jobs retain ownership until acknowledgement. | Queued cancelled job timestamp/state/flag tested through public queue get. |
| Minor: misleading revocation code | Revocation/exclusion/source unavailability maps to scope_unavailable, not invalid_output. | Revocation during real ProviderService injected call checks the stored domain code. |
| Minor: mangled exported identifiers | Plain-text exports preserve underscores, quotes, backticks and markup; recognizable credentials/private host paths are still suppressed. Root confirmed UI renders plain text. | Raw snake_case("quoted") export is exact; existing recognizable credential/host path suppression tests pass. |
| Minor: export pagination unusable | export(id,limit=100,cursor=None) pages via list_messages and returns callable next_cursor. | Two sequential exported pages with limit=1 include user then assistant and terminate with null cursor. |
| Minor: unbounded runs | list_runs(id,limit=50,cursor=None) returns bounded items/next_cursor. get caps runs at 100 with runs_next_cursor/runs_truncated. Message provenance lookup is bounded to returned message IDs. | 102 saved runs return 100 plus two via cursor; no silent truncation or duplicate IDs. |
| Additional requested public provenance | Public assistant messages and runs expose only stored profile_version_id, model and destination {kind,host}. Failed validated generations retain actual provenance; retries clear stale provenance. | Local and opted-in remote real ProviderService calls report their actual immutable profile/model/destination. No secretrefs/raw prompts/headers/full queue metadata in public run/diagnostic payloads. |

No shared queue helper was needed. Source/permission failures remain fail-closed and late results remain lease/scope fenced. Immutable plan behavior is retained; no execution/preflight privileges were added.

## Accepted HTTP additions for root

- `ConversationService.export(id, limit=100, cursor=None)` -> `{conversation_id, markdown, next_cursor}`; limit 1..100. Pass next_cursor back as cursor to continue.
- `ConversationService.list_runs(id, limit=50, cursor=None)` -> `{items, next_cursor}`; stable created_at/id ordering and validated cursor.
- `get(id)` includes bounded `runs`, `runs_next_cursor`, boolean `runs_truncated`; existing messages_next_cursor/plans_next_cursor remain.
- Assistant messages and runs include `profile_version_id`, `model`, `destination:{kind,host}|null`, from actual stored generation results. No fallback to the currently assigned profile. Root accepted these additive shapes and owns HTTP wiring.

## Checks actually run

Interpreter: /Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python (APSW available). Actual SQLite, IndexService, ProviderService and JobQueue/Worker run with synthetic source and model/discovery transports. No live model/account/credential access, downloads or installs.

- Focused service discovery: **27 passed** in 3.297s; durable summary verification-r1-focused.json records zero remaining Ask renewal threads.
- Expanded routing evaluate: original 50 tasks **100%** top-three recall versus **98%** metadata lexical baseline; five multi tasks **100%** label/complete coverage; 12 new path tasks **100%** exact selected scope/top-three coverage; original ambiguous/absent, path-only/absent, collision/qualified/missing/revoked cases behaved as labeled. Raw final result routing-results-r1.json. Original metrics unchanged. Initial R1 failures/corrected labels/tuning disclosed in evaluation-r1.md and retained initial result file.
- Final full unittest discovery: **169 run, 162 passed, no assertion failures, seven errors**. All seven errors are pre-existing HTTP tests denied loopback socket binding by the sandbox. verification-r1-full.json lists exact IDs, no source/terminal captures. Root must run them in a permitted environment.
- Earlier iterative full run exposed one new absent-query action-word false positive plus the same seven socket errors; it was corrected before the final run. Do not treat the intermediate run as a pass.
- `git diff --check` passed before packaging. New scoped staging/commit attempt and hashed-patch details recorded in status.md.

## Files and next action

Changed product files: repoask/ask/common.py, conversations.py, routing.py. PlanService schema/version implementation unchanged. Tests: tests/test_ask_services.py, test_ask_routing_evaluation.py, fixtures/routing/expanded-r1.json. Evidence/docs remain exclusively docs/agents/runs/M1-ASK-BACKEND. Original evaluation.md/routing-results.json and reviewer-owned review-claude-r1.md are preserved.

Root should create an exact commit if Git writes are denied here, then send it to the independent Claude reviewer for R1 re-review/corrections. Root owns UI/HTTP additions, permitted HTTP checks and later execution preflight. Final index review/corrections/integration remain a completion gate; public signatures are unchanged, and no dependency edits were made.

Previous pre-quota exec session handles were unavailable and OS process listing is sandbox-denied; no unrelated kill/restart was attempted and no inference about orphan absence is claimed. Fresh bounded evaluation/full/focused commands all returned, and the focused test runner found zero Ask renewal threads. No persistent provider/service/agent process was intentionally launched.
