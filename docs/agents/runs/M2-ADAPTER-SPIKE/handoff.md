> R1 review: CHANGES REQUESTED for9de6eeb. The earlier verification below is
> historical development evidence, not acceptance for the revised source. The
> prior JSON had manual post-run capability annotations and did not identify the
> final source. It is preserved unchanged under historical/. See
> review-r1-resolution.md; new committed-source proof is pending.

# Builder handoff — M2-ADAPTER-SPIKE

## Identity

- Author/harness: native Codex subagent `/root/adapter_spike`; integration/runtime personas. No nested agents.
- Branch/worktree: `task/m2-adapter-spike`, `/Users/apple/workspace/vibe-coding/opendevin-m2-adapter-spike`.
- Base SHA: `4f068baa1677579718f2d9c22acffc75cee88137`. Submitted implementation SHA: `678942138f9dca155cd37053ef7e017123ccbf8d`; evidence/handoff commit follows it. Final review target is the evidence commit supplied to coordinator.
- Dependency-only commits in this worktree: runner `dae233d` → local `e610f9e`, runner fix `d7d420e` → local `c731a18`. These belong to the runner card and are not adapter implementation.
- Task: task.json here; F07 AI-10/AI-11, F05 SE-04/SE-05/SE-08/SE-09/SE-11.
- Status: review; not integrated or approved.

## Outcome

Implemented `repoask/execution/claude.py`, `repoask/execution/adapter_process.py`, `tests/test_execution_adapter.py`, and task-local artifacts only. Consumes the accepted `docs/contracts/m2-execution-spike.md` interface.

`ClaudeAdapter.run(endpoint,prompt,*,auth_mode,on_inventory_verified,emit,synthetic=False,local_only=True,external_source_consent=False,stop_event=None,...)` is a bounded single attempt. The trusted session service must share its stop Event with the broker guard and adapter, keep the broker denied until `on_inventory_verified`, and close/stop the broker/container in a `finally` block. The helper sets the shared Event before any cleanup, including internal deadline/output/parser failures and successful completion.

- Normal CLI login only, selected explicitly. CLI `auth status` supplies only metadata; identity fields are discarded, and no credential files/tokens/Keychain values are read or copied by product code. Personal first-party pro/max/ultra profiles only; known local managed policy paths and other auth profiles are rejected. API-key auth is explicitly unsupported.
- No model or reasoning override. Real source is rejected unless local-only is off and explicit external-source consent is true. All real probes used synthetic fixture source only.
- Launch uses a fresh trusted empty cwd, `--restricted`, empty builtins, strict single MCP configuration, disabled slash commands, no persistence, empty setting sources, unattended denial, trusted explicit settings, fresh plugin cache, and constrained environment. No host command/file tool fallback.
- Exact seven trusted MCP names and one connected `opendevin` server required before opening the guard. Additional server metadata is harmless; additional servers/tools/plugins/commands fail closed. The exact tools/server gate fails closed; optional init metadata checks apply only to fields observed in the supported schema.
- CLI plugin-list metadata supplies per-invocation `enabledPlugins:false` overrides; no plugin/account settings change. Known built-ins `cc-plugin-agents-md@builtin` and `cc-plugin-plugin-authoring@builtin` are explicitly disabled. The security guard is never disabled.
- Host CLI process group owned per attempt. Non-reaping Darwin kqueue/Linux waitid supervision retains the leader until group termination, including descendants redirecting every pipe. Output is bounded before buffering; stderr discarded. Cancellation/deadlines/output limits revoke the shared guard before termination. Unknown usage/cost remain null.
- Events allow assistant summaries, tool names, final classification and numeric usage only. Tool inputs/results, private thinking, API error bodies, hook/progress messages and identity fields are discarded. Only final process exit can produce a completed result.
- Resume/checkpoint/follow-up are explicitly false. ask_user is proven and true only with the trusted broker callback (ask_user_requires_callback=true); no stdin delivery is claimed. Broker checkpoints preserve inspectable workspace changes, but they are not adapter-resumable checkpoints.

Coordinator accepted synthetic-spike configuration correction: `--safe-mode` disables explicit MCP, so strict-broker mode uses individual customization controls instead. Official references: [CLI](https://code.claude.com/docs/en/cli-reference), [settings](https://code.claude.com/docs/en/settings-reference), [builtin mods](https://code.claude.com/docs/en/plugins/mods/overview), [managed policy](https://code.claude.com/docs/en/managed-settings). Built-in mods survive general hook/safe-mode controls, requiring explicit ephemeral false entries. Managed-host isolation is not claimed.

## Verification evidence

| Requirement | Command or scenario actually run | Result / evidence |
| --- | --- | --- |
| AI-10/AI-11 detection | `ClaudeAdapter().preflight()` and installed `claude --version/--help`; CLI auth/plugin metadata queries | Claude Code 2.1.311; personal first-party profile reported. Version/auth metadata is not inference verification. |
| Boundary regression | `python3 -m unittest discover -s tests -p test_execution_adapter.py -v` | Final22 tests passed after retained-leader, shared-gate, failed-monitor setup and proven ask_user capability metadata (32.814s). Real subprocesses prove deadlines/output caps/descendant cleanup; fake CLI streams are not inference acceptance. |
| Baseline + initial runtime dependency | `python3 -m unittest discover -s tests` | Initial dependency run:281 passed/30 skipped,210.638s. Updated runtime/helper run:297 passed/30 skipped,235.498s. Latest focused checks cover final startup-error defense and capability metadata. |
| SE-04 tool isolation | Initial authorized real attempts | Safe-mode MCP omission, installed/builtin plugin presence and additive server-metadata mismatch all failed closed. No coding tools started. Sanitized rejection evidence is preserved separately. |
| SE-04/SE-05/SE-09 real coding | `python3 docs/agents/runs/M2-ADAPTER-SPIKE/real_probe.py` | Exit 0. Final Claude PID33050, configured claude-opus-5-5 without overrides, read calc/test, changed subtraction to addition, ran python unittest through MCP/Docker; separate validation exit0 and unified diff recorded. 15.342s, CLI-reported usage and cost0.0193024 retained. No actual billing claim. |
| SE-08 actual CLI cancellation | Same final explicit probe, sequential PID33374 | Verified inventory then cancelled; exit143, group stop confirmed, 4.071s total including startup (an upper bound on containment), zero tool starts; usage/cost null. |
| Canary + cleanup | Same explicit probe | Caller-cwd CLAUDE.md/skill/hook and env-injected plugin canaries present; hook marker false, init plugins/commands empty. Containers confirmed stopped/discarded, zero owned afterward. |
| SE-07 actual question round trip | Final explicit probe, sequential PID33441 | Actual ask_user call asked the synthetic question; trusted stop-aware callback returned hidden MARIGOLD_4821; final model acknowledgment exactly ACK: MARIGOLD_4821. Exit0,9.142s; capability promoted only after proof. |
| Final dependency/helper verification | Updated runtime d7d420e + retained-leader helper | Final three-attempt probe exit0; all process groups and containers stopped, owned containers0. Runtime independently reviewed/integrated by coordinator. |

The explicit probe creates synthetic containers only and asserts coding/tool-use/diff/validation/cancellation/canary/cleanup outcomes. It is not auto-run in ordinary tests. Evidence files omit reasoning, identity and raw terminal captures.

## Risks and next action

- Implementation commit6789421 is ready; independent exact-commit boundary review required against the final evidence commit.
- Verified host: macOS, Python3.12, installed Claude2.1.311, Docker Desktop, cached python:3.12-slim digest `sha256:78976a69c067520ef8be34cde307ef9f6fea6dcefa50edb57039773d241ca0db`. Linux supervision is implemented but not proven on a Linux host.
- Managed enterprise/Team/other auth environments remain unsupported; do not infer universal isolation from personal-profile proof. Known policy existence/profile checks cannot attest to every future CLI policy delivery mechanism.
- Source privacy booleans, broker guard ownership and lifecycle callbacks must come from the trusted service, never model tool arguments. Session orchestration must terminate CLI/container concurrently to respect its combined stop deadline.
- Durable pending-question persistence/HTTP answer delivery and generic follow-up integration remain later session-service work; adapter ask_user callback/answer/acknowledgment is proven. Follow-up/resume remain false. No production sessions, schema migration, UI wiring, GitHub publication or real repository source transmission performed here.
- Runtime card boundary findings and final independent review remain coordinator-owned; candidate dependency is not release acceptance.
- Background processes: none owned. Final Claude PIDs33050/33374/33441 and all test/probe processes stopped; owned containers0. All focused/full checks completed.
- Reviewer: coordinator to assign independent Claude boundary reviewer against exact adapter commit; author does not approve their own changes.
