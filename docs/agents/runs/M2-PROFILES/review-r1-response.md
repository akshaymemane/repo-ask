# Response to independent review of 551e988

Status: review fixes complete at source commit
`4f8f698aa77a7d1f5beed0acb04e5ca37db6df2f`; independent exact-commit re-review pending. This response addresses coordinator-delivered
independent Claude findings without changing SQL, contracts or dependency files.

| Finding | Resolution | Evidence |
| --- | --- | --- |
| M1: zero-effect pre-runtime policy/precondition errors incorrectly require external reconciliation | Fence ownership first; for a queued attempt, record a known failed check and return normally if policy/shutdown/preconditions reject before any factory call. Lease loss remains fenced; already-running attempts remain uncertain. | Local-only enabled after queueing produces zero factories, failed check, known queue completion and no recovery entry; restoring policy permits a successful fresh fixture test. Shutdown-before-runtime also allows a fresh test. |
| L1: callback errors after confirmed harness termination become containment_unverified | Respect producer process-boundary semantics: propagated callback errors are already contained; only ProcessContainmentError or explicit false containment results remain unverified. | A real synthetic Python child goes through run_stream; a start callback error propagates after termination, PID is verified absent, check is failed and no reconciliation is required. A separately injected unverified-termination result remains blocked/needs_reconciliation even though the child happens to be gone. No models are involved. |
| L2: credential-like/image URL forms accepted | Validate local Docker name/tag/digest grammar; reject userinfo, URLs, double slash paths, malformed @/digest forms and invalid registry ports. @ is accepted solely as the separator of a valid sha256 digest. | Invalid credential/URL/digest cases reject with validation. Local tags, registry host:port, raw sha256 IDs and repository@sha256 remain accepted. |
| L3: unbounded cursor timestamp can overflow SQLite bindings | Require decoded timestamp to be a signed int64 before querying. | Positive/negative overflow, huge integers, bools and floats map to validation; both int64 boundaries bind successfully. |
| L4: presentation rename should retain equivalent check | Read-only check resolution inherits the nearest check across consecutive immutable versions only when adapter/auth/config bytes are identical. An explicit check on the new version overrides inheritance. Any intervening material change breaks the chain, including a later revert. | Completed and in-flight name-only renames retain check readiness with no extra test/runtime/recovery record. Material changes/reverts do not reuse old success; a failed latest check stays failed after rename. |

The equivalent-check lookup avoids duplicating private runtime records/job IDs in
multiple check rows, so a rename during a running check still yields one trusted
leader recovery entry. It does not change pinned immutable version IDs/configs.
No migration or public projection change is required.

Command run: `./.venv/bin/python -m unittest discover -s tests -p 'test_execution_profiles.py' -v`.
Result: **39 passed in 15.590 seconds**.

No Docker, model inference, credential access, remote accounts or nested agents.

Final full command: `OPENDEVIN_DOCKER_TESTS=0 ./.venv/bin/python -m unittest discover -s tests`.
Result: **358 tests in 151.314 seconds; OK, five expected Docker-gated skips**.
Inherited broker AF_UNIX ResourceWarnings remained visible; this task neither
modified that dependency nor suppressed its warnings. `git diff --check` and
`git diff --cached --check` passed before the source commit.
