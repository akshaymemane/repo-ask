# F04 — Ask mode and implementation plans

Status: Draft | Milestone: M1 | Parent: [Master PRD](../../Master%20PRD.md)

## Outcome and boundaries

Ask is a persistent conversation for repository understanding and implementation planning. It answers with citations, helps resolve requirements and produces an editable plan plus an exportable implementation prompt. It never edits repository files, runs repository commands or publishes changes.

Users can ask exploratory questions without creating a plan. A plan becomes launchable only when required scope, evidence and execution settings are available.

## Functional requirements

- **ASK-01:** Persist conversations, messages, repository scope and source references across browser refresh and application restart.
- **ASK-02:** Route unscoped prompts through F03. Show selected repositories and index coverage above the conversation; allow manual correction.
- **ASK-03:** Retrieve evidence for each question; cite existing-code claims using repository, commit, file and line range. Distinguish proposed future changes from observed behavior.
- **ASK-04:** Identify unknowns and ask focused questions. Store assumptions explicitly; blocking questions prevent launch, while nonblocking assumptions remain visible in the plan.
- **ASK-05:** Generate and edit structured plans with immutable version history. Manual edits and regeneration produce new versions without replacing older sessions' inputs.
- **ASK-06:** Show an exportable Markdown implementation prompt generated from the same structured version used at launch. Export does not include credentials.
- **ASK-07:** Validate schema, citations and scope server-side. Model-generated text cannot mark its own plan ready or bypass missing permissions.
- **ASK-08:** Provide Start session with repository/base commit, agent, limits and publication choice visible. A successful start navigates to its durable session ID.
- **ASK-09:** Cancel an answer generation without deleting earlier conversation state. Failed generation allows retry without duplicate user messages or plan versions.
- **ASK-10:** Preserve all requirements when execution scope is unsupported. For multi-repository changes in M2, offer explicit linked single-repository plans or retain the full plan as nonlaunchable.

## Required plan structure

| Field | Meaning |
| --- | --- |
| Goal and user request | Desired outcome and original intent |
| Repository scope | Stable IDs, read/write roles, branches and base SHAs |
| Current findings | Source-backed behavior and context gaps |
| Requirements | Functional outcomes and constraints |
| Proposed changes | Ordered steps and likely files/components, with estimates labeled tentative |
| Validation | Commands or checks, expected outcomes and acceptance criteria |
| Risks and assumptions | Migration, compatibility and uncertainty notes where applicable |
| Open questions | Blocking flag and answer status |
| Execution context | Provider/agent profiles, selected skill/plugin/memory versions when supported |
| Publication intent | Manual draft PR by default; optional publish-on-completion choice |

Readiness states: `draft`, `needs_input`, `ready`, `superseded`. Readiness is recomputed from structured data. Every PlanVersion stores an ID, content hash, author/source, parent version and creation time.

## Launch handoff and freshness

`POST /api/conversations`, `POST /api/conversations/{id}/messages`, `POST /api/plans`, `POST /api/plans/{id}/versions`, `GET /api/plans/{id}/export`, and `POST /api/sessions` are proposed routes.

Session creation includes plan-version ID/hash and an idempotency key. Revalidate current repository access, availability of the pinned base, execution capability and budget. A changed default-branch HEAD is shown before launch: the user can deliberately retain an available older base or regenerate against the new base. Never silently change the commit or plan version. Missing blocking answers or unsupported write scope disable launch with a precise reason.

## Failure behavior

Insufficient evidence yields an honest partial answer and suggested next step. Invalid model output is rejected or repaired through a bounded retry, never displayed as a valid plan. Provider timeout preserves the draft and messages. Remote provider use shows the active profile and source-sharing policy; local-only mode fails closed if the selected profile would transmit source.

## Acceptance criteria

1. A task can be routed, discussed, refined, saved and exported without any repository mutation or runner invocation.
2. Every rendered citation opens the recorded snapshot and lines; invalid evidence IDs are rejected.
3. A plan missing an execution target or blocking answer cannot start a session.
4. An edited plan creates version B while a session launched from A continues to reference A.
5. Double-clicking Start session creates exactly one session for the same idempotency key.
6. A branch advancing between planning and launch is shown explicitly; retained versus refreshed base selection is persisted.
7. Browser refresh restores the conversation, chosen scope and saved plan; provider failure does not discard manual edits.
8. A multi-repository plan cannot be launched as a silently truncated single-repository task.

## Dependencies and measures

Depends on F02/F03 and planning slice of F07. Hands off to F05; F08–F10 enrich later versions. Measure major plan correction rate, unresolved assumptions, citation support and plan-to-session conversion without treating conversion as proof of plan quality.
