# Codex + Claude development workflow

Date: 2026-11-13 | Status: configured workflow, implementation not started

## Team model

Use one coordinator, two builders and an on-demand independent reviewer. Personas
are reusable roles, not nine permanently running agents. Default assignments below
are an organizational choice; either harness can take a role if a task card records it.
The user owns product priorities and material scope decisions. The coordinator resolves
routine engineering choices within those priorities and reports tradeoffs.

| Persona | Default harness | Responsibility | Main output |
| --- | --- | --- | --- |
| Coordinator / integrator | Codex | Task shaping, dependencies, ownership, integration | Board, contract decisions, integrated evidence |
| Architect | Claude | Data/API/event contracts, dependency spikes | Versioned contracts and short ADRs |
| Platform engineer | Codex | SQLite, migrations, jobs, GitHub connection, retention | Durable backend behavior |
| Retrieval engineer | Codex | Indexing, vectors, repository routing and evaluation | Retrieval pipeline and measured results |
| Experience engineer | Claude | Navigation, Ask/plan editor, session UI, accessibility | Working user flows against agreed contracts |
| Runtime engineer | Codex | Isolated runners, session states, events and PR operations | Observable, recoverable execution |
| Integration engineer | Claude | Model providers, execution adapter spike, skills/plugins/memory services | Tested adapter and customization boundaries |
| Quality reviewer | Opposite harness to author | Requirement coverage, regressions, independent acceptance evidence | Findings or exact-commit approval |
| Security reviewer | Opposite harness where practical | Secrets, grants, runner boundary and external effects | Boundary findings and release risks |

See [personas](personas) for scope, behavior, non-goals and output requirements.
Reviews may reuse an idle builder under a reviewer persona in a fresh session; avoid
carrying the author's conversational assumptions into the review. Review-only Claude
roles have read/search tools; the integrator runs any additional requested commands.

## Division by milestone

| Wave | Codex lane | Claude lane | Gate before next wave |
| --- | --- | --- | --- |
| Planning baseline | Coordinator: review backlog and checkpoint setup | Architect: review minimal interfaces once assigned | Committed shared baseline; initial contract packet approved |
| M0 foundation | Platform: storage/migrations/jobs/secret interfaces | Experience: navigation skeleton using frozen fixtures | Cross-review, integrator wiring, existing demo/regressions pass |
| M1 connections | Platform: F01 GitHub/catalog | Integration: F07 provider profiles | Stable catalog/provider behavior and credential boundaries |
| M1 context | Retrieval: F02 chunks/index/hybrid retrieval | Experience: F11 catalog/indexing UI | Real data replaces fixtures; restart/coverage checks pass |
| M1 planning | Retrieval: F03 routing + backend F04 plan service, sequential if needed | Experience: F04 Ask/plan editor against agreed contracts | Cited plan, versioning and freshness handoff verified |
| M2 execution preparation | Runtime: event/state/runner contract spike | Integration: first coding-adapter lifecycle spike | Choose one proven adapter and container interface |
| M2 execution | Runtime: F05 session service and runner | Experience: F05 session timeline/diff/checks UI | Real session + reconnect/cancel/recovery verified |
| M2 publication | Runtime: F06 push/PR reconciliation | Quality: end-to-end acceptance audit | Prompt → plan → real session → draft PR pilot |
| M3 customization | Platform/retrieval: F10 memory service and deletion | Integration: F08 skills then F09 plugins | Version/grant/context contracts validated before UI wiring |
| M3 experience | Coordinator: integration and independent review | Experience: skills/plugins/memory management screens | Context preview, deletion and no permission escalation |

Do not run every feature simultaneously. F02 depends on usable catalog/provider
contracts; routing depends on real retrieval; execution depends on a pinned ready
plan. Subdivide board work packages into focused cards before assignment. Tests of
an author's feature belong in that author's scope; independent reviewers do not race
the author to edit the same tests.

## Contracts before parallel work

Architect proposes, coordinator owns/accepts, consumers review. Store accepted
contracts under `docs/contracts/` and decisions under `docs/architecture/` when created.
The initial packet must define:

1. IDs, repository identity, snapshot SHA, timestamps and common error shape.
2. SQLite migration ownership, job states/leases and secret-reference interface.
3. Catalog/provider health responses and minimal UI fixtures.
4. Plan/version/readiness schema and launch request idempotency.
5. Session event envelope, sequence/replay and state-transition ownership before M2.

Freeze only the slice needed by the next wave. A versioned fixture is an interface
example, not a substitute for integrating the real backend. Contract changes get a
coordinator decision plus an explicit consumer migration task before dependent work
continues. One owner allocates migration identifiers; no parallel numbering guesses.

## Work-item protocol

`backlog → ready → running → review → integrated`; any active item can become
`blocked`, and obsolete items become `archived`. Integrated means applied to the
local integration branch and checked; remote PR merge status is tracked separately.

`depends_on` gates task start. `completion_depends_on` permits fixture-first work
but blocks review/integration until real service dependencies are integrated. Exclusive
write ownership is an additional gate: cards touching the same web assets run in
sequence. M1-INTEGRATE, M2-INTEGRATE and M3-INTEGRATE explicitly schedule shared
entrypoint wiring and combined milestone checks; merging new modules alone is insufficient.

A backlog card becomes ready only after dependencies, inputs, branch/worktree,
base SHA, exclusive paths, acceptance, reviewer and handoff are assigned. The board
contains planned defaults; assignment sets actual owner/session identity. Only the
coordinator edits the board, avoiding a shared status file write race.

Workers write task-local `status.md` and `handoff.md` in their worktree under
`docs/agents/runs/<task-id>/`. Update status at start, phase transition, blocker and
handoff; during long work include periodic concise updates. A silent pane is not a
reliable heartbeat. The coordinator inspects handoffs by exact worktree path and
updates board fields. Handoffs carry no credentials or raw private terminal logs.

A blocked card records cause, owner, next action and what can proceed independently.
Do not solve an ownership conflict by editing outside scope. The coordinator may
reassign scope or split a dependency. A failed worker is not automatically relaunched
until process and worktree state are reconciled.

## Review and integration gates

1. Builder runs focused checks and records actual results, changed files and commit SHA.
2. Integrator prepares a review packet from Git objects at the submitted commit:
   base/submitted SHAs, exact diff, changed-file snapshots, relevant contracts and check
   evidence. Keep it under a submitted-SHA directory with a content-hash manifest,
   outside the author's mutable checkout. Read/search-only reviewers consume this packet;
   its source commit and manifest are rechecked by the integrator before integration.
   Reviewer examines that exact-commit packet against requirements and contracts.
3. Findings include severity, source location, reproduction/evidence and requested fix.
   The author fixes on its own branch; review approval binds to the final commit.
4. Security-sensitive GitHub credentials, execution, plugins and external writes receive
   the boundary review in addition to normal quality review.
5. No unresolved blocking/major finding passes integration unless the user explicitly
   accepts its concrete limitation. Minor follow-ups are recorded with an owner.
   Integrator applies only reviewed task commits to a dedicated integration branch,
   resolves shared-entrypoint changes and runs affected combined regression checks.
6. Update the board with integrated SHA and evidence. Publishing/merging remotely follows
   the user's authorization; a tmux/Herder session never counts as review approval.

No mandatory confirmation at every local edit or test. Only missing product decisions,
unsupported scope or new external effects need escalation. Respect authorization already
given rather than repeatedly asking the user to approve the same action.

## Coordination interfaces and limits

- Git branches/worktrees carry code; committed contracts carry interfaces.
- Board carries ownership/state; task-local artifacts carry evidence and blockers.
- tmux carries terminal visibility; it does not route messages or merge work automatically.
- Herder can replace session visibility/launch after evaluation without replacing task,
  worktree, review or integration rules. Do not launch the same task in both interfaces.
- Native Codex subagents are Codex sessions, not Claude. Genuine cross-harness work
  requires the actual Claude CLI and a recorded session/handoff; none ran during setup.
- Development isolation via worktrees is not the container isolation required by F05.

## Completion and recovery

A task is complete only when requirements, checks, handoff and independent review
are satisfied. A milestone needs the master PRD exit gate, not merely green unit tests.

If a CLI disconnects, attach/resume its recorded session when possible. If it exits,
inspect status, diff, branch, child processes and last event before retry. Reassign on
the same task branch only after the previous writer is confirmed stopped. Keep old
attempt evidence and record a successor attempt. Do not kill unrelated processes,
remove dirty worktrees or silently reset partially completed work.
