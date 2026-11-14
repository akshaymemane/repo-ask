# Builder handoff — M1-ASK-UI

## Identity

- Author/harness: Codex, experience engineer; no delegated workers.
- Branch: task/m1-ask-ui; worktree: /Users/apple/workspace/vibe-coding/opendevin-m1-ask-ui.
- Base: 7fe71b85e57e4feea4beab7fbca267611fab950d. Submitted SHA: unavailable; git add failed because the shared worktree Git directory is outside the writable sandbox. No commit created.
- Task: task.json; F04 ASK-01..09, preserved multi-repository content (ASK-10); F11 UX-03,04,05,07,08,09,10,11.
- Status: candidate for independent Claude review, not approved/integrated. Index/Ask candidate approvals remain completion gates.

## Outcome and scope

Added repoask/web/ask.js; changed app.js and styles.css; added tests/ui/ask.test.mjs and ask-service-bridge.py plus these task artifacts. No index.html change was needed. context.js, its tests, shared Python, __main__, ASSETS and all Settings/catalog behavior remain outside edits.

Consumes docs/contracts/m1-ask-plans.md including additive messages and reserved launch handoff, real AskAPI and ContextAPI. Persistent UI probes /api/conversations; API absence/unavailability leaves the original legacy Ask DOM, events, demo and citations intact. Root must register ask.js before deploying the importing app.js.

Saved conversation URLs use #/ask/{id}; plans use #/plans/{id}/{version_id}. Lists paginate, conversations reload, plans link to their parent/latest version. Repository scope supports catalog browsing, manual IDs, candidate evidence, real coverage/base details and optimistic revision saves. Source buttons request /api/context/source with exact repository/snapshot/path/range; responses are fenced independently from navigation. All model/source/export text uses textContent; source-generated external links are never created.

Answer and plan requests persist client IDs across uncertain retries (sessionStorage where available), poll actual run IDs without repeatedly replacing focused controls, support cancel/retry, and preserve one original user message. Polling errors offer explicit reload/reconnect. Model role/destination/local-only policy is read from Settings before submission; unavailable per-answer attribution and usage/cost stay unknown.

Plan goal, request, requirements, steps, paths, validation, risks, assumptions and blocking questions are human-readable editable controls. Steps/validation/questions support add/remove. Existing structured citations/findings/context/scope are retained. Save uses the exact optimistic parent and immutable server response. Old versions stay navigable. Export is displayed as copyable text only after exact version/hash verification. Pinned bases can be explicitly retained in a new version; regeneration is through a new conversation plan request. Unsaved edits warn on navigation/unload; failed saves preserve the editor; fields freeze during plan saves; late source/plan/route reads are fenced.

Start is disabled unless server readiness is exactly ready, with associated blocking reasons and visible version/hash, repository bases, execution profile/publication. Limits are truthfully unavailable in M1. Ready launch rechecks the server and POSTs /api/sessions with only plan_version_id/content_hash/idempotency_key; uncertain retry retains key. Success uses only server session_id for #/sessions/{id}. No M1 runtime or real session claim; root adds M2 routing/preflight later.

## Verification evidence

| Requirement | Actual command/scenario | Result |
| --- | --- | --- |
| Existing demo/catalog/context | node --test tests/ui/ | Existing 38 preserved; 43/43 passed (38 existing plus 5 new) |
| Persistence/versions/sources/export | Real app.js + AskAPI/ContextAPI + SQLite bridge, new Python process for each request | Version 2 persists; old version unchanged; stale parent 409; exact source; export hash matches; cancel/retry keeps one user message |
| Safety/recovery | Additional Node behavior tests | Same client ID on timeout retry; navigation refusal preserves prompt; late source cannot replace newer source; markup stays literal |
| Launch contract | Synthetic ready response only in test, never production data | Exact reserved body and same idempotency key on uncertain retry; server session ID navigation |
| Regression | python3 -m unittest discover -s tests | 177 run; 7 socket-bind errors, 19 skipped without deps |
| Regression with installed deps | ../repo-ask/.venv/bin/python -m unittest discover -s tests | 177 run; 170 pass; same 7 PermissionError socket-bind errors; no skips |
| Actual browser | Attempted isolated headless Chrome smoke via temporary local bridge | Blocked before Chrome launch: sandbox denies ThreadingHTTPServer bind. No screenshot, layout, tab-order or screen-reader claim |
| Patch hygiene | git diff --check | Passed |

Bridge uses bounded synthetic local source only in tests, actual persistent service methods, no model, no downloads, no account/provider writes. The ready-session test is explicitly a transport-contract test; actual local snapshots remain nonlaunchable.

## Candidate corrections and integration gates

1. Root owns asset registration/live ApplicationServices composition. This worktree's ApplicationServices still composes GitHub/providers only; UI bridge explicitly composes the submitted Index/Ask services. Root needs to register ask.js and real worker handlers before live HTTP use. This task does not alter shared Python.
2. Candidate ConversationService.get_run returns no generation metadata, and messages expose usage/profile_version_id but omit model/destination. The worker stores actual model/destination privately. Per-answer provenance cannot be shown accurately from these public reads; UI displays unknown and shows current configured role destination separately. Backend owner should consider an additive safe public generation projection.
3. M1 execution_not_configured and local implementation_not_permitted correctly block launch. Root owns M2 session route, execution limits/preflight visibility and post-launch UI. No session was created here.
4. Exact-commit independent Claude review, socket-enabled HTTP/browser/narrow/keyboard checks and approval/corrections for backend/index candidates remain required. DOM tests establish control behavior, not actual layout or assistive technology acceptance.

Commit blocker: git add could not create /Users/apple/workspace/vibe-coding/repo-ask/.git/worktrees/opendevin-m1-ask-ui/index.lock (Operation not permitted). Coordinator must stage/commit these scoped files from an authorized environment, then bind independent review to that exact commit. No permission bypass attempted.

No owned background processes remain. No push, publication or merge performed.

## Self-evaluation (ecc:agent-self-evaluation)

Accuracy 4/5: real candidate APIs and immutable hashes checked; deployed HTTP composition remains root-owned.
Completeness 3/5: requested UI paths implemented, but real-browser accessibility/layout and live HTTP are blocked by socket restrictions and registration ownership.
Clarity 4/5: readable fields and explicit server blockers; repository IDs remain visible as a precise manual fallback.
Actionability 4/5: scoped candidate and reproducible checks; root still needs registration, independent review and live composition.
Conciseness 4/5: module is isolated; some compact handlers could be split for easier maintenance.
Overall 3.8/5. Highest-impact follow-up: root runs isolated browser acceptance after registration/composition; backend exposes safe per-answer provenance. This assessment distinguishes implemented behavior from remaining integration evidence.
