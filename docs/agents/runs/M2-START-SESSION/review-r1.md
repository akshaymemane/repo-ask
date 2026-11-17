- **P2 — Launch key survives a definite success.** [repoask/web/ask.js:223](../opendevin-review-start/repoask/web/ask.js:223) navigates without clearing the key from `launchKeys` or session storage. Returning to the conversation and starting the same version reuses the completed attempt’s key, reopening the previous session. Clear both stores after confirmed success; preserve them for unknown/network outcomes. Add coverage for key regeneration after success and definite rejection.

Profile selection uses active-version check semantics, excludes deleted profiles, and returns the profile ID accepted by preflight. Composition only fills an unset callback. Readiness rules, existing plans, and editor flow are unchanged; no `innerHTML` was added.

Validation: 12 thread tests passed. Fix-link integration was environment-blocked by temp-directory permissions. The permitted Python command failed during import (`ModuleNotFoundError: test_ask_services`), before running tests.

Verdict: request changes