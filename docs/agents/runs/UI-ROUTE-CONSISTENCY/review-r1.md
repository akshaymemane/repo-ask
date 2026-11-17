# UI-ROUTE-CONSISTENCY review — round 1

Verdict: **CHANGES_REQUESTED**

- Reviewed commit: `3b8484f16fecdb01b9bf9a09a439514e13a450b3`
- Branch/worktree: `task/ui-route-consistency` / `opendevin-ui-route-consistency`
- Reviewer: independent Codex quality reviewer

## Findings

1. **Major — removing the Session workspace header leaves the desktop sticky-tab offset behind.**  
   `repoask/web/sessions.js:1125-1129`, `repoask/web/styles.css:1198-1201`  
   The removed header occupied the area that justified `.session-tabs { top: 57px; }`. At widths above 1000px the tabs now stick 57px below the top of their already-offset pane, leaving an empty strip and allowing pane content above the tab bar while scrolling. Change the desktop offset to `top: 0` (the <=1000px rule can continue to use the shell height), remove the obsolete header rules, and cover the resulting CSS contract.

2. **Major — repository secondary metadata falls into the label column in the new mobile card grid.**  
   `repoask/web/styles.css:906-915`; generated structure in `repoask/web/repositories.js:244-249`  
   The repository `th` has three grid items: its `::before` label, the repository button, and the `small` language/pushed metadata. With two columns and automatic placement, the `small` becomes row 2 / column 1, underneath “Repository,” rather than aligning beneath the repository name in column 2. Add an explicit column placement for the secondary metadata (for example `.repos-table tbody th small { grid-column: 2; }`) and a browser-oriented structural/style assertion or recorded responsive check.

3. **Major — the assigned Settings flattening remains unimplemented.**  
   `repoask/web/settings.js:125-134`, `repoask/web/styles.css:973-984`  
   The commit scopes GitHub callback copy correctly, but it does not address the audited nested-card inconsistency. The existing-App disclosure still wraps `.connected-panel`, and `.existing-app > .connected-panel` explicitly adds another bordered surface; `.setting-box` adds further nested cards. The review assignment explicitly includes Settings flattening, and this is the final route-consistency card. Flatten the presentation while preserving the existing fallback loaders and form logic, and add a focused class/structure assertion. If this is intentionally deferred, record a separate owned backlog card rather than claiming the full-app cleanup complete.

## Checks run

- `REPOASK_TEST_PYTHON=/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python node --test tests/ui/repositories.test.mjs tests/ui/settings.test.mjs tests/ui/session.test.mjs tests/ui/ask.test.mjs` — 57 passed, 0 failed.
- `/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python -m unittest tests.test_web_assets` — 2 passed.

The Ask title suppression, plan disclosure rename, repository filter predicates/empty-state link, callback-status scoping, legacy fallback preservation, and unchanged plan/session mutation logic otherwise match the submitted scope. The structural tests do not exercise CSS layout, so their passing result does not cover findings 1 and 2.
