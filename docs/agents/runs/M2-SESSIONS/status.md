# M2-SESSIONS status

- Owner: Claude runtime (session runtime/publication persona), worktree `opendevin-m2-sessions`, branch `task/m2-sessions`.
- Base: 28343c3a6a5223bb6195678d2d55203692cdbc14.
- Candidate dependency cherry-picked (not root-integrated): adapter 6789421 -> 595d6b7, 9de6eeb -> 952a1b4.

## Log

- 2026-11-15 start: read AGENTS/WORKFLOW/runtime persona, PRD, F05/F12, task card, m2-sessions + m2-execution-spike contracts, schema 9/10. Phase: reading producers (runner/broker/adapter/GitHub/plans/indexing/profiles).
- Phase: implementation. repoask/sessions/{service,attempt,runtime,workspace,prompt,processes,redaction,errors}.py written. Launch/preflight/queued-stop/full fixture run (real broker socket, real GitHub/Index/Plan services, synthetic transport) passing: 8 tests.
- Blocked locally: direct `docker` CLI and `git -C` into sibling worktree denied by sandbox; Docker proof deferred to root/owned script.
- Producer note: sibling repoask/execution/profiles.py not yet present; tests use a double persisting real schema-9 rows with root-clarified flat require_usable shape.
- Next: stop timing, ask_user round trip, revocation, budget, lease loss, restart/shutdown recovery, retry, purge, acquisition failure tests.
- Phase: review-ready. Session suites 31 tests OK (2 opt-in Docker skipped) x3 runs; full regression 350 OK / 32 skipped. Real ClaudeAdapter+MCP bridge path proven with FAKE CLI (no inference). Docker opt-in test NOT run (sandbox denied); real Claude probe NOT run (no root grant). Handoff written; broker follow-up proposal for root (broker not edited). Committing for fresh Codex boundary review.
