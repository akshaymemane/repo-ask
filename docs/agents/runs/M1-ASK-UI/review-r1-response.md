# M1-ASK-UI — R1 response

Reviewed commit: c2482553b7ff85b767ac7e3a2980107d48eaac28.
Status: correction candidate; independent Claude re-review required. No self-approval.

| Finding | Correction | Added evidence |
| --- | --- | --- |
| Major M1 | Status-aware HTTP errors; 4xx drops pending identity and preserves text; network/5xx retains identity; explicit pending-discard preserves draft and disclaims server cancellation | 400/401/403/404/409/422, changed-content and different-conversation recovery; network/503 identity reuse across reload; explicit discard |
| Major M2 | Only 404 collection absence falls back; initial history/saved-record failures retain panel handle and guard, show recovery; onMount hides legacy before delayed saved GET | Initial history 503, saved GET network rejection, saved conversation/plan 404/500, malformed history, delayed app import and error recovery |
| Medium stale actions | Clear body/source at navigation start, fence request epochs, reject detached controls, replace failures with error state | Delayed and rejected navigation from Ask and ready plan; old Ask/scope/save/start clicks cause no writes; stale late completion ignored |
| Duplicate pagination | Consume previous cursor control and deduplicate conversation/repository identities | Repeated old cursor clicks do not duplicate page links/rows/New action |
| Search false dirty/discard | Search is ephemeral; confirmed discard deletes cached prompt and scope drafts | Search causes zero prompts; confirmed discard returns empty prompt and server scope |
| Missing scoped repository | Render explicit unavailable label instead of omission | Failed context read remains visible with retained scope |
| Use candidate | Stage union of existing confirmed pins, unsaved scope edits and candidate; explicit Save required | Request pins include draft; no implicit PATCH; union survives explicit scope save |
| Focus | Restore connected matching action or heading after rebuild; preserve intentional scope/source focus | Scope-save and cancel/retry keyboard focus checks; detached controls remain inert |
| Duplicate export | Replace a single export section | Repeated export renders one Markdown display |
| Coordinator browser NodeList | Spread NodeLists before Array helpers | Iterable read-only NodeList stand-in has no map/find/filter; history/catalog/focus paths pass |
| Coordinator main/H1 | Visible labelled main, focusable H1; route focus goes to persistent H1 | Persistent route returns focus to visible H1, not hidden legacy title |
| Public provenance | Read actual flat stored message fields and exact version.generation; unknown if absent; label estimated cost accurately | Stored model/destination/cost labels plus missing attribution assertions; separate configuration labels |

Validation: `node --test tests/ui/` = 56 passed, 0 failed (all original 43 preserved); `node --check repoask/web/ask.js` and `git diff --check` pass. Original real-service restart bridge remains in the full passing suite. Actual Chrome against the root synthetic server 8880 remains root-owned. No Python changes or new Python-suite claim.

Commit attempt: `git add` of only ask.js, app.js, ask-recovery.test.mjs, status.md and handoff.md failed creating `/Users/apple/workspace/vibe-coding/repo-ask/.git/worktrees/opendevin-m1-ask-ui/index.lock`: Operation not permitted. No new commit was created and no permission bypass attempted. Root must commit these files plus this response, then request exact-commit re-review. Read-only review input and coordinator browser note remain untouched.

No agents spawned, packages installed, account operations, context.js/shared Python edits, or owned background processes.
