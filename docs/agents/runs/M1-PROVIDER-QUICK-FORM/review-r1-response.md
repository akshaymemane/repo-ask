# M1-PROVIDER-QUICK-FORM review round 1 response

The major destination-consent finding in `review-r1.md` is resolved in the next
candidate.

- The form records the exact trimmed endpoint visible when source sharing is opted in.
- Any subsequent endpoint edit clears the checkbox unless the endpoint remains exact.
- Hiding the remote-only control (for a loopback destination) also clears consent, so
  returning to a remote destination requires a fresh visible opt-in.
- Structured-output defaults and the unchanged-endpoint explicit opt-in are preserved.

Regression evidence:

- Remote provider A → remote provider B clears consent and submits
  `allow_external_source: false`.
- Remote → loopback → remote clears the hidden consent and requires a new opt-in.
- Focused settings-model suite: 11/11 passed.
- Full UI suite with the integrated Python bridge: 182/182 passed.
- `git diff --check`: passed.

This is author evidence, not approval. The corrected exact commit requires independent
re-review.
