# UI-MODERNIZATION review — round 3

Verdict: **CHANGES_REQUESTED**

- Reviewed commit: `2ac708958f56c06b34a67234b68e8017853ea2fe`
- Reviewed commits: `10ef65c`, `c599419`, `2ac7089`; diff `968f8f5..2ac7089`.
- Branch/worktree: `task/ui-modernization` / `../opendevin-ui-modernization`
- Reviewer: independent Codex quality reviewer; reviewed Claude's follow-up changes.

## Findings

1. **Major — expanded switch targets overlap adjacent compact repository permission rows.**
   `repoask/web/styles.css:1531`, with compact row layout at `styles.css:920` and switch size at `styles.css:752`.
   The new absolutely positioned `::before` extends each 34×20 switch to 44×44 without reserving any layout space. At ≤760px the repository table becomes stacked cells with only 6px vertical padding: a switch row reserves approximately 32px, while its hit region extends 12px above and below the track. Consecutive “Used in Ask” and “Changes allowed” cells contain switches in the same grid column (`repoask/web/repositories.js:253-269`), so their expanded targets can overlap; the later painted switch can intercept a tap intended for the preceding row. This is especially inappropriate for a write-permission control. Source-derived geometry, not an independently rendered hit test. **Fix:** reserve a real 44px layout box for each switch (render the 34×20 track inside it), or give every switch-bearing row/wrapper sufficient height and spacing to contain the entire target. Verify `elementFromPoint` and actual clicks across both adjacent targets at 390px, including row boundaries and the desktop table.

2. **Minor — light surfaces still inherit disproportionately dark shadows.**
   `repoask/web/styles.css:1444`, `styles.css:1447`, `styles.css:1450`, `styles.css:1411`; Sessions date popover at `styles.css:1075`.
   `.composer, .composer-v2, .session-composer` and their `:focus-within` variants retain `0 16px 40px #0006`; `.side-panel` retains `-18px 0 54px #0005`; `.btn:hover:not(:disabled), .button:hover:not(:disabled), .icon-button:hover:not(:disabled)` retain `0 4px 12px #0003`; `.sessions-panel .session-filter.is-date` retains `0 12px 30px #05060866`. These bypass the existing light-specific shadow tokens, which use much lower opacity, leaving Ask/Sessions composers, source/settings side panels, shared route buttons and the date disclosure with dark-mode shadow strength. The card group at `styles.css:1456-1458` also hard-codes `#0001`, though its 7% opacity is less concerning. **Fix:** use semantic shadow tokens (including directional composer/panel variants if needed) and inspect all four requested routes in light mode. These declarations predate the reviewed diff; record as inherited polish debt, not a new Claude regression. Visual severity is source-review only.

3. **Minor — inherited light-mode text exceptions remain outside the otherwise sound palette.**
   `repoask/web/styles.css:647` and `styles.css:1341-1343`.
   `.session-facts dt` uses undefined `--text-muted` with fallback `#a9b1bf`, approximately 2.16:1 against white. Session facts therefore bypass `--muted` in light mode. The small `.brand-mark, .intro-icon` accent text on `--accent-tint` computes to approximately 4.45:1 (`#087d66` on `#e2f4ef`), just below 4.5:1 if treated as normal text; the brand/logo exemption may apply, but informational text should not reuse this pair without adjustment. By comparison, `--muted` is 5.56:1 on white and 4.91:1 on `--sunken`, and accent is 5.08:1 on white. **Fix:** change facts labels to `var(--muted)` and slightly darken accent text on tint where normal-text contrast is required. Both exceptions are inherited, not introduced by these three commits.

## Checks run

- Read `AGENTS.md`, workflow, quality-reviewer persona, Master PRD, F11 workspace spec, task card, design contract, prior reviews and both Claude handoff sections. Verified HEAD is the submitted exact commit and inspected the requested diff.
- `REPOASK_TEST_PYTHON=./.venv/bin/python node --test tests/ui/*.test.mjs` — **284 passed, 2 failed, 286 total**; repeated with the same result. Failures are the two real-service tests at `tests/ui/session-services.test.mjs:22` and `:55`. Both fail during bridge bootstrap with `synthetic check failed`, profile error code `execution_test_failed`, before the intended service assertions. No evidence ties these failures to the CSS changes; the requested suite is nevertheless not green here.
- `./.venv/bin/python -m unittest tests.test_web_assets` — **2/2 passed**.
- `git diff --check 968f8f5..2ac7089` — **passed**.
- Calculated light palette contrast from source values using WCAG relative luminance.
- Rendering unavailable: the requested app command failed with “Could not start OpenDevin on port 8793. Operation not permitted”. Browser MCP access required approval unavailable under this session's policy. Existing Playwright could not find its default browser; launching installed Chrome with its sandbox enabled also failed. No dependencies were installed and no permission bypass was attempted. All new layout/light-mode conclusions above are source review; prior author screenshots are not independent runtime verification.

## Requested focus checks

- **Offsets:** the ≤760px `118px` overrides occur after the ≤1000px rules and correctly represent the 62px rail plus 56px route bar. At 761–1000px the inherited 56px offsets remain appropriate for the desktop shell. No additional offset regression identified by source review.
- **Session clipping:** no concrete lost-content case identified in the current DOM. Diff lines retain their own `overflow: auto`; check command/output inherit scrolling and wrapping from `.sessions-panel pre`; publication paths, notices and PR links inherit `overflow-wrap: anywhere`, and form inputs are width-constrained. `overflow: clip` removes the pane's horizontal fallback, so wide-content reachability and sticky-tab hit testing still require an independent rendered check at 390/760/900/1000px. Do not equate the CSS-string assertions with that check.
- **Route cascade:** repository filter controls are scoped to `.repo-filters`; chip wrapping is compact-only; settings fields/nav changes are scoped; the date popover retains its relative `<details>` anchor and is right-aligned by the later equally specific rule. No additional source-level specificity/order regression identified. The 44px compact inputs/summaries/nav rules do not repair the switch row layout issue above.

The author owns the switch correction and rendered regression evidence; the coordinator owns rerunning the two failed service checks in a working execution environment and scheduling exact-commit re-review. Only this review file was written; no source/tests were edited and no commit was created.
