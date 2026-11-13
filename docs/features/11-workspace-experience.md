# F11 — Workspace navigation and user experience

Status: Draft | Milestone: M0–M3 | Parent: [Master PRD](../../Master%20PRD.md)

## Outcome and boundaries

Provide a coherent browser workspace for moving from a prompt to a plan, then to observable execution. Users should always know which repositories, provider and session they are working with. This document owns shared interaction rules; feature specs own behavior.

## Information architecture

| Area | Main content | Main action |
| --- | --- | --- |
| Ask | Conversations, repository candidates, citations, plan editor | Start session |
| Sessions | Active/history list and detail with activity, diff, validation, artifacts and PR | Follow up / stop / publish |
| Repositories | Catalog, selection, freshness, indexing progress and exclusions | Index / retry / configure |
| Skills | Skill library, editor, version preview and assignments | Create / import |
| Plugins | Integrations, grants, health and versions | Register / enable |
| Memory | Entries, proposals, provenance and scope | Create / review |
| Settings | GitHub, model roles, execution profiles, budgets, storage and retention | Configure / test |

Customization screens ship in M3. Earlier releases should not present nonfunctional controls as available features. Product-facing headings use OpenDevin; Python package/CLI renaming follows a separate migration.

## Functional requirements

- **UX-01:** Offer onboarding for GitHub connection, repository selection and model profile setup. Let users continue browsing while indexing runs.
- **UX-02:** Distinguish demo mode from connected-account mode. Fixtures must never imply that private GitHub indexing or real execution has occurred.
- **UX-03:** Persist navigable conversation, plan and session URLs. Refresh restores saved state; back navigation does not abandon active work.
- **UX-04:** Show selected repository names/owners, write/read roles, base commits and coverage where relevant. Avoid treating a routing suggestion as a confirmed writable target.
- **UX-05:** Keep Ask's planning action and Sessions' execution activity visually distinct. Start session shows the exact plan version and launch settings inline.
- **UX-06:** Session list supports active/terminal filters, repository, date and search, with phase, elapsed time and last activity. Session detail supports replay and reconnect.
- **UX-07:** Source citations open a file/line pane with repository and commit, preserving the conversation or plan context.
- **UX-08:** Clearly distinguish index partial/stale, generation failure, required user input, execution failure, failed validation and failed publication. Each error offers a relevant next action.
- **UX-09:** Display provider destination, local-only status and unknown/estimated usage honestly. Background indexing progress includes partial completion and rate-limit waits.
- **UX-10:** Support full keyboard navigation, visible focus, associated labels, accessible status announcements and non-color-only states. Live output must not steal focus or continuously interrupt screen readers.
- **UX-11:** Protect unsaved plan/skill/memory edits from accidental navigation; save drafts or warn only when edits would be lost.
- **UX-12:** Keep Stop available in active session detail and provide a clear termination result. Closing a browser tab is not equivalent to stopping a session.

## Key states

First-run empty state offers connection or explicit demo mode. Missing provider setup disables generation with a link to configuration while allowing catalog browsing and lexical search. No repositories selected explains selection. Incomplete indexing offers metadata-level discovery and a prioritized indexing action. Offline mode identifies cached data. Lost execution connectivity shows last confirmed state rather than a running animation implying progress.

Layout priority is desktop browser use; narrower screens retain readable plans, session status and stop controls. Drag-and-drop is never the sole method for a required action. Keyboard and screen-reader testing covers the core journey.

## Acceptance criteria

1. A new user can connect, choose repositories and reach Ask without waiting for all indexing jobs.
2. A pilot task can move Ask → saved plan → session → PR without manually finding a checkout or launching a terminal agent.
3. Reloading a live session restores its URL/state and activity sequence without starting another session.
4. Every disabled primary action has an accessible reason and setup/resolution path.
5. Core actions and citation navigation work using a keyboard; dynamic output does not trap or steal focus.
6. Demo, partial indexing, interrupted session and failed publication fixtures each show distinct truthful states.
7. Skills/plugins/memory screens expose scope and version/provenance alongside content when M3 ships.

## Dependencies and measures

Delivered alongside F01–F10 and F12. Measure setup completion, time to first useful plan, repository correction rate and ability to locate a session's current blocker. Validate the flow with task-based pilot observation rather than page-view counts.
