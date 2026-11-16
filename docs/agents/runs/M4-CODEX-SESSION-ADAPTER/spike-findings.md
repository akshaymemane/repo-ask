# M4-CODEX-SESSION-ADAPTER spike findings

Date: 2026-11-16. Author: Claude (native), user-requested. Probe scripts only, no
product code. CLI: `codex-cli 0.160.0`, user's ChatGPT login. Every probe ran in an
empty temporary directory with `--sandbox read-only --ephemeral --ignore-user-config
--ignore-rules --skip-git-repo-check`, using a local stdio MCP server
(`probe_mcp_server.py`) instead of the real broker.

## Verdict: feasible, with two contract gaps to resolve before building

| Contract item (M2 adapter spike) | Codex 0.160 result |
|---|---|
| Headless, prompt on stdin | Yes: `codex exec --json -` reads stdin; JSONL events (`thread.started`, `item.*`, `turn.completed`). |
| Built-in shell off | Yes: `--disable shell_tool --disable unified_exec`. Probe: no command ran, no file created. |
| Tools only through our MCP broker | **Partly.** MCP tools are called through Codex "code mode" (`functions.exec` running in `codex-code-mode-host`). Disabling `code_mode_host` also disables MCP calls, so it must stay on. Code mode additionally exposes `tools.apply_patch`, `clock__curr_time`, `request_user_input` (Plan mode only) and `collaboration.*`. |
| No native writes | Yes, by sandbox: `apply_patch` is rejected under `--sandbox read-only`. The adapter must always pass `read-only`; edits happen only through broker tools in the container. |
| MCP tool approval in headless mode | Needs `-c mcp_servers.<name>.default_tools_approval_mode="approve"`; otherwise every call fails with "requires approval, but approval policy is never". Round trip verified with an unguessable result (`NONCE-7Q4K-2003`). |
| Exact trusted tool inventory | **Gap.** Sub-agents (`collaboration.spawn_agent`) still work with `--disable multi_agent`, `--disable multi_agent_v2` and `-c agents.max_depth=0`. A spawned sub-agent inherited the restrictions (no shell, read-only sandbox, no files written), so it is contained, but the inventory is not exact and sub-agents spend budget. |
| Verified stop | Yes for the CLI: `adapter_process.run_stream` cancelled mid-turn and confirmed the group gone in 8.1 s. **Gap:** Codex starts MCP servers in their **own process group** (server pgid = its pid). It exited only because its stdin closed; `killpg` on the CLI group does not reach it. |
| Personal login only | `codex login status` reports "Logged in using ChatGPT". Must refuse API-key and managed logins, like the Claude adapter. |
| Usage reporting | `turn.completed.usage` has input, cached, output and reasoning tokens. No cost: report cost as unknown. |
| Config isolation | `--ignore-user-config` and `--ignore-rules` skip user config and exec-policy rules; auth still comes from `CODEX_HOME`. `include_apply_patch_tool` is not a recognized key in 0.160 (Codex warns). |
| Latency | 8–25 s per probe turn. |

## Required design decisions for the adapter

1. **Sandbox is a hard requirement.** Always `--sandbox read-only`, never `--approve-for-me`
   or the dangerous bypass flags. Native `apply_patch` exists but cannot write.
2. **Code-mode host stays on** (needed for MCP). Allowlist our broker with
   `mcp_servers.opendevin.enabled_tools=[...]` and approve only that server.
3. **Inventory gate:** the Claude adapter refuses to open the broker unless the init event
   lists exactly the trusted tools. Codex does not emit a tool list; either accept the
   observed residual set (exec, wait, request_user_input, collaboration.*, apply_patch,
   clock) as "contained by sandbox", or fail closed until a version can disable
   sub-agents. Recommend: fail closed on any `collab_tool_call` event (stop the session,
   containment reason `subagent_attempted`), and re-probe on each CLI version.
4. **Broker server process:** because Codex detaches MCP servers into their own group,
   the broker's stdio shim must exit on stdin EOF and the adapter must verify its pid is
   gone after stop (report `containment_failure` otherwise).
5. **Pin and re-probe per CLI version**, as the Claude adapter does for 2.1.311; feature
   names change between releases.

## Not yet verified

- Running against the real `repoask.execution.mcp_server` broker and Docker runner
  (the probes used a stub server and no container).
- A full synthetic implementation task and the real-probe evidence used for Claude
  (`docs/agents/runs/M2-ADAPTER-SPIKE/real_probe.py`).
- Login-expiry behavior, `ask_user` round trip through the broker, output schema for a
  final summary (`--output-schema`).

## Evidence

Probe scripts in this folder: `codex_probe.py` (inventory, MCP, sub-agent probes),
`probe_mcp_server.py` (stub MCP server logging calls and pid/pgid),
`codex_stop_probe.py` (stop through `run_stream`). Outputs were observed live and are
summarized above; no prompts or credentials were recorded.
