# Builder handoff — M2-ADAPTER-SPIKE R1

## Identity

- Author: native Codex `/root/adapter_spike`, integration/runtime personas; no nested agents.
- Worktree/branch: `../opendevin-m2-adapter-spike`, `task/m2-adapter-spike`.
- Original base4f068baa1677579718f2d9c22acffc75cee88137. Runtime-only dependencies dae233d/e610f9e and d7d420e/c731a18; coordinator integrated/reviewed runtime separately.
- Prior adapter commits6789421/9de6eeb received CHANGES REQUESTED. R1 implementation/probe source commit **73a682f8a4a1b9139972005ac86992ea218c18f4**. Final evidence commit follows; its exact SHA is sent to coordinator for re-review.
- Task requirements: F07 AI-10/AI-11; F05 SE-04/SE-05/SE-08/SE-09/SE-11; callback proof also supports SE-07.
- Status: review candidate, not independently approved or integrated.

## Outcome and review fixes

Only assigned `claude.py`, `adapter_process.py`, `test_execution_adapter.py` and task-local artifacts changed. Consumes accepted m2-execution-spike and root m2-sessions producer clarifications; no contracts/schema/manifests/shared service edits.

The old evidence did not identify the exact final source and had manual post-run capability annotations. It is preserved unchanged at `historical/real-probe-pre-r1-manually-annotated.json`, explicitly historical and not acceptance for R1. Earlier sibling rejection/success evidence is historical too. The new proof runs only committed source, records code_sha plus SHA256 source hashes, checks the source remains unchanged, and generates JSON once. No manual JSON edits were made.

Public `ClaudeAdapter.run(endpoint,prompt,*,auth_mode,on_inventory_verified,emit,stop_event,...)` now requires a `threading.Event`; omitted/invalid values raise `AdapterError('invalid_stop_event')`. Every valid Event is set on every exit, including success, prelaunch argument/policy/auth/endpoint errors, subprocess spawn failures and callback/parser/containment outcomes. `OSError` and `ValueError` at the public boundary map to stable `cli_unavailable`/`invalid_limits`. Consumers already pass Events. Use durable user stop_requested plus returned status to determine cancellation: the Event closes after success too, and must not be reused across attempts.

The prompt is bounded UTF8 in an unnamed0600 TemporaryFile passed directly as subprocess stdin. It is absent from argv, environment and any prompt pathname. There is no pipe feeder thread. Actual installed CLI `--print` stdin consumption is proven by the coding/ask_user work below. Each auth/plugin/version query runs in a separate fresh0700emptycwd with empty setting sources. No shared world-writable cwd is used.

The launch still requires empty builtins, restricted/strict single MCP broker, disabled slash commands/hooks/plugin sync/memory, no persistence, unattended denial and a fresh plugin cache. Per-invocation installed/builtin plugin false entries do not mutate user settings or disable the security guard. Seven exact trusted MCP names and one connected broker remain mandatory before `on_inventory_verified()`.

When init emits skills/agents/output_style, only empty skills, known builtin agent names and default style are accepted. Actual2.1.311 defaults observed: Explore/general-purpose/Plan/statusline-setup and output_style=default. These agent names are inert metadata under an inventory excluding Task/Agent/Skill invocation tools. Missing optional init fields do not attest to future CLI schemas; no blanket future-default isolation claim.

Normal personal first-party CLI login only: explicit auth_mode cli_login, credential storage remains owned/read by the CLI, no credential extraction/copy by product code. Only nonsecret CLI auth/plugin metadata is consumed; identity fields are discarded. Known local managed policy installations and other auth profiles are rejected. Real source needs workspace local_only=false and explicit external-source consent from trusted service policy. Every actual probe used synthetic source only. No model or reasoning override; observed configured model was claude-opus-5-5.

Private reasoning, model tool inputs/results, raw API diagnostics and identity are discarded. Persisted adapter events contain bounded summaries, tool names, final classifications and numeric reported usage. Unknown usage/cost stay null. Process groups retain an unreaped leader via Darwin kqueue/Linux waitid before termination; stderr and stdout count toward bounded output. `ask_user=true` requires the broker callback; follow_up/resume/checkpoint remainfalse. Durable artifact checkpoints are separate from adapter resume.

## Exact verification evidence

| Requirement | Check actually run | Result |
| --- | --- | --- |
| R1 shared Event/prelaunch/spawn/private stdin/preflight context | `python3 -m unittest discover -s tests -p test_execution_adapter.py -q` | **31 tests passed**,9.485s. Includes actual Popen failure, success and prelaunch Event closure, finite0600stdin/argv exclusion, metadata cwd isolation, process descendant/stop/output boundaries. Fixtures are not inference acceptance. |
| Real committed-source coding/cancel/question | `python3 docs/agents/runs/M2-ADAPTER-SPIKE/real_probe.py` at source73a682f | **Exit0, proof_passed=true**, generated JSON untouched. Source hashes unchanged after run. CLI2.1.311/configured claude-opus-5-5. |
| SE-04/05/09/11 coding | Actual Claude PID86917 | Read calc/test, fixed `a-b`→`a+b`, ran unittest through MCP/Docker. Independent validation exit0; unified diff retained.12.728s; reported usage/cost0.0428112, not an actual billing claim. |
| SE-08 cancellation | Actual Claude PID87069 | Cancelled after verified init, exit143, group termination confirmed **0.115s after request**; total attempt1.397s; zero tool starts. Unknown usage/cost null. |
| SE-07 question | Actual Claude PID87206 | Actual ask_user asked synthetic question, trusted stop-aware callback returned hidden MARIGOLD_4821, final model acknowledgment exactly ACK: MARIGOLD_4821. Exit0,6.161s. |
| Prompt privacy | Actual ps metadata inspection in all3 attempts | argv inspection verified and prompt marker absent. CLI successfully acted on stdin task; no prompt argv fallback. |
| Tool/customization/canary/cleanup | Same committed-source probe | Exact7 MCP tools/single broker, plugins/commands/skills empty, known builtin agent metadata/default style. Event set all3 returns, canary marker false, all owned containers stopped/discarded, owned_after_cleanup0. |
| Full regression on R1 source | `python3 -m unittest discover -s tests` | **307 tests run,30 skipped, OK**,87.438s. |

Generated JSON: `real-probe-evidence.json`, SHA256 **68f0525c9f398ffd01afa4217d3f18eeef6416046e8bed92e970c6bed9555621**. It records the exact source commit and hashes for execution modules, package entry, focused tests and probe. No evidence field was added or changed after generation. Historical earlier results cannot substitute for this identified run.

## Consumer handoff and limitations

- Existing run kwargs remain: auth_mode, zero-argument on_inventory_verified, emit(type,payload), synthetic/local_only/external_source_consent, shared Event, on_started(pid), timeout_seconds/max_turns/max_budget_usd/max_output_bytes. Map profile wall_seconds to timeout_seconds; output minimum1024. on_started receivesPID=PGID; service captures/verifies process start identity for recovery.
- Source/guard policy and callback state are service-owned. Keep tools denied until inventory callback; guard new tool admission and source return, close broker/contain CLI+container on every outcome. Post-agent trusted validation does not reopen the model gate.
- Sessions map AdapterError.code to failure; no duplicate adapter_result event is emitted for exceptions. Containment failure remains explicit stop_confirmed=false. Never use exit code or Event alone as a completion/cancellation verdict.
- Callback answer/acknowledgment is proven; long human waits, durable pending questions/HTTP delivery, restart and generic follow-ups need session integration tests. No stdin follow-up or resume claim.
- Verified host: macOS/Python3.12/Docker Desktop/cached python:3.12-slim sha256:78976a69c067520ef8be34cde307ef9f6fea6dcefa50edb57039773d241ca0db. Linux supervision is implemented but not Linux-host proven; managed hosts remain unsupported.
- No auth copies, account changes, packages, real repository source transmission, GitHub writes or publication. No schema/configuration change needed.
- Owned CLI PIDs86917/87069/87206 and containers are gone. All focused/full regression processes completed; no owned processes remain.
- Next: coordinator prepares an exact-final-SHA packet for fresh Claude boundary re-review. Author does not approve/integrate their own changes.
