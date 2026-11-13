# F01 — GitHub connection and repository discovery

Status: Draft | Milestone: M1 | Parent: [Master PRD](../../Master%20PRD.md)

## Outcome and boundaries

Connect a GitHub account once and maintain a searchable catalog of accessible personal and organization repositories. Discovery does not grant implementation permission or require all repositories to be cloned. Initial scope is one local workspace with one user and one or more GitHub App installations; GitHub Enterprise Server support is deferred.

## User experience

Settings → GitHub shows connection state, authorized installations, last successful refresh and reconnect controls. Onboarding explains metadata access, code indexing and optional write access separately. A paginated repository list supports search, owner, language, archived/fork and indexing filters. Users can select all repositories within an installation and exclude individual repositories.

Newly discovered repositories under a selected “all repositories” installation become eligible for indexing according to that installation's saved selection policy. An implementation allowlist remains explicit; new repositories are not automatically writable.

## Functional requirements

- **GH-01:** Use a GitHub App installation flow with validated callback state. Handle cancellation and expired setup attempts without creating a partial usable connection.
- **GH-02:** Persist installation references and short-lived access metadata; store private credentials in the configured secret store. Never render credentials in browser responses or logs.
- **GH-03:** Discover all pages of accessible repositories, including organization repositories made available by installation policy. Preserve existing selections during refresh.
- **GH-04:** Store stable repository ID, owner/name, description, topics, default branch, language, visibility, archive/fork flags, remote URL, last push and access capabilities.
- **GH-05:** Allow independent `index_enabled` and `implementation_enabled` controls. Validate actual GitHub capabilities at execution and publication time.
- **GH-06:** Support manual refresh and configurable periodic reconciliation. Polling is sufficient for local M1; signed webhooks are a later optional accelerator.
- **GH-07:** Respect rate-limit responses with scheduled retry and visible next-attempt time. A failed page must not imply subsequent repositories were removed.
- **GH-08:** Reconcile deletion and permission loss only from authoritative responses or a complete successful refresh. Hide revoked content from routing and retrieval immediately after detection.
- **GH-09:** Disconnect cancels pending sync, prevents new provider access and stops active sessions using the connection. Locally retained inaccessible material remains excluded pending explicit retention or deletion choice.
- **GH-10:** Purge action deletes repository source, summaries, vectors and cached checkouts; derived plans and sessions are marked source-unavailable and redacted according to F12 retention policy.

## Permission model

Baseline discovery/indexing needs repository metadata and source read access. Branch publication needs source write and PR creation needs pull-request write capabilities. Request the minimum capabilities needed by enabled features and show missing capabilities as actionable setup requirements. Exact provider permission names and flow must be validated against current GitHub documentation during implementation.

The indexing worker uses read-scoped capabilities. Runner credentials are short-lived and repository-scoped; they are injected only for approved Git operations. An indexing checkbox never authorizes a push.

## Data and proposed interfaces

- `GitHubConnection`: ID, account identity, secret reference, connection status, selection policy, timestamps.
- `Installation`: provider installation ID, connection ID, owner, granted capabilities.
- `Repository`: stable provider ID, installation association, metadata, selections, access state, discovery generation.
- `POST /api/github/connect` starts setup; callback completes the verified connection.
- `POST /api/github/refresh` returns a job ID; `GET /api/repositories` paginates the catalog.
- `PATCH /api/repositories/{id}` updates selections; disconnect and purge are separate explicit operations.

Connection states: `disconnected → connecting → connected`; expired/revoked credentials lead to `reconnect_required`. Temporary network failure leaves the connection known but refresh degraded.

## Failure and recovery

Retry transient errors with bounded backoff; never retry authorization failure as if it were a network error. Repository transfer/rename updates the display name without changing identity or losing plan history. Organization restrictions display which repositories are unavailable without implying full account coverage.

If revocation occurs during a session, stop further tools and publication, request runner termination, retain only permitted/redacted activity, and require reauthorization before any restart.

## Acceptance criteria

1. A fixture with 250 repositories across multiple pages and owners yields exactly 250 unique catalog records; a second refresh creates no duplicates.
2. A failed middle page retains previously known repositories and marks discovery incomplete.
3. Disabling indexing removes a repository from retrieval and cancels queued indexing; cached data can be purged independently.
4. Removing installation access blocks source retrieval, new sessions and PR publication; reconnect does not silently re-enable a user-disabled repository.
5. Rename and transfer preserve repository identity and references from saved plans.
6. Rejected/expired callback state cannot attach an account. Tokens do not appear in rendered errors or logs.

## Dependencies and measures

Requires F12 job persistence and secret references. Feeds F02, F03 and F06. Measure discovery completeness, refresh duration, rate-limit wait and time to first visible repository. Do not log private repository names in opt-in aggregate telemetry.
