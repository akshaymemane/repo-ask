# M2 execution preparation contract

Status: accepted by coordinator for fixture-first runner and adapter spikes. Production launch still requires M1 integration and independent boundary review. F05/F07. No session schema allocated yet (current schema8).

## Boundary and ownership

Coordinator owns contracts, migrations, main/API composition and final session orchestration. Runtime builder owns repoask/execution/runner.py, broker.py, mcp_server.py and execution runner/broker tests. Adapter builder owns repoask/execution/claude.py and adapter tests. Neither edits the other's files. Python package uses no module-level implicit launches.

A model coding harness runs on the host in a trusted empty directory, with zero builtin tools, restricted settings, no skills/hooks/plugins, strict single trusted MCP configuration, no transcript persistence. Only a trusted broker may invoke the pinned session container. Never expose Docker IDs/options, host paths, shell or credentials as model-controlled arguments. Source is untrusted data. No unrestricted host shell fallback.

The runner uses an image resolved to sha256 by preflight; explicit image provisioning may pull python:3.12-slim for synthetic stdlib proof. Runtime execution itself never pulls automatically. No unrelated containers/images touched. No home/socket/worktree bind mounts. Readonly root; network none; capabilities dropped; no-new-privileges; unprivileged UID; PID/CPU/memory/ulimit; separate tmpfs /workspace and /tmp with enforced byte sizes. /workspace may execute validation tools; /tmp noexec. Memory includes tmpfs usage. Container labels identify OpenDevin instance, session and attempt.

## Python runner interface

`DockerRunner(instance_id: str, *, docker_binary=None)` only accepts discovered trusted executable. All subprocess arguments are arrays, bounded outputs/deadlines, process-tree cancellation. Session ids are validated opaque identifiers.

- `preflight(image: str) -> dict`: available, resolved image_id, architecture, supported limits, blocking_reasons; no model or source transmission.
- `provision(session_id: str, files: dict[str, bytes], *, image: str, limits: dict) -> RunnerHandle`.
- `list_files(handle) -> list[str]`; `read_file(handle, path: str) -> bytes`; `write_file(handle,path,content: bytes)`; `delete_file(handle,path)`.
- `run_command(handle, argv: list[str], *, timeout_seconds: int = 30) -> dict`: exit_code, stdout, stderr, timed_out, truncated. All commands inside container /workspace. No network. Bound output bytes before buffering.
- `snapshot(handle) -> dict[str, bytes]`: finite regular files only, no path traversal, symlinks, hardlinks, devices. Parse tar stream without extracting on host; include new/deleted files via manifest comparison. Reject artifact over-limit explicitly.
- `stop(handle) -> dict`: confirmed, code; idempotent, confirm container no longer running within10s.
- `discard(handle)`: remove only verified owned stopped container. `list_owned()` returns handles after validating labels.

RunnerHandle frozen dataclass fields: instance_id, session_id, container_id, image_id. Public API never returns container_id. Default limits: memory_mib512, workspace_mib64, tmp_mib16, cpus1, pids64, wall_seconds600, max_files2000, max_file_bytes262144, max_output_bytes65536. Validate finite bounds, never caller-provided Docker options. Tools may inspect source only inside /workspace. Related readonly context is a later additive scoped directory.

## Broker and MCP bridge

`ToolBroker(runner, handle, *, guard, emit, checkpoint=None, ask_user=None)` owns the fixed runner handle. guard callable returns None when allowed or a stable denial code (stop_requested/lease_lost/budget_exhausted/policy_denied); check before every new tool and before returning source. emit(type, payload) persists only bounded sanitized summaries; no chain of thought. checkpoint(snapshot) called after mutations/commands and before termination where possible. Denials never start a tool or invoke Docker. Tool writes cannot target excluded/unsafe paths; source manifest/policy supplied by trusted service.

Tool names exact: list_files, read_file, search_text, write_file, delete_file, run_command, ask_user. Args contain relative paths/text/argv only, never host paths/runner identifiers. File content is bounded. run_command shell argv is allowed only within the isolated container. ask_user unsupported without callback returns honest unsupported, no fake acknowledgment.

Broker exposes a private per-attempt Unix socket and0600 token file under a trusted owned directory; `start() -> dict` returns socket_path and token_file to trusted caller only, `close()` revokes/stops requests. Bridge CLI: `python -m repoask.execution.mcp_server --socket PATH --token-file PATH`; validates endpoint permissions and caller token, speaks supported MCP stdio lifecycle/tools/list/tools/call, never exposes resource/prompts/sampling roots. Python SDK is preferred if verified dependency is available; otherwise implement tested bounded JSON-line JSON-RPC for CLI-negotiated version, with correct initialize/errors/shutdown behavior. Broker restart invalidates old endpoint. No logs on stdout besides MCP protocol.

## Claude adapter interface (next spike)

`ClaudeAdapter` consumes broker endpoint, approved synthetic prompt, execution limits and explicit auth mode. Detect installed executable/version; no model/reasoning override. Normal CLI login may be explicitly selected by execution profile, using CLI authentication directly: never extract/copy auth files, tokens or Keychain secrets into product, containers or tools. API key mode resolves product secret only at process boundary. Product local-only and external-source opt-in remain enforced before real repository transmission. Synthetic fixture proof is not authorization to share account source.

Start with `--tools "" --restricted --strict-mcp-config --disable-slash-commands --no-session-persistence`, unattended permissions denied, strict trusted MCP tools. Verify actual init inventory equals only trusted names; unexpected tools fail closed. Process-group stop; no host tool permission bypass. Expose only assistant summaries/tool metadata/result/usage, discard private reasoning. Cap wall time, turns and spending; never infer unknown token/cost as0. Checkpoint/resume false until proven. Follow-up and ask_user lifecycle must be tested before marked supported.

## Acceptance / handoff

Real two-container fixture proves no cross-session/host/socket access, secret exclusion, enforced workspace byte cap, unprivileged process, no network, bounded command output/time, symlink rejection and stop. Real MCP initialization/tool use through installed Claude must edit a synthetic fixture, run validation and leave a reviewable diff; no mocked inference acceptance. Test cancellation and orphan recovery. Independent review before integration. No remote GitHub writes. Session and publication contracts follow proven adapter, not invented success.
