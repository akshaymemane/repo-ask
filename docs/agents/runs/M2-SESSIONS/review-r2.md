# M2-SESSIONS independent review — round 2

Verdict: **CHANGES REQUESTED** for exact commit
`02843c32e1c4b7991663acd57939e90673369773`, including runner slice `6b3c5fd`.
The immutable packet's 18 files matched its hash manifest and `git diff --check`
passed. The session suite passed 52 tests with 3 skipped; the runner-context suite
passed 6 with 1 skipped. No live Docker or model invocation was performed.

## Findings

1. **Major — source consent is not synchronous at every broker boundary.**
   `repoask/sessions/attempt.py:217` checks current profile consent/image only for
   `full=True`; the broker guard and transactional admission use the cheaper check and
   the monitor's full check is two-second periodic. Revoking `allow_external_source`
   immediately after one `read_file` still allowed a second read before the session
   blocked. Current profile/consent must gate every source-bearing tool before admission
   and before returning its result.
2. **Major — artifact metadata bypasses live source policy.**
   `repoask/sessions/service.py:679` returned unchanged artifact hashes, byte counts and
   `redacted=false` after implementation access was revoked even though the session
   projection correctly reported `source_available=false`. Artifact projections need
   the same live redaction/tombstone policy as events, diff, validations and messages.
3. **Major — retry incorrectly requires the old plan to remain latest.**
   `repoask/sessions/service.py:472` and the transaction around lines 537–541 reject a
   predecessor's immutable plan after a newer plan version is saved. Retry must preserve
   the predecessor's exact intent while freshly checking access, exclusions, grants and
   its pinned execution version. The latest-version rule still applies to a new launch.
4. **Major — automatic publication eligibility is too permissive.**
   `repoask/sessions/attempt.py:946-956` marks any completed reviewable change eligible.
   A reproduced `on_success_draft` session with one passed and one unavailable required
   validation plus two rejected paths still returned `publication_eligible=true`.
   Automatic eligibility must require all required checks passed, no stale capture,
   rejected path or blocker, and confirmed containment. Manual reviewability remains a
   separate disclosed outcome.

Real Docker context immutability/containment and real-model execution remain release
evidence gates rather than additional code findings.
