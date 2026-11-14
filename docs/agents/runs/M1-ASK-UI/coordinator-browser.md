# Actual Chrome finding during R2

Root's isolated Chrome at1280x900 against synthetic acceptance server8880 shows:
`Conversation history unavailable: history.querySelectorAll(...).map is not a function`.
The current JavaScript is served directly from this worktree. Browser querySelectorAll
returns NodeList, whose map/filter/find helpers are absent; the DOM stand-in returns
an Array. Use Array.from/spread before Array-only methods and add a realistic regression.
Do not weaken tests. Keep unrelated existing tests intact.

The accessibility tree also lacks a visible main landmark/H1 after legacy children
are hidden: the new panel starts with H2. Please provide a focusable persistent Ask
H1/main target and ensure route focus does not target the now-hidden legacy H1.
Root will resume this note explicitly if the ongoing turn finishes before reading it.
No real GitHub App/account/source was used; the server has bundled synthetic demos
and a noncredentialed loopback Ollama profile only.

After a fresh reload, history now works (the live file already has Array/spread
conversion); keep that fix and its browser-like regression. Context/model reads
succeeded on explicit reload. Initial hash navigation produced cancelled requests
in the browser tool, so the root has not classified that as an application bug.

Please summarize coverage in human-readable files/chunks/partial/skipped counts;
avoid dumping internal selection_hash, raw limits and token-accounting JSON into
conversation rows. Format model destination as local/remote plus host. The shell
still says Search only although the modern panel has a ready local model; coordinate
with root rather than changing backend settings. The modern heading/main and visible
route-focus target remain necessary before final browser acceptance.
