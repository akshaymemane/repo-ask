# Backlog: Codex CLI coding-agent adapter for sessions

Requested by the user on 2026-11-16. M4 scope ("additional coding-agent adapters").

## Goal

Offer Codex CLI as a second session agent beside the Claude Code adapter
(`repoask/execution/claude.py`), selectable per execution profile.

## Contract to satisfy (from the M2 adapter spike, `docs/contracts/m2-execution-spike.md`)

- Headless start with the prompt on stdin, never in argv; allowlisted environment.
- Built-in tools disabled; the agent acts only through the OpenDevin MCP tool broker
  (`list_files`, `read_file`, `search_text`, `write_file`, `delete_file`,
  `run_command`, `ask_user`). Exact trusted tool inventory verified before the broker
  gate opens.
- Personal login only (`cli_login`); managed or organization profiles refused.
- Verified stop: process-group termination confirmed, or `containment_failure`.
- Usage and cost `None` when not reported, never zero.
- Same real-probe evidence as Claude: fixed synthetic task, cancellation, `ask_user`
  round trip, no startup canaries, containers removed.

## Depends on

M2 integration (sessions, PR publication and pilot) and an execution profile UI that
can choose the adapter.
