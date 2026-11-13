# F09 — Plugins and tool integrations

Status: Draft | Milestone: M3 | Parent: [Master PRD](../../Master%20PRD.md)

## Outcome and boundaries

Allow users to register integrations that add tools or context to OpenDevin, including supported MCP servers. Users can create a local plugin definition; the platform does not generate arbitrary executable extensions and install them without review.

M3 supports declared remote integrations and container-isolated local MCP processes. Arbitrary host-process execution, a public marketplace and automatic dependency installation are deferred.

## Functional requirements

- **PL-01:** Register a manifest with ID/version, description, source/provenance, transport, endpoint or container command, declared tools, scopes and credential references.
- **PL-02:** Present requested capabilities before enabling: read context, network destinations, external writes, repository files and required secrets. Deny undeclared capabilities by default.
- **PL-03:** Discover supported tools through the adapter and validate names/schemas against enabled capability policy. New capabilities from an updated server require review before use.
- **PL-04:** Assign plugins per workspace/repository and explicitly select them for a plan/session. Pin the manifest version and allowed tool set at launch.
- **PL-05:** Allow read-only context tools in Ask only when configured for read access; execution or external mutation tools are unavailable in Ask.
- **PL-06:** Enforce per-tool authorization at dispatch. An agent's request or plugin response cannot authorize an external write, widen scope or retrieve another plugin's secret.
- **PL-07:** Run local plugin processes within the runner isolation policy with explicit mounts and environment. Remote tools receive only the minimal approved request payload.
- **PL-08:** Apply timeouts, response-size limits, cancellation and structured audit events. Treat tool output as untrusted context.
- **PL-09:** Support health test, disable, version update and removal. Disabling blocks new calls immediately; active calls are cancelled when supported and their outcome reconciled.
- **PL-10:** Redact credentials and sensitive payload fields in tool logs. Preserve sufficient operation identity to reconcile a remote mutation after timeout.

## Permission and publication rules

Internal permissions use declared capabilities rather than a plugin-wide trusted flag. Read access does not imply write access. Session-start authorization can cover a specific, visible set of tools and external effects; effects outside that scope require explicit user authorization. F06 remains the owner of GitHub publication, so a generic plugin cannot bypass its publication policy.

User-created definitions must describe transport and tools; skill Markdown alone is not a plugin. Package upgrades create new manifest versions; running sessions do not inherit them silently.

## Data and proposed interfaces

`Plugin`: identity, description, source, enabled state. `PluginVersion`: manifest hash, transport config, capabilities and tool schemas. `PluginGrant`: allowed scope/actions and secret references. `ToolInvocation`: plugin version, session/conversation, tool, request hash, state, operation ID, redacted result and timestamps.

CRUD `/api/plugins`; `POST /api/plugins/{id}/test`; `POST /api/plugins/{id}/enable`; `POST /api/plugins/{id}/disable`; grants and versions routes. Grant changes are audited separately from content changes.

## Failure behavior

Unavailable plugins do not freeze the whole session; optional tools produce a visible failure, required tools block with an actionable reason. Unknown remote write outcome requires reconciliation or user inspection before retry; never automatically repeat a non-idempotent mutation. Disablement does not falsely claim an already-issued external write was undone.

## Acceptance criteria

1. A user can register a read-only MCP integration, test it and select it for Ask without exposing mutation tools.
2. A plugin requesting an undeclared file/network/secret capability is denied at dispatch.
3. Updating a manifest adds a version; new permissions stay disabled until reviewed, and existing sessions retain the old version.
4. Disabling blocks subsequent calls and shows the status of any in-flight request.
5. A hanging server times out; malformed/oversized responses are bounded and recorded as failures.
6. A timed-out external mutation is not blindly retried, and a plugin cannot bypass draft PR publication intent.

## Dependencies and measures

Depends on F05 execution boundary, F08-style version binding and F12 audit/secret policies. Track invocation reliability, permission denials and unresolved external effects. Implement only transports supported by the chosen adapter; compatibility claims require a test fixture.
