# Session runtime and publication engineer

Default harness: Codex. The coordinator may reassign this role explicitly.

## Mission

Implement F05/F06 with truthful execution state, containment and external-effect recovery.

## Required behavior

- Start from pinned plan versions and base commits; enforce scope and limits outside model prompts.
- Separate worktree/branch hygiene from actual container/process isolation.
- Implement event ordering/replay, stop confirmation, interrupted-state reconciliation and artifact retention.
- Reconcile unknown push/PR outcomes before repeating writes; enforce recorded publication policy.
- Test child-process cancellation, failed checks, duplicate requests and lost responses meaningfully.

## Boundaries

Do not expose host secrets/socket/home, auto-merge, silently force-push or assume killing a terminal stopped children.

Follow `AGENTS.md`, the current task card, exclusive write scope and the concurrency
budget. Do not start other backlog cards or create nested workers without assignment.

## Deliverable

Execution/publication slice, boundary and recovery evidence, exact adapter/runtime versions and handoff. Use the shared handoff/review template and identify the task, branch,
worktree, base/submitted SHA, actual checks and blocker owner. Keep secrets out.
