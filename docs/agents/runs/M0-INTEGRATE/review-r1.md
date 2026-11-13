# Review of 6a671f89e33d (base e4ff292): changes requested

**Card:** M0-INTEGRATE, branch `work/opendevin-integration`. It covers 406c8fc (HTTP/lifecycle) and 6a671f8 (OS vault/packaging).

**Verdict:** I found no blocking code defect. One major problem: the tests never check acceptance item #3 or the data-dir fail-closed rule. Add one focused check and the next commit is ready to approve. This approval would cover that new commit only; 6a671f8 is not approved as it stands.

## Major

**M1. Acceptance #3 and the data-dir rule have no evidence.**
- **Requirements:** OP-07/OP-12, task acceptance #3 ("SIGTERM exits cleanly", request workers close before databases), and contract `docs/contracts/README.md:166-167, 532` (data-dir failure exits non-zero with no memory fallback; demo writes no files).
- **Where:** `repoask/__main__.py:189-216` is never run by any test. `tests/test_http_foundation.py:365-373` uses its own `stop()`, which copies the intended order but does not test `main()`. I found no subprocess, SIGTERM or `--data-dir` test in `tests/`.
- **Why it matters:** the handoff says "SIGTERM maps to graceful stop", but nothing checks it. From reading the code, the order is right: `with server:` calls `server_close()`, and `ThreadingMixIn.block_on_close=True` joins request threads before `finally` closes `platform` and `index.db`. That is reasoning, not evidence.
- **Fix:** add a subprocess test that:
  - starts `python -m repoask --port <free>` and waits for the "Open http://" line;
  - sends a GET, then SIGTERM, and expects exit code 0 with no traceback on stderr;
  - runs `--data-dir <an existing regular file>` and expects a non-zero exit, the fixed message, no traceback, no path in the output and no memory fallback;
  - runs the demo with no flags in a temporary working directory and expects no files written.

## Minor (not blocking)

1. **A second signal during shutdown skips the order** (`__main__.py:207-216`). The SIGTERM handler stays installed. A second SIGTERM or Ctrl-C while `server_close()` waits for threads raises KeyboardInterrupt inside `__exit__`, and `finally` then closes both databases while handlers still run.
   - Repro: run `--model` against a slow Ollama, start a `/api/ask` call, send SIGTERM twice.
   - Result: request threads get "closed database" errors, and an uncaught `ProgrammingError` from `index.db` prints a traceback through `handle_error`. The process exits anyway, so this is minor.
   - Related: one drain can take up to the 110 s Ollama timeout (`answer.py:110`), or longer if a local client trickles header bytes. That is longer than systemd's default 90 s stop timeout. Consider ignoring signals after the first one, plus a bounded join.
2. **Response codes differ from the contract** (`__main__.py:87-88`). A `PlatformError` returns 503 with `error.code`. The contract (§6.2 and line 462) says health always returns 200 and unexpected errors return 500 `internal`. The codes contain no content and 503 is reasonable, but record it in the contract or the UI 5xx path. Note also that `SecretService.status()` raising now gives 503, not 500 (the open item from M0-PLATFORM review r2).
3. **An unknown `~user` path gives a raw traceback** (`__main__.py:191`). `Path('~nosuchuser/x').expanduser()` raises `RuntimeError`, which `except PlatformError` does not catch. The output is a traceback, not the clean message, and `index.db` is not closed. Fix: expand the path inside a broader except, or validate it earlier.
4. **The data-dir check runs after indexing.** The data dir is opened only after every `--repo` is indexed, so a bad data dir fails late. Opening the platform before indexing would fail faster.
5. **The 128 KiB credential limit does not hold on Windows** (`keyring_backend.py:54`). The Windows vault blob limit is about 2560 bytes (UTF-16). Base64 of a GitHub App PEM is about 2.3 K characters, so storing it fails, though safely as `secret_store_unavailable`. This is already advisory M11; the per-platform limit should land with M1.
6. **The "no discovery" check uses fakes only** (`keyring_backend.py:20-33`; `tests/test_keyring_backend.py:485-505`). The test injects a fake loader; the real `importlib` path and real `keyring` package are not tested, and keyring is not yet installed in `.venv`. Once it is, check that importing `keyring.backends.macOS` leaves `keyring.core._keyring_backend` as `None`. That would show no `init_backend()` or entry-point discovery ran.
7. **Lower-priority vault notes:**
   - The macOS backend respects the `KEYCHAIN_PATH` environment variable; this only matters if someone already controls the environment.
   - `status()` checks availability only at construction, so a vault locked later still shows as available.
   - The traceback from `put` keeps a reference to the secret `value` in its frame. `SecretService.create` re-raises without it, so this is fine for now.
8. **Bookkeeping is out of date:**
   - `task.json`'s `write_scope` leaves out the four 6a671f8 files.
   - `task.json` still has `submitted_sha` and `review_packet` empty and an outdated `next_action`.
   - `board.json:154` lists `submitted_sha` as 406c8fc, but this review is of 6a671f8.
   - 6a671f8 has no card or handoff of its own giving requirement IDs.

## Areas with no findings

- **Shared routes:** the new routes sit behind `allowed_host()`, reject any query string, keep the 404 body as `{"error"}` and leave the POST Origin check and legacy routes unchanged.
- **Status leakage:** `recent_failures` returns only id, kind, code and timestamp; there are no paths or repo names, and the reason strings are fixed text.
- **Data-dir failure handling:** `Store.open` turns any failure (mkdir, path is a file, migration) into a `PlatformError`, so startup fails closed.
- **Vault selection:** only the named macOS/SecretService/Windows classes are loaded, behind a `priority>0` check; there is no plaintext fallback or discovery, and runtime still defaults to the unavailable backend.
- **Error cleanup:** backend errors are re-raised outside the `except` block, so `__context__` stays `None`.
- **Binary data:** values round-trip as base64, and empty or corrupt stored values fail closed.
- **Packaging:** `pyproject.toml` includes the package data, and the `LICENSE` and `README.md` it points to both exist.

## Limits of this review

- I only read and searched files. I ran no tests and am relying on your count of 40 Python and 15 Node tests passing.
- I read the commit's files from the review packet's snapshot and the unchanged `repoask/platform/*` files from the working tree, and I did not verify their hashes against the manifest.
- Whether `keyring` imports without side effects is unverified because the package is not installed yet.
- I did not try a real vault, GitHub or provider.

**Who acts next:** you as author fix M1, and minor items 1 and 3 if you choose. You also decide whether to accept the 503 mapping and update the board.
