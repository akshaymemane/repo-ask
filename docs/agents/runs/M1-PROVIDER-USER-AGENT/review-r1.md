# M1 provider User-Agent independent review — round 1

Verdict: **APPROVED** for source candidate
`54fd24f0345da91b464391c5be3192c72e5b4845`, integrated as
`475f4517e99b6eaaa08ad1d7205eae90a0897c67`.

Reviewer: fresh native Codex reviewer, 2026-11-16. This was a read-only product-code
review. No provider credentials, external provider calls, account mutations or live-app
operations were performed.

## Review

The product change is restricted to a constant and the standard-library opener's
default headers. `UrllibTransport` now supplies `User-Agent: OpenDevin-local` when a
request does not provide one. The value is static: it contains no endpoint, model,
credential, request body or repository/source data. The provider service continues to
own authorization headers and source-sharing policy.

The opener still has an empty `ProxyHandler`, `_NoRedirect`, the existing verified TLS
handler and the owned cancellation/deadline connection handlers. Adding a default
header changes none of those objects or their ordering. An explicit request-level
`User-Agent` remains authoritative under `urllib` semantics; a live local-peer check
confirmed it is preserved and the default is not duplicated.

The default applies consistently to every request using the production
`UrllibTransport`, including chat, embeddings, connection tests and model discovery.
Injected test transports remain unaffected.

## Evidence

- Exact diffs `54fd24f^..54fd24f` and `475f451^..475f451`: identical scoped change;
  `git diff --check` passed for both.
- `python -m unittest tests/test_provider_transport_cancel.py
  tests/test_providers_service.py`: **42/42 passed** in 4.573 seconds. This covers real
  local HTTP/TLS transport cancellation, deadlines, no redirects/credential forwarding,
  ignored environment proxies, concurrent isolation, bounded responses and provider
  request/error behavior.
- Focused local-peer probe with an explicit `User-Agent: Explicit-Agent`: explicit
  value preserved and `OpenDevin-local` absent, proving no override/duplication.

No blocking, major or minor finding remains for this change.
