# M2-PRS independent review record (rounds 1-3)

Author: Codex runtime builder. Reviewers: fresh Claude sessions (opposite harness), read-only.

| Round | Commit | Quality reviewer | Security reviewer |
| --- | --- | --- | --- |
| 1 | `a273ab2` (cherry-pick of `741251e` onto `97f8c30`) | request changes (4 HIGH, 5 MEDIUM, LOW) | request changes (1 HIGH, 2 MEDIUM, LOW) |
| 2 | `5a551d1` | request changes (2 major: stuck job after retry, overlapping recover; 3 minor) | **approve** (2 minor: refresh shape, compare previous_filename) |
| 3 | `83172f7` | **approve** — N1-N8 and round-1 items 4, 10 resolved; no new findings | (round-2 approval; round-3 changes are recovery serialization and snapshot cost, reviewed by quality incl. boundary checks: token scope, fences, lock order) |

Consolidated findings and coordinator decisions: `review-r1-findings.md`, `review-r2-findings.md`.
Author evidence: `handoff.md` (finding-to-test mapping per round).

## Round-3 approval summary (quality, boundary)

- N1: retry acts only on recover()'s outcome; enqueue refuses while the current job is `needs_reconciliation`.
  Test `test_retry_pending_read_never_orphans_old_job`.
- N2: `RECOVERY_LOCK`, conditional `reconciling` transition, InvalidTransition treated as resolved, per-row
  error capture. Tests `test_overlapping_recovery_retry_and_leased_worker`, `test_purge_during_recovery_does_not_abort_startup`.
- N3: check summary persisted at publish; `get`/`_public`/`_state` never call the snapshot; every snapshot call is
  outside a write transaction; constant snapshot loads per run. Test `test_snapshot_loads_are_constant_for_blob_step_outside_write_lock`.
- N4-N8 resolved with focused tests.
- Observations (not defects): per-blob source check relies on `SessionService.source_policy` (present in the real
  service); `retry()` may wait behind recovery of other publications (latency only).

Coordinator checks on `83172f7` outside the sandbox: full suite 565 OK (9 skipped). Combined check with the real
snapshot producer lives in `tests/test_publication_integration.py` (M2-INTEGRATE).
