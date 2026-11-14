"""Restricted Claude Code adapter for the synthetic M2 execution spike.

The CLI owns normal account authentication. This module never reads credentials,
transcripts, user configuration or repository instructions on the host.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path
import shutil
import stat
import sys
import tempfile
from typing import Callable

from .adapter_process import ProcessContainmentError, run_stream

TOOLS = ("list_files", "read_file", "search_text", "write_file", "delete_file", "run_command", "ask_user")
SERVER = "opendevin"
TRUSTED_TOOLS = frozenset(f"mcp__{SERVER}__{name}" for name in TOOLS)


class AdapterError(RuntimeError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _number(value):
    if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0:
        return value
    return None


def _summary(value: object) -> str:
    # Text summaries are allowed; terminal controls and unbounded content are not.
    if not isinstance(value, str):
        return ""
    return "".join(c for c in value if c in "\n\t" or c.isprintable())[:4000]


def _failure_code(event: dict) -> str:
    subtype = event.get("subtype")
    direct = {"error_max_turns": "turn_limit", "error_max_budget_usd": "budget_exhausted"}
    if isinstance(subtype, str) and subtype in direct:
        return direct[subtype]
    # Classify only a CLI failure, never a successful assistant's source text.
    errors = event.get("errors", [])
    text = " ".join(item[:4000] for item in errors[:8] if isinstance(item, str)) if isinstance(errors, list) else ""
    text = (text + " " + _summary(event.get("result"))).lower()
    for fragments, code in (
        (("rate_limit", "rate limit", "usage limit", "hit your limit"), "rate_limit"),
        (("authentication", "not logged in", "invalid api key"), "authentication"),
        (("context window", "context_length_exceeded", "prompt is too long"), "context_overflow"),
    ):
        if any(fragment in text for fragment in fragments):
            return code
    return "agent_error"


def _environment() -> dict[str, str]:
    # Do not inherit arbitrary tool/SDK hooks, provider credentials or debug knobs.
    names = ("PATH", "HOME", "USER", "LOGNAME", "TMPDIR", "LANG", "LC_ALL", "ANTHROPIC_MODEL", "CLAUDE_CODE_EFFORT_LEVEL")
    env = {name: os.environ[name] for name in names if name in os.environ}
    for name in ("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL",
                 "CLAUDE_CODE_DISABLE_AUTO_MEMORY", "CLAUDE_CODE_DISABLE_POLICY_SKILLS", "CLAUDE_CODE_DISABLE_WORKFLOWS",
                 "CLAUDE_CODE_DISABLE_BACKGROUND_TASKS", "CLAUDE_CODE_DISABLE_AGENT_VIEW", "CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK"):
        env[name] = "1"
    env["DISABLE_AUTOUPDATER"] = "1"
    env["DISABLE_TELEMETRY"] = "1"
    env["DISABLE_ERROR_REPORTING"] = "1"
    return env


class ClaudeAdapter:
    capabilities = {
        "headless": True, "streaming": True, "cancellation": True,
        "resume": False, "checkpoint": False, "follow_up": False,
        "ask_user": True, "ask_user_requires_callback": True,
    }

    def __init__(self, *, claude_binary: str | None = None):
        binary = claude_binary or shutil.which("claude")
        if not binary or not Path(binary).is_absolute() or not os.access(binary, os.X_OK):
            raise AdapterError("cli_unavailable")
        self.binary = str(Path(binary).resolve())

    def preflight(self) -> dict:
        """Read-only detection. Availability does not assert successful login/inference."""
        self._check_policy()
        profile = self._check_auth_profile()
        self._disabled_plugins()
        lines = []
        try:
            result = run_stream([self.binary, "--version"], cwd=tempfile.gettempdir(),
                                env=_environment(), on_line=lines.append,
                                timeout_seconds=5, max_output_bytes=1024)
        except (OSError, ProcessContainmentError):
            raise AdapterError("cli_unavailable") from None
        if result.exit_code or result.reason != "exited" or not lines:
            raise AdapterError("cli_unavailable")
        return {"available": True, "version": _summary(b"\n".join(lines).decode("utf-8", "replace").strip()),
                "authentication_verified": False, "authentication_reported": profile, "customization_metadata_checked": True, "capabilities": dict(self.capabilities)}

    @staticmethod
    def _check_policy():
        # Managed hooks cannot be disabled by --settings. This first adapter is
        # deliberately limited to unmanaged personal CLI profiles on POSIX hosts.
        if os.name != "posix":
            raise AdapterError("unsupported_host_policy")
        roots = (Path("/Library/Application Support/ClaudeCode"), Path("/etc/claude-code"),
                 Path.home() / ".claude")
        paths = [root / name for root in roots for name in
                 ("managed-settings.json", "managed-settings.d", "managed-mcp.json")]
        paths += [Path("/Library/Managed Preferences/com.anthropic.claudecode.plist"),
                  Path("/Library/Managed Preferences") / os.environ.get("USER", "") / "com.anthropic.claudecode.plist",
                  Path.home() / "Library/Managed Preferences/com.anthropic.claudecode.plist"]
        if any(os.path.lexists(path) for path in paths):
            raise AdapterError("unsupported_managed_policy")

    def _check_auth_profile(self):
        # Metadata comes from the CLI itself. Never open/copy its auth storage.
        lines = []
        try:
            result = run_stream([self.binary, "auth", "status"], cwd=tempfile.gettempdir(),
                                env=_environment(), on_line=lines.append,
                                timeout_seconds=10, max_output_bytes=16384)
            profile = json.loads(b"\n".join(lines))
        except (OSError, ValueError, ProcessContainmentError):
            raise AdapterError("authentication_unverified") from None
        if result.reason != "exited" or result.exit_code != 0 or not isinstance(profile, dict) or profile.get("loggedIn") is not True:
            raise AdapterError("authentication_required")
        if (profile.get("authMethod") != "claude.ai" or profile.get("apiProvider") != "firstParty" or
            profile.get("subscriptionType") not in ("pro", "max", "ultra")):
            raise AdapterError("unsupported_auth_profile")
        return {"method": "claude.ai", "personal_profile": True}

    def _disabled_plugins(self):
        # Restricted mode does not suppress every installed-plugin registry entry
        # in CLI 2.1.311. Query metadata through its read-only CLI command and
        # override each entry for this invocation; never alter user settings.
        lines = []
        try:
            result = run_stream([self.binary, "plugin", "list", "--json"],
                                cwd=tempfile.gettempdir(), env=_environment(),
                                on_line=lines.append, timeout_seconds=10, max_output_bytes=65536)
            plugins = json.loads(b"\n".join(lines))
        except (OSError, ValueError, ProcessContainmentError):
            raise AdapterError("customization_unverified") from None
        if result.reason != "exited" or result.exit_code != 0 or not isinstance(plugins, list) or len(plugins) > 100:
            raise AdapterError("customization_unverified")
        disabled = {
            "cc-plugin-agents-md@builtin": False,
            "cc-plugin-plugin-authoring@builtin": False,
        }
        for plugin in plugins:
            if not isinstance(plugin, dict) or plugin.get("scope") == "managed":
                raise AdapterError("unsupported_managed_policy")
            name = plugin.get("id")
            if not isinstance(name, str) or not name or len(name) > 256 or any(not c.isprintable() for c in name):
                raise AdapterError("customization_unverified")
            disabled[name] = False
        return disabled

    @staticmethod
    def _endpoint(endpoint: dict) -> dict:
        try:
            socket_path = Path(endpoint["socket_path"])
            token_file = Path(endpoint["token_file"])
            for path, kind in ((socket_path, stat.S_ISSOCK), (token_file, stat.S_ISREG)):
                info = path.lstat()
                parent = path.parent.lstat()
                if (not path.is_absolute() or not kind(info.st_mode) or
                    info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o600 or
                    not stat.S_ISDIR(parent.st_mode) or parent.st_uid != os.getuid() or
                    stat.S_IMODE(parent.st_mode) != 0o700):
                    raise ValueError
        except (KeyError, TypeError, OSError, ValueError):
            raise AdapterError("invalid_broker_endpoint") from None
        return {"mcpServers": {SERVER: {
            "command": sys.executable,
            "args": ["-m", "repoask.execution.mcp_server", "--socket", str(socket_path), "--token-file", str(token_file)],
            "env": {"PYTHONPATH": str(Path(__file__).resolve().parents[2])},
        }}}

    def run(
        self, endpoint: dict, prompt: str, *, auth_mode: str,
        on_inventory_verified: Callable[[], None], emit: Callable[[str, dict], None],
        synthetic: bool = False, local_only: bool = True,
        external_source_consent: bool = False, stop_event=None, on_started=None,
        timeout_seconds: float = 180, max_turns: int = 12,
        max_budget_usd: float = 1.0, max_output_bytes: int = 524288,
    ) -> dict:
        """Blocking single attempt. Caller holds broker guard closed until callback.

        Source consent is trusted service policy, never a model supplied argument.
        API-key mode and interactive follow-ups intentionally remain unsupported.
        ask_user requires the trusted broker callback; no stdin delivery is implied.
        """
        if auth_mode != "cli_login":
            raise AdapterError("unsupported_auth_mode")
        if any(type(value) is not bool for value in (synthetic, local_only, external_source_consent)):
            raise AdapterError("invalid_source_policy")
        if not synthetic and (local_only or not external_source_consent):
            raise AdapterError("external_source_denied")
        if not isinstance(prompt, str) or not prompt.strip() or "\x00" in prompt or len(prompt.encode("utf-8", "surrogatepass")) > 32768:
            raise AdapterError("invalid_prompt")
        if (type(max_turns) is not int or not 1 <= max_turns <= 40 or
            _number(max_budget_usd) is None or not 0 < max_budget_usd <= 10):
            raise AdapterError("invalid_limits")
        self._check_policy()
        self._check_auth_profile()
        disabled_plugins = self._disabled_plugins()
        config = self._endpoint(endpoint)
        initialized = False
        final = None
        usage = None
        cost = None
        final_summary = ""

        def consume(line: bytes):
            nonlocal initialized, final, usage, cost, final_summary
            try:
                event = json.loads(line)
            except (ValueError, UnicodeDecodeError, RecursionError):
                raise AdapterError("invalid_output") from None
            if not isinstance(event, dict):
                raise AdapterError("invalid_output")
            kind = event.get("type")
            if kind == "system" and event.get("subtype") == "init":
                servers = event.get("mcp_servers")
                inventory = event.get("tools")
                emit("adapter_inventory", {
                    "tools": [_summary(name)[:128] for name in inventory[:64]] if isinstance(inventory, list) else [],
                    "servers": [{"name": _summary(item.get("name"))[:128], "status": _summary(item.get("status"))[:64]}
                                for item in servers[:8] if isinstance(item, dict)] if isinstance(servers, list) else [],
                    "plugins_present": bool(event.get("plugins")),
                    "plugins": [_summary(item.get("name") or item.get("id"))[:128]
                                for item in event.get("plugins", [])[:64] if isinstance(item, dict)]
                               if isinstance(event.get("plugins"), list) else [],
                    "commands_present": bool(event.get("slash_commands")),
                })
                if event.get("plugins") or event.get("slash_commands"):
                    raise AdapterError("unexpected_customization")
                if (initialized or not isinstance(inventory, list) or
                    any(not isinstance(name, str) for name in inventory) or
                    len(inventory) != len(TRUSTED_TOOLS) or set(inventory) != TRUSTED_TOOLS or
                    not isinstance(servers, list) or len(servers) != 1 or
                    not isinstance(servers[0], dict) or servers[0].get("name") != SERVER or
                    servers[0].get("status") != "connected"):
                    raise AdapterError("unexpected_tool_inventory")
                initialized = True
                on_inventory_verified()
                emit("adapter_ready", {"tools": sorted(TRUSTED_TOOLS), "model": _summary(event.get("model"))})
            elif kind in ("assistant", "result") and not initialized:
                raise AdapterError("missing_initialization")
            elif kind == "assistant":
                if event.get("isApiErrorMessage"):
                    return
                message = event.get("message", {})
                if not isinstance(message, dict):
                    raise AdapterError("invalid_output")
                content = message.get("content", [])
                if not isinstance(content, list):
                    raise AdapterError("invalid_output")
                for block in content:
                    if not isinstance(block, dict):
                        continue
                    if block.get("type") == "text":
                        emit("assistant_summary", {"text": _summary(block.get("text"))})
                    elif block.get("type") == "tool_use":
                        name = block.get("name")
                        if not isinstance(name, str) or name not in TRUSTED_TOOLS:
                            raise AdapterError("unexpected_tool_inventory")
                        # Never persist model tool inputs, hidden reasoning or raw results.
                        emit("tool_requested", {"name": name})
            elif kind == "result":
                if final is not None:
                    raise AdapterError("invalid_output")
                subtype = event.get("subtype")
                if event.get("is_error") or subtype != "success":
                    final = {"status": "failed", "code": _failure_code(event)}
                else:
                    final = {"status": "completed", "code": "success"}
                reported = event.get("usage")
                if isinstance(reported, dict):
                    usage = {key: _number(reported.get(key)) for key in
                             ("input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")}
                cost = _number(event.get("total_cost_usd"))
                final_summary = _summary(event.get("result")) if final["status"] == "completed" else ""
            # User/tool results, thinking, hooks, progress and unknown events discarded.

        with tempfile.TemporaryDirectory(prefix="opendevin-adapter-") as root:
            os.chmod(root, 0o700)
            cwd = str(Path(root) / "cwd")
            Path(cwd).mkdir(mode=0o700)
            argv = [self.binary, "--print", "--verbose", "--output-format", "stream-json",
                    "--restricted", "--tools", "", "--strict-mcp-config",
                    "--mcp-config", json.dumps(config), "--disable-slash-commands",
                    "--setting-sources", "", "--settings", json.dumps({
                        "disableAllHooks": True, "autoMemoryEnabled": False, "claudeMdExcludes": ["**"],
                        "syncClaudeAiSkills": False, "syncClaudeAiPlugins": False, "enabledPlugins": disabled_plugins,
                    }), "--no-session-persistence", "--no-chrome",
                    "--permission-mode", "dontAsk", "--permission-prompts", "none",
                    "--allowedTools", ",".join(sorted(TRUSTED_TOOLS)),
                    "--max-turns", str(max_turns), "--max-budget-usd", str(max_budget_usd),
                    "--", prompt]
            environment = _environment()
            plugin_root = Path(root) / "plugins"
            plugin_root.mkdir(mode=0o700)
            environment["CLAUDE_CODE_PLUGIN_CACHE_DIR"] = str(plugin_root)
            try:
                outcome = run_stream(argv, cwd=cwd, env=environment, on_line=consume,
                                     timeout_seconds=timeout_seconds, max_output_bytes=max_output_bytes,
                                     stop_event=stop_event, on_started=on_started)
            except ProcessContainmentError:
                return {"status": "failed", "code": "containment_failure", "exit_code": None,
                        "stop_confirmed": False, "usage": usage, "reported_cost_usd": cost,
                        "capabilities": dict(self.capabilities)}
        if not outcome.stop_confirmed:
            result = {"status": "failed", "code": "containment_failure"}
        elif outcome.reason != "exited":
            result = {"status": "cancelled" if outcome.reason == "cancelled" else "failed", "code": outcome.reason}
        elif outcome.exit_code != 0:
            result = {"status": "failed", "code": "cli_exit"}
        elif not initialized or final is None:
            result = {"status": "failed", "code": "invalid_output"}
        else:
            result = final
        emit("adapter_result", {**result, "summary": final_summary, "usage": usage, "reported_cost_usd": cost})
        return {**result, "exit_code": outcome.exit_code, "stop_confirmed": outcome.stop_confirmed,
                "usage": usage, "reported_cost_usd": cost, "capabilities": dict(self.capabilities)}
