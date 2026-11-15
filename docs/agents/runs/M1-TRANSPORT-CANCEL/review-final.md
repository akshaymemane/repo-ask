I approve `d2a4802451bf448721853ab098b453233311b164` (base `797009b`, task M1-TRANSPORT-CANCEL). I found no confirmed major issues.

I reviewed the packet copy of the commit (`diff.patch`, the snapshot files, `manifest.json`), the task card, and the stdlib `urllib`/`http.client` 3.12 code paths. I had no shell, so I did not recompute the SHA or file hashes, and I ran no tests myself. The test results below are the author's; your root rerun is still pending.

## Boundaries confirmed

| Boundary | How it holds |
|---|---|
| **Socket ownership** | The connected socket is duplicated as soon as connect returns (`transport.py:105-111`), before any TLS handshake or request write. The background thread that watches for cancel/deadline only calls `shutdown` on that duplicate, which stops the connection itself. The duplicate is closed only after that thread has exited (`close()` 125-130), so a recycled file descriptor can never be shut by mistake. |
| **TLS** | `wrap_socket` takes over the original descriptor, but the duplicate still refers to the same connection, so a stuck handshake is interrupted. If the handshake fails, the SSL socket is closed and the duplicate is closed by `close()`. |
| **Header / body / request write** | A blocked header read ends with `RemoteDisconnected`, a blocked write with a broken-pipe error, a body read with EOF. Each is first marked unavailable, then reclassified as cancelled or timeout from the recorded outcome (line 243). `attach` raising `TransportCancelled` is not an `OSError`, so urllib closes the connection and re-raises it unchanged. |
| **Watcher join and cleanup** | `close()` runs in an outer `finally` on every path, including when cancel is already set at start (the thread is never started then). The watcher checks every 50 ms and `shutdown` doesn't block, so the join can't hang. Only one socket is opened per request: urllib sends `Connection: close` and drops its handle after `getresponse`. |
| **TLS defaults / custom context** | Default verification uses `ssl.create_default_context()`. The handler passes no `check_hostname`, which matches 3.12's `https_open`. On 3.10/3.11 that leaves the injected context's settings as they are. |
| **No proxy** | `ProxyHandler({})` is kept. Because the custom handlers are subclasses of the standard ones, `build_opener` drops the defaults. The new scheme check (lines 218-219) also blocks the file/ftp/data handlers before any connection is made. |
| **No redirect** | `_NoRedirect` returns `None` before the body is read or a new request is built, so a 3xx comes back as `HTTPError`, whose own message (which includes the URL) is never surfaced. |
| **No retry** | Neither urllib nor http.client re-sends a request. `create_connection` trying each resolved address is only connect fallback. The peer saw exactly 1 connection and 1 request. |
| **Overall deadline and byte cap** | The socket timeout is set to the remaining time at attach and again before each read. The watcher enforces the absolute deadline, and the final `control.check()` catches anything after the last read. Reading with `read1` plus the `limit+1` boundary is unchanged. |
| **Clean errors** | Every error raised is the fixed text `'transport failure'`, raised outside any `except` block so nothing is chained. An invalid URL error that would include the URL (e.g. an API key in `?key=`) is caught as `ValueError`. |
| **Request isolation** | Each request gets its own control object attached to its own urllib `Request`, and the handlers keep no state. The concurrent test confirms one request's cancel doesn't affect another. |
| **DNS/connect documentation** | Accurate: DNS can't be interrupted, connect uses the socket timeout and may wait that long once per resolved address, and cancel is checked after connect returns and before anything is sent. |

## Minor items (not blocking)

1. **Release gate for root shutdown (8d), `transport.py:222`.** `open(..., timeout=request.timeout)` gives each connect attempt the full timeout, not the time left. So DNS plus N × timeout can exceed the overall deadline: up to 600 s per address against an address that never answers. This matches the documented limit. Before claiming bounded shutdown, confirm root shutdown does not assume a 2-second bound while a provider call is still connecting. Passing the remaining time to connect would be a cheap improvement.
2. **Line 243.** A real failure, or `ResponseTooLarge`, that happens right at the deadline or at cancel time is reported as Timeout/Cancelled. No data leaks; only the error type changes.
3. **Line 86 and uncaught types.** If `Thread.start()` fails, a raw `RuntimeError` reaches the caller. It contains no request data.
4. **Line 110.** A second `attach` would overwrite and leak the first duplicate socket. urllib can't do this today; worth guarding for safety.
5. **Test gap.** The handoff says request writes can be interrupted, but no test blocks on a large request body against a peer that stops reading. The mechanism is the same as the tested paths, but that claim is untested.

## Checks

- **Author reported:** 17 new real TCP/TLS tests plus 24 existing provider tests passed. Full suite: 312 tests OK with 5 Docker skips. Both new cancel tests fail on base `797009b`.
- **Not run by me:** all tests, and verifying the SHA and file hashes. Your root network rerun and the integration reruns are still pending, and your team owns them.
