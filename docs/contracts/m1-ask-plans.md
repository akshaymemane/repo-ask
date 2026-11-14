# Routing, persistent Ask and immutable plans

Coordinator contract for F03/F04. Consumes m1-indexing.md and actual public services.
Schema6 in platform/ask_schema.py is coordinator-owned. Implementation may begin only
after the context service gate; its public methods, not private SQL, supply source.
This contract allocates package ownership, persistence and HTTP shapes for parallel UI.

## Ownership and APIs

Backend builder owns `repoask/ask/**`, `tests/test_ask_*.py`, routing evaluation
fixtures and its task artifacts. Coordinator owns migrations, HTTP/lifecycle wiring,
legacy answer/index entrypoints and dependencies. UI builder owns web and UI tests.
Export three services from repoask.ask:

- `RoutingService(store,index,*,clock=now_ms)`.
  `route(prompt,conversation_id=None,pinned_repository_ids=())` persists a decision;
  `get(decision_id)` rechecks current eligibility, never exposes newly revoked context.
- `PlanService(store,index,providers,*,execution_preflight=None,clock=now_ms)`.
  `create(conversation_id,content,source='manual',profile_version_id=None,generation=None)`,
  `save_version(plan_id,content,parent_version_id,source='manual',profile_version_id=None,generation=None)`,
  `get(plan_id,version_id=None)`, `list_plans(conversation_id=None,limit=50,cursor=None)`,
  `export(plan_id,version_id=None)`, `delete(plan_id)`.
  External callers cannot declare source=model/profileversion; coordinator HTTP omits them.
- `ConversationService(store,jobs,index,providers,routing,plans,*,clock=now_ms)`.
  `create(title='',repository_ids=())`, `list_conversations(limit=50,cursor=None)`, `get(id)`,
  `update_scope(id,repository_ids,expected_revision)`,
  `send(id,content,client_request_id,intent='answer')`, `get_run(id)`,
  `cancel(run_id)`, `retry(run_id)`, `delete(id)`, `export(id)`,
  `purge_repository(repository_id)`, `run_answer(job,context)`.
  intent is answer or plan. send persists one user + pending assistant and a run/job
  atomically, returns conversation_id/run_id/job_id/state/message IDs. Duplicate client
  request returns same run if payload agrees, conflict if differs. Retry preserves
  original user message and replaces continuation job; no duplicate user or plan version.
  Model generation takes place only in durable `ask.answer` handler, never HTTP thread.
  Plans generated through send(intent=plan) create a plan version only after validation.

Collection methods return {items,next_cursor}, stable(created_at,id) ordering and
opaque validated cursors; limit1..100. HTTP GET lists accept limit,cursor and optional
conversation_id forplans. Never silently truncate a saved conversation message history;
get(conversation) may return a boundedrecent window with explicitpagination metadata
and an additive list_messages method for earlierhistory.

## Routing output and evaluation

Decision: id,conversation_id,prompt,pinned_repository_ids,candidates,
selected_repository_ids,status,degradation_code,catalog_generation,created_at,
question nullable,next_action. Candidate: repository_id,name,rank,reason,citations,
coverage,freshness,implementation_enabled. Candidate provenance comes from
IndexService.catalog_candidates, then bounded search on strongest candidates. Recheck
eligibility after retrieval and on read. Explicit owner/name matches and valid pins
win ranking; exact-name collisions without owner stay ambiguous. Missing/revoked pins
are surfaced, never silently replaced. No matches returns no_match even if a model
invents a name. Status resolved requires explicit/unambiguous scope; weak generic
matches yield needs_selection. Lack of semantic support is disclosed independently
of whether user selected valid scope (degradation_code; status may be degraded).
Routing never enables implementation or changes grants. Scope changes increment
conversation.scope_revision and cannot silently overwrite earlier message scope.

Provide deterministic labeled evaluation of at least250 synthetic catalog repositories,
50 answerable tasks plus ambiguous/absent/revoked/collision cases. Report top3recall
and multi-repository coverage separately, compare basic metadata lexical baseline.
Evaluation labels describe realistic feature terminology, not copied unique tokens only.
No opaque LLM confidence numbers; qualitative reasons reference actual evidence.

## Message generation and safety

get(conversation) returns public conversation metadata/scope and ordered messages with
citations, state,error_code,usage,profile_version_id and current runs/plans. No queue
payloads/raw checkpoints, private paths or secretrefs. Source excerpts are permitted
only as explicitly cited answer content, never diagnostics. Bound message counts,
input/output/context bytes and retrieval per run. Use real ProviderService.generate;
store actual returned profile_version_id/model/destination/usage. No silent fallback.
Unconfigured model reports role_unassigned while retaining message/draft.

Bind current source evidence to internal IDs (e1,e2,...) in a prompt that treats source
as untrusted data. Require provider JSON {answer:string,citation_ids:[...]} or a
strict plan object. Invalid output/citation IDs never render as valid citations. At
most one bounded repair call; record failures truthfully. For ordinary explanations,
claims about existing source require citations; low/no evidence answers explicitly
state gaps. Model text cannot trigger repository commands or session creation.

Each write transaction checks run.job_id, domain state, live queue lease/token/expiry,
current scope_revision and cancellation. Release Store lock before provider/source
calls. Recheck eligibility/citations and scope before finalizing output/plan. On
user cancel, set domaincancelled, cancel job, signal active provider cancel_event;
later output is discarded. App shutdown raises JobInterrupted at context boundaries
and yields safe work; do not catch BaseException to mark it failed. Request idempotency
and last-write preconditions protect restart/late results. Scope change during generation
invalidates the run with scope_changed, retaining earlier message history.

## Plan content and readiness

Canonical JSON plan content keys:
- goal,user_request: nonempty strings.
- repositories: [{repository_id,role:read|write,snapshot_id,revision,branch}].
- citations: [{id,repository_id,snapshot_id,revision,path,start_line,end_line}].
- findings: [{text,citation_ids:[id]}].
- requirements: [nonempty string].
- steps: [{title,description,paths:[safe relative path],citation_ids:[id]}].
- validation: [{command,expected,source:observed|proposed,citation_ids:[id]}].
- risks,assumptions: [string].
- open_questions: [{id,text,blocking:boolean,answer:string|null}].
- execution_context: {execution_profile_id:string|null,skills:[],plugins:[],memory:[],
  base_choices:{repository_id:retain|regenerate}}. M3 enriches empty pinned lists;
  reject unsupported custom instructions rather than silently ignore them in M1.
- publication: {policy:manual_draft|on_success_draft}, default manual_draft.

Allow default empty arrays/optionalcontext fields in normalized content, but preserve
all provided requirements; reject unknown keys/types and unsupported scope. Validate
all citation identities through index.source and exactrevision; every citation belongs
to a scopedsnapshot. Findings require evidence or explicit gap wording. Proposed new
files may not yet exist; their paths must be safe. No ready/state fields from model.

Version: id,plan_id,version,parent_version_id,content,content_hash,source,
profile_version_id,generation,scope_revision,created_at,readiness. Plan addslatest_version_id/title.
Each new version pins current conversation.scope_revision (including manual versions);
standalone plans use null. Scope revision mismatch blocks readiness even if IDs later
match again after remove/add-back. A new version is required after scope changes.
Hash is SHA256 of canonical normalized content, validated server-side; updating creates
new version using parent optimistic concurrency. Old versions remain immutable.
Superseded is derived from latest version, not edits to old content. Readiness is
recomputed on read/launch and includes state,blocking_reasons,warnings,source_freshness.
State ready requires exactlyonewrite target, valid usable source snapshot, current
retrieval and implementation permission, resolved blocking questions and configured
execution profile/preflight. Multiple writes retain full plan with explicit unsupported
reason; never truncate. No execution_preflight means execution_not_configured. A
read-only local/demo snapshot remains useful for Ask but cannot imply GitHub publish
permission. The injected preflight(content) returns {blocking_reasons:[],warnings:[]};
coordinator later supplies M2 execution capability checks. Content never authorizes
new runtime privileges by itself. Compare active index snapshot versus pinnedversion,
show retained/current_index freshness; changed base needs explicit retain or regenerate.
Live GitHub HEAD freshness is checked again at launch in M2, not claimed from index.

Export derives readable Markdown implementation prompt from exact same content/hash,
including request, scope+SHAs, findings+citation links, requirements/orderedchanges,
validation, risks/questions, context and publication. No credential, private hostpath,
internal reasoning or hidden instructions. Returns {plan_version_id,content_hash,markdown}.

## HTTP allocation (coordinator implements)

GET/POST /api/conversations; GET/PATCH/DELETE /api/conversations/{id};
PATCH accepts repository_ids+expected_revision only. POST
/api/conversations/{id}/messages accepts content,client_request_id,intent;202run.
GET /api/answer-runs/{id}; POST /api/answer-runs/{id}/cancel or /retry.
GET/POST /api/route (POST takes prompt,conversation_id,pinned_repository_ids;
GET optionaldecisionid via /api/route/{id}).
GET/POST /api/plans; GET/DELETE /api/plans/{id}; POST /api/plans/{id}/versions
accepts content,parent_version_id. GET /api/plans/{id}/export?version_id=...
and GET plan may take version_id. IDs opaque, body strict. Export JSON carriesMarkdown.
Legacy /api/ask and /api/source remain for demo compatibility until UI replaces them;
new source uses /api/context/source with repo/snapshot/path/range queryfields.

## Deletion and acceptance

Deleting conversation cancels runs and redacts all associated messages/planversions
and routes, preserving minimal versionidentity/tombstones needed for future sessions.
Deleting plan redacts its version content, retaining hashes/IDs. Repository purge hook
conservatively redacts duplicated answer/plan source and routing context associated
with that repository; never leaks a retained source excerpt after purge/revocation.
Exports show tombstones and unavailablecitations, no hidden source from savedpayloads.

Tests: persisted reload/restart; ambiguous/missing/explicit routing eval; pins and access
revocation; generation/cancel/retry/scope-change fences; real immutable version hashes,
parent conflicts and exports; inventedcitation rejection; preserved failed-model draft;
unsupportedmultiwrite blocked; unansweredblockingquestions blocked; readiness notselfset;
repositorypurge andconversation deletion remove duplicatedcontent. Full regressions.


## Additive UI handoff

GET /api/conversations/{id}/messages?limit=50&cursor=... maps the additive
list_messages(id,limit,cursor), returning {items,next_cursor}. Conversation.get
provides messages_next_cursor and plans_next_cursor. Plan get returns plan
metadata plus version; version contains content/hash/readiness and parent_version_id.
Use parent IDs and latest_version_id to browse immutable history.

The reserved M2 launch body is {plan_version_id,content_hash,idempotency_key}; the
server derives the execution profile, limits and publication intent from that
pinned version. Success returns {session_id,state} and navigates to
#/sessions/{session_id}. Start stays disabled until server readiness is ready.
M1 does not claim a live session endpoint. M2 will add preflight and session UI
before enabling that path; clients must not infer readiness from model text.

## Generation context packing

Ask now reserves the configured output allowance and a bounded repair allowance before packing history and sources. Full latest user input remains intact; an input that cannot fit fails as context_overflow before transport. Retrieval text and citation identities share the same measured serialized prompt budget. Internal ranking/chunk metadata is not sent to generation. Answer generation uses native structured JSON only when the configured profile advertises structured_output; chat-only profiles retain validated JSON/repair. Plans retain server validation/repair. Budget estimates use UTF-8 bytes/4 and do not claim provider-exact tokenization.
