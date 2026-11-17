Reviewed exact commit `c187e61` against `51f5839`. No files edited.

- **P2 — Terminal sessions can still appear to be stopping.** [sessions.js:37](../opendevin-review-session-ux/repoask/web/sessions.js:37): failed, interrupted, or blocked sessions with `stop_requested: true` receive a “stopping” badge because this condition precedes terminal-state handling. The claimed fix correctly removes the stale warning sentence, but misses these badges. Handle terminal states first and test each with `stop_requested: true`.

- **P2 — Partial connection failure hides Reconnect.** [sessions.js:953](../opendevin-review-session-ux/repoask/web/sessions.js:953): when the session request succeeds but events, messages, diff, or validations fail, the indicator becomes “Live” and Reconnect disappears—even while the status tells users to reconnect. Show a degraded/reconnecting state with an available retry control; test a failed child request followed by recovery.

- **P2 — Pending plan-title requests race navigation.** [sessions.js:519](../opendevin-review-session-ux/repoask/web/sessions.js:519): an outstanding request is cached as `null`. Navigate away and return before it resolves: the new view treats that plan as cached and finishes its repaint early; the original completion is fenced by its old epoch. The title remains “Saved plan” until another repaint. Cache and await in-flight promises separately from resolved titles, with retryable failures. Add a delayed-response navigation test.

The remaining brief items are implemented or explicitly deferred with reasons. Rendering uses text nodes; diff colouring cannot inject markup. Publication logic and key reuse remain intact. Updated behavioral tests retain meaningful assertions, though the new tests miss the cases above.

`node --test tests/ui/*.test.mjs`: **241 passed; four environment-blocked** by temporary-directory permissions, including both service-bridge tests. No assertion failures were observed.

Verdict: request changes