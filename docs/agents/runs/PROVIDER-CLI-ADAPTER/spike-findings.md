# PROVIDER-CLI-ADAPTER spike findings

Date: 2026-11-16. Author: Claude (native), user-requested. Spike code, not product code.
CLI: Claude Code 2.1.311, user's personal claude.ai login. Corpus: bundled synthetic
examples only. Script: `spike_cli_transport.py` (a transport shim that answers the
provider service's OpenAI-compatible chat request with one CLI call, so routing,
`plan_schema`, `bind_plan` and `PlanService.validate` run unchanged).

## Result: viable

| Run | Plan eval (gate ≥8/10 pass, ≥9/10 valid) | CLI calls | Median / max latency | CLI-reported cost |
|---|---|---|---|---|
| Groq `gpt-oss-120b` (API, M1 gate) | 9/10, 9/10 valid | ~13 | 3–5 s (+30 s rate-limit waits) | n/a |
| Claude CLI, `claude-opus-5-5` | **10/10, 10/10 valid** | 10 (no repairs) | 23.7 s / 49.7 s | $0.70 nominal |
| Claude CLI, `claude-sonnet-5-5` | **10/10, 10/10 valid** | 11 (one repair) | 9.0 s / 19.7 s | $0.29 nominal |

Evidence: `claude-cli-opus-plan-eval.json`, `claude-cli-sonnet-plan-eval.json`
(content-free: states, counts, cited paths, per-call status/latency/model/turns).
Both runs passed `vague-request`, which Groq failed. The CLI reports `total_cost_usd`
even on a subscription; treat it as nominal, not billed.

## What was verified

- `--print --output-format json --json-schema <schema>` returns schema-valid JSON in a
  separate `structured_output` field (the CLI uses an internal structured-output turn,
  so `num_turns` is 2–3).
- With `--restricted --tools "" --strict-mcp-config --mcp-config '{"mcpServers":{}}'`
  and `--setting-sources ""`, every call reported zero permission denials and no tool
  use; the CLI can only return text.
- The system instruction fits in `--system-prompt` (argv). Evidence and the user
  request go on stdin only.
- Usage and model are reported per call (`usage`, `modelUsage`).

## Not verified (needed for the real adapter)

- Cancellation mid-generation: the spike used `subprocess.run` with a timeout; the
  adapter must reuse `adapter_process.run_stream` (process group, deadline, stop event).
- Managed-policy and auth-profile refusal: reuse `ClaudeAdapter._check_policy` and
  `_check_auth_profile` (personal pro/max login only).
- Installed-plugin suppression for this invocation (`_disabled_plugins`).
- Large prompts near the context limit; behavior on CLI login expiry.
- Codex CLI equivalent (`codex exec` with an output schema) — separate spike.

## Recommendation

1. Build a `claude_cli` provider adapter kind in F07, defaulting to Sonnet for Ask and
   planning (9 s median, 10/10), with Opus selectable.
2. Treat it as a remote destination: local-only mode blocks it and the profile must opt
   in to source sharing, exactly like Groq.
3. Share process ownership and policy checks with the session adapter instead of a
   second implementation.
4. Acceptance: connection test (`chat`, `structured_output`), plan eval gate, cancel
   within the session stop bound, prompt absent from argv, zero tool use.
