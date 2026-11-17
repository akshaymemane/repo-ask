# Builder handoff — M1-TRANSPORT-CANCEL

## Identity

- Author/harness: Codex provider integration engineer; native Codex subagent `/root/transport_cancel`.
- Branch: `task/m1-transport-cancel`.
- Worktree: `../opendevin-m1-transport-cancel`.
- Base SHA: `797009ba899740e477db3b88eacdb90fb80cb3e7`.
- Submitted source/test commit: `43e0fdf0e0cee55127478d21b17c1a1a861032e0`; the following task-evidence commit is identified by exact SHA in the coordinator handoff message.
- Task card: `docs/agents/runs/M1-TRANSPORT-CANCEL/task.json`.
- Requirements: F07 AI-04; F12 OP-08 and OP-12 (established provider socket cancellation and deadlines supporting bounded shutdown).
- Status: review; implementation and regression checks complete; independent review pending.

## Outcome

`UrllibTransport.send()` now actively interrupts established socket I/O when its
cancellation event is set or its absolute deadline expires. Previously, nonstreaming
response-header and blocked response-body waits could occupy the caller for the
whole provider timeout (up to 600 seconds). A request-local non-daemon watcher owns a
duplicate of the connected socket, uses shutdown to release the sending thread, and
is joined before send returns. Every request and duplicate socket is closed on success
and failure. HTTP(S) requests remain synchronous in the caller; no detached request
worker is introduced. TLS handshake and request writes share the same interruption.

The existing urllib opener retains `ProxyHandler({})`, no redirect following and
verified TLS by default. Custom SSLContext injection still works, including hostname
verification. Response byte caps and fixed content-free transport failures are preserved;
shutdown-induced disconnects are classified as cancelled/timeout. No service interface,
manifest, migration, provider fallback or source-budget change.

Exclusive changed paths:

- `repoask/providers/transport.py`.
- `tests/test_provider_transport_cancel.py` (real local TCP/TLS fixtures and 17 cases).
- This task's status, task card, handoff, self-evaluation and baseline reproduction script.

Contracts consumed: `docs/contracts/m1-services.md` (`opendevin.m1/1`), F07 and F12.
No public contract deviations.

## Verification evidence

Use `PY=./.venv/bin/python` from this worktree.
Tests use local synthetic peers, temporary test certificates and fixture providers;
no model inference, GitHub calls, Docker, external service or package installation.

| Requirement | Command/scenario actually run | Result / evidence |
| --- | --- | --- |
| F07 AI-04 / regression validity | `PYTHONPATH=.:tests "$PY" docs/agents/runs/M1-TRANSPORT-CANCEL/reproduce-baseline.py` | Both new HTTP cancellation cases fail against unchanged base 797009b on `cancel blocked on provider response`; script succeeds only for these two expected failures. Worktree source is not changed. |
| F07 AI-04 / established connection stop | `"$PY" -W error::ResourceWarning -m unittest discover -s tests -p 'test_provider*.py' -v` | 41 passed: 17 new TCP/TLS cases plus 24 existing provider cases; no skips. With a 30-second request timeout, cancellation must return within 1.5 seconds and peer must see EOF. Header/body/handshake waits covered. |
| F12 OP-08 / absolute deadline | New held and trickled header/body scenarios | 0.35-second overall request deadline yields TransportTimeout within 1.5 seconds, including peers sending bytes frequently enough to defeat per-read timeouts. |
| F12 OP-12 / cleanup | Every new test checks thread enumeration and process socket descriptor count; blocked peers observe EOF | No transport watcher or owned socket remains after return; test caller and peer threads are joined. macOS DNS resolver warmed before descriptor baseline. |
| F07 AI-06/AI-07/AI-12 preservation | Real proxy trap; 307 to a second local peer; disconnect/TLS failures; response size boundary | Proxy and redirect destinations receive zero connections; failed requests have one connection/request, fixed redacted exception text and no exception cause/context. Default TLS rejects self-signed cert; custom trusted context succeeds only with correct hostname. |
| Current regressions | `"$PY" -m unittest discover -s tests` | 312 tests in 281.457 seconds; OK, five expected Docker-gated skips. All 17 new transport tests ran. |
| Scope and whitespace | `git diff --check` | Passed. |

TLS tests use the existing `openssl` executable to create a temporary localhost
certificate/key; all TLS cases ran here. On systems without `openssl req -addext`,
those five tests explicitly skip. Production transport has no openssl dependency.

## Risks and next action

- **Remaining precise limit:** system DNS resolution (`getaddrinfo`) is synchronous
  and cannot be interrupted by this mechanism. The stdlib TCP connect phase can
  remain blocked until its configured socket timeout, potentially once per resolved
  address. Cancellation/deadline during these phases is observed as soon as connect
  returns, before TLS/request/source writes. This patch does **not** claim a two-second
  bound for DNS or TCP connection establishment. Once connected, TLS handshake,
  request writes, response headers and response body are actively interruptible.
- No migrations/configuration needed. All owned regression, peer, caller, watcher and
  temporary certificate-generation processes/threads have completed; none remain.
- Next: coordinator prepares exact-commit packet for independent Claude boundary
  review, then applies reviewed commit(s) and reruns affected combined checks.
- Review focus: socket ownership across urllib/SSL wrapping, concurrency isolation,
  classification/redaction, cleanup on cancellation/deadline and honest DNS/connect limit.
- Not yet approved, integrated or published; coordinator owns those states.
