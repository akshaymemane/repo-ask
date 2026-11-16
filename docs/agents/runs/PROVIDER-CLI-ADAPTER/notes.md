# Backlog: Claude Code / Codex CLI as Ask and plan provider

Requested by the user on 2026-11-16. Not scheduled.

## Goal

Let Ask answers and plans run on the user's own Claude or Codex subscription login
instead of an API key. Today the provider service (F07) supports only HTTP adapters
(`ollama`, `openai_compatible`); sessions already run Claude Code with `cli_login`.

## Shape

- New provider adapter kind (for example `claude_cli`, `codex_cli`) behind the same
  `ProviderService.generate(role, messages, schema=...)` contract, so routing, plan
  binding and server-side validation stay unchanged.
- Run the CLI headless with the prompt on stdin, JSON output, and the plan JSON schema.
  Built-in tools, MCP servers, plugins and persistence are disabled: Ask never executes.
- Reuse the session adapter's process ownership: process group, deadline, cancellation
  and an allowlisted environment (`repoask/execution/adapter_process.py`).
- Same policy as remote HTTP providers: blocked by local-only mode, and requires the
  per-profile source-sharing opt-in. Destination shown on every answer.
- Usage and cost reported as unknown unless the CLI reports them; calls count against
  the user's subscription limits.

## Acceptance

- Connection test passes `chat` and `structured_output` with synthetic content.
- `tests/plan_evaluation.py` passes the M1 gate (>=8/10 passed, >=9/10 valid).
- Cancel during generation stops the CLI process group within the session stop bound.
- Prompt never appears in argv; no tool, file write or command is possible.

## Open questions

- Exact headless flags and schema enforcement for each CLI version; verify, do not assume.
- Per-call startup latency versus API providers.
- Provider terms for automated personal use of a subscription login.
