# F05 — Implementation sessions and execution runner

Status: Draft | Milestone: M2 | Parent: [Master PRD](../../Master%20PRD.md)

## Outcome and boundaries

Start implementation from an exact plan version without manually cloning or launching an agent. Users can inspect ongoing activity, send instructions, review diffs and stop the session. M2 supports one writable repository per session and one validated coding-agent adapter. Related repositories can be included as read-only snapshots where access permits.

No production deployment, automatic merge or unrestricted host execution is included.

## Session lifecycle

`queued → provisioning → running → validating → completed`

Active phases can enter `waiting_for_user`, `blocked`, `failed` or `stopping → cancelled`. A session in `waiting_for_user` can resume its recorded prior phase after an answer. Infrastructure interruption enters `interrupted`; recovery either resumes from a verified adapter checkpoint or starts a successor attempt explicitly. Terminal sessions are immutable execution history; retry creates a linked attempt.

`completed` means work reached a recorded reviewable outcome; validation results separately distinguish passed, failed and not-run checks. A session can complete with disclosed failing checks, but the UI cannot label it fully validated or automatically publish it under a success-only publication policy.

## Functional requirements

- **SE-01:** Create a durable session using plan-version ID/hash, repository/base SHA, execution profile, instruction versions, budgets and publication policy.
- **SE-02:** Provision a separate container and workspace from the pinned commit. Never reuse another session's writable checkout or mount the host home directory or container socket.
- **SE-03:** Create a unique session branch; keep base SHA and branch references in SessionRepository records. Credential injection is temporary and limited to approved repositories/operations.
- **SE-04:** Provide the agent only the approved plan, bounded source context and permitted tools. Tool calls are policy-checked outside model prompts.
- **SE-05:** Persist structured events for phases, tool starts/results, commands, file changes, validation, questions and publication. Stream with reconnect/replay support.
- **SE-06:** Show current activity, elapsed time, diff, validation results and usage. Tool summaries are sufficient; private chain-of-thought is neither required nor exposed.
- **SE-07:** Accept follow-up messages with delivery/acknowledgment status. Material changes to goal or writable scope require an explicit plan amendment; they cannot silently expand authorization.
- **SE-08:** Stop immediately blocks new tools and requests process-tree/container termination. Show `stopping` until confirmed; report containment failure if termination cannot be verified.
- **SE-09:** Enforce time, token/cost, disk, CPU/memory and concurrency limits. Network destinations and tool capabilities follow the execution profile.
- **SE-10:** Run plan-defined validation when supported and record exact command, environment summary, exit status and redacted output. Never substitute “passed” for a check that was unavailable or not run.
- **SE-11:** Persist patches/checkpoints so failure remains inspectable. Recovery must verify workspace ownership and adapter checkpoint support before resuming.
- **SE-12:** Publication is handled by F06 and requires the recorded policy; completing local work alone does not authorize a remote write.

## Runner boundary

Indexing and Ask have no execution tools. The runner executes repository code, including dependency install and tests, only inside its isolation policy. Host credentials are not inherited. Default network access is denied except configured package/model/GitHub destinations; setup explains how to add required destinations. No general-purpose host shell fallback is allowed if a container runtime is unavailable.

The first adapter must prove headless startup, structured output or reliable event mapping, credential setup, cancellation and exit classification. Unsupported environments fail preflight before work begins.

## Data and interfaces

`Session`: plan version, attempt, state, current phase, runner reference, limit snapshot, stop reason and final outcome. `SessionRepository`: repo, role, base SHA, branch, head SHA and patch reference. `SessionEvent`: session, sequence, timestamp, type, redacted payload. `ValidationRun`: command, status, exit code, log artifact and timing.

Proposed routes: `POST /api/sessions`, `GET /api/sessions`, `GET /api/sessions/{id}`, `GET /api/sessions/{id}/events?after=...`, `POST /api/sessions/{id}/messages`, `POST /api/sessions/{id}/stop`, and `POST /api/sessions/{id}/retry`. Use server-sent events or an equivalent replayable transport. Repeated stop is idempotent.

## Failure and recovery

Clone/authentication failure blocks provisioning with an actionable reason. Agent failure records tool events and patch artifacts. Process death marks an interrupted session, not completed. A lost connection to the browser never stops background work. Access revocation and budget exhaustion stop new actions and trigger containment. Repository hooks cannot escape container or credential policy.

## Acceptance criteria

1. Starting a ready plan provisions the correct pinned base, unique branch and isolated workspace, then produces observable events and diffs.
2. Two sessions cannot write each other's files or read host secrets in an isolation fixture.
3. Refreshing the browser replays events without duplication or lost ordering.
4. Stop is acknowledged within 2 seconds locally; containment succeeds or reports failure within 10 seconds; no later tool starts are allowed.
5. Restart during execution yields a truthful interrupted/recovered state and no duplicate runner or branch publication.
6. Failed and skipped checks remain distinguishable from passed checks in the final outcome.
7. An unsupported multi-repository write scope fails preflight before any edits occur.
8. Budget exhaustion preserves work and reports its stop reason without beginning another model or tool action.

## Dependencies and measures

Depends on F04, execution slice of F07 and F12; publication uses F06. Measure queue/provisioning time, task success, validation completeness, stop latency, resource usage and recovery outcomes separately.
