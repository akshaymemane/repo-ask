# M2-PILOT evidence log (live, coordinator-driven)

Repository: `akshaymemane/opendevin-pilot` (disposable, created by the user). Seed commit `2605d80`
(a three-file synthetic calculator with one deliberate bug in `add()`), pushed by the coordinator with the
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
| 8 | Diff / checks | One-line fix to `add()` (1 addition, 1 deletion); validation ran in the container: exit 0, `ok`; fully_validated |
| 9 | Publication preview | **Blocked `rejected_paths`**: validation created `__pycache__/*.pyc` (`excluded_generated`, added). Defect: every Python session that runs tests is unpublishable. Contract decision `e74bb3b`; fix assigned to Codex (M2-GENERATED-OMIT) |

## UX findings (not blocking, owners to assign)

1. Repositories list shows status "Off" after indexing completed and Use in Ask is on (reload does not fix it).
2. Plans are generated with no execution profile; choosing one is buried in Edit plan → Execution and publication and requires saving a new version. A single tested profile should be preselected or offered on the plan.
3. The conversation card's "Start session" only opens the plan; the real launch control is inside the plan editor.
4. Stale copy "Sessions arrive with M2" / "Implementation (M2)" — fixed in `f931041`.

## Completion (2026-11-17)

| # | Step | Result |
| --- | --- | --- |
| 10 | Generated-artifact fix `fb1ba26` (Codex author, Claude review approved) integrated `5132c08`; app restarted | Old attempt stays blocked by design (stored outcome not reinterpreted) |
| 11 | Session page → "Retry as a new attempt" | `ses_58809f36…` completed in ~25 s, `reviewable`, `rejected_paths 0`; validation passed in the container |
| 12 | Preview | `publication_permission_denied`: **defect** — the App manifest requested read-only permissions, so no setup-created App could publish. User chose "request write at setup"; fix `5048484` (Codex approved), integrated; user raised the existing App to Contents and Pull requests read & write and accepted on the installation |
| 13 | Repositories → Sync; preview | publishable; base `main` @ `2605d80` not diverged; changed `calc.py`; omitted `__pycache__/*.pyc` (2) |
| 14 | PR tab → Create draft PR → review → title "Fix add() in calc.py to return a + b" → Publish draft PR | `published`, Draft PR #1 open, commit `b2674c3`, branch `opendevin/ses_58809f369319ff90157902bd-96c99e3e2a` |
| 15 | Independent GitHub check (`gh`, read-only) | https://github.com/akshaymemane/opendevin-pilot/pull/1 — draft, one file `calc.py` +1/−1, author Akshay Memane <akshaymemane@users.noreply.github.com>, `main` unchanged at `2605d80`, no bytecode published |

Machine-readable, content-free evidence: `evidence.json`. A browser GIF was recorded but its export failed
(extension disconnected after the 50-frame cap); API and GitHub evidence above are the record.

## Additional UX findings

5. Default PR title is "OpenDevin session <id>"; it should default to the plan goal.
6. The PR review step does not show `omitted_paths` (generated files left out); the PR body lists them.
7. Agent model shown in the timeline is the CLI default (claude-opus-5-5); the execution profile has no model choice.

## Cancellation and recovery checks (exit gate)

| # | Check | Result |
| --- | --- | --- |
| 16 | Cancellation: new attempt `ses_ba865aac…`, Stop requested while `running agent` | `cancelled` in 1.2 s, containment confirmed, no session containers left |
| 17 | Recovery: attempt `ses_01788bb0…` running agent; server killed with SIGKILL | Session container `org.opendevin.session=ses_01788bb0…` left running (expected after a hard kill) |
| 18 | Restart server | Session reconciled to `interrupted` / `runtime_interrupted`; containment event `{confirmed: true, container: terminated, harness: absent, source: recovery}`; `edits_since_last_checkpoint_may_be_lost` true; 0 containers left |

Retry rule observed: only the latest attempt can be retried (`retry_exists` otherwise) — correct but the
code is unexplained in the API error; recorded as UX finding 8.
Setup and recovery instructions: README "Implementation sessions and draft pull requests".
