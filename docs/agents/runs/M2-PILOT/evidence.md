# M2-PILOT evidence log (live, coordinator-driven)

Repository: `akshaymemane/opendevin-pilot` (disposable, created by the user). Seed commit `2605d80`
(calc.py with `add()` returning `a - b`, test_calc.py, README.md), pushed by the coordinator with the
user's permission. GitHub App `opendevin-88c4ef` connected by the user and installed on this repository only.
User authorizations (2026-11-17, in chat): local-only off and source to Anthropic for this pilot; Ask/plan
on the Claude subscription (Sonnet); one real draft PR; commit author "Akshay Memane" with the GitHub noreply email.
App: integration code at `ff0a6da`, then `62f33cd` (plan preflight fix) — local server on 127.0.0.1:8765, data dir in the session scratchpad.

## Steps and results

| # | Step (real UI unless noted) | Result |
| --- | --- | --- |
| 1 | Repositories: Use in Ask + Allow changes (confirmation dialog) | Index snapshot at `2605d80`, 3 files, lexical_only (no embedding role) |
| 2 | Privacy: local-only off | `local_only=false` |
| 3 | Models: Claude subscription Sonnet, source sharing on, "Set up and test" | Test passed; Ask and planning roles `ready sonnet` |
| 4 | Coding agent: PR author; execution profile "Pilot Claude" (python:3.12-slim, source allowed) | First synthetic test `execution_runner_unavailable` (transient Docker "No such image" for the tag; runner preflight passed on retry). Second test **passed**: CLI 2.1.311; capabilities ask_user, cancellation, checkpoint, follow_up, headless, resume, streaming |
| 5 | Ask: request with repo chip → Generate plan | Plan v1 in ~10 s (Sonnet), cited `calc.py:1–6`, `test_calc.py:1–9` @ `2605d80`, validation command, risks |
| 6 | Plan readiness | v1 `execution_not_configured` (plans are generated with no profile). Edit plan → profile → v2 still blocked: **defect** — PlanService had no `execution_preflight` in the app. Fixed `f931041` (Codex approved), integrated `62f33cd`, app restarted → v2 **ready** |
| 7 | Start session (inside Edit plan → Execution and publication) | Session `ses_38eb423a…` queued → provisioning → agent → **completed** in ~30 s, outcome `reviewable` |
| 8 | Diff / checks | One-line fix `return a - b  # bug…` → `return a + b`; validation ran in the container: exit 0, `ok`; fully_validated |
| 9 | Publication preview | **Blocked `rejected_paths`**: validation created `__pycache__/*.pyc` (`excluded_generated`, added). Defect: every Python session that runs tests is unpublishable. Contract decision `e74bb3b`; fix assigned to Codex (M2-GENERATED-OMIT) |

## UX findings (not blocking, owners to assign)

1. Repositories list shows status "Off" after indexing completed and Use in Ask is on (reload does not fix it).
2. Plans are generated with no execution profile; choosing one is buried in Edit plan → Execution and publication and requires saving a new version. A single tested profile should be preselected or offered on the plan.
3. The conversation card's "Start session" only opens the plan; the real launch control is inside the plan editor.
4. Stale copy "Sessions arrive with M2" / "Implementation (M2)" — fixed in `f931041`.
