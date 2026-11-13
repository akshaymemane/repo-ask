Read-only review is done. I read the role docs, the M1 draft, M0, F01/F07 and the untracked `keyring_backend.py`. I made no edits. Findings follow.

# M1-services draft review: implementation readiness

**Verdict:** not ready to freeze. There are 6 blocking and 11 major gaps. All can be fixed in the contract text without adding infrastructure. Line numbers refer to `docs/contracts/m1-services.md`.

## Blocking

**B1. Nobody owns the migration file (L31–35).** `repoask/platform/migrations.py` is append-only and belongs to M0-PLATFORM. The draft lets both builders depend on migrations 2 and 3 but doesn't say who writes the SQL. It also allows "additional indexes/check constraints", so the two branches could end up with different schemas.
- **Fix:** the coordinator commits the exact SQL for migrations 2 and 3 (enums as CHECKs, NOT NULL, FKs, indexes) to `migrations.py`. Do this on the *integrated* M0-PLATFORM SHA, which is still in review at `ff0cdb9`. Both builders start from that commit.
- Builders don't edit `migrations.py`. Any schema change becomes migration 4 or later, through the coordinator.
- `keyring_backend.py` and `test_keyring_backend.py` are untracked in the main checkout. Commit them and give them a security review before any real credential form ships.

**B2. Idempotency keys never expire in M0, so refresh and purge would only ever run once (L80, L88).** In M0, `idempotency_key` is UNIQUE forever and returns the existing job even if it has finished. A key like `github.refresh:<conn>` would make every later refresh return the first job.
- **Fix:** in one transaction, look for an active `discovery_runs` row (queued or running). If there is one, return its job. Otherwise insert a new run and enqueue with key `github.refresh:<run_id>`.
- Add `discovery_runs.job_id TEXT` so disconnect can cancel the job. `JobQueue` can't search by kind or payload.
- Purge works the same way: key `github.purge:<repo_id>:<purge_seq>`.

**B3. A rate-limited retry can't be scheduled for the reset time (L101, GH-07).** M0's `fail(retryable)` uses exponential backoff and can't take a specific `run_after`. Changing the M0 queue is a contract change.
- **Fix:** keep the discovery checkpoint in `discovery_runs.checkpoint`, not in the job checkpoint. When rate-limited, the handler:
  1. completes the job with `{"rate_limited": true}`;
  2. sets `discovery_runs.retry_at` to the reset time and `state='waiting'`;
  3. enqueues a continuation job (`github.refresh`, `run_after=reset`, key `github.refresh:<run_id>:<n>`).
- The UI reads `retry_at` from the connection or run to show the next attempt time.

**B4. Writing credentials without persistent storage leaves orphaned vault entries.** The demo and no-flag runs use `:memory:`. A configure call there would put the PEM or API key in the OS vault while the reference disappears on exit.
- **Fix:** `configure`, `create_profile` and `update_profile` with a secret raise `persistence_required` (409) unless `store.persistent` is true **and** `secrets.status().available` is true. Both checks happen before any vault or DB write.

**B5. App setup and installation flow is incomplete (L74–79, L91–95).** The draft is missing:
- **App check at configure time:** sign a JWT, call `GET /app`, and require `id == app_id` and `slug == slug`. Otherwise fail with `github_app_invalid`. Check that the PEM parses as unencrypted RSA ≥2048 of ≤16 KiB before calling `SecretService.create`. Validate slug with `^[a-z0-9][a-z0-9-]{0,33}$` before building `install_url`, to block URL injection.
- **Connection states:** `configured` (App checked, no installation yet) → `connecting` (attempt open) → `connected`, plus `reconnect_required` and `disconnected`. Add `last_error_code`, `last_refresh_at` and `next_retry_at` to `github_connections`.
- **Callback rules:**
  - Consume state atomically with `UPDATE … WHERE state_hash=? AND consumed_at IS NULL AND expires_at>? ` and require rowcount 1. Do this *before* the remote check, so the attempt is used up even if the check fails.
  - Unknown, expired and already-used state all return one code, `setup_state_invalid`, so the response doesn't reveal which case it was.
  - Then call `GET /app/installations/{id}` with the App JWT. It must match `app_id` and must not be suspended. Store owner, permissions, `repository_selection` and `suspended_at` from that response.
  - `setup_action=request` (an org owner must approve) has no usable installation yet. Show it as `pending_approval` and attach nothing.
  - A callback with no valid state changes nothing.
  - The callback replies with a 303 redirect to `/#/settings?github=<code>`, never JSON.
- **Which installations count:** refresh covers only installations attached through a verified callback. It does not enumerate `/app/installations`. Setup docs must require a **private** App, because others could install a public one.
- **Key rotation:** a second `configure` creates the new ref, swaps it in one transaction, then revokes the old ref.
- **Scope:** exactly one connection row in M1 (singleton constraint).

**B6. Local-only mode can be bypassed in three ways (L145–148, AI-06).**
1. It is only a per-call flag, so a consumer can forget it. **Fix:** persist a workspace setting `local_only`. The rule used everywhere is `effective = setting OR call flag`. Assigning a remote profile to a role while it's on is rejected, and existing remote assignments are reported as `blocked`. This needs a settings table in migration 3 (`provider_settings(key PK, value JSON, updated_at)`), exposed through `GET/PATCH /api/settings/model-roles`.
2. Python's `urllib` uses `HTTP(S)_PROXY` environment variables by default. A request meant for loopback, carrying the API key, could go through a proxy. **Fix:** every transport, GitHub included, uses `ProxyHandler({})` and the default TLS context, and **follows no redirects**. A 3xx response is the `upstream_redirect` error. GitHub calls use `/repositories/{id}`, so rename redirects don't come up.
3. Hostnames can be rebound in DNS. **Fix:** "loopback" means only literal `127.0.0.0/8`, `::1` or exactly `localhost`. Endpoints must have no userinfo, query or fragment. Plain HTTP is allowed only for loopback.

## Major

**M1. No network I/O while holding the Store lock.** The Store lock is global. Any HTTP call (GitHub page, model call, JWT exchange) inside `transaction()` would block every other route. The contract should say so explicitly.
- Each GitHub page write re-checks, in its write transaction, that `connection.status='connected'` and `run.state='running'`. Otherwise it drops the page. This stops a page fetched before disconnect from re-granting access.

**M2. Grant removal is defined only loosely (L97–102).** Define it per installation:
- Links for installation X with an old `seen_generation` are removed only if every page of X finished in this run.
- An authoritative 404 or suspension for X removes all of X's links.
- Define `repositories.access_state` as `accessible | inaccessible | unknown`, derived from links. Add `last_seen_generation`.
- Make `pushed_at` an INTEGER in ms, matching M0.
- Rebuild `clone_url` from the numeric ID's `full_name` rather than trusting the API value.

**M3. The hooks consumers need are unspecified (L104–108, L88).** F02 is the next wave and both sides need the signatures now. Proposed:
- `register_eligibility_listener(fn(repository_id, eligible: bool))`
- `register_purge_hook(name, fn(repository_id))`, run outside transactions and idempotent
- `require_access(repository_id, capability)`, where capability is one of `contents_read`, `contents_write` or `pull_requests_write`. It returns `{repository_id, installation_id, permissions}` or raises `RepositoryUnavailable(code='repository_unavailable')` or `CapabilityMissing(code='capability_missing')`.
- `mint_installation_token(repository_id, permissions)` lives in the client module. Tokens stay in memory only; never use the `github_token` secret purpose for them.

**M4. There's no M1 error code list.** Each package defines `PlatformError` subclasses in its own `errors.py`.
- **GitHub:** `github_not_configured`, `github_app_invalid`, `setup_state_invalid`, `installation_suspended`, `installation_mismatch`, `reconnect_required`, `rate_limited` (with `detail.retry_at`), `upstream_timeout`, `upstream_unavailable`, `upstream_redirect`, `repository_unavailable`, `capability_missing`, `persistence_required`.
- **Provider:** `provider_auth`, `provider_rate_limited`, `provider_timeout`, `context_overflow`, `unsupported_capability`, `invalid_output`, `destination_not_allowed`, `source_sharing_not_allowed`, `profile_deleted`, `embedding_mismatch`.
- Map each one to the HTTP status table at L26–28.

**M5. Role assignment points at a version, so profile edits silently don't apply (L62, L137–138).**
- **Fix:** `model_role_assignments.profile_id` follows the profile's active version. `generate` and `embed` resolve the version at call time and return `profile_version_id`, and plans and sessions record that ID. The exception is the embedding role: changing its version must trigger reindexing (AI-09), so either keep `embed(version_id)` explicit or have F02 detect a namespace change.
- **Secret semantics:**
  - Each version holds a `secret_ref` that carries forward unless a new value is given.
  - A new secret revokes the old ref after commit, so old versions become historical and can't be called.
  - `delete_profile` revokes all of its refs.
  - Active profile names are unique (partial index).

**M6. Provider health has nowhere to live.** The UI needs test results, and versions are immutable. Add `provider_version_checks(version_id PK, status, verified_capabilities JSON, error_code, checked_at)`. Declared capabilities come from config; verified ones come from tests. Results are shown separately.

**M7. Usage attribution is missing (L63–64, F07 UsageRecord).**
- Add `subject_type` and `subject_id` (both nullable), `outcome`, and `currency` (default `'USD'`).
- `generate`/`embed` take `purpose=` and `subject=` arguments.
- Cost is stored only when prices are configured. Otherwise it is NULL with `cost_status='unknown'`.

**M8. The embedding namespace function isn't defined (L152–153).** Add `embedding_namespace(version_id) -> {key, adapter, endpoint, model, dimensions}`, where `key` = sha256 of the canonical JSON. F02 appends its chunker version. Keep the endpoint in the key; that's conservative.

**M9. The M1 workspace summary has no shape or fixture (L167).** F11 is the next consumer.
- Each service exposes `status_summary()`:
  - GitHub: `{status, installations, repository_count, last_refresh_at, next_retry_at, error_code}`
  - Providers: `{roles: {role: {status, profile_id, destination}}, local_only}`
- Add fixtures `workspace.m1_*`. Bump the contract minor version to `opendevin.workspace/m1.1`.

**M10. GitHub jobs have no scheduler (L40, GH-06).** No scheduler exists. **Fix:** after a run succeeds, the handler enqueues the next refresh with `run_after = now + max(interval, 15 min)` and key `github.refresh:<next_run_id>`. Startup schedules a refresh if none is active. Disconnect cancels the active job via `discovery_runs.job_id` and then sets the run state; the handler checks for cancellation between pages.

**M11. OS vault prerequisites aren't written down (L15–19).** `OSKeyringBackend` stores base64. RSA-2048 PEM is about 1.7 KB, about 2.3 KB once encoded.
- Windows Credential Manager has a known blob limit of 2560 bytes (UTF-16, so about 1280 characters). I'm confident of this but haven't tested it; treat it as unverified. If it holds, the PEM won't fit.
- **Fix:** M1 supports the GitHub PEM on macOS and Linux only. On Windows, PEM storage fails safely with `secret_too_large`. Provider API keys fit.
- Linux needs a running D-Bus Secret Service. Headless and WSL setups get `secret_store_unavailable`.
- On macOS, Keychain asks again when the venv's Python binary changes. Document this.

## Defaults for low-risk choices

| Item | Default |
| --- | --- |
| Setup state | 32 random bytes, stored as a sha256 hash, valid 10 min |
| JWT | `iat=now-60s`, `exp=now+540s`, RS256 via `cryptography` |
| Installation token | Requested per run, kept in memory, scoped to `metadata:read` / `contents:read` |
| Paging | GitHub `per_page=100`; dedupe by repo ID inside a run; collections limited to 1..100 |
| `index_new` | Applies to all newly inserted repos, including the first discovery; default false. Per-installation policy deferred |
| App permissions in M1 docs | Metadata read and Contents read only. Write access comes in M2 through an App permission update; `require_access` reports `capability_missing` until then |
| Transport | Each package writes its own minimal `urllib` transport following the B6 rules. Merge them later |
| Body limits | Chat 2 MiB, embeddings 32 MiB, at most 64 inputs per embedding batch, GitHub 8 MiB |
| OpenAI-compatible endpoint | Treat as a base URL and append the paths. Don't require `/v1` |
| Streaming | Not supported in M1; `generate` doesn't stream. A `streaming` capability is reported but unused |
| `test_profile` while local-only is on | Remote tests are rejected |
| LAN Ollama over HTTP | Rejected (HTTPS only). Note it as a known limitation |
| Legacy `--model` | Not stored in the DB. Used only when no profile is assigned to the Ask role; the summary says which one is active |
| Repo ID format | `gh:<n>` on new routes only; legacy `/api/ask` keeps names until F02/F03 |
| App Manifest one-click setup | Deferred; M1 has users paste the App ID, slug and PEM |
| Orphaned vault entries after DB restore | Accepted; a reconnect resolves them (`SecretMissing`) |

## Live prerequisites to add to setup docs

These are not CI gates.

**GitHub:**
- Create a **private** GitHub App.
- Set the Setup URL to `http://127.0.0.1:<fixed port>/api/github/callback`. The app must then always run with that `--port` and host form.
- Turn the webhook off ("Active" unchecked).
- Turn off "Request user authorization (OAuth) during installation". If it's on, GitHub sends the browser back with a `code`, and the state flow never runs.
- Permissions: Metadata read and Contents read.
- Generate a private key, then install the App on your account or orgs. Org installs may need owner approval.

**Runtime:** run with `--data-dir`, install the project venv with `.[credentials,github]`, and have an unlocked OS vault.

**Models:** Ollama running with a chat model and an embedding model pulled, or a compatible endpoint with an API key. Existing Codex or Claude CLI logins don't count as product credentials.

## Dependency impact

The two builders can work in parallel once B1–B6 and M3–M5 are in the accepted text and the coordinator's migration commit exists. M6–M9 can be decided while they build, but must be settled before F11 and F02 start.
