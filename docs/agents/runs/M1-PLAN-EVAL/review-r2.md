# M1 fixes independent review — round 2

Verdict: **APPROVED** for code commits `ebc0a0b` and `2011387`.

The Groq 413 mapping is narrowly gated by server error text; unrelated 413 responses
remain `provider_rejected`. Repair guidance is derived only from bounded,
server-authored validation messages and does not echo rejected model content. Trailing
directory slashes normalize while absolute, dot, parent, empty-segment, backslash and
colon paths remain rejected. Thread errors are plain user-facing sentences.

Rate-limit retries preserve the same durable run, are bounded to four with a 30-second
default delay, and are excluded from quality scoring while recorded in evidence. The
8192 context / 4096 output CLI defaults match the evaluated small-quota setup without
changing product profile defaults.

Checks: focused Python `34/34` passed; thread UI `10/10` passed. No key, live model,
GitHub account or app process was accessed. Docs/evidence commits `715bd5e` and
`369bf7a` were accepted as supplied and were not code-reviewed here.
