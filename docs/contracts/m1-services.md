# M1 service contracts — opendevin.m1/1

Status: Accepted interface packet after Claude advisory and coordinator dispositions. Exact schema source is commit0bdeb33; additive foundation quality review gates integration, while builders may work against these frozen interfaces. Builds on accepted M0.
Scope: GitHub/catalog and model providers; source indexing/planning follow in separate slices.
Python >=3.10. Existing legacy HTTP contracts remain valid. M0 migration 1 is immutable.

## Ownership and dependencies

Coordinator owns migration registry, dependencies, secure-backend integration, shared dispatcher
and application wiring. GitHub builder owns `repoask/github/` and `tests/test_github_*.py`.
Provider builder owns `repoask/providers/` and `tests/test_providers_*.py`. They use Store and
SecretService, injected transports/clocks and the coordinator-provided schemas below.
A test-only secret backend remains under tests. Real forms require a secure OS backend.

Declared optional product dependencies: keyring for approved OS storage, cryptography for
GitHub App RSA signing, sqlite-vec for later local vectors. No global installation or plaintext
fallback. Install these into the project venv after declaring them; absence is actionable setup.
Only explicitly selected macOS Keychain/Linux SecretService/Windows vault implementations are
eligible; reject plaintext/null/chained or arbitrary discovered keyring backends.

## Conventions and errors

Use M0 opaque IDs/timestamps, except repository `id` is `gh:<numeric GitHub repository id>`.
Public records are JSON dictionaries with no keys/tokens/private PEM or local filesystem paths.
Service errors carry a stable code and content-free message. Shared HTTP adapter maps validation
to 400, missing IDs to 404, state/idempotency conflicts to 409, auth/setup to 409, rate limits to
429 with retry timing, upstream timeout to 504 and temporary transport/storage failure to 503.
Do not duplicate Host/Origin validation in services. Validate JSON types strictly (bool is not int).
All collections use bounded limits (1..100) and opaque cursors with stable ordering.

## Migration allocation

Coordinator allocates migration 2 `github_catalog` and migration 3 `provider_profiles` before
builders start. Fields below are authoritative; additional indexes/check constraints are allowed.
JSON fields use canonical JSON text; timestamps use Unix milliseconds as in M0.

### Migration 2

- `github_connections`: id PK, app_id TEXT, slug TEXT, private_key_ref TEXT, status TEXT,
  index_new INTEGER, refresh_interval_ms INTEGER, created_at INTEGER, updated_at INTEGER.
- `github_setup_attempts`: state_hash PK, connection_id, expires_at INTEGER, consumed_at INTEGER NULL.
  Persist only the hash; return raw random state only in the connect response.
- `github_installations`: id TEXT PK (GitHub installation id), connection_id, owner TEXT,
  account_type TEXT, permissions TEXT JSON, status TEXT, last_refresh_at INTEGER NULL.
- `repositories`: id TEXT PK, github_id INTEGER UNIQUE, owner TEXT, name TEXT, full_name TEXT,
  description TEXT, topics TEXT JSON, default_branch TEXT, language TEXT NULL, visibility TEXT,
  archived INTEGER, fork INTEGER, clone_url TEXT, pushed_at TEXT NULL, index_enabled INTEGER,
  implementation_enabled INTEGER, access_state TEXT, created_at INTEGER, updated_at INTEGER.
- `repository_installations`: repository_id + installation_id composite PK, permissions TEXT JSON,
  seen_generation TEXT; links determine current access without erasing explicit selections.
- `discovery_runs`: id PK, connection_id, generation TEXT, state TEXT, job_id TEXT NULL, continuation INTEGER, checkpoint TEXT JSON,
  discovered_count INTEGER, error_code TEXT NULL, retry_at INTEGER NULL, created_at, updated_at.

### Migration 3

- `provider_profiles`: id PK, name TEXT, active_version_id TEXT, deleted_at INTEGER NULL,
  created_at INTEGER, updated_at INTEGER.
- `provider_profile_versions`: id PK, profile_id, version INTEGER, adapter TEXT, endpoint TEXT,
  model TEXT, secret_ref TEXT NULL, config TEXT JSON, created_at INTEGER;
  UNIQUE(profile_id,version). Config includes capabilities, limits, source-sharing opt-in and
  optional user-supplied prices; secrets are never in config.
- `model_role_assignments`: role TEXT PK, profile_id TEXT, updated_at INTEGER. Future calls resolve the active version; each result/plan/session pins the resolved version.
- `provider_settings`: key PK, value TEXT JSON, updated_at INTEGER (including workspace local_only).
- `provider_version_checks`: version_id PK, status TEXT, verified_capabilities TEXT JSON, error_code TEXT NULL, checked_at INTEGER.
- `provider_usage`: id PK, profile_version_id TEXT, purpose TEXT, input_tokens INTEGER NULL,
  output_tokens INTEGER NULL, estimated_cost REAL NULL, cost_status TEXT, created_at INTEGER.

## GitHub service

Use GitHub App authentication, not the developer CLI login. A user configures their App id/slug
and private PEM once through the local application. Source/read access and implementation selection
remain distinct. Setup docs must describe App creation/permissions and the local setup callback.
Only api.github.com and reconstructed github.com repository HTTPS remotes are supported in v1.
HTTP tests inject a transport; accepting arbitrary GitHub base URLs in production is deferred.

```python
class GitHubService:
    def __init__(self, store, jobs, secrets, *, transport=None, clock=now_ms): ...
    def configure(self, app_id, slug, private_key, *, index_new=False): ... # sanitized connection
    def begin_connect(self, connection_id): ... # {connection_id, install_url, expires_at}
    def finish_connect(self, state, installation_id, *, setup_action=None): ... # verify remotely, consume state once
    def connections(self): ...
    def status_summary(self): ...
    def schedule_due(self): ... # server periodically calls; no new run while one active
    def register_eligibility_listener(self, callback): ... # callback(repo_id, eligible)
    def register_purge_hook(self, name, callback): ... # callback(repo_id), idempotent
    def refresh(self, connection_id): ... # enqueue safe github.refresh job idempotently
    def run_refresh(self, job, context): ... # registered handler; checkpoint by installation/page
    def disconnect(self, connection_id): ...
    def get_repository(self, repository_id): ...
    def is_eligible(self, repository_id): ... # accessible AND index_enabled
    def list_repositories(self, *, cursor=None, limit=50, query='', owner=None,
                          index_enabled=None): ... # {items,next_cursor,total}
    def update_selection(self, repository_id, *, index_enabled, implementation_enabled): ...
    def require_access(self, repository_id, capability='contents_read'): ... # internal grant
    def mint_installation_token(self, repository_id, permissions=None): ... # internal only; never route
    def purge_repository(self, repository_id): ... # idempotent safe purge job, derived data hooks
```

Installation metadata/owner/permissions come from an authenticated GitHub App request, never
callback parameters. Match app_id, reject suspended installations, and validate expiring single-use
state even under callback races. JWT signing is RS256 with bounded expiry and clock skew; resolve
PEM through SecretService only. Installation tokens are short-lived, repository/permission-scoped
when used for implementation, never persisted or sent to browsers. No credentialed URL/argv/logs.

Discover all installation pages and repository pages. Upsert metadata by numeric repository ID;
rename/transfer must preserve selections. Record checkpoint progress per page. A failed page
cannot revoke unseen repositories. Only a complete discovery generation or an authoritative
access response can remove a grant. Multiple installations can grant access to one repository.
Rate limit schedules retry at the provider reset time; auth errors require reconnect. Newly found
repositories follow index_new; implementation_enabled always defaults false.

Disconnect makes its grants ineligible immediately, cancels pending jobs and signals future
session/index services through an eligibility hook. Exclusion blocks retrieval before physical
cleanup. Purge deletes all derived data through hooks as later services arrive; no false claim of
purging tables that do not yet exist. Existing plans retain unavailable/redacted source markers.

Transport abstraction accepts method, provider-relative path, headers and optional JSON, returning
status/headers/JSON under timeout/body limits. Never follow credential-bearing redirects. Provide
client helpers for installation validation, token minting, default-branch SHA and bounded tree/blob
reads; source fetch implementation may use safe Git caching in the indexing slice.

## Provider service

```python
class ProviderService:
    def __init__(self, store, secrets, *, transport=None, clock=now_ms): ...
    def create_profile(self, spec, *, secret_value=None): ...
    def update_profile(self, profile_id, spec, *, secret_value=None): ...
    def delete_profile(self, profile_id): ...
    def list_profiles(self): ...
    def get_version(self, version_id): ... # nonsecret metadata
    def assign_role(self, role, profile_id): ...
    def roles(self): ...
    def settings(self): ...
    def update_settings(self, *, local_only): ...
    def embedding_namespace(self, version_id): ...
    def status_summary(self): ...
    def test_profile(self, version_id, *, capabilities=None): ... # synthetic requests only
    def generate(self, role, messages, *, schema=None, contains_source=True,
                 local_only=False, cancel_event=None): ...
    def embed(self, version_id, texts, *, contains_source=True, local_only=False,
              cancel_event=None): ...
```

Roles are ask/planning/summary/embedding. Profile spec: name, adapter (ollama/openai_compatible),
endpoint, model and config {timeout_seconds, max_output_tokens, context_limit, capabilities,
allow_external_source, embedding_dimensions?, input_price_per_million?, output_price_per_million?}.
Validate finite bounded numeric values and supported capabilities; unknown fields fail validation.
Updates create immutable versions. Role assignment selects a profile and new requests resolve its active version; deleted profiles cannot make
new requests and lose active roles, but historical nonsecret version metadata remains.

Ollama uses /api/chat and /api/embed; compatible endpoints use /chat/completions and /embeddings
under a configured /v1 base. Verify against injected and optional real endpoints. Return bounded
plain output plus parsed JSON when schema requested; consumers still validate domain schemas.
No hidden provider fallback. Nonstreaming fallback is explicit if streaming is unsupported.

Only HTTP loopback destinations or HTTPS endpoints are allowed. local_only rejects non-loopback
before inference, embeddings, redirects or fallback. Effective policy is persisted workspace local_only OR the call flag; remote role assignments/tests are blocked while enabled. Disable redirect credential forwarding.
External source transmission additionally requires profile opt-in; synthetic connection tests carry
no repository material. Errors/logs contain neither request source nor response secrets.

Results include profile_version_id, model, destination, actual token usage when reported and
estimated/unknown cost. Unknown pricing is not zero. Embedding batches must match input count,
finite values and configured dimensions. Namespace identity includes adapter/endpoint/model/
dimensions/chunker version; index services never mix incompatible namespaces.
Cancellation checks before sending and after receiving; network calls remain bounded by timeout.
Credentials are resolved transiently, never exported. Deleting/revoking a profile secret prevents
future calls even if a plan references its old version.

## HTTP wiring (coordinator-owned)

- GET /api/github/connections; POST /api/github/configure; POST /api/github/connect;
  GET /api/github/callback?state=...&installation_id=...; POST /api/github/refresh;
  POST /api/github/disconnect. Callback is state-validated; other writes require local Origin checks.
- GET /api/repositories; PATCH /api/repositories/{id}; POST /api/repositories/{id}/purge.
- GET/POST /api/provider-profiles; PATCH/DELETE /api/provider-profiles/{id};
  POST /api/provider-profiles/{id}/test; GET/PATCH /api/settings/model-roles.
- GET /api/jobs and GET /api/jobs/{id}; bounded sanitized job state, never raw payload/lease token.
- Workspace summary becomes versioned M1 and reflects actual connected/profile states;
  preserve existing fields where possible. Worker thread starts only registered safe handlers.
- UI redesign (2026-11-15): `/api/workspace` `mode` is `demo | local | connected`. It is `connected`,
  with `catalog.source: "github"`, when the GitHub summary status is `connected`.
  `GET /api/context/repositories` omits `index_sources` rows of kind `demo` while any
  `github_connections` row has status `connected`; demo rows remain listed otherwise.
- `GET /api/provider-profiles/discover[?base_url=]` (default `http://127.0.0.1:11434`, loopback
  only) returns `{reachable, models: [{name, family, parameter_size, context_length, embedding,
  loaded, gpu}], error_code}`; unreachable Ollama is `reachable: false, error_code:
  "provider_unreachable"`, not an error. `POST /api/provider-profiles/discover/dimensions`
  `{base_url?, model}` embeds the synthetic text "dimension probe" and returns `{dimensions}`.
- GitHub App Manifest flow. `POST /api/github/manifest/start` `{organization?}` returns
  `{action, state, manifest, expires_at}`. The browser POSTs a form field `manifest` (JSON) to
  `action?state=...`. The manifest is read-only (`contents`/`metadata: read`), private, has no
  `hook_attributes` (GitHub rejects loopback hook URLs even when inactive; verified live 2026-11-15), and sets `setup_url` to `/api/github/callback`. `GET /api/github/manifest/callback?code&state`
  validates the in-memory, single-use, 10-minute state, then calls the unauthenticated
  `POST /app-manifests/{code}/conversions` (GitHub allows 1 hour). It stores only `pem` in the vault via
  `configure(id, slug, pem)` and discards `client_secret`/`webhook_secret`, then redirects with 303 to
  `/#/settings/github?github=manifest_created`, or `?github=<error_code>` with
  `manifest_state_invalid | manifest_conversion_failed | validation | ...`.
  Checked against docs.github.com "Registering a GitHub App from a manifest" and REST "Create a
  GitHub App from a manifest" on 2026-11-15. The docs neither allow nor forbid a loopback
  `redirect_url`; that is verified live in the UI redesign Task 16.

## Acceptance and live prerequisites

GitHub: 250 records over multiple pages; middle-page failure preserves grants; rename, duplicate
refresh, replay, rate-limit scheduling, disabled selections and multiple grants all covered.
Providers: test content is synthetic; immutable versions, local-only/source-sharing, malformed
responses, timeouts/auth/rate limits, embedding dimensions and unknown cost covered.
Both: no plaintext credentials in DB/export/errors, actual requests mocked through injected
transports in tests. Live GitHub App registration/installation and model endpoints are separate
prerequisites; existing Codex/Claude CLI logins do not provide the product's API credentials.

References: [GitHub App installation auth](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation),
[keyring](https://keyring.readthedocs.io/en/latest/),
[cryptography RSA](https://cryptography.io/en/latest/hazmat/primitives/asymmetric/rsa/).


## Coordinator decisions resolving architecture advisory

The advisory is retained in docs/agents/runs/M1-CONTRACT/advisory.md. These decisions supersede
ambiguous wording above; implementation follows exact coordinator SQL, not guessed schemas.

1. **Atomic scheduling:** coordinator exposes `JobQueue.enqueue_in_transaction(conn, kind,
   payload, **options)` with the same validation/idempotency semantics, for callers already in
   Store.transaction. Refresh creates a unique run ID and job in one transaction; return the
   existing active run/job for duplicate requests. Never use a forever-fixed refresh key.
   Add job_id/continuation to discovery_runs. Rate-limit continuation is a new safe job scheduled
   at retry_at, keyed by run ID and continuation; run checkpoint survives across attempts.
   Periodic schedule_due checks connected connections at a minimum15-minute refresh interval;
   it only creates a run when no active queued/running/waiting run exists.
2. **Credential lifecycle:** any operation saving credentials requires persistent Store and
   available SecretService before writes (`persistence_required`409). Configure validates PEM
   as unencrypted RSA >=2048 and <=16KiB, verifies GET /app id/slug using transient JWT, then
   saves the ref. App-id reconfiguration rotates the ref atomically and revokes the previous
   one after commit. Multiple connections are allowed, with unique app_id; no singleton limit.
   Profile secret rotation carries the old ref forward unless replaced, then revokes it after
   commit; deletion revokes its refs. Failed record creation cleans newly created refs.
3. **Installation setup:** state is32 random bytes, hashed at rest,10-minute expiry; atomically
   consume before remote verification. Invalid/expired/replayed state has one setup_state_invalid
   code. Validate installation App ID and suspension. Only verified callback-attached installations
   are refreshed, never every installation of an App. Handle setup_action=request as pending
   approval with no grant. HTTP callback redirects303 to a fixed local Settings hash with a
   sanitized status code; never echo state/keys or an arbitrary redirect destination.
4. **Concurrency and revocation:** no HTTP request while holding Store locks/transactions.
   After each fetched page recheck connection and run state before upsert. Reconcile grants per
   fully traversed installation; partial failure cannot remove unseen grants. Authoritative
   suspension/404 removes that installation's grants. require_access returns an internal sanitized
   grant (repository_id, installation_id, permissions) or capability_missing/repository_unavailable.
   Tokens stay in memory; never persist installation tokens as github_token refs.
5. **Transport/privacy:** use ProxyHandler({}), default TLS validation and no redirects. URLs have
   no userinfo/query/fragment. Loopback is literal127/8 or::1 or exactlocalhost; reject other names
   in local-only and reject HTTP for remote hosts. Share-source opt-in is independent of local-only.
   Provider connection tests contain only synthetic text. Do not hold SQL locks during model calls.
6. **Provider metadata:** checks are mutable records separate from immutable versions. Usage may
   include optional subject_type/subject_id, outcome and currencyUSD. `embedding_namespace` hashes
   canonical adapter/endpoint/model/dimensions; F02 appends chunker identity. generate output schemas
   are model hints plus JSON parsing; owning plan/answer services perform domain/schema validation.
   No general JSON-Schema compliance is claimed. Nonstreaming is the declared M1 mode.
7. **Errors/status:** define package PlatformError subclasses with stable codes. Setup, credentials,
   auth, destination and profile state errors are409; missing IDs404; validation400; upstream rate
   limits429 with retry_at; timeouts504; temporary upstream/storage503; malformed output502.
   No raw upstream body/message is returned. Services expose bounded status_summary for later UI:
   GitHub status/installations/repository_count/last_refresh_at/next_retry_at/error_code;
   providers roles with profile/version/destination/status, and persisted local_only.
8. **Platforms and live gates:** initial execution/storage support is macOS and Linux (M0 uses
   POSIX locking). Do not claim Windows support from the OS vault adapter alone. Secure vault
   must be unlocked; no OS prompt is automated. Existing CLI logins are separate from App/provider
   credentials. Local Ollama is available for synthetic live checks: llama3.2:latest and
   nomic-embed-text:latest are cached; no model download or remote inference is required.


## Boundary return shapes for parallel builders

- Package exports are `repoask.github.GitHubService` and `repoask.providers.ProviderService`.
- GitHub connection/configure/begin/callback results are sanitized dictionaries. No state hash,
  key ref, JWT or token appears in the public connection result. refresh returns
  `{run_id,job_id,state,retry_at}`; job handlers return JSONobjects compatible with M0 Worker.
  Repository results contain database metadata with booleans decoded and topics as an array.
  get_repository includes selection/access fields. is_eligible requires current accessible grants
  and index_enabled. require_access(read) checks grants, write additionally requires explicit
  implementation_enabled; it does not imply index selection. Recheck active installation state
  as well as connection/run state before applying a fetched page.
- Provider create/update/list return profile dictionaries `{id,name,active_version_id,version}`
  where version contains id/profile_id/version/adapter/endpoint/model/config/created_at and
  credential_configured boolean, never secret_ref/value. get_version returns this version shape.
  roles maps role to profile/version/status/destination. generate returns
  `{text,json,profile_version_id,model,destination,usage}`; json is parsed structured output ornull.
  embed returns `{vectors,profile_version_id,namespace,usage}`. Usage has actual input/output
  tokens when available and estimated_cost/cost_status; unknown isnull, notzero.
- Provider settings defaults to `{local_only:true}`. Profile saving may be remote, but testing,
  role assignment or inference is blocked by effective local-only policy. No APIkey is required
  for loopback Ollama. New profile versions retain pinned historical metadata; role assignments
  follow active versions while an embedding job captures an explicit version namespace.
- Exact schemas are committed in `repoask/platform/service_schema.py` as migrations2/3;
  builders must not modify them. Additional columns require a coordinator migration allocation.
  `pushed_at` intentionally preserves GitHub's source timestamp string, matching the SQL schema.
- Standard service constructors accept injected transports. Define/export transport request and
  response types in the owning package and use them consistently in tests. No arbitrary URL from
  GitHub response or Link headers may receive credentials; only same-origin validated paths.
