# UI-INTERACTION-CONSISTENCY review — round 1

Verdict: **CHANGES_REQUESTED**

Reviewed commit: `3252ee0edccef0a1ca6bd7c93ba1c25a1343bc5b`  
Branch: `task/ui-interaction-consistency`  
Reviewer: independent Codex quality reviewer

## Findings

1. **Major — reopening the compact panel leaves the application permanently inert after close.**  
   `repoask/web/panel.js:47-48,81-90,101-107`  
   Every `openTab()` call invokes `setCompactModal(true)`. The first call records the outside nodes' original `inert=false` state and sets them inert. Opening or reopening another tab while the panel remains open records those already-inert nodes as `wasInert=true`, replacing the original snapshot. `close()` then restores `true`. This is a normal supported path—the existing panel test opens multiple tabs—and leaves background controls inaccessible. Preserve the first pre-modal snapshot until close, or restore before recomputing. Add a compact regression that calls `openTab()` twice, closes, and asserts outside nodes are no longer inert.

2. **Major — the focus trap is not in document order and does not reliably contain mixed controls.**  
   `repoask/web/panel.js:51-56,119-129`  
   `focusable()` concatenates all buttons, then anchors, inputs, selects and textareas. A panel body containing an anchor before a button has browser tab order `… anchor, button`, but the trap list orders `… button, anchor`. Tabbing from the actual last control is therefore not intercepted, while tabbing from the anchor wraps early and skips the button. Query all supported focusable controls in a single selector/document-order traversal (also excluding hidden/inert controls), and test a mixed-control body in both Tab directions.

3. **Minor — modal semantics can diverge from the responsive layout after a viewport change.**  
   `repoask/web/panel.js:89,119`; `repoask/web/styles.css:718-726`  
   Modal role/inert state is set only when `openTab()` runs, while focus trapping consults the live media query on every keydown. If the viewport crosses 760px while open, CSS and focus behavior change but role/inert state does not. Synchronize the modal state on media-query changes (and remove the listener on disposal if lifecycle support is added), or use a stable open-time mode consistently. Add a focused resize/media-query regression.

## Checks run

`REPOASK_TEST_PYTHON=/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python node --test tests/ui/shell.test.mjs tests/ui/mentions.test.mjs tests/ui/picker.test.mjs`

Result: 26 passed, 0 failed.

Tab ARIA relationships, mention combobox state, picker explicit-confirm behavior, and scoped compact touch targets otherwise match the requested behavior. The author should address the panel findings and resubmit an exact commit for round 2.
