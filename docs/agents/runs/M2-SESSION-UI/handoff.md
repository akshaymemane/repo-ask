# Builder handoff — M2-SESSION-UI

## Identity

- Author/harness: native Codex experience builder `/root/session_ui`; never Claude.
- Branch/worktree: `task/m2-session-ui`, `../opendevin-m2-session-ui`.
- Assigned base:94ccc6e9cb53e859b662efba7f8a802bfe6591ea.
- Submitted UI commit:74cac0e4a8c6ed12bfe8878bc363150586eb9169.
- Review diff base:7fef9f1 (candidate dependencies described below); integrator must
  cherry-pick only the submitted UI commit, not unreviewed dependency ancestry.
- Task: `task.json`; requirements F05 SE05/06/07/08/10/11, F07 execution profiles,
  F11 UX04..11, coordinator-assigned explicit publication-policy editor.
- Status: ready for exact-commit UI review; integration acceptance remains dependent
  on committed SessionR1 messages/live-source projection.

## Outcome

Added the session list/detail routes and replayable polling, human-readable server
phase/provenance/bases/limits/usage/cost/outcome, retained diff/checkpoint details and
validation output, stop/containment and linked retry controls, typed question replies
and clarification delivery history. Unknown mutations preserve request identity;
rejected4xx permit corrections. Source-unavailable projections clear old diff,
questions, messages and logs, including stale successful sibling responses.

Execution settings provide actual profile CRUD, immutable versions, human image,
container/agent limits and concurrency controls, CLI-login/privacy/source-consent
guidance, and explicit asynchronous synthetic tests polled by immutable version.
Unknown writes require inspecting reloaded saved state. Tests never infer capability
success from CLI discovery or a queued job.

Plan editing preserves all other saved fields while selecting an execution profile
and manual_draft/on_success_draft policy in a new immutable version. Start shows the
actual saved readiness.execution projection and uses only authoritative ready state,
exact version/hash and a preserved launch key. Publication controls remain unavailable
until the separately owned F06 UI contract lands.

Only assigned web files, session UI tests/bridge and task-local docs were authored.
No Python production/API/schema/manifests/context.js/test DOM helper edits. Consumes
accepted `m2-sessions.md` session UI projection and `m2-execution-spike.md`; no silent
contract changes.

## Verification evidence

| Coverage | Actually run | Result |
| --- | --- | --- |
| Session replay/dedup, redaction/stale responses, message target and unknown keys, stop/retry/containment, profile CRUD/test polling/unknown writes, immutable plan fields/publication, terminal focus | `node --test tests/ui/session.test.mjs` |13/13 pass at submitted code. |
| Existing Ask/history/catalog/providers/context/legacy fallback plus new session faults | `node --test tests/ui/app.test.mjs tests/ui/ask.test.mjs tests/ui/ask-recovery.test.mjs tests/ui/catalog.test.mjs tests/ui/services.test.mjs tests/ui/context.test.mjs tests/ui/session.test.mjs` |73/73 pass. |
| Real FeatureAPI/ExecutionProfileService create, local-only test denial, saved queued check, immutable limits, deletion history | `node --test --test-name-pattern='real execution-profile' tests/ui/session-services.test.mjs` |1 pass; other session test intentionally excluded pending SessionR1 dependency. |
| Current prototype regression | `python3 -m unittest discover -s tests -p test_repoask.py` |4/4 pass. |
| JavaScript parse + whitespace | `node --check` app.js/ask.js/sessions.js and session-services.test.mjs; `git diff --check` |Pass. |
| Real-browser narrow layout, labels, keyboard focus and terminal composer retention | Own port8890 / isolated Chrome `session-ui-qa` |390px no overflow;17profile inputs labeled; keyboard2px focus; terminal textarea keeps focus/draft and becomes read-only. See browser-evidence.json. |
| Broad Python regression | `python3 -m unittest discover -s tests` |Interrupted after3+minute stall in Ask shutdown; not a pass. Bounded main stack and exact environment recorded in regression-diagnostic.md. Coordinator owns investigation; no baseline changes made. |

Actual service/browser fixtures use real SQLite, FeatureAPI, profile/plan/session
services with synthetic GitHub transport, in-memory runner and scripted adapter.
They are not real model inference, Docker isolation, containment timing or publication
acceptance. No model invocation, provider credentials or account writes occurred.

## Dependency candidates used only in this isolated worktree

Allowed source commits6789421/9de6eeb/73a682f/ea7de6d, b5ca0c4/551e988,37a4a4a and
coordinator ede9309 were cherry-picked solely to run the actual service bridge.
They are separate integration decisions; this handoff does not approve them.
Session37a has no GETmessages/source_available implementation. The full session
service acceptance test is present but not represented as run/passing against it.

## Risks and next action

- SessionR1 producer/coordinator must supply the committed messages/live-policy
  projection, then run `node --test tests/ui/session-services.test.mjs`. Existing
  pure fault tests cover that contract; they do not substitute actual service evidence.
- Coordinator owns static serving for `/sessions.js`, runtime/ExecutionProfileService
  main composition, accepted backend integration and full regression.
- Session list filters explicitly apply to loaded pages because server list supports
  pagination only; the UI never claims an instance-wide filtered search.
- Session metadata currently supplies repository IDs, not display names; exact IDs,
  write/read roles and base SHAs remain visible. No inferred repository authority.
- F06 publication actions are intentionally unavailable. The saved policy and its
  remote-write implications are visible and require manual immutable editing.
- Fresh Claude reviewer requested for this exact UI commit, with privacy/recovery,
  message acknowledgements, launch consent, stale/focus behavior and existing Ask
  flows in scope. Author cannot approve the work.
- Browser fixture server on own8890 is being stopped after evidence collection;
  no userApp8765/rootQA8882/8884 or persistent user data was accessed.
