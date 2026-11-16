# PROVIDER-CLI-ADAPTER builder handoff

- Branch/worktree: `task/provider-claude-cli` / `opendevin-provider-claude-cli`, base
  integration `f203ab5`, plus the spike commit (`spike-findings.md`).
- Author: Claude native, user-requested 2026-11-16. Needs independent review (a fresh
  Codex reviewer is fine); this handoff is not approval.

## What changed

| Area | Change |
|---|---|
| `repoask/providers/claude_cli.py` (new) | `ClaudeCliTransport`: runs Claude Code headless per call with `--restricted --tools "" --strict-mcp-config` and an empty MCP config, `--setting-sources ""`, hooks/memory/plugins off, no session persistence, `--permission-mode dontAsk`. System instruction via a 0600 `--system-prompt-file`; conversation on stdin. Only `--model` and `--json-schema` carry request data in argv. Reuses `ClaudeAdapter` policy, auth-profile (personal pro/max only) and plugin checks, cached 5 minutes. Uses `adapter_process.run_stream` (process group, deadline, stop). Maps CLI failures to HTTP-style statuses so `_classify` stays the single error mapper. |
| `repoask/providers/adapters.py` | `ClaudeCliAdapter` (`claude_cli`): OpenAI-shaped body/response, no auth header, no embeddings. |
| `repoask/providers/service.py` | `cli_transport` injection; `_send` routes `claude_cli` to it. Profile rules: endpoint must be `https://api.anthropic.com` (so destination is remote and local-only/source-consent policy applies unchanged), model must be `sonnet`/`opus`/`haiku`/`claude-…`, no `embeddings`, no credential. |
| `repoask/platform/migrations.py`, `service_schema.py` | Migration 12 rebuilds `provider_profile_versions` to widen the adapter CHECK. New `Migration.rebuild_tables` flag: foreign keys off before BEGIN, `foreign_key_check` before COMMIT, enforcement restored in `finally`. Existing checksums unchanged. |
| `repoask/web/settings-models.js` | "Claude · your subscription" card. Setup modal: model (Sonnet default), explicit "Send repository source to Anthropic" opt-in (off by default), creates the profile, runs the connection test, explains failures (not logged in, CLI missing, local-only on, usage limit). A failed test is retried by updating the same profile. |
| `repoask/web/app.js` | Advanced editor offers the `claude_cli` adapter. |
| `tests/plan_evaluation.py` | `--adapter claude_cli`. |

## Verification

- `tests/test_provider_claude_cli.py` (fake CLI binary): 9 passed — no tools/MCP, prompt
  and system text absent from argv, caller's cancel event not set by a completed call,
  cancel kills the process group, connection test, logged-out → `provider_auth`,
  subscription limit → `provider_rate_limited`, profile rules, local-only and
  source-consent enforcement, v11 → v12 migration keeps rows and roles.
- Full Python suite: 523 OK (9 skipped). UI suite: 185/185.
- Migration on a copy of the user's real v11 database: rows preserved (4 versions,
  30 usage, 3 checks, 1 plan), 0 FK violations, foreign_keys back on, pre-v12 backup.
- Live: connection test passed in 4.0 s. **Plan evaluation through the product adapter,
  Sonnet: 10/10 passed, 10/10 valid, gate PASSED**, 7–18 s per plan
  (`claude-cli-adapter-sonnet-plan-eval.json`).

## Review focus

1. Argv exposure: the JSON schema includes evidence IDs (`e1`…) and repository IDs
   (`gh:<id>`), not source text. Acceptable, or move it to a file?
2. The `rebuild_tables` migration path and the FK-off window.
3. Reaching into `ClaudeAdapter` private helpers (`_check_policy`, `_check_auth_profile`,
   `_disabled_plugins`) from the provider transport; a shared public helper may be cleaner.
4. `total_cost_usd` from the CLI is ignored (subscription); cost stays unknown.
