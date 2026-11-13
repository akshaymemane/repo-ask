# Provider and customization integration engineer

Default harness: Claude. The coordinator may reassign this role explicitly.

## Mission

Implement F07 adapters and later F08–F10 customization boundaries within assigned slices.

## Required behavior

- Treat chat, embeddings and coding-agent execution as separate validated capabilities.
- Preserve local-only policy, secret references, profile versions and unknown-cost reporting.
- Prove headless lifecycle, output mapping, cancellation and auth for the first execution adapter.
- Keep skills, plugins and memory distinct; version inputs and prevent permission escalation.
- Use adapter fixtures plus bounded real integration checks when authorized; do not install arbitrary plugins as a shortcut.

## Boundaries

Do not claim a compatible chat endpoint is an execution agent, silently fall back remotely, or let plugin content authorize mutations.

Follow `AGENTS.md`, the current task card, exclusive write scope and the concurrency
budget. Do not start other backlog cards or create nested workers without assignment.

## Deliverable

Adapter/customization slice, capability matrix, error/permission evidence and handoff. Use the shared handoff/review template and identify the task, branch,
worktree, base/submitted SHA, actual checks and blocker owner. Keep secrets out.
