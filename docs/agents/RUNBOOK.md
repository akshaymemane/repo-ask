# Multi-agent launch runbook

## Current setup and prerequisites

Checked locally on 2026-11-13: tmux 3.4, Codex CLI 0.160.0 and Claude Code 2.1.311
are available. Presence/version checks do not establish active login or model access.
Herder was not found on PATH. No CLI agent session or product implementation was
started while preparing this workflow.

This runbook is for a future authorized implementation wave. It is not a request to
start the commands now. Inherit configured models; no hardcoded model selection,
permission-bypass flags, new subscriptions or global configuration changes are needed.

## 1. Establish a shared baseline

The user authorized committing the PRDs and workflow as a shared baseline. A worktree
can see only files included in its base commit. At implementation launch, inspect
`git status`, verify that the selected commit contains the intended planning/workflow
files, and record its exact SHA on the board. Do not automatically stage unrelated files.

Verify from the baseline:

```sh
git status --short
git ls-tree --name-only HEAD 'Master PRD.md' AGENTS.md CLAUDE.md docs .claude
python3 -m unittest discover -s tests
```

Committing setup is authorized; starting implementation is deferred until the user
explicitly says to start. If the selected baseline omits required inputs, delay workers
rather than silently copying mutable drafts into multiple worktrees.

## 2. Shape and assign the wave

Coordinator selects dependency-ready work, freezes the needed contract packet,
creates concrete task cards from `templates/task.json`, and fills actual base SHA,
exclusive paths, author, reviewer and acceptance checks. Split a large work package
until it can produce one reviewable slice. Keep two builders active at a time.

Use task IDs in branch/worktree names. The commands below illustrate a later M0 wave
**after** the contracts card is integrated; they are not ready-to-run assignments now.
Run from the integration checkout:

```sh
git worktree add -b task/m0-platform ../opendevin-m0-platform HEAD
git worktree add -b task/m0-experience ../opendevin-m0-experience HEAD
```

Never reuse an existing task branch for another live worker. Ensure both worktrees
contain the committed PRDs, entrypoint instructions and task cards before launching.
Do not use automatic worktree flags on top of these explicit worktrees.

## 3. Use tmux for visibility

Create a named session; normal shell environments/authentication remain in effect:

```sh
tmux new-session -d -s opendevin-dev -n control -c "$PWD"
tmux new-window -t opendevin-dev -n platform -c "$(cd ../opendevin-m0-platform && pwd)"
tmux new-window -t opendevin-dev -n experience -c "$(cd ../opendevin-m0-experience && pwd)"
tmux new-window -t opendevin-dev -n review -c "$PWD"
tmux attach-session -t opendevin-dev
```

Use the current coordinator session for integration; the control window is an operator
shell, not a requirement to start a second coordinator model. In the **platform** window,
start Codex only after inserting the real task-card path:

```sh
codex 'Read AGENTS.md, docs/agents/personas/platform.md and the assigned task card. Implement only its accepted scope, run its checks, and write the required handoff. Do not start other board tasks.'
```

In the **experience** window, select the configured Claude persona and provide the
actual card path in place of the descriptive placeholder:

```sh
claude --agent experience 'Read the assigned task card and build only its accepted scope. Use the frozen fixtures and write the required handoff. Do not edit Python entrypoints.'
```

The task-card path must be explicit in the final prompt; these examples deliberately
have no real implementation assignment. For Codex, passing the persona path in the
prompt is the portable configuration. For Claude, `--agent` selects the matching
`.claude/agents/` definition verified in the installed CLI help.

Useful operator commands:

```sh
tmux list-windows -t opendevin-dev
tmux capture-pane -p -t opendevin-dev:platform -S -100
tmux attach-session -t opendevin-dev
```

Treat captured output as potentially sensitive; do not commit raw captures. tmux
keeps terminals available across detach, but does not provide task scheduling, automatic
cross-agent communication, process containment or crash-safe model execution.

## 4. Cross-review

Once a builder provides its exact commit and handoff, use an idle reviewer slot.
For Codex-authored work start Claude's `quality-reviewer`; for Claude-authored work
start Codex with `personas/quality-reviewer.md`. Prepare a commit-bound review packet from Git objects: base/submitted SHAs,
exact diff, changed-file snapshots, relevant accepted contracts and actual check evidence.
Place it in an integrator-owned directory named for the submitted SHA with a hash manifest;
do not feed reviewers a mutable author checkout as proof of exact-commit contents.
Put review artifacts in the reviewer/integrator checkout, not the author's files. The coordinator supplies exact paths and expected commit hashes.

Claude review roles have read/search tools only. They return findings in their response;
the integrator saves a filled copy of `templates/review.md` and runs any requested checks. Codex reviewers
also follow the no-source-edit protocol. Do not claim tool configuration creates a hard
shell sandbox. The same author cannot act as the independent reviewer of its own patch.

## 5. Integrate and report

Integrator verifies reviewed SHAs and clean task commits, applies only accepted commits
to its integration branch, and runs the combined affected checks. Record integration SHA
and evidence in the board. Keep the user's original checkout and unrelated changes intact.
No automatic push, PR publication or merge is part of this setup.

## 6. Pause, stop and recover

Ask the worker to stop, interrupt its CLI if needed, then inspect the CLI and child commands
associated with that window before reassignment. Closing a pane does not prove descendants
terminated. Record interrupted state and preserve patches. Resume only one writer per task.
Do not delete a tmux session or dirty worktree as a substitute for confirming execution stopped.

## Optional Herder evaluation

The project assumed here is [herder-sh/herder](https://github.com/herder-sh/herder).
Its README describes managing vendor CLI sessions through a daemon and TUI/native clients,
and labels the project early. If another Herder was intended, its interface must be checked
before adoption. Do not install a daemon or run a remote installer just to read this plan.

Before replacing tmux visibility, verify on a disposable task that Herder preserves explicit
worktree cwd, uses the intended CLI/account, supports inspect/stop/resume, exposes session
identity and does not launch duplicate writers. Check local help for the installed release;
no unverified Herder launch syntax is prescribed here. Keep the same board/handoffs/review gates.
Use one session manager per worker; do not put the same card under both launchers.

## References

- [Claude custom subagents](https://code.claude.com/docs/en/sub-agents): project Markdown role definitions and tool controls.
- [tmux manual](https://man.openbsd.org/tmux.1): session/window/attach commands.
- Codex command syntax was checked against local `codex --help` and `codex exec --help`.
