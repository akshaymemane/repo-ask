No blocking findings in `git diff da08645 a5755d7`. Round-1 P2 is resolved.

- Success clears memory and sessionStorage before the epoch guard.
- Definite 4xx rejection clears both.
- Unknown/network outcomes retain the key for reconciliation.

All three new tests pass, proving key regeneration after success/409 and reuse after network failure. Adjacent regression tests: 32 passed; one blocked by sandbox `mkdtemp` permissions. The focused suite’s existing editor test hit the same restriction. Missing-session-ID and 5xx retention are verified by inspection, without dedicated new tests.

Verdict: approve exact commit a5755d7