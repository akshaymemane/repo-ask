# F07 — AI provider profiles and execution adapters

Status: Draft | Milestone: M1 for models; M2 for execution | Parent: [Master PRD](../../Master%20PRD.md)

## Outcome and boundaries

Let users choose different models for Ask, planning, summaries and embeddings, and choose an execution adapter for implementation. Model API configuration and coding-agent execution are distinct capabilities: a chat-completion endpoint alone is not an implementation runner.

M1 includes the existing Ollama path and an OpenAI-compatible chat/embedding adapter with explicitly tested capabilities. The Claude Code CLI is also available as a chat-only provider (answers, plans, summaries) using the user's own login; it cannot serve embeddings. Named native provider adapters can be added after contract validation. M2 includes one coding-agent adapter selected through a spike; exposing a provider logo does not claim executable support.

## Functional requirements

- **AI-01:** Create named provider profiles with adapter type, base URL, model identifier, secret reference, context/output limits, timeouts and capability flags.
- **AI-02:** Assign defaults independently for Ask/planning, summarization and embeddings. Optional task overrides must be visible before use.
- **AI-03:** Validate connection, authentication and required capability using a bounded synthetic request. Do not send repository source during a connection test.
- **AI-04:** Support streaming/cancellation where available. Enforce valid structured plan output server-side even when the provider lacks schema-constrained generation.
- **AI-05:** Display actual reported token use and estimated cost separately. Missing pricing yields unknown cost, never zero.
- **AI-06:** Provide local-only mode that rejects remote model, embedding and fallback destinations. Show external source-processing destinations in normal mode.
- **AI-07:** Never silently fall back to another provider. Optional user-configured fallback must preserve data-sharing, budget and capability constraints and be recorded in the result.
- **AI-08:** Pin profile version and model identifiers in plans, summaries and sessions. Deleting a profile removes future usability while retaining nonsecret historical metadata.
- **AI-09:** Treat embedding identity, dimensions and chunking as an immutable namespace. Changing them schedules F02 reindexing before semantic queries use the replacement.
- **AI-10:** Configure execution profiles separately: adapter, installed version, authentication method, container image/runtime, capabilities and resource/network limits.
- **AI-11:** Preflight a coding adapter for headless use, event mapping, cancellation and checkpoint behavior. Show unsupported resume or tool capabilities before launch.
- **AI-12:** Credential references resolve only in the authorized API/worker/runner boundary. Keys are never copied into exported plans, browser state or normal database backups.

## Capability model

| Capability | Consumer | Required behavior |
| --- | --- | --- |
| Text/chat generation | Ask, plans, summaries | Bounded request/response, error classification |
| Structured output | Plans | Native schema or validated adapter repair |
| Embeddings | Index and query | Stable model identity and dimensions |
| Streaming | Ask/activity | Optional, with explicit nonstreaming fallback |
| Tool execution | Coding agent | Explicit execution adapter, policy enforcement |
| Resume/checkpoint | Sessions | Only when verified by adapter |

Availability must be determined by adapter support and tests, not inferred from a provider's product name.

## Data and proposed interfaces

`ProviderProfile` and immutable profile versions hold nonsecret settings. `SecretReference` names secure storage entries. `ExecutionProfile` pins runner and adapter settings. `UsageRecord` attributes usage to purpose, profile, job/conversation/session and timestamp; content logging is disabled by default.

Routes: CRUD `/api/provider-profiles`, `POST /api/provider-profiles/{id}/test`, role assignments under `/api/settings/model-roles`, and CRUD/preflight under `/api/execution-profiles`. Updates do not mutate already-started sessions.

## Failure and recovery

Classify authentication, rate limit, timeout, context overflow, unsupported capability and invalid output separately. Retry transient reads/generation within a bounded budget; do not retry a tool action with unknown effects. Endpoint changes require a new configuration validation. Reject unsupported protocols and avoid forwarding credentials through cross-origin redirects. Hosted deployments will need a stricter endpoint/network threat model before release.

## Acceptance criteria

1. Ask works with Ollama and a tested compatible endpoint; changing the planning profile does not change the embedding profile.
2. Connection tests use synthetic content, redact keys and accurately report unsupported embeddings/schema/streaming capabilities.
3. Local-only mode rejects remote inference and configured remote fallback.
4. An embedding dimension change cannot mix vectors with the old namespace.
5. A plain model provider cannot be selected as an execution adapter without tool/runner support.
6. Provider failures preserve conversation/plan state and show actionable classification.
7. A running session retains its profile snapshot after defaults change, while credential revocation stops future calls.
8. Unknown token pricing is displayed as unknown; reported and estimated cost are distinguishable.

## Dependencies and decisions

Requires F12 secret storage, usage records and policy enforcement. The first coding adapter is the Claude Code CLI, selected after a reproducible sample task proved startup, authentication, structured activity and termination (`docs/agents/runs/M2-INTEGRATE/acceptance.md`, `docs/agents/runs/M2-PILOT/evidence.md`). A Codex CLI adapter is planned for M4.
