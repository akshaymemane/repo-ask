# Builder handoff — M1-PROVIDERS

## R1 revision — current review handoff

- Review input: review-r1.md, changes requested against 20a9c2902fc7db87669efae4bebee4c8f20841ae. Earlier evidence below is retained as historical takeover evidence.
- Both major findings addressed in repoask/providers/service.py and tests/test_providers_service.py; shared platform/schema/migrations and other components untouched.
- Coordinator explicitly authorized a narrowly scoped secret_refs.revoked_at UPDATE. Rotation marks only the replaced reference belonging to this profile, and deletion marks only this profile's references, inside the same Store.transaction as the profile changes. Failed transaction rolls back both changes. Post-commit SecretService.revoke attempts vault cleanup; cleanup failure may leave a vault value, but the persisted tombstone blocks resolution and old-version inference, including after reopening storage. No claim of guaranteed physical vault erasure.
- A global synthetic-check stop now invalidates earlier current-run successes as well as previous verification. The returned per-capability results, persisted verified_capabilities and role readiness all report the invalidation.
- Four new regressions: rotation with injected pre-mark StorageBusy from revoke (including old-version embed and restart); deletion with the same failure plus unaffected other-profile credential; rotation rollback preserving old reference/active version; previous successful verification followed by successful chat then embedding 401.
- Actual validation: python3 -m unittest discover -s tests -p 'test_providers_*.py' — 24 passed, exit 0 (includes all ten fixtures). python3 -m unittest discover -s tests — 69 run, 64 passed, five existing test_http_foundation socket-bind errors, exit 1: PermissionError [Errno 1] Operation not permitted. Same five named cases listed below. No assertion failures.
- python3 -m compileall -q repoask/providers tests/test_providers_service.py and git diff --check — exit 0.
- No subagents, installs, live provider/account calls, source transmission, pushes or background processes. Independent exact-commit re-review and coordinator socket-enabled regression rerun remain required. This is author evidence, not approval.
- Revision commit: none; scoped git add exited128 because the sandbox denied shared Git worktree index.lock creation. No bypass attempted. Coordinator must commit before re-review; tracked revision patch: /private/tmp/m1-providers-r1.patch.

## Identity

- Author: Claude partial implementation (session cac5ebc2-b1ea-4ccb-b6ae-cb3da0fe4446), then Codex takeover (task owner session 01a1d5c9-e390-74d3-9164-e641623c0216). Claude exited on session quota; Codex preserved and inspected its files, completed fixes and authored the behavior tests. No subagents used.
- Persona: integration; branch task/m1-providers; worktree ../opendevin-m1-providers.
- Base: cb2dcad262050eed989cb64df05511db08974780; approved shared foundation: 0bdeb33.
- Submitted SHA: none. Staging exited 128 because the sandbox denied creating the shared Git worktree index.lock; see status.md. No permission bypass attempted. Coordinator must commit the preserved assigned paths before exact-commit review. Patch snapshot: /private/tmp/m1-providers.patch.
- Task: task.json; requirements AI-01, AI-02, AI-03, AI-06, AI-08, AI-09, AI-12. Also exercises usage/cancellation behavior required by the accepted packet.
- Status: ready for independent review preparation; not approved or integrated.

## Outcome

Consumes opendevin.m1/1, including final coordinator decisions and return shapes. Implements immutable model/config/credential versions, active-version role resolution, durable settings defaulting to local-only, synthetic capability tests stored separately from declarations, explicit embedding namespaces and nonstreaming Ollama/OpenAI-compatible adapters. Profile names are mutable profile metadata; name-only edits preserve the inference version.

Credentials use SecretService exclusively: persistent/available backend required before saving, carry-forward unless rotated, newly created references cleaned on failed writes, previous reference revoked after rotation, all references revoked after deletion. Historical metadata remains public and sanitized; deleted profiles cannot infer. Provider services do not enqueue jobs, so enqueue_in_transaction is not applicable to this package.

Codex fixes include malformed/unhashable capability inputs, strict booleans/numeric bounds, enormous token/vector values, exponent-overflow JSON, /v1 compatible endpoint validation, truncated output rejection, invalid response/header handling, bounded retry headers, stale verification after auth failure, sanitized storage failures, accurate deletion credential metadata and deadline checks between bounded transport reads. Proxy environment is disabled, TLS defaults remain enabled, redirects never forwarded, and response bytes are capped. No fallback or implicit retries.

Changed files (exclusive assigned scope):
- repoask/providers/{__init__,adapters,errors,service,transport,validation}.py (Claude partial retained and completed by Codex).
- tests/test_providers_service.py (Codex; includes tests-only in-memory vault, never a runtime backend).
- tests/fixtures/providers/README.md and ten synthetic JSON response fixtures (Claude contribution preserved).
- docs/agents/runs/M1-PROVIDERS/{task.json,status.md,handoff.md,self-evaluation.md}.

No platform, migration, entrypoint, web, manifests, existing tests or planning board changes. No installs, remote calls, credential discovery, source transmission or other board work.

## Verification evidence

Final commands executed on 2026-11-13 with global Python 3.12:

| Requirement | Actual command/scenarios | Result |
| --- | --- | --- |
| AI-01, AI-02, AI-08 | python3 -m unittest discover -s tests -p 'test_providers_*.py'; versions/role resolution/reopen/deletion/missing IDs/capability boundaries | 20 tests passed, exit 0 |
| AI-03 | Same suite; synthetic requests, separate checks, auth invalidation, all ten fixture files exercised through service | Passed; fixtures are hand-authored, not live captures |
| AI-06 | Same suite; persisted and call local-only, remote role/tests/embedding/source blocks, source opt-in, literal loopback endpoints, proxy/TLS/redirect handler checks | Passed with injected transports; no actual external inference |
| AI-09 | Same suite; namespace stability/change, vector count/dimension/nonfinite/bool/huge-number rejection, reordered/duplicate indexes | Passed |
| AI-12 | Same suite; unavailable backend/nonpersistent prerequisites, failed creation cleanup, credential carry/rotation/deletion, DB/public redaction | Passed using tests-only vault |
| Error/cancellation/cost | Same suite; auth, timeout, rate limit, redirect, malformed/oversize output, context overflow, storage failure, cancellation before/after send, unknown/estimated costs, network outside Store lock | Passed; no hidden retries |
| Full regression | python3 -m unittest discover -s tests | 65 run: 60 passed, 5 errors, exit 1. All five are existing test_http_foundation socket-bind failures: PermissionError [Errno 1] Operation not permitted. No assertion failures. |
| Syntax | python3 -m compileall -q repoask/providers tests/test_providers_service.py | Exit 0 |
| Whitespace | git diff --check | Exit 0; files initially untracked, so also inspect submitted patch after staging where permitted |

The five environment-blocked cases: ApplicationLifecycleTests.test_actual_cli_serves_then_sigterm_exits_cleanly_without_demo_files, ApplicationLifecycleTests.test_actual_cli_storage_failure_has_no_traceback_path_or_fallback, FoundationHTTPTests.test_durable_job_survives_server_restart, FoundationHTTPTests.test_status_routes_preserve_host_and_query_boundaries, FoundationHTTPTests.test_summary_health_and_legacy_routes_are_real. They fail before server startup because the sandbox forbids binding 127.0.0.1. Existing tests were preserved.

## Risks and next action

- Independent exact-commit quality/security review remains required; author does not approve this work.
- Coordinator must rerun the full suite where loopback sockets are permitted and optionally test cached local Ollama models with synthetic text. Codex did not run a live Ollama check after socket denial in the full suite. Fixture README retains Claude's earlier denied probe report; it is not Codex live evidence.
- OS secure-vault integration is coordinator-owned and not exercised here. Tests require only stdlib and a tests-only backend; no root venv or optional dependencies used.
- JSON schema is a model hint plus strict finite JSON parsing. Tests deliberately show schema-nonconforming JSON can parse; owning answer/plan services must validate domain schemas. Synthetic structured checks verify only their small expected object shape, not general JSON-Schema compliance.
- Context preflight uses an approximate four characters/token bound; upstream context errors are classified. Token limits are sent to providers, output also has byte caps; exact tokenizer accounting is not claimed.
- Cancellation is checked before send and after receive and between body reads; blocking connect/read obey network timeouts. No streaming, execution-agent capability, fallback, automatic retries, remote account integration or Windows runtime support claimed.
- No background processes launched or left running. HTTP wiring and F02 chunker namespace extension remain separately scoped coordinator/consumer work.
- Reviewer: assigned quality-reviewer via coordinator; inspect credential lifecycle, destination/redirect policy, finite response parsing, mutable checks vs immutable versions, error sanitation and approved-schema compatibility.
