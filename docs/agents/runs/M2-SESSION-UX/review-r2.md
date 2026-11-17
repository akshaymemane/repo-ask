All three round-1 findings are resolved:

- **Terminal badge:** `repoask/web/sessions.js:38` checks terminal states before `stop_requested`. Passing test: `tests/ui/session-ux.test.mjs:324`, covering all five terminal states, a running control and the rendered header.
- **Partial refresh failure:** `repoask/web/sessions.js:962` keeps Reconnect visible when any child read fails; Live returns only after all four refresh reads succeed. Passing test: `tests/ui/session-ux.test.mjs:335`.
- **Plan-title navigation race:** `repoask/web/sessions.js:522–530` reuses pending promises and removes settled entries in `finally`. Passing tests: `tests/ui/session-ux.test.mjs:347` (navigation and one shared read) and `:364` (failure retried on next load).

No new findings. Inspection confirms no recursive retry or repaint loop: failed title reads retry only on a subsequent load; refresh retains its existing single-timer polling.

`node --test tests/ui/*.test.mjs`: **245 passed; 4 environment-blocked failures** from denied temporary-directory creation. All four new regression tests passed. No files edited.

Verdict: approve exact commit fc6e5f5