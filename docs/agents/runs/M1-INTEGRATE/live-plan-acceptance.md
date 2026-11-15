# Local structured-plan acceptance

Date: 2026-11-15. Scope: synthetic committed fixture only; no account source or remote
write. This is one runtime acceptance case, not the PRD's 8/10 pilot benchmark.

The running application used local Ollama `llama3.2:latest` to answer a plan request for
the committed `publisher.py` fixture. The native structured-output response completed
with `done_reason=stop`, 332 input tokens and 360 output tokens. Its bounded shape had
one repository, one citation, one finding, one requirement, two steps and one proposed
validation. The server bound repository, snapshot, revision, path and line identities
from trusted retrieval rather than accepting model-supplied identities.

The resulting canonical plan was stored as an immutable version with the exact user
request and citation to `publisher.py`. Readiness was `needs_input` with
`execution_not_configured` and `implementation_not_permitted`, which is the expected
result for this local read-only fixture. No implementation or publication was started.

An earlier response attempted two roles for the single scoped repository and was
rejected as `Invalid repository role.` The compatible native JSON schema now caps the
repository array to the trusted scope size and gives explicit role semantics; the
successful rerun demonstrates that the server still rejects invalid authority while a
small local model can satisfy the corrected contract.

Private raw model text and reasoning were not retained in this evidence. The structural
diagnostic recorded only status, token counts, object keys and array counts.
