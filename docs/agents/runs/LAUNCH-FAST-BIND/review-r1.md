# LAUNCH-FAST-BIND independent review R1

## Verdict

Approve exact commit on source review; no actionable correctness or security findings. Real socket/CLI acceptance remains unverified in this sandbox and must be rerun by the integrator or CI before claiming the macOS startup failure resolved.

## Reviewed commit

- Branch: `task/fast-bind`; author: Claude; independent reviewer: Codex.
- HEAD: `21eea772494993a86d58eb8129b7383b4fc209cf`.
- Base: `79b3217`; scope: `git diff 79b3217..HEAD`.
- Changed files: `repoask/__main__.py`, `tests/test_http_foundation.py`, `.github/workflows/ci.yml`.
- Assignment/context: user review request, including supplied CI run 44230622917 diagnosis. That run and stack dump were not independently retrieved. No task-local card/handoff was present in this run directory; the user supplied the review scope. Read `AGENTS.md`, workflow, quality-reviewer persona, master PRD, F12 specification and handoff template. Relevant requirement: F12 OP-07 and loopback deployment boundary.

## Findings

None requiring changes.

- `repoask/__main__.py:56-58`: CPython HTTPServer adds only `server_name` and `server_port` after delegating bind to TCPServer. The override retains both, intentionally using the numeric bound host for the name. TCPServer still applies socket options, binds, and refreshes `server_address` with `getsockname()`, so an ephemeral port is captured correctly. Activation/listen, constructor failure cleanup, address reuse, threading and daemon behavior remain inherited.
- `repoask/__main__.py:73-75`, `:179-181` and the feature dispatcher: Host validation uses `server_port` with explicit `127.0.0.1`/`localhost` values; Origin validation compares against the validated Host. No application consumer relies on an FQDN-valued `server_name`. Main still binds literal `127.0.0.1`. The class name itself does not enforce loopback, but its only production construction supplies loopback; this change introduces no exposure.
- Python 3.10–3.13: the HTTPServer bind contract is identical in the inspected upstream sources. Delegation preserves version-specific TCPServer socket-option behavior rather than copying it. No unsupported syntax or API was introduced. This is source compatibility evidence, not execution on four interpreters. Existing CI covers 3.10, 3.12 and 3.13; 3.11 was source-reviewed only.
- `.github/workflows/ci.yml:5`: adding quoted `ci/**` expands push coverage for CI branches. The workflow retains `contents: read`, hosted runners, no secret references, no environments, and no publication/deployment steps. It installs and tests checked-out code as the existing triggers already do; the added trigger grants no additional token permissions or secrets. Additional CI consumption is expected.
- `tests/test_http_foundation.py:107-117`: the regression rejects any `socket.getfqdn` call during construction and checks both HTTP attributes, including the actual assigned port, then closes the server. Existing foundation fixtures still use ThreadingHTTPServer; the dedicated regression and actual-CLI tests exercise the new production class. No finding is raised for retaining those fixtures.

CPython comparison sources: [3.10 HTTPServer](https://raw.githubusercontent.com/python/cpython/3.10/Lib/http/server.py), [3.11 HTTPServer](https://raw.githubusercontent.com/python/cpython/3.11/Lib/http/server.py), [3.12 HTTPServer](https://raw.githubusercontent.com/python/cpython/3.12/Lib/http/server.py), [3.13 HTTPServer](https://raw.githubusercontent.com/python/cpython/3.13/Lib/http/server.py), [3.10 TCPServer](https://raw.githubusercontent.com/python/cpython/3.10/Lib/socketserver.py), [3.13 TCPServer](https://raw.githubusercontent.com/python/cpython/3.13/Lib/socketserver.py). Installed Python 3.12.0 implementations were also inspected.

## Checks

Commands actually run from the repository root with the requested interpreter, expressed relatively below. `PYTHONDONTWRITEBYTECODE=1` prevented bytecode writes.

| Check | Result |
| --- | --- |
| `PYTHONDONTWRITEBYTECODE=1 ../repo-ask/.venv/bin/python -m unittest discover -s tests -p test_http_foundation.py` | Exit 1: 6 tests, 6 errors. All were blocked by loopback `bind()` raising `PermissionError: [Errno 1] Operation not permitted`; no passing runtime claim. |
| `PYTHONDONTWRITEBYTECODE=1 ../repo-ask/.venv/bin/python -m unittest discover -s tests -p test_ask_composition.py` | Exit 1: 2 tests, 1 passed, 1 error. Real-CLI test blocked at its preliminary loopback port reservation with the same permission error. |
| In-memory probe through `../repo-ask/.venv/bin/python` | Passed: real override and TCPServer bind method with a mocked socket, forbidden `getfqdn`, simulated bound port 45678, both allowed Hosts, foreign Host and wrong-port rejection. This exercises no real bind, listen or HTTP exchange. |
| `git diff --check 79b3217..HEAD` | Passed. |

Sandbox limits: socket binding is prohibited and escalation is unavailable. No permission bypass, dependency installation, source edit or commit was attempted. Only Python 3.12.0 was executed. No full regression suite or CI rerun was performed. Integrator owns rerunning the two focused suites in a socket-capable environment and checking macOS CI before integration acceptance. This review changes only this file and does not assert integration or publication.
