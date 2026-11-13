# OpenDevin development agents

## Purpose and source of truth

These instructions govern agents building this repository, not the product's future user agents.
Read `Master PRD.md`, the assigned feature spec, `docs/agents/WORKFLOW.md`, your
persona under `docs/agents/personas/`, and your assigned task card before work.
`docs/agents/board.json` is the coordinator-owned planning board. Its initial cards
are backlog work packages, not authorization to start implementation.

## Current launch gate

The user authorized committing this setup and explicitly deferred implementation until
they say to start. Do not launch implementation agents or workers before that instruction.
Once given, schedule dependency-ready work under the concurrency limits below.

## Collaboration contract

- Exactly one coordinator/integrator owns scheduling, contracts, shared entrypoints
  and integration. Default: Codex; a handoff can explicitly designate Claude instead.
- Use one task, branch and Git worktree per writing agent. Do not share a writable
  checkout between independent CLI sessions. Worktrees isolate changes, not secrets/processes.
- Start with coordinator plus at most two builders; one reviewer may run when useful.
  Keep at most four active agents total, including nested agents and the coordinator.
- Delegate only an assigned, dependency-ready task. Do not recursively spawn workers
  or consume the remaining concurrency budget without coordinator assignment.
- Every task needs a base SHA, exclusive write scope, requirement IDs, inputs,
  acceptance checks, reviewer and handoff destination before it becomes ready.
- Read dependencies freely; edit only assigned paths. Ask the coordinator to reassign
  ownership before changing shared contracts, migrations or files owned by another card.
- The coordinator serializes changes to `repoask/__main__.py`, `repoask/index.py`,
  `repoask/answer.py`, `tests/test_repoask.py`, manifests and shared configuration.
  Explicit temporary assignment is allowed; two tasks never own one hotspot concurrently.
- Preserve unrelated changes. No reset/clean, force-push, deletion of worktrees,
  package installation or permission-bypass flags as an orchestration shortcut.
- No autonomous push, PR publication, merge or product implementation is implied by
  this setup. Follow the user's current task authorization; do not ask again for work
  already authorized in the session.

## Contracts and evidence

- Freeze affected API/data/event contracts before dependent parallel implementation.
  Propose contract changes to the coordinator; do not silently change fixtures and consumers.
- Inherit the user's configured models; roles do not mandate a model or reasoning level.
- Record changed files, commits, commands, results, known gaps and requirement coverage
  using `docs/agents/templates/handoff.md`. Distinguish checks run from checks proposed.
- Update only your task-local status/handoff; the coordinator updates the board.
- Review against an exact commit. Prefer the other harness for review; an author cannot
  approve their own work. Review findings carry severity, file/line and concrete evidence.
- Only the integrator applies reviewed commits to the integration branch. Rerun affected
  regression/integration checks after combining changes, then mark integrated.
- Never report a native Codex subagent as Claude. CLI availability does not prove login,
  inference success or a running session. Keep durable status distinct from terminal activity.

## Current baseline and checks

The shipped prototype is Python, SQLite FTS and static web assets. It is read-only,
local and limited to explicit checkouts. Preserve source citations and the demo while
migrating. Proposed folders in task cards do not exist until their task implements them.

Run the current regression suite with `python3 -m unittest discover -s tests`.
Use focused behavior checks for new state, recovery and permission boundaries;
add integration checks where independently built components meet. Do not write
implementation-mirroring tests or claim docs-only validation proves runtime correctness.

Never put provider credentials, private source or full terminal captures into shared
coordination artifacts. Skills, persona prompts, tmux and Herder are coordination aids,
not security sandboxes. Stop/restart requires checking owned child processes and
worktree state; killing a pane alone does not prove work stopped.
