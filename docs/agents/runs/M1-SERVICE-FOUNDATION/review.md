**Verdict: APPROVE exact commit `0bdeb3324069200e5652845aa11bd21244c4eb77`** (base `068690404527f56b83b4f715b1dec483070e2122`). I found no blocking or major defects. The minor notes below can be fixed by the provider builder in service code or by the coordinator, and none of them should hold the gate.

**Scope:** I read the packet `diff.patch`, `manifest.json`, `checks.txt` and the snapshot copies of `jobs.py`, `migrations.py` and `service_schema.py`, plus the three test files as shown in the diff. I also read `repoask/platform/db.py`, `secrets.py` and `workspace.py` from the mutable root, because they aren't in the packet. The diff doesn't touch them, so they should match base, but I didn't confirm that against a hash. I ran nothing; the 45-pass result comes from the coordinator's `checks.txt`, not from me.

## What I checked

1. **Migration 1 is preserved.** The diff only shows it as an unchanged context line; the registry adds versions 2 and 3 after it, and the checksum function is the same. The new upgrade test builds a real database with only migration 1, adds a job, reopens it with the full registry, and checks that the job payload survives, the version-1 checksum matches, and `PRAGMA foreign_key_check` is empty.

2. **Upgrade mechanics are sound.**
   - The backup is taken once, before `pre-v2`.
   - Each migration runs in its own `BEGIN IMMEDIATE` transaction.
   - The `provider_profiles` table refers to `provider_profile_versions` before that table exists. SQLite allows this when the table is created, and both tables come from the same migration.
   - `db.py` turns `foreign_keys=ON` on before migrations run, so every new foreign key is enforced.

3. **Schemas 2 and 3 cover every authoritative field in the contract.** The extra columns (`last_error_code`, `last_refresh_at`, `next_retry_at`, `repository_selection`, `suspended_at`, and usage `subject_type`/`subject_id`/`outcome`/`currency`) are the advisory additions the contract accepted. The CHECK value lists match the contract's states. `pushed_at` stays TEXT on purpose, as documented.

4. **Job composition is transactional.**
   - `enqueue` now just calls `enqueue_in_transaction` inside its own transaction, so its behaviour and validation are unchanged.
   - The new guard (`conn is store.conn and conn.in_transaction`) rejects connections taken from `read()` and any foreign connection.
   - Idempotency lookup and insert happen in the caller's transaction, so a run row and its job commit or roll back together. The rollback test covers this.

5. **Foreign keys and the unique active run hold.**
   - The partial unique index `discovery_active` allows only one queued, running or waiting run per connection; finished runs free the slot. A test covers this.
   - `discovery_runs.job_id` references `jobs`, and M0 never deletes job rows, so nothing breaks there.
   - Secret revocation in `secrets.py` sets `revoked_at` and never deletes the row, so the new references to `secret_refs` can't block a revoke.

6. **The profile/version cycle works.**
   - `active_version_id` is `NOT NULL ... DEFERRABLE INITIALLY DEFERRED`, while `profile_id` on versions is checked immediately. So inside one `Store.transaction` you insert the profile (with the version ID chosen in advance), then the version, and the check passes at COMMIT.
   - If COMMIT fails on a deferred foreign key, the transaction stays open, and `transaction()`'s `except` block rolls it back.
   - Inserting a profile in autocommit mode would fail. That's acceptable, because it forces callers to use a transaction.

7. **The test changes are correct.**
   - Tests that inject fake migrations now use `LATEST_VERSION + 1` instead of a hard-coded 2.
   - The backup's `user_version` is checked against `LATEST_VERSION`, which is right because the backup is taken before the injected migration.
   - Rewriting the M0 fixture's schema version to `LATEST_VERSION` is consistent with `workspace.py`, which reports `schema_version()` and `LATEST_VERSION` rather than a constant. The archived `m0-fixtures.json` file itself is left untouched.

## Minor notes (non-blocking)

- **m1. The active version can belong to a different profile** (`service_schema.py` L45–48). Nothing stops `active_version_id` pointing at another profile's version. A composite deferred key would close this: `UNIQUE(profile_id,id)` on versions plus `FOREIGN KEY(id,active_version_id) REFERENCES provider_profile_versions(profile_id,id) DEFERRABLE INITIALLY DEFERRED` on profiles. Adding it later means rebuilding the table in migration 4. Today a single service owns all writes, so a provider test asserting the rule is enough.
- **m2. Nothing in the schema stops roles pointing at deleted profiles.** `model_role_assignments` can reference a soft-deleted profile. `delete_profile` must remove the assignment rows in the same transaction, and a provider test should check this.
- **m3. Nothing in the schema stops an "unknown" cost of 0.** Consider `CHECK((cost_status='unknown') = (estimated_cost IS NULL))`, which would turn the "unknown is null, not zero" rule into a schema guarantee. `outcome` and `provider_version_checks.status` have no CHECK constraint either.
- **m4. The cycle and the frozen checksums aren't tested.** No test covers the deferred cycle (profile plus version commits; a profile with no version fails at COMMIT and rolls back). No test pins the checksums of migrations 2 and 3 either. Both are cheap to add, and a pinned checksum would catch any whitespace edit to `service_schema.py` while builders work in parallel.
- **m5. The transaction guard can't tell which thread owns the transaction.** `enqueue_in_transaction` checks `in_transaction` but not that the calling thread holds `store.lock`. Another thread passing `store.conn` could join someone else's open transaction. The docstring's "caller owns Store.transaction" covers this as a usage rule.
- **m6. Some foreign-key columns have no index.** `repository_installations(installation_id)`, `github_setup_attempts(connection_id)` and the non-active `discovery_runs(connection_id)` have none. This only affects performance when revoking or listing.
- **m7. Future job retention must respect the new key.** Any later cleanup of old jobs will need to handle `discovery_runs.job_id`, either by nulling it first or with `ON DELETE SET NULL` in a future migration.

**Who acts:** m1–m4 can go to the provider builder as tests or service rules, or to the coordinator if the coordinator wants them in the schema before the freeze is final. m5–m7 are notes for the coordinator. The integration decision is the coordinator's.
