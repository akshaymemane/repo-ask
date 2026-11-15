**Verdict: CHANGES REQUESTED for `9de6eeb20208919c578e446052ca129a38f50480`. Not approved.** There are two major findings: one breaks the accepted contract and one undermines the probe evidence. Neither creates a security escalation. The security boundary itself held up under review.

Scope: I reviewed the packet at `.git/opendevin-runtime/reviews/9de6eeb…`, with base `c731a18`. All 14 manifest files are inside the card's exclusive paths. The card's base `4f068baa` differs from the packet base, and the handoff explains why: the runner dependency commits came in between. I read the packet, the M2 execution spike contract, the sessions contract and its producer clarifications. I made no edits, started no processes, made no account calls and ran no model inference. I did not rerun anything myself; I rely on the author's checks and your root rerun.

## Confirmed majors

**M1: The stop Event is not set on every adapter exit (contract violation; low security impact)**
- **Contract:** `m2-sessions.md:57` says the shared stop Event must be set on every adapter exit, including success.
- **What happens:** `run_stream` sets it in its `finally` (`adapter_process.py:195-196`). That covers success, timeout, cancellation, output limit, parser/callback errors and supervision setup failure (`:130-131`). But `ClaudeAdapter.run` can exit earlier without setting it:
  - The pre-launch checks raise an `AdapterError` with the Event still unset. These are `unsupported_auth_mode`, `invalid_source_policy`, `external_source_denied`, `invalid_prompt`, `invalid_limits`, managed policy, the auth checks, `customization_unverified` and `invalid_broker_endpoint` (`claude.py:202-216`). Each can be triggered on demand, for example with a bad endpoint or when the user is logged out.
  - If `subprocess.Popen` itself fails (`adapter_process.py:117`, outside the `try`), the Event stays unset and a raw `OSError` escapes `run()` (only `ProcessContainmentError` is caught, `claude.py:318`).
  - Invalid `timeout_seconds` or `max_output_bytes` raise a raw `ValueError` (`adapter_process.py:111-114`).
  - The last two also break the contract's promise of a stable `AdapterError.code` (same clarification).
- **Security impact:** low. `on_inventory_verified` never runs on these paths, so the broker guard was never opened.
- **Test gap:** no test checks that the Event is set on success or on a pre-launch error. `test_shared_stop_gate_closes_on_internal_timeout` only covers timeout.
- **Fix:** wrap the whole body of `run()` in `try/finally: stop_event.set()`. Map `OSError` and `ValueError` to stable codes (`cli_unavailable`, `invalid_limits`). Require a non-None stop Event, since `stop_event=None` is currently accepted silently. Add tests for the success and pre-launch cases.

**M2: The real-probe evidence was not produced by the submitted code, and was edited after the run**
- **Evidence:**
  - Every attempt's `capabilities` in `real-probe-evidence.json` (lines 11-19, 81-89, 144-152, 211-219) has `ask_user: false` and no `ask_user_requires_callback` key. The submitted `claude.py:78-82` would emit `ask_user: true` and `ask_user_requires_callback: true`. So the probe ran against earlier adapter code.
  - Evidence lines 233-240 cannot come from the submitted `real_probe.py:119-120`:
    - The script builds `dict(adapter.capabilities, …)`, which would include `headless`, `streaming` and `cancellation`. The evidence has none of them.
    - The `capability_promotion_basis` text differs: "tool callback… ; attempt capability snapshots predate promotion" in the evidence versus "callback… marker." in the script.
  - The handoff also says the "final startup-error defense" landed after the probe.
- **Effect:** the coding, validation, diff, cancellation and ask_user proofs are plausible, but they belong to an unidentified earlier SHA, and the JSON was changed by hand without saying so.
- **Fix (either):**
  1. Rerun `real_probe.py` at `9de6eeb` (or the final SHA) in a coordinator probe slot and commit the untouched output.
  2. Or record the exact probe SHA and the diff from it to the submitted code, mark the edited fields as manual, and get your explicit acceptance.

## Minors and follow-ups (not blocking)

- **m1 Preflight commands run in a shared directory:** `auth status`, `plugin list --json` and `--version` run with `cwd=tempfile.gettempdir()` (`claude.py:97,127,146`), not a fresh empty directory, and without `--setting-sources ""`. On Linux without `TMPDIR` set, that is world-writable `/tmp`, so planted `.claude/settings.json` or `CLAUDE.md` files can be read by these commands. The impact I can confirm is limited to denial of service or extra disabled-plugin entries. Whether these commands run hooks or helpers is untested. The canary probe planted files only in the caller's cwd, not in `TMPDIR`. Fix: use a per-call 0700 empty temporary directory.
- **m2 Prompt visible in the process list:** the prompt goes in as a command-line argument (`claude.py:309`), so other local accounts can see it with `ps`. It must move to stdin or a 0600 file before real plan or source text is used.
- **m3 Some init fields are not checked:** the gate checks `plugins`, `slash_commands`, tools and servers, but ignores `skills`, `agents` and `output_style`. These can't be invoked, because the exact tool inventory excludes Skill and Task, but they are a possible prompt-influence channel. The handoff's "unknown future defaults fail closed" claim covers tools and servers only.
- **m4 Missing result event on adapter errors:** when an `AdapterError` is raised from the event consumer, no `adapter_result` event is emitted. The session service must map the exception to an outcome.

## Verified OK

- **Credentials:** no credential reads or copies. Auth comes only from CLI metadata and identity fields are dropped. API-key mode and managed, team or enterprise profiles are rejected. The environment is an allow-list, so `ANTHROPIC_API_KEY` and `NODE_OPTIONS` are not passed. The token is passed by file path only, and the endpoint must be 0600 inside a 0700 directory owned by the same user.
- **Launch restrictions:** empty trusted cwd, `--restricted`, `--tools ""`, strict single MCP config, hooks disabled, empty setting sources, plugins disabled for this run only, fresh plugin cache. No model or reasoning override.
- **Tool gate:** exactly 7 trusted tools on one connected server before `on_inventory_verified`. Extra servers, tools, plugins or commands fail closed. Assistant or result events before init are rejected.
- **Process control:** the process-group leader is kept unreaped until the group is terminated (kqueue on macOS, waitid with no-wait on Linux, unproven on Linux). The Event is set before signalling. Termination escalates from TERM to KILL. Output limits count stderr and apply before buffering.
- **Event mapping:** reasoning, tool inputs and results are discarded. Unknown usage and cost stay null rather than 0. A completed status requires the process to exit 0 with a success result.
- **Policy order:** the source-consent check runs before any process starts. `resume`, `checkpoint` and `follow_up` are false; `ask_user` requires the callback.

## Hypothetical host compromise (not findings)

These assume an attacker who can already write to the user's home, directories on `PATH`, Python user site-packages (the MCP server is started without `-I`), or the installed CLI binary. They also include a process that escapes with `setsid` or the CLI auto-updater deleting the pinned version directory. Process-group containment isn't a sandbox on macOS. Policy delivery not covered by the known-path checks is out of scope, as the handoff states.

**Next step:** the author fixes M1 and settles M2 on its own branch, then sends the new exact SHA for re-review.
