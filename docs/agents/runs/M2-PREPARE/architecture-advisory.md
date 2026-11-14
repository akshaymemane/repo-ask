# M2 contract advisory: Docker runner, Claude coding adapter, sessions, publication

This is a read-only proposal. I edited no files and ran no shell, CLI, model or test. You (root/coordinator) decide what to accept and write; migration numbers are yours to allocate (the latest recorded is 8). This is not an M2 exit claim.

**What I read:** AGENTS.md, WORKFLOW.md, the architect persona, F05/F06/F07, `m0` README contract, `m1-services.md`, `m1-ask-plans.md`, `M2-PREPARE/docker-advisory.md`, the board's M2 cards, `ask/plans.py` readiness, `github/service.py` `require_access`/`mint_installation_token`, `github/client.py`, `indexing/snapshots.py` and `providers/service.py` policy.

## 1. Shape: three trust zones

```
App (trusted)            Host harness (trusted binary, untrusted model)     Container (untrusted)
SessionService ─spawn─▶  claude CLI, empty builtin tools, strict MCP ─stdio▶ ToolGateway (our MCP, trusted)
  owns DB/state/events    cwd = trusted empty dir, isolated config/HOME        │ docker exec argv only
  owns stop/budget/lease  env: provider key only                                ▼
                                                                    /workspace (sanitized files, no .git)
PublicationService ── installation token (in memory) ──▶ GitHub Git Data API (no git, no token in runner)
```

- **One state writer.** Only the session service changes `Session.state`. The adapter, runner and gateway report observations; they never set state.
- **The gateway checks every tool call** before running it: stop flag, lease valid, budget left, deadline, argument schema. All of this lives outside the model prompt (SE-04).
- **No credential ever enters the container.** The container runs with network off. GitHub tokens exist only inside the publication job.

## 2. Python interfaces (smallest set)

```python
# repoask/sessions/runner.py
@dataclass(frozen=True)
class RunnerLimits:
    wall_seconds: int; tool_timeout_seconds: int; cpu: float; memory_mib: int
    pids: int; workspace_mib: int; tmp_mib: int; output_bytes: int

@dataclass(frozen=True)
class ManifestEntry:
    path: str; mode: Literal["100644", "100755"]; size: int; sha256: str; base_blob_sha: str

@dataclass(frozen=True)
class WorkspaceManifest:
    repository_id: str; base_sha: str; entries: tuple[ManifestEntry, ...]
    excluded: tuple[tuple[str, str], ...]          # (path, reason: symlink|submodule|too_large|binary_cap|lfs)
    manifest_hash: str

@dataclass(frozen=True)
class RunnerHandle:
    attempt_id: str; container_id: str; instance_id: str; image_digest: str; created_at: int

@dataclass(frozen=True)
class ExecResult:
    exit_code: int | None; stdout: bytes; stderr: bytes; truncated: bool
    timed_out: bool; duration_ms: int

@dataclass(frozen=True)
class ContainmentResult:
    confirmed: bool; code: Literal["stopped", "already_gone", "containment_failed"]; elapsed_ms: int

@dataclass(frozen=True)
class WorkspaceDiff:   # computed host-side from a parsed tar stream; regular files only
    changed: tuple[ManifestEntry, ...]; added: tuple[ManifestEntry, ...]; deleted: tuple[str, ...]
    rejected: tuple[tuple[str, str], ...]   # (path, reason: excluded_path|symlink|special|too_large)
    patch_artifact_id: str; diff_hash: str

class Runner(Protocol):
    def preflight(self) -> dict: ...  # {ok, engine_version, image_digest_present, blocking_reasons}
    def provision(self, attempt_id: str, image_digest: str, limits: RunnerLimits,
                  manifest: WorkspaceManifest,
                  files: Iterable[tuple[ManifestEntry, bytes]]) -> RunnerHandle: ...
    def exec(self, h: RunnerHandle, argv: Sequence[str], *, timeout_s: int,
             stdin: bytes | None = None, cwd: str = "/workspace") -> ExecResult: ...
    def snapshot(self, h: RunnerHandle, manifest: WorkspaceManifest) -> WorkspaceDiff: ...
    def terminate(self, h: RunnerHandle, *, grace_s: float = 2.0) -> ContainmentResult: ...
    def list_owned(self, instance_id: str) -> list[RunnerHandle]: ...  # via container labels, for recovery
    def discard(self, h: RunnerHandle) -> None: ...
```

```python
# repoask/sessions/gateway.py  (trusted MCP server; stdlib JSON-RPC: initialize/tools/list/tools/call)
TOOLS = ("list_files", "read_file", "search_text", "write_file", "delete_file",
         "run_command", "run_validation", "ask_user")
@dataclass(frozen=True)
class GuardDecision:
    allowed: bool; code: str | None   # stop_requested|lease_lost|budget_exhausted|deadline|policy_denied

class ToolGateway:
    def __init__(self, runner: Runner, handle: RunnerHandle, policy: "ToolPolicy",
                 guard: Callable[[], GuardDecision],
                 emit: Callable[[str, dict], int]): ...  # emit returns event seq
    def call(self, name: str, args: dict) -> dict: ...   # guard → tool.started → exec → tool.finished
```

`run_command` takes an argv array, never a shell string. Commands come from the profile allowlist or the plan validation list, plus a bounded general command when the profile allows it. Output is capped and redacted. The gateway connects to the app over a 0600 Unix socket using a per-attempt capability token, which it stores only as a hash and revokes on stop. The token is not a provider credential.

```python
# repoask/sessions/adapters.py
@dataclass(frozen=True)
class AdapterCapabilities:
    structured_events: bool; follow_up: bool; resume: bool = False; usage_reporting: bool = False

@dataclass(frozen=True)
class AgentStart:
    attempt_id: str; instructions_markdown: str; plan_content_hash: str
    credential: SecretValue; gateway_command: tuple[str, ...]; max_turns: int; wall_seconds: int

@dataclass(frozen=True)
class AgentObservation:   # mapped from harness stream; no chain-of-thought
    kind: Literal["init", "assistant_text", "tool_use", "usage", "result", "error"]; data: dict

@dataclass(frozen=True)
class AgentExit:
    classification: Literal["completed", "failed", "auth", "rate_limited", "budget",
                            "cancelled", "crashed", "protocol_error"]
    exit_code: int | None; usage: dict

class AgentProcess(Protocol):
    pgid: int; started_at: float
    def send(self, message_id: str, text: str) -> bool: ...   # False when follow_up unsupported
    def terminate(self, *, grace_s: float = 2.0) -> ContainmentResult: ...
    def wait(self, timeout_s: float) -> AgentExit | None: ...

class CodingAdapter(Protocol):
    adapter_id: str              # "claude_code"
    capabilities: AdapterCapabilities
    def preflight(self, profile_version: dict) -> dict:
        ...  # {ok, detected_version, tool_inventory, blocking_reasons}
    def start(self, req: AgentStart, sink: Callable[[AgentObservation], None]) -> AgentProcess: ...
```

```python
# repoask/sessions/service.py
class SessionService:
    def __init__(self, store, jobs, plans, github, providers, secrets, runner, adapter, *, clock=now_ms): ...
    def preflight(self, plan_content: dict) -> dict: ...   # injected as PlanService.execution_preflight
    def launch(self, plan_version_id, content_hash, idempotency_key) -> dict: ...  # {session_id, state}
    def get(self, session_id) -> dict: ...
    def list_sessions(self, limit=50, cursor=None) -> dict: ...
    def events(self, session_id, after_seq: int = 0, limit=200) -> dict: ...   # {items, next_seq}
    def send_message(self, session_id, content, client_request_id) -> dict: ...
    def stop(self, session_id) -> dict: ...      # idempotent; ack = durable stop_requested + signal
    def retry(self, session_id) -> dict: ...     # new linked attempt; never mutates terminal session
    def run_session(self, job, context) -> dict: ...   # kind session.run, effect=external, max_attempts=1
    def recover(self) -> list[str]: ...          # startup: owned containers/pgids → interrupted
```

```python
# repoask/publication/service.py
class PublicationService:
    def __init__(self, store, jobs, github, sessions, *, clock=now_ms): ...
    def preview(self, session_id) -> dict: ...   # read-only
    def publish(self, session_id, *, expected_diff_hash, intent_version, title, body, idempotency_key) -> dict: ...
    def get(self, publication_id) -> dict: ...
    def retry(self, publication_id) -> dict: ...
    def run_publication(self, job, context) -> dict: ...   # kind publication.run, effect=external
    def reconcile(self, publication_id) -> dict: ...       # lookup ref/PR by head+base before any rewrite
```

## 3. Data (each table needs a migration you allocate)

- **`execution_profiles` + immutable `execution_profile_versions`:**
  - adapter `claude_code`, pinned harness version, harness path
  - `secret_ref` (purpose `provider_api_key`; see B7), model id, destination host
  - `allow_external_source` (must be true), image digest
  - `limits` JSON, `network:"none"`, `command_policy`
- **`sessions`:**
  - id `ses_`, plan_id, plan_version_id, content_hash, execution_profile_version_id
  - attempt, predecessor_session_id, idempotency_key UNIQUE, job_id
  - state, resume_phase, stop_requested, stop_reason
  - limits_snapshot, usage_totals, publication_policy, outcome JSON (`reviewable|no_changes|failed` + validation summary)
  - created_at, started_at, finished_at
- **`session_repositories`:** session_id, repository_id, role, base_sha, branch, manifest_hash, diff_hash, patch_artifact_id, head_sha NULL (set by publication).
- **`session_runners`:** attempt_id, session_id, instance_id, container_id, harness_pgid, harness_started_at, gateway_token_hash, state (`provisioning|running|terminating|terminated|containment_failed`).
- **`session_events`:** PK (session_id, seq), seq assigned in-transaction as max+1, ts, type, payload ≤8 KiB redacted.
- **`session_messages`:** id, session_id, client_request_id UNIQUE per session, content, delivery (`queued|delivered|acknowledged|rejected`), reason.
- **`validation_runs`:** id, session_id, ordinal, argv, source (`observed|proposed`), status (`passed|failed|timeout|error|not_run|unavailable`), exit_code, duration_ms, log_artifact_id, env_summary (image digest, network none).
- **`artifacts`:** id, kind (`patch|validation_log|manifest`), sha256, size, stored under the data dir.
- **`publications`:** id `pub_`, session_id, intent_version, expected_diff_hash, state (F06 states), step, branch, commit_sha, pr_number, pr_url, idempotency_key UNIQUE, last_synced_at, error_code.

**Event types (closed enum, minor version bump on additions):**
- `session.state`
- `agent.text` (bounded summary)
- `tool.started` / `tool.finished` (name, argument summary, status, duration, truncated)
- `file.changed`
- `validation.started` / `validation.finished`
- `question.asked`
- `message.delivery`
- `usage`
- `stop.requested` / `containment`
- `publication.state`
- `error` (code only)

Replay uses SSE with `Last-Event-ID = seq`, or `?after=seq`. Events carry no source beyond bounded tool summaries, and no secrets or host paths.

## 4. Boundaries

**Workspace (untrusted source)**
- Built from the GitHub trees/blobs path, as `github_snapshot` already does, at the plan's pinned base SHA.
- Only regular files with mode 100644/100755. Symlinks, submodules and LFS files are excluded and disclosed. A truncated tree fails preflight.
- No `.git`, and git never runs against untrusted repository configuration.
- Write targets must be GitHub repositories with `implementation_enabled`. Local checkouts stay read-only.
- Diffs are taken from a tar stream parsed host-side, never extracted and never read through a bind-mount path. This blocks symlink planting that would make the host read its own files.
- Changes to excluded paths are rejected.

**Container:** the advisory flags plus a pinned image digest, labels `opendevin.instance/session/attempt`, and no socket, home or host mount.

**Harness**
- Starts in a trusted empty directory with an isolated config directory and HOME.
- No hooks, skills, plugins or transcript persistence. Strict MCP config with only the gateway.
- Startup fails unless the tool list the harness reports at initialization equals exactly the gateway's tools.
- The environment is minimal: PATH, the isolated HOME and the provider key. The user's CLI login is never used.

**Credentials**
- The provider key resolves from `SecretService` only at harness spawn.
- The installation token is minted only inside `run_publication` with `{contents:write, pull_requests:write}`, kept in memory, and never sent to the runner, harness, events or database.

**Stop**
1. Stop is acknowledged once `stop_requested` is committed and the in-memory flag is set (target ≤2 s). From then on the gateway refuses every call.
2. `killpg(SIGTERM)` on the harness, then `docker kill`.
3. Confirmed when the process group is gone and `docker inspect` shows not running (≤10 s); otherwise `containment_failed`.
4. Repeat stops are idempotent.

**Budget**
- Wall time and tool count are enforced in the gateway. Tokens are enforced at turn boundaries from the harness's usage events.
- When exhausted: refuse further tools, terminate, save the patch, `stop_reason=budget_exhausted`.
- Disclosed limit: at most one model turn already in flight can overshoot. F05 AC8 needs to accept that wording.

**Restart and recovery**
- `session.run` is an external job with one attempt, so an expired lease goes to `needs_reconciliation` and never reruns automatically.
- `recover()` kills runner records owned by this instance (process group checked against its recorded start time), snapshots the patch, then marks the session `interrupted`.
- `resume=false`: a successor attempt is always explicit.

**Publication**
- Uses the GitHub Git Data API: create blobs, then a tree on `base_tree=base_sha` with changed paths only, then a commit (parent `base_sha`), then a new ref (a 422 collision means a new session-specific name), then a draft PR.
- Before every write step it looks up the ref or PR by head and base; it never force-updates.
- Also checks empty diff, a stale `expected_diff_hash`, current `require_access` and auto-publish conditions (PR-07).
- New `GitHubClient` helpers need the GitHub-package owner.

**Plan readiness:** `SessionService.preflight` plugs into the existing `execution_preflight` hook. It adds these reasons:
- `local_only_blocks_execution`
- `external_source_not_allowed`
- `adapter_preflight_failed`
- `runner_unavailable`
- `write_target_not_github`
- `base_head_changed` (checked against live HEAD at launch)

## 5. Acceptance for the first real adapter proof (M2-ADAPTER-SPIKE)

1. **Preflight:** the pinned harness version is detected and a mismatch is rejected. Initialization reports exactly the gateway tools and zero builtin tools. A canary hook or skill placed where it would normally load is never executed (canary file absent).
2. **Credential isolation:** with no product key, preflight fails with `auth`. This proves there is no fallback to an existing CLI or Keychain login. With the key, it is absent from the container environment, tool output, events, database bytes and artifacts.
3. **Real coding task:** a synthetic fixture repository with a one-line bug and a failing stdlib unittest. The agent reads, edits and validates only through the gateway. The diff matches what is expected, the validation is recorded as `passed`, and events replay in order without duplicates.
4. **Cancel:** stopping during a long `run_command` is acknowledged within 2 s, the process group and container are gone within 10 s, and no `tool.started` comes after the `stop.requested` seq.
5. **Exit classification proven for:** completed, auth (bad key), crashed (SIGKILL harness → interrupted), budget (low token or turn cap). Rate-limited stays "not proven" unless a real one is observed.
6. **Isolation:** two concurrent attempts cannot see each other's workspace or host sentinels. A symlink planted in the workspace is rejected by the diff.
7. **No transcript persistence:** the isolated config directory has no session transcript afterwards, or this is disclosed.
8. **Recorded honestly:** harness version, license/terms status, follow-up support (if stream input to an unattended run isn't verified, `follow_up=false` and messages are `rejected` with reason `unsupported`), and that harness outbound network is not enforced on the host.

## 6. Unresolved blockers (owner)

- **B1 local-only default (user):** local-only defaults to true, and a remote Claude session sends source to Anthropic. I recommend no exemption: launch is blocked until the user turns off local-only and opts in on the execution profile.
- **B2 credential isolation (spike gate):** the harness must not pick up the user's existing Claude login, possibly stored in the macOS Keychain. If acceptance item 2 fails, this design does not hold.
- **B3 Claude Code terms (user):** whether Claude Code's commercial terms allow this product to run it unattended is open (F07 still lists license compatibility as an open decision).
- **B4 disk quota (coordinator):** I recommend a size-capped tmpfs at `/workspace` (exec, nosuid, nodev; counts against the container's memory) with patch snapshots after each write. The alternative, a bind mount with soft monitoring, has no independently enforced quota.
- **B5 network/toolchain scope (user/coordinator):** with network off, dependency install is unsupported. The first proof is limited to stdlib-testable repositories on a pinned image. An egress allowlist would be a separate decision, so F05's "configured package destinations" is unmet in this first proof.
- **B6 publication (coordinator, plus GitHub owner):** two decisions:
  - Git Data API (recommended) or a host-side git push.
  - Commit identity for PR-02: App bot or a configured author.
- **B7 secret purpose (coordinator):** migration 1's purpose check is immutable. I recommend reusing `provider_api_key` rather than rebuilding the table.
- **B8 orphaned harness (coordinator):** macOS has no parent-death signal, so the harness can outlive an app crash. Proposed recovery: a recorded process group plus start time, killed on restart, and the gateway refuses calls once the lease is lost. A stray harness can still spend tokens until recovery runs; that needs accepting.
- **AC8 wording (user):** whether "at most one in-flight turn overshoot" is acceptable.

**Not blockers, can be frozen now:** the state machine, event envelope, tables, interfaces and launch body (it reuses the reserved `{plan_version_id, content_hash, idempotency_key}`).

**Deferred, no overdesign:**
- multiple writable repositories
- resume/checkpoint
- egress allowlist
- streaming tokens
- adapters other than Claude
- CI status sync beyond PR polling
- hosted threat model
