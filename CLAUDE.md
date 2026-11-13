# Claude Code instructions for OpenDevin

Read and follow `AGENTS.md` first. It is the shared project collaboration contract.
Then read `docs/agents/WORKFLOW.md`, the assigned canonical persona and task card.

Project role definitions live in `.claude/agents/`; their canonical role instructions
live under `docs/agents/personas/`. These are development personas, separate from
OpenDevin's future user-managed skills, plugins and memory.

Default Claude responsibilities are architecture/contracts, experience engineering,
provider adapters and independent review. These are assignments, not claims that
only one model can perform a role. A task card takes precedence over default ownership.

Do not start backlog implementation because this file exists. When assigned work,
use its worktree, respect exclusive paths, and return a durable handoff. Do not delegate
further unless the coordinator assigns a subtask and concurrency slot. Reviewers do
not edit the author's branch; return findings and let the author address them.
