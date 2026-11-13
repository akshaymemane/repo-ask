# M0-INTEGRATE handoff

Author: Codex coordinator. Source: repoask/__main__.py and tests/test_http_foundation.py.
Reviewed platform/UI commits are integrated before this slice. Added two read-only routes,
opt-in --data-dir, fail-closed startup and resource lifecycle. SIGTERM maps to graceful stop;
HTTP server closes/joins request threads before databases close.

Actual checks: python3 -m unittest discover -s tests passed40 tests in combined checkout
(33 platform/regression,3 real HTTP,4 separately scoped secure-backend bootstrap).
Node UI suite passed15 tests. HTTP tests start real loopback servers, verify legacy Ask,
Host/Origin boundaries and status query rejection, and persist a job across server restart.
Real Chrome verified the independently reviewed UI against a legacy server; integrated
health/settings Chrome check follows this wiring. No GitHub/provider/execution claim yet.

No external writes or background production handlers introduced. Independent review required.

## Revision after independent review

Added actual CLI subprocess checks: real module startup in an empty temporary directory,
HTTPhealth, SIGTERM exit0/no traceback/no demo files; invalid regular-file/unknown-user data
paths exitnonzero with sanitized fixed error and no fallback. Second shutdown signals are
ignored while request handlers drain. Status failures503 are now documented in the contract.
Exact root submission/packet IDs are recorded in board.json after commits; task.json is the
original assignment snapshot. Secure-vault bootstrap has its own M1-SECURE-STORE handoff.
