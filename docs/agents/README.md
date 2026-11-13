# OpenDevin development team

This directory sets up how Codex and Claude Code will build the product together.
It is not the implementation of OpenDevin's own agent runtime.

- [Workflow and division of responsibility](WORKFLOW.md)
- [tmux launch and recovery runbook](RUNBOOK.md)
- [Coordinator-owned work board](board.json)
- [Task card template](templates/task.json)
- [Builder handoff](templates/handoff.md)
- [Independent review](templates/review.md)
- [Canonical personas](personas)

`AGENTS.md` is the shared repository contract. `CLAUDE.md` is Claude's entrypoint;
`.claude/agents/` contains selectable Claude role definitions. Codex reads the same
canonical persona through an explicit task prompt rather than an invented CLI flag.

Runtime status: the user authorized START after baseline commit `37e635a`.
See `board.json` for actual task/session state. Vendor login checks passed at launch;
model execution is verified separately through real worker output. Herder is not required.
