# Builder handoff — CONTRACT-01

## Identity

- Author/harness and session ID: Claude (Claude Code, architect delegate); task card owner_session `6cf6a390-9b08-4792-aa22-fcda0f9faa11`
- Persona, branch and worktree: architect · `task/contract-01` · `/Users/apple/workspace/vibe-coding/opendevin-contract-01`
- Base SHA and submitted commit SHA(s): base `37e635abd527c53b7bdd77648e6c87ae17a3c970`; submitted = the single local commit that adds this file (SHA reported to coordinator in the session result; `git log -1 task/contract-01`)
- Task card and requirement IDs: `docs/agents/runs/CONTRACT-01/task.json`; OP-01, OP-02, OP-04, OP-09, UX-02, UX-08, UX-10 (F12, F07 summary, F11)
- Status: review

## Outcome

Proposed contract packet `opendevin.m0/1` for M0-PLATFORM (Codex), M0-EXPERIENCE (Claude) and M0-INTEGRATE (coordinator):

- `docs/contracts/README.md` — conventions (IDs, timestamps, versioning, error shape); exact `repoask/platform/` Python signatures (`Store`, `Platform`, `JobQueue`, `Worker`, `SecretService`, `SecretBackend`, errors, `build_workspace_summary`/`build_health`); migration runner rules, registry and exact migration 1 SQL; job state/lease/retry/cancel/reconciliation transition table; fail-closed secret rules; preserved legacy routes; new GET `/api/workspace` and `/api/health` field tables; UI consumption rules incl. pre-integration fallback; per-slice scope and focused checks; deferred table.
- `docs/contracts/m0-fixtures.json` — legacy `/api/repos` + `/api/ask` shapes (generated from current code), 3 workspace, 4 health, 3 error fixtures, UI legacy fallback and render expectations.
- `docs/architecture/0001-m0-foundation.md` — 8 concise decisions + 3 open decisions.
- `docs/agents/runs/CONTRACT-01/check_fixtures.py` — reproducible stdlib fixture-consistency check.
- `docs/agents/runs/CONTRACT-01/status.md`, `handoff.md`; `task.json` committed unmodified as received.

Scope confirmed: only `docs/contracts/`, `docs/architecture/`, `docs/agents/runs/CONTRACT-01/`. No source, board, tests or manifests edited. No contract versions consumed (first packet).

Key choices to review (details in ADR):
- Persistence opt-in via `--data-dir`; no flag → in-memory platform, demo writes no files.
- Lease ownership = token match; `claim()` reconciles expired leases first; `effect='external'` expiry → `needs_reconciliation`, never auto-requeued; restart does not force-expire leases.
- Only runtime secret backend in M0 is `UnavailableSecretStore`; memory double under `tests/` only.
- Host-check 403 / unknown-route 404 keep legacy bodies (shared dispatcher); new `code` field only on new-route errors.
- Unavailable areas (Sessions, customization) are omitted from navigation, not shown disabled.

Routes the coordinator wires in M0-INTEGRATE (`repoask/__main__.py`): `GET /api/workspace`, `GET /api/health` (two `elif` branches calling platform builders), `--data-dir PATH`, `Platform.open` at startup (fail closed on error), `close()` on shutdown. No POST/state-changing routes, no `/api/jobs`, no worker thread.

## Verification evidence

| Requirement | Command or scenario actually run | Result / evidence |
| --- | --- | --- |
| Baseline unchanged | `python3 -m unittest discover -s tests` (before and after edits) | exit 0, `Ran 4 tests ... OK` both times |
| Fixtures parse | `python3 -m json.tool docs/contracts/m0-fixtures.json` and task.json | exit 0 (`JSON_OK`) |
| Fixture/interface consistency; legacy shapes preserved | `python3 -I docs/agents/runs/CONTRACT-01/check_fixtures.py` | exit 0: `OK: 3 workspace, 4 health, 3 error fixtures consistent`; legacy repos keys/values and ask search response compared against live `CodeIndex`/`respond()` output |
| OP-01/02/04/09, UX-02/08/10 | Document review only | Specified, not runtime-proven; platform/experience builders' focused checks (README §8) provide behavior evidence |

Not run: negative test of the checker itself (mutated fixture); any runtime behavior (none implemented by this card).

## Risks and next action

- Known gaps: fixture `local_with_model_persistent` model name is illustrative. Fixture checker validates documents only. `Worker` contract defined but intentionally not wired into server in M0.
- Open decisions for coordinator: default data-dir location / default-on persistence (M1); first OS secret backend approach (`security` CLI argv exposure); repository numeric identity migration (M1-GITHUB).
- Migrations/configuration needed: none now. Migration version 1 allocated to M0-PLATFORM; later numbers by coordinator.
- Tool note: sandbox denied heredoc-in-Bash and a command using `$?`; worked around with the Write tool and separate commands. No effect on deliverables.
- Background processes still running: none.
- Reviewer and requested review scope: Codex quality-reviewer (`coordinator-independent-contract-review`) — review for both producer (platform) and consumer (experience) feasibility, legacy route preservation, fail-closed secret rules, lease/reconciliation table completeness.
- Blocker owner and unblock action: none. Next: coordinator review/accept, then shape M0-PLATFORM and M0-EXPERIENCE cards against `opendevin.m0/1`.

Not integrated, approved or published.
