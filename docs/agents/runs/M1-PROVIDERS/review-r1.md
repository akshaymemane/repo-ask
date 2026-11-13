**CHANGES REQUESTED** for M1-PROVIDERS commit `20a9c2902fc7db87669efae4bebee4c8f20841ae`, base `cb2dcad262050eed989cb64df05511db08974780`.

1. **Major — Failed credential revocation is silently treated as successful rotation.** `repoask/providers/service.py:192–196,298–301`. `_revoke_quietly()` suppresses every `PlatformError`, including failure to durably mark the old reference revoked. Reproduction for the integrator: create a credentialed embedding profile; make `secrets.revoke` raise `StorageBusy` before revocation; rotate the credential; restore `revoke`; call `embed()` using the old version. Rotation reports success, but the old version can still resolve and send its credential. This violates the accepted credential lifecycle contract. Ensure old references become durably unusable, and surface or durably track incomplete revocation rather than silently succeeding.

2. **Major — A later authentication failure preserves capabilities verified earlier in the same test.** `repoask/providers/service.py:686–691`. With requested capabilities `['chat','embeddings']`, return successful chat followed by HTTP 401 for embeddings. `failed_now` becomes all capabilities, but the final union reintroduces `verified_now={'chat'}`. Consequently, `roles()['ask']['status']` remains `ready` despite the authentication failure. Clear current-run successes as well as previous verification on a global stop condition. The existing test covers authentication failure on the first request only. This affects AI-03 and accurate capability readiness.

Minor follow-ups: none.

Reviewed AGENTS.md, quality-reviewer persona, task, PRD/F07, accepted contract, packet diff, snapshots, handoff, fixtures and tests. Independently verified all **22 snapshot files** against manifest hashes and exact Git objects; the packet diff matches Git.

This was an independent Codex review. **I ran no tests or live inference**; the coordinator’s reported 65/65 pass remains separate evidence. No edits or external mutations were performed. The provider owner should address both findings before coordinator integration and exact-commit re-review.
