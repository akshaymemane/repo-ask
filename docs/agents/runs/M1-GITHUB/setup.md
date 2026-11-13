# GitHub App service setup and integration notes

This slice provides Python services only. The callback route, local Origin checks, Settings
forms, worker registration and periodic scheduler are coordinator-owned and are not wired yet.
No real GitHub App credentials were configured or used during implementation.

## App registration (operator action after HTTP integration)

1. Create your own GitHub App in GitHub developer settings. Record its numeric App ID and
   exact App slug. Use a local application home URL matching your chosen loopback port.
2. Set the App **Setup URL** to the coordinator's fixed local setup callback, for example
   `http://127.0.0.1:8765/api/github/callback` for the current default application port.
   This is an installation setup callback, not an OAuth access-token exchange. Keep the
   application running at that exact address while installing. Webhooks are not needed
   for polling; leave webhook delivery disabled for this M1 slice.
3. Grant Metadata read and Contents read for discovery/source access. If implementation
   and future PR publication are needed, grant Contents write and Pull requests write.
   Repository implementation selection is a separate explicit local authorization.
4. Generate an App private key and supply its PEM to the eventual local configuration form.
   The service accepts unencrypted RSA keys of at least 2048 bits and at most 16 KiB.
   It validates App identity using `GET /app` before saving a secure secret reference.
5. Enable persistent workspace storage and an explicitly approved, available OS secret
   backend. An in-memory workspace or unavailable vault cannot configure credentials.
   Do not paste keys into command arguments, logs, task artifacts or SQLite. Existing
   `gh`, Codex and Claude CLI authentication is unrelated and is never imported.
6. Begin setup using `begin_connect(connection_id)` and navigate to the returned installation
   URL. Install only into accounts/repositories you intend this application to access.
   The callback state expires in ten minutes and is consumed once before verification.
   Organization requests awaiting approval attach no new grant. When an already connected
   App adds a pending installation, the callback reports `setup_status: pending_approval`
   while retaining its connected status and existing verified grants.
7. Trigger refresh and inspect its durable run/job state. Only callback-verified installations
   are traversed. A failed page retains unseen grants. Rate limits preserve the checkpoint
   and schedule a continuation at reset; temporary transport failures have three bounded
   continuations with exponential delays. Reauthentication failures require reconnect.

Official references checked during implementation:

- [GitHub JWT claims and RS256 signing](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app)
- [Installation tokens, permission and repository scope](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)

## Coordinator and consumer integration

Construct `repoask.github.GitHubService(store, jobs, secrets, transport=..., clock=...)`.
The injected callable accepts the exported `Request` dataclass and returns `Response`.
Request fields are method, provider-relative path, headers, json, timeout and max_bytes.
The default transport uses only `https://api.github.com`, disables proxies and redirects,
limits responses to 8 MiB and uses a 20-second socket timeout. No response Link/clone URL
is followed. Repository remotes are reconstructed from validated owner/name components.
The service never calls the transport while holding Store locks or transactions.

Register safe Worker handlers `github.refresh: service.run_refresh` and
`github.purge: service.run_purge`. Periodically call `schedule_due()`. Polling defaults
to an hour; `update_refresh_interval(connection_id, interval_ms)` accepts fifteen minutes
through thirty days. A duplicate refresh/purge while active returns the existing work.
A later explicit purge after completion creates a new job, allowing future derived data
also to be removed. No derived-data service exists in this branch; register idempotent
purge hooks before integration. Hook names/checkpoints allow restart without repeating
completed hooks, although each hook must tolerate a crash after its effects.

Register eligibility listeners as `callback(repository_id, eligible)`. Callbacks run after
commit, outside the Store lock. They should be fast, idempotent and nonthrowing. They
must cancel their own queued indexing/session work on exclusion. The current schema
has no durable listener outbox; consumers must also check `is_eligible` at retrieval/index
boundaries and `require_access` at runtime boundaries, including after restart. Purge
immediately disables indexing, then invokes registered derived-data cleanup hooks.

`require_access` returns a sanitized internal grant. Read access does not imply indexing
selection; write access also requires implementation selection. `mint_installation_token`
is internal-only, chooses a single covering grant, limits the token to one numeric repository
and requested permissions, and rechecks authorization after the request. Never expose
this method through HTTP, put its result in a job payload, or persist its token. Tokens
stay in memory and expire within GitHub's one-hour window. Client source helpers provide
default-branch SHA, nonrecursive bounded trees, and bounded decoded blobs; recursive
traversal and safe checkout caching belong to the indexing slice.

The coordinator maps `GitHubError.code` using the accepted HTTP mapping: validation400;
not_found404; setup_state_invalid/auth/connection_unavailable/installation_mismatch/
installation_suspended/app_identity_mismatch/persistence_required/crypto_unavailable/
secret_store_unavailable/capability_missing/repository_unavailable409; rate_limited429
with retry_at; timeout504; upstream_unavailable503; malformed_output502. No raw upstream
body or private credential is part of an error. Callback redirects must use the fixed local
Settings destination and a sanitized code, never the input state or arbitrary destinations.

## Validation limits

All HTTP activity in owning tests uses injected synthetic responses. Tests use a deliberately
test-only in-memory secret backend; it is not exported from the product package. No live App,
OS-vault integration, GitHub mutation, source sharing or inference was attempted. Tests ran
with Python3.12 and the already installed cryptography41.0.5. The shared manifest's newer
supported cryptography range remains the coordinator's project-venv integration check.
