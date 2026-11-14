# Builder handoff — M2-RUNNER-SPIKE

## Identity

- Author/harness and session ID: Claude (Claude Code, Opus 5.5) as runtime engineer; one session, no nested agents.
- Persona, branch and worktree: runtime engineer persona; worktree `opendevin-m2-runner-spike` (isolated git worktree).
- Base SHA and submitted commit SHA(s): base `4f068baa1677579718f2d9c22acffc75cee88137`; submitted = the commit containing this handoff (see `git log`, message "feat: add isolated Docker runner, guarded tool broker and MCP bridge spike").
- Task card and requirement IDs: `task.json` here; F05 SE-02, SE-04, SE-08, SE-09, SE-11; F07 AI-10, AI-11.
- Status: review (candidate only; needs fresh Codex boundary review before integration).

## Outcome

Built a dependency-free implementation of the accepted `docs/contracts/m2-execution-spike.md` runner/broker/bridge interfaces:

- `repoask/execution/runner.py` — `DockerRunner(instance_id, *, docker_binary=None)` and frozen `RunnerHandle` (container_id has `repr=False`; public dicts never include it).
  - Docker CLI: only a trusted absolute executable from fixed locations is accepted (regular, executable, owner root or current user, not group/world-writable, parent likewise). PATH and cwd are never consulted. Minimal env passthrough (HOME/USER/DOCKER_*).
  - Every subprocess: argv arrays, own process group, byte caps applied while reading (excess drained, not buffered), deadline with process-group kill, cancel event, stragglers killed after exit.
  - `docker create`: `--pull never` by resolved `sha256` image ID, network none, cap-drop ALL, no-new-privileges, user 65534:65534, read-only root, `--init`, tmpfs `/workspace` (exec, size, nr_inodes, mode 0700, uid/gid 65534) and `/tmp` (noexec, size), memory = memory-swap, cpus, pids, nofile/core ulimits, log-driver none. Labels cover instance/session/attempt/limits. PID 1 runs `sleep wall_seconds`, so the container ends itself at the wall limit. No `-v`/`--mount`/privileged/device/namespace flags; caller limits are validated integers, never Docker options.
  - After create and before start, `docker inspect` is used to verify binds/mounts/volumes absent, network none, read-only root, caps, no-new-privileges, tmpfs set, pids/memory and user. On any provision failure the just-created container is removed.
  - The image must provide the required POSIX tools (checked after start). Files are uploaded as an in-memory tar via `docker exec -i tar -x` into the tmpfs. Nothing is written on the host.
  - File operations: the path is validated (relative, no `.`/`..`/empty, no control characters, length limits), then a fixed in-container POSIX script runs with the path passed only as a positional argument. It rejects symlinked parents and symlinked final components. Writes go to a temp file and are renamed into place (so a symlink is never followed), and ENOSPC maps to `workspace_full`. Delete removes only files or links, never a link's target.
  - `run_command`: wrapped in in-container `timeout -k 2 N`, with a host deadline of N+10. Output is capped at `max_output_bytes`. Returns exit_code, stdout, stderr, timed_out, truncated.
  - `snapshot`: in-container `tar -c` parsed in memory by `parse_workspace_tar`. Only regular files are accepted. Symlinks, hardlinks, devices, FIFOs, sparse entries, traversal and absolute names (including PAX path overrides) and duplicates are rejected. Over-limit size or count raises `limit_exceeded`. `compare_snapshots(base, current)` gives added/modified/deleted.
  - `stop`: verifies ownership, sends KILL, polls until the container is confirmed not running (within 10 s) or returns `containment_unverified`. It is idempotent (`already_stopped`/`absent`).
  - `discard`: only verified owned, stopped containers. `list_owned`: label-validated handles for this instance only. `provision` refuses a second container for the same session (`session_exists`).
- `repoask/execution/broker.py` — `ToolBroker(runner, handle, *, guard, emit, checkpoint=None, ask_user=None, excluded_paths=())`.
  - Exact tools: list_files, read_file, search_text, write_file, delete_file, run_command, ask_user. Closed JSON schemas.
  - Guard is checked before every tool (a denial never touches the runner) and again before returning any result. Unknown codes and guard exceptions fail closed to `policy_denied`.
  - Calls are serialized. Events are bounded scalar summaries only (path, program basename, argc, sizes, exit code); no content, output or query text. If `tool_started` cannot be persisted, the tool is not started.
  - Checkpoint runs after write/delete/run_command; `checkpoint_now()` is for pre-termination.
  - `.git` components and excluded globs are denied for read/write/delete and filtered from list/search.
  - search_text is fixed-string grep inside the container, result-capped.
  - ask_user without a callback returns `unsupported`, honestly.
  - `start()`: fresh 0700 dir, 0600 token, 0600 Unix socket. Peer-UID check is best-effort (SO_PEERCRED / macOS LOCAL_PEERCRED), plus a constant-time token check. `close()` revokes the token, drops live connections and removes the directory. A new broker always gets a new path and token.
- `repoask/execution/mcp_server.py` — `python -m repoask.execution.mcp_server --socket PATH --token-file PATH`.
  - Validates that the dir/socket/token are owned by the current user and not group/other-accessible, that the token is not a symlink (O_NOFOLLOW) and that the socket and token share one directory. Refuses with exit 2 and empty stdout.
  - Newline JSON-RPC 2.0 implementing initialize (negotiates 2025-11-25/2025-06-18/2025-03-26/2024-11-05, otherwise latest), notifications/initialized, ping, tools/list and tools/call (tool errors → `isError`, unknown tool → -32602).
  - Errors: -32002 before initialize, -32601 for resources/prompts/sampling/roots/logging, -32700 parse, -32600 batch/invalid. Capabilities: tools only.
- `repoask/execution/__init__.py` — exports only; importing starts nothing.

Scope: only task-card exclusive paths changed (the four `repoask/execution/*` modules, the two test files and `docs/agents/runs/M2-RUNNER-SPIKE/**`). No main/API/schema/contract/manifest change. No MCP SDK or other dependency (none installed, none proposed).

Additive deviations for coordinator acceptance:
- `ToolBroker(..., excluded_paths=())` keyword.
- `ToolBroker.tools()`, `call()`, `checkpoint_now()`.
- `start(runtime_root=None)`.
- Module helpers `compare_snapshots`, `validate_relative_path`, `validate_limits`, `parse_workspace_tar`, `run_bounded`, `discover_docker_binary`.
- `RunnerError.code` stable codes.

## Verification evidence

Environment: macOS host, Python 3.12.0, Docker Desktop Engine 28.3.2 (context desktop-linux). Images present locally (not pulled by runtime): debian:stable-slim `sha256:00959f189b92…a48c`, python:3.12-slim `sha256:78976a69c067…a0db`, both linux/amd64.

| Requirement | Command or scenario actually run | Result / evidence |
| --- | --- | --- |
| Pure boundary checks | `python3 -m unittest tests.test_execution_runner tests.test_execution_broker` | 53 run, OK, 5 Docker-gated skipped |
| Regression | `python3 -m unittest discover -s tests` | 264 run, OK (30 skipped) |
| SE-02/SE-09 real isolation (two sessions, nonroot, network none, no host mounts) | `python3 docs/agents/runs/M2-RUNNER-SPIKE/run_docker_tests.py debian:stable-slim` and `... python:3.12-slim` | 5/5 OK on each image (68 s / 58 s) |
| Same, probe evidence | `python3 docs/agents/runs/M2-RUNNER-SPIKE/docker_probe.py` (both images) | uid/gid 65534; CapEff=CapBnd=0; NoNewPrivs 1; no routes, only `lo` up (kernel fallback tunnels down); no host markers or docker.sock; peer session file not visible (no timeout); root write exit 1; `/tmp` exec 126; pids.max 64; memory.max 536870912; DNS fails |
| Strict workspace byte cap | probe and test with `workspace_mib=1` | 3 MB write stopped at 1044480 B (rc=1); `write_file` → `workspace_full` |
| Bounded output and time | probe and test | 300 kB output truncated to 65536 (or 1024 when configured); `sleep 60` with 2 s timeout returned timed_out in 2.2–2.6 s, and no leftover in-container process |
| Safe snapshot | pure tar tests and real test | symlink/hardlink/dev/fifo/traversal/PAX override rejected; no host extraction (cwd stays empty); real symlink → read `unsafe_path`, snapshot `snapshot_rejected`; hardlink rejected; manifest diff added/deleted correct |
| SE-08 stop | real test and probe | stop confirmed `stopped` in 0.2–1.6 s with a background process running; repeat `already_stopped`; later exec → `not_running` |
| SE-11 / orphan recovery | real test | a fresh runner with the same instance lists the session from labels, reads its file; another instance sees none; discard refuses a running container; a forged session label on the handle → `ownership_unverified`; cleanup leaves zero owned |
| SE-04 guard / policy | broker tests | denial before start: zero runner calls; stop mid-tool withholds source and blocks the next tool; events contain no secret content; `.git`/excluded/unsafe paths are denied before the runner |
| MCP protocol | broker tests spawning the real bridge subprocess over a real Unix socket | initialize/version negotiation, initialized notification, list/call, error codes, stdout protocol-only, clean EOF exit 0; endpoint refusals (0644 token, 0750 dir, symlink token, split/relative paths, revoked endpoint) exit 2 with empty stdout |
| Broker over real Docker via MCP | `BrokerOverRealDockerTest` | the bridge edited a synthetic `calc.py` fix, search found it, validation command ran in the container, checkpoint captured the diff, stop then confirmed and further tools denied |

Two real bugs were found by the tests and fixed:
- The macOS process-group straggler kill depended on `waitid(WNOWAIT)`. It now kills the group while descendants still hold our pipes; POSIX forbids pid reuse while the group exists.
- `preflight` raised `UnboundLocalError`.

Not run / not claimed:
- No model CLI and no inference. The Claude adapter/initialize inventory with an installed CLI is the next adapter spike.
- The arm64 native image was not tested (images are amd64 under emulation).
- Linux-host Docker and rootless Docker were not tested.

## Risks and next action

- Known gaps:
  - Read/write TOCTOU: a background process left by an earlier `run_command` could swap a path component for a symlink between check and open. Exposure is limited to that container's own image files (no host or other-session data is mounted). Fix idea: kill non-PID1 processes after each command or use an in-container `O_NOFOLLOW` helper.
  - Snapshot consumers must not apply `.git/**` or hook paths to a host checkout. `run_command` can create them inside the container; the broker only blocks direct tool writes.
  - There is no explicit per-session CPU-time budget beyond `--cpus` and wall time.
  - `ask_user` callback lifecycle and the follow-up path are untested with a real adapter.
  - Peer-UID check on macOS is best-effort.
  - The bridge needs `repoask` importable (PYTHONPATH or installed package) when the adapter launches it from an empty trusted dir.
- Migrations/configuration needed: none. Gated tests need `OPENDEVIN_DOCKER_TESTS=1` (optional `OPENDEVIN_TEST_IMAGE`) or the owned wrapper `run_docker_tests.py`.
- Background processes still running: none. Probes and tests removed every container they created (`owned_after_cleanup: []`). They touched no unrelated Docker resources and pulled no images.
- Sandbox notes: direct `docker` Bash commands and env-prefixed or redirected commands were denied by this session's approval policy. Real Docker ran through owned Python scripts as root sanctioned. No permission bypass was used.
- Reviewer and requested review scope: fresh Codex boundary reviewer. Please cover the runner flags and inspection, in-container scripts, tar parser, endpoint permissions/token, MCP error semantics and the gaps above.
- Blocker owner: none for this card. Adapter spike owner consumes `ToolBroker.start()` output.

Do not treat this as integrated, approved or published.
