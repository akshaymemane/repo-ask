# CONTRACT-01 independent review — revision 1

Reviewer: Codex coordinator, independent of Claude architect author.
Exact reviewed commit: `91a80b6fdfa92aeccc6890a09e6eba459c83cdfe`. Packet: local runtime reviews/91a80b6fdfa92aeccc6890a09e6eba459c83cdfe.
Decision: changes requested before contract acceptance.

## Findings

1. **Major — Python compatibility:** docs/contracts/README.md section 2 raises the
   minimum Python to 3.11 although the existing README supports 3.10. Retain 3.10
   and avoid new syntax or stdlib APIs that require 3.11 without an approved migration.
2. **Major — uncertain external outcome:** section 4 maps an unexpected handler
   exception to failed even for an external-effect job. Such a failure can follow an
   issued remote mutation. For external jobs, unknown exceptions must enter
   needs_reconciliation; retryable errors must mean a known-safe-to-retry outcome.
   Explicitly prohibit reconciliation requeue beyond max_attempts.

## Coverage and evidence

Reviewed the exact contract packet, ADR, fixtures and current Python/web interfaces
from both producer and consumer perspectives. Confirmed preserved legacy routes,
truthful unavailable-feature UI, token fencing, revocation and no plaintext secret
fallback. Author's fixture and four-test results are recorded in its handoff; runtime
behavior is not implemented by this card. Re-review binds to the corrected commit.
