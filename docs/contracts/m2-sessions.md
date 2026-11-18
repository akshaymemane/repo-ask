# M2 durable sessions contract

Status: accepted by coordinator after adapter producer review (2026-11-15 local). Root reserves migration9 (execution profiles),10 (sessions),11 (publication); no parallel numbering. Builds on accepted m2-execution-spike.md and reserved F04 launch body. The real Docker/MCP/Claude coding and cancellation spike has passed; durable orchestration is the next task. One writable GitHub repository, optional eligible read-only context, one active implementation per instance by default.

## Ownership

Coordinator: migrations, ExecutionProfileService, SessionAPI/PublicationAPI, shared main/FeatureAPI/PlanService hook and browser entrypoints integration. Runtime builder: repoask/sessions/**, focused tests and task-local docs. Experience builder: sessions.js, scoped app/style changes after separate assignment. Publication builder: repoask/publication/** and explicitly assigned GitHubClient helpers, after session contracts stabilize. Existing execution adapter/broker owners must approve extensions to their files.

## Execution profiles

`ExecutionProfileService(platform,providers, *, runner_factory=None, adapter_factory=None, clock=now_ms)`:
- create(spec), update(id, changes), delete(id), list_profiles(limit=50,cursor=None), get(id), get_version(version_id).
- request_test(profile_id) returns202 job_id/version_id/status, enqueues external execution.test(max_attempts1); run_test(job,context) performs bounded synthetic-only runtime/adapter validation, records actual detected CLI version, pinned resolved image_id, capabilities, checks and timestamp. A detected CLI/auth/image is not a successful coding proof. Cache probe results for UI; do not launch models from GET/readiness.
- require_usable(profile_id) returns immutable version + successful check, or a stable blocking code. Worker rechecks executable/version/auth/owned container policy before sending actual source.
- Initial adapter claude_code/auth_mode cli_login; explicit normal installed-CLI login, never token/key extraction or credential copies. Unsupported API-key/managed profiles report unsupported, never fallback. Profile allows external source only when explicitly enabled; workspace local_only must also be false for this remote coding adapter.
- Spec: name, adapter, auth_mode, image (local tag or digest), allow_external_source, runner_limits, agent_limits. No HTTP executable paths, Docker options, arbitrary environment or host mounts. Agent limits: wall_seconds1..3600,max_turns1..40,max_budget_usd>0..10,max_output_bytes1024..1MiB. Runner limits use validated runtime bounds. Missing usage/cost is unknown.
- Return `{id,name,active_version_id,version:{id,version,adapter,auth_mode,config,created_at},check:{status,capabilities,image_id,cli_version,checked_at,error_code}|null,deleted_at}`. Delete preserves nonsecret history, blocks future use.

## Session service and worker

`SessionService(platform,index,github,providers,plans,execution_profiles,*,runner_factory=None,adapter_factory=None,clock=now_ms)`:
- preflight(plan_content) -> `{blocking_reasons:[],warnings:[],execution:{profile_id,profile_version_id,image_id,cli_version,limits,capabilities,destination}}`. Read-only, bounded, cached; used by PlanService.execution_preflight.
- launch(plan_version_id,content_hash,idempotency_key) -> `{session_id,state}`. Atomically validate exact immutable ready version/hash/current access/profile policy, freeze execution/profile/instruction/limit/publication snapshots, create one session plus external session.run job(max_attempts1). Same key/same intent returns same session; conflicting reuse409. One active session enforced transactionally. Empty/multiple write targets, local/demo writes, missing source/citations/questions/grants fail before provisioning.
- get(id), list_sessions(limit=50,cursor=None), events(id,after=0,limit=200), artifacts(id), diff(id), validations(id).
- send_message(id,content,client_request_id,question_id=None): durable queued/delivered/acknowledged/rejected state. Same client key is idempotent. Material scope/grant changes return plan_amendment_required and cannot expand authorization. Unknown delivery remains queued, never fake ack. Messages for a waiting question release only that question. Terminal attempts reject new messages.
- stop(id): commit stop_requested and revoke new tools immediately; signal process/container outside request thread. Return stopping until both verified. Repeated stop idempotent; containment failure remains visible. Target ack<=2s, containment<=10s from signal, using actual runtime/adapter results.
- retry(id,idempotency_key,acknowledged_base?): explicit linked successor from terminal/interrupted attempt, same pinned intent subject to fresh readiness. Never mutate terminal history or replay uncertain execution automatically.
- run_session(job,context): fence every state/event/tool/checkpoint write with live lease+job/run identity. Guard checks stop, shutdown, access, authority, budgets and inventory gate before every tool and before returning source. No tool before exact trusted inventory verified. Persist only mapped safe summaries, never raw stream/reasoning.
- start()/close()/recover(): dedicated bounded runtime worker separate from indexing/Ask worker; model execution cannot block Ask queue. Default concurrency1. Heartbeat owns live job; app interruption terminates owned harness/container, checkpoints where safe, marks interrupted and external job needs_reconciliation. Recovery inspects labelled owned containers and recorded process identities, contains or reports failure, never assumes absence means success and never automatic rerun.

## Source, workspace and artifacts

Acquire the exact pinned revision through existing GitHub tree/blob boundary, validate current contents_read and implementation capability repeatedly. No host checkout/config/hooks, auth or raw .git objects enter the agent workspace. Use only bounded regular allowed files; apply default/configured exclusions and secret checks. Reject truncated tree or over-budget acquisition rather than silently implement a partial repository. Read-only related contexts never become writable publication targets. Retain file modes, base hashes and known omitted paths outside the container; new files cannot shadow an omitted/excluded original path.

Container work is ephemeral. After each mutating tool/command, save bounded regular-file checkpoint or a truthful checkpoint failure. Compare trusted base manifest with snapshots to produce added/modified/deleted files and unified text diff; never extract a tar on the host. Publication consumers reject .git/hook/unsafe/excluded paths regardless of direct command output. Preserve artifacts on failure/stop when available; hard kill can lose edits since last verified checkpoint and must disclose that. Artifact IDs are generated; HTTP never accepts host paths. Private content is rechecked/redacted on current repository access, exclusion and purge. Store finite byte limits and fail visibly on quota exhaustion.

Run declared validation only inside the same isolated policy. Record exact argv/environment/image/exit/output status. A plan command string may run via container sh -c; never via host shell. Passed/failed/timeout/unavailable/not_run are distinct. Dependency/network unavailable stays unavailable. Default network none; profile image may supply toolchain/dependencies. No host installation fallback.

## Events and HTTP

Event envelope `{session_id,seq,created_at,type,payload}`; per-session monotonic sequence assigned transactionally, bounded payload<=8KiB. Map runtime tool_started/tool_finished/tool_denied to tool.started/tool.finished/tool.denied; map adapter summaries/results/usage explicitly. Event types include session.state,agent.summary,tool.*,checkpoint,validation.*,question.asked,message.delivery,stop.requested,containment,usage,error,publication.state. No private reasoning, credentials, container IDs, local executable paths or private socket endpoints in normal responses.

`GET /api/sessions?limit=&cursor=` -> items,next_cursor; `POST /api/sessions` exact reserved body ->202 session_id,state. `GET /api/sessions/{id}` -> metadata,repository bases,limits,execution provenance,outcome,latest_seq,pending_question and capability statuses. `GET .../events?after=&limit=` -> items,next_seq,has_more (replayable polling acceptable; no duplicate events). `GET .../diff`, `GET .../validations`, `POST .../messages`, `POST .../stop`, `POST .../retry` (idempotency_key, optional acknowledged_base). Use common safe errors/origin checks. Source-bearing artifacts always use live permission checks.

Questions use existing broker ask_user callback; persist question/state, bounded wait while observing stop/lease/deadline, return only a matching user answer. Adapter capability remains false until actual callback lifecycle proof. Generic follow-ups may be delivered through trusted tool-result annotations; do not claim stdin/resume support. Any broker extension gets independent review and explicit producer ownership assignment.

## Persistence fields (migrations9/10)

ExecutionProfile and immutable version/check records follow provider pattern, with no secrets. Session: id,plan/version/hash,profile_version,idempotency_key,predecessor,attempt,job,state,phase,stop flags/reason,error,outcome,limits/instructions/usage/publication snapshots,timestamps. SessionRepository: session,repository/role,snapshot(optional ON DELETE SET NULL),baseSHA/branch,session_branch,base_manifest and current_diff_hash. SessionRunner: session,instance/container/process-group+start identity/private runtime state. SessionEvent: session+seq,type,payload,time. SessionMessage: id,session,client_key,content,question_id,delivery/reason,time; unique per-session client key. SessionQuestion: id,session,prompt,answer/message reference,state/time. ValidationRun: id,session,argv,source,status,exit/output/artifact/environment/timing. SessionArtifact: id,session,kind,sha256,byte_count,content(private bounded BLOB or owned internal path),time. Public projections omit private runner data. No foreign key may prevent approved source purge; redact derived content first and retain minimal history.

## Acceptance

Actual pinned-base launch -> observable tools -> code diff -> validations -> completed reviewable outcome; replay after refresh; real stop timings; two same Start/retry keys produce one attempt; restart contains old runner and reports interrupted; authority loss stops tools/source; budgets preserve last verified artifacts; unsupported multi-write/local writes fail preflight. Synthetic integration is separate from required GitHub-connected disposable-repository/draft-PR pilot; user App credentials and explicit publication remain operator prerequisites, not assumed from gh CLI login.

## Producer review clarifications

Adapter author confirmed these interfaces and the actual run kwargs. Map agent_limits.wall_seconds to timeout_seconds. on_inventory_verified takes no arguments; on_started receivesPID (alsoPGID), so the service captures OS start identity for recovery. Adapter errors have stable AdapterError.code aftercleanup. Returned status/code/exit_code/stop_confirmed/usage/reported_cost_usd are authoritative, not exitcodealone. Observedmodel comes from adapter_ready.model. A fresh sharedstopEvent is set on EVERY adapterexit, even success: determine usercancellation from durablestop_requested+returnedstatus, notEventalone. Trustedpost-agentvalidation/checkpoint remains subject to lease/access/deadline but doesnot reopenmodeltoolgate. ask_user proved realtool+callback+finalack; callbackmustboundwait/observeStop. follow_up/resume/checkpoint remainfalse atadapterlevel; durableartifactcheckpoints belongtoservice.

Profile tests respect workspace local_only before remoteCLI launch (development syntheticspikes didnotmutateproductpolicy). Testfixture may use bounded POSIX shell arithmetic so custom POSIX toolchainimages neednotincludePython. A passing probe requiresactualtools, changedfixture, independentlypassedvalidation andverifiedcontainment; inventory/version detection alone remains unverified. Store latestcheckresult on immutableprofileversion; unknowninterruption neverreusesstalesuccess. Dedicatedruntimeworker handles execution.test andsession.run. Runtimeleadership/data-directorylock preventssecondappfromrecovering/killing livework ofanotherprocess; samehostmultipleprocessAsk maystillread, runtime reportsruntime_in_use.

Schema9/10 implementation is frozen in repoask/platform/execution_schema.py andsession_schema.py. These exact SQL fieldnames are the servicebuilder sourceoftruth. Coordinator may temporarilyassign ExecutionProfileService implementation toplatformbuilder under a newtask; contracts/migrations/sharedAPI staycoordinator-owned.

## Accepted profile projection

get_version(version_id) and require_usable(profile_id) return the same flat immutable version dict with id/profile_id/version/adapter/auth_mode/config/created_at/profile_deleted/check. get(id) returns the public profile with nested version/check. list_profiles(limit,cursor) returns items,next_cursor. settings() defaults max_active_sessions1; update_settings(max_active_sessions) validates integer1..4, affects future launches without terminating current work. Factory signatures runner_factory(instance_id),adapter_factory().

## Profile test recovery (accepted)
Profiletestcontainer session_id=job.id, instance_id same stable runtime_instance. ExecutionProfileChecks.result_json.private_runtime storesinstance_id/container_id/harness_pid/harness_start, ALWAYSstrippedpublicprojection. Internalprofiles.pending_runtime_tests() returnsversion_id/job_id/private_runtime forleaderrecovery; profiles.reconcile_test(version_id,job_id,containment_confirmed=bool) marksinterrupted andonlyresolvesqueuealreadyneeds_reconciliationasfailed afterverifiedcleanup, neverrequeue. Ifleaseisstillexpiresfuture, leaveblockeduntilqueueleaseexpiry unlessfullleadership+processidentityproven safe; neverstealfrommetadataalone. Runtimeleader mustcontainprofileprobeprocesses/containers aswellassessions. Unknowncontainment staysblocked, cannotrerun tests. Profilesauthorimplementingtheseinternalhandoffs, no schemachange.

## Session UI projection and message history

GET /api/sessions/{id}/messages?limit=&cursor= -> items,next_cursor. Each message has id,session_id,client_request_id,question_id,content(string or null when redacted),delivery/reason,created_at/updated_at. No automatic acknowledgement from tool-finished dispatch; distinguish sent-to-bridge from observedmodelack. GETsession adds source_available bool; when false, client clears previouslyrenderedsource/diff/questions/logs and reloads source-bearingeventhistory undercurrentpolicy. Backend remainsauthoritative forredaction.

Existingpublicresponses fromservice37a areshapeinputs (notapproval): GETsession fields id,plan_id,plan_version_id,content_hash,attempt,predecessor_id,successor_id,state,phase,stop_requested,stop_reason,error_code,repositories,limits,execution,instructions,usage,publication,outcome,latest_seq,pending_question,capabilities,runner,created_at/updated_at/started_at/finished_at. repositories entries repository_id,role,snapshot_id,base_sha,base_branch,session_branch,current_diff_hash,provisioned,acquisition/head_sha_at_start. execution exposes profile_id/profile_version_id/version/adapter/auth_mode/image/image_id/cli_version/allow_external_source/checked_at/destination, neverprivateprocess/container/socketdata. runner={state,containment}. pending_question={id,prompt,redacted,created_at}|null.

Events: items(session_id,seq,created_at,type,payload),next_seq,has_more. Diff: session_id,repository_id,base_sha,state,edits_since_last_checkpoint_may_be_lost,available,reason(optional),files,rejected,diff_hash,stats,captured_at; eachfile carriespath/status/diff/modes/sizes. Missing/forbidden/redacted remainsunavailable, neverempty-success. Validations: items(id,ordinal,command,source,status,required,exit_code,artifact_id,environment,output,output_redacted,started_at,finished_at),summarycounts,fully_validated. Failure/staleartifactoutcomes mustbevisible andcannotbeoverriddenbyclientinference. Artifactslistmetadataonly; noarbitraryhostpaths.

Profile API list uses items,next_cursor, model-provider API continuesprofiles-listdistinct. RootAPIboundseventlimit1..200. UIhistorypaginated; serverMessage/Launch/Retry keys preserved acrossunknownnetwork outcomes; definite4xx allowcorrectionwithoutlosingdraft. UIstaleepoch/focus/source-policyfences required. No source/rawJSONdump whenhumanstates/counts/provenancecancommunicatethedecision.

### Launch freshness (F04 AC6; additive)

`POST /api/sessions` optionally accepts `acknowledged_base`, a mapping from write
repository ID to its exact pinned revision. It means deliberately retain that saved
base; it never changes the plan version or commit. Unknown repositories or a
revision other than the plan's pinned revision are rejected as validation errors.

Before creation, the service observes the write branch through the existing GitHub
client, waiting at most two seconds. Equal HEAD proceeds. An advanced HEAD without
acknowledgement returns HTTP 409:

```json
{"code":"base_advanced","error":{"code":"base_advanced","details":[{"repository_id":"gh:1","pinned_revision":"<saved SHA>","current_head":"<observed SHA>","status":"advanced"}]},"details":[{"repository_id":"gh:1","pinned_revision":"<saved SHA>","current_head":"<observed SHA>","status":"advanced"}]}
```

No session or execution job is created by that refusal. Reposting the exact saved
version/hash with `acknowledged_base` uses the same idempotency key. The first
observation is durable (schema 13); identical unacknowledged retries reproduce the
same 409, including after restart or an acknowledged launch. Other plan/hash reuse
of the key is an idempotency conflict. Successful identical requests return the
existing session. Changing an acknowledgement after success is a conflict.

Session detail's existing `instructions` JSON adds `acknowledged_base` (empty map
when absent) and `base_observation`, with `repository_id`, `pinned_revision`,
`current_head` and `status` (`current`, `advanced`, `unavailable`). Offline, invalid
upstream output or timeout records `unavailable` and a null head, and proceeds with
the saved base. Existing worker-time `head_sha_at_start` and `base_is_head` event
information continues independently. A retry attempt inherits any recorded older
base acknowledgement while observing freshness for its own launch key.

The UI presents an inline focused notice and explicit saved-base/regenerate actions
in both conversation and saved-plan launch flows. Regeneration uses the existing
conversation plan-generation path; it does not mutate the saved version. Current
index acquisition and plan readiness rules still apply to the generated plan.

Retry freshness uses the same optional `acknowledged_base` map, validation, durable
observation and 409 shape as initial launch. Omission inherits the predecessor's
acknowledgement; an explicit empty map does not. A current-base predecessor retried
after branch advancement refuses without creating a successor/job until the client
resends the same retry key with the pinned-base acknowledgement. That map is saved
on the successor; identical acknowledged replay returns it, including after restart.
The original unacknowledged request continues to reproduce its saved 409. Sessions
reuses the focused notice with “Retry on the saved base” and “Open plan” actions.

### Finished-session retention (OP-10)

`purge_session(session_id)` / `POST /api/sessions/{id}/purge` with exactly `{}`
returns HTTP 200 `{session_id,purged_at}`. Only TERMINAL sessions qualify;
`session_active` and a publication outside `published/blocked/failed/no_changes`
(`publication_in_progress`) return 409. Repeated purge preserves the original
millisecond timestamp and retries filesystem cleanup. The tombstone is stored in
`outcome_json`. Migration 15 adds a database insert fence so a publication
intent holding a pre-purge snapshot cannot persist content after the tombstone;
the publisher maps that rejected insert to its existing idempotency conflict.

Detail/list projections retain id, state, timestamps, plan_version_id, repository
id/role/base SHA, and publication id/state/PR URL/number, plus `purged:true`,
`purged_at` and `source_available:false`. Events/messages/diff/validations/artifacts
return HTTP 409 `{code:"purged",error:{code:"purged"}}`; trusted publication export
also fails with `purged`. Guidance/question text, all event payloads, artifact
bytes/hashes, validation commands/environment, manifests and frozen session context
are redacted in active SQLite rows. Publication title/body/commit prose and event
payloads are redacted, retaining remote reconciliation identifiers. Plan and
repository content have independent retention controls; GitHub PRs and backups
are unaffected.

Artifacts currently persist in SQLite. Any retained filesystem artifacts belong
under `data_dir/sessions/<session-id>`; purge removes that tree using directory
file descriptors, no symlink following, a 10,000-entry/64-level bound. Other session
directories are untouched. Disk cleanup failure is visible and may be retried;
content is already inaccessible through the durable tombstone.
