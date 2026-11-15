# M2 integration acceptance (execution slice)

Date: 2026-11-15

This checkpoint covers the integrated execution-profile, session runtime, adapter,
Docker runner and redesigned session UI. F06 publication and the prompt-to-draft-PR
pilot remain separate gates; this is not an M2 milestone completion claim.

## Integrated checks

- Full Python suite: `507` passed, `9` opt-in/environment skips in `180.463s`.
  The previously reported `test_ask_shutdown.py` stall did not reproduce; its focused
  run also passed in `5.117s`.
- Full UI suite with the real session bridge:
  `REPOASK_TEST_PYTHON=.venv/bin/python node --test tests/ui/*.test.mjs` —
  `178/178` passed. The one initial integration mismatch was an old assertion that
  expected Diff and Checks to be visible while the redesigned page defaulted to its
  Progress tab; the test now selects the public tabs before asserting their content.
- Real Docker session tests:
  `OPENDEVIN_SESSION_DOCKER=1 OPENDEVIN_SESSION_DOCKER_IMAGE=python:3.12-slim ...`
  — `3/3` passed in `9.852s`. This covered read-only context, executable modes,
  in-container validation/diff, confirmed stop in `0.348s`, and zero owned leftovers.
- Real Claude adapter/model proof over the restricted broker and real Docker:
  `docs/agents/runs/M2-ADAPTER-SPIKE/real_probe.py` — `proof_passed=true` at source
  `e51d10f`, evidence SHA-256
  `d6a0433c704d08e8caccd419f7f704cf3a4abd3416fbb73edf3b63c9fb7659c2`.
  The synthetic calculator was fixed and validated, cancellation was confirmed in
  `0.113s`, `ask_user` returned the callback answer, the prompt was absent from argv,
  startup canaries stayed inactive, and all containers were removed.

The real-model proof exercises the production adapter, broker and Docker runner but
not the full `SessionService` orchestration object. A full prompt-to-session-to-draft-PR
pilot remains owned by M2-PILOT after F06 integrates.

## Remaining gates

- F06 publication builder, independent quality/security review and integration.
- User-authorized live GitHub Manifest acceptance.
- M2-PILOT against an explicitly disposable repository, including a real draft PR.
- Adapter minor follow-ups: prelaunch metadata stop/deadline propagation and callback
  error classification.
