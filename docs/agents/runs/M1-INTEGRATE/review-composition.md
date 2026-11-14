**Verdict: APPROVED, `2c258da09a31913d54d8da3086ad9bbeaffc2765`.** No blocking or major findings. One condition before integration: the integrator must record a full Python and Node test run at this exact SHA (details below).

## Scope and sources
- **Packet:** `.git/opendevin-runtime/reviews/2c258da…`. It covers `259a31a..2c258da`. I read its manifest, diff, snapshot `__main__.py` and checks.
- **Root `259a31a` changes:** there is no packet for that commit, so I compared current `ask.js`/`app.js` with the `2d5d2fa` packet snapshots. Limitation: I read those files from the working tree, not from Git objects. HEAD is `work/opendevin-integration` = `2c258da` per `.git/refs`, but I can't confirm the tree is clean. The integrator should recheck the hashes.
- I did not re-review the already-approved indexing, Ask or purge modules. I ran no tests and launched no browser.

## What I verified
- **Composition** (`__main__.py:288-317`):
  - Context and Ask are wired up in order, and `server.features` is set from `services.api` after `enable_ask`, so it uses the rebuilt API.
  - `ask.js` is served (`:31`).
  - `CodeIndex([])` starts empty; bootstrap then restores only eligible, unpurged sources (`services.py` bootstrap).
  - The startup snapshot list is cleared. Purged sources keep no in-memory copy; only the legacy index keeps snapshots for eligible sources.
- **`--model` seeding** (`:293-302`):
  - `providers.roles()` returns a per-role dict, so the "missing role" check is correct.
  - It creates a single loopback profile with `chat` and `structured_output` and assigns only the unassigned roles.
  - The CLI test shows a second start with a different model does not overwrite the saved choice.
- **Privacy and legacy behaviour:**
  - `/api/repos`, `/api/source` and `/api/ask` still filter through `legacy_source_allowed`.
  - A purged demo stays absent from `/api/repos` after a real restart (CLI test).
  - Purge clears Ask's copies through `conversations.purge_repository` once Ask is enabled.
  - Legacy Ask keeps using the startup model.
- **CLI start/stop:** SIGTERM triggers an interrupt that ends the server; the `finally` block closes services, platform and index. The test fails if the process outlives a 10-second wait.
- **Auto-refresh after a finished answer** (`ask.js:180-184`): this resolves the earlier medium follow-up.
  - The page only skips the reload when focus is in an editable control or there is an unsaved draft.
  - After reloading, it focuses the `h3` heading only if focus was inside the page and no newer load has started (the `token+1===epoch` check).
  - The new UI test covers both the editing and non-editing cases.
- **Readable summaries:** `destinationText` matches the backend's `destination_for` shape (`{kind, host}`). `coverageText` drops internal fields such as `selection_hash`, as the test confirms.
- **Header** (`app.js:1219-1221`): this runs after the top-level `/api/repos` block, so "Ask & plans" is not overwritten. If the Ask API is missing (404), the legacy "Ollama"/"Search only" label stays, which is accurate.

## Minor findings (non-blocking; owner: root/experience)
1. **`ask.js:5,95` — lexical-only mode never shows.** `coverageText` reads `c.mode`, but the backend puts `mode` on `active_snapshot` (`indexing/service.py:315`). So a lexical-only (degraded) snapshot is not shown in the conversation details. Fix: pass `r.active_snapshot.mode` in.
2. **`ask.js:130,193,197` — the earlier follow-up 3 is only partly done.** Usage is still shown as `JSON.stringify(usage)`, and plan readiness `source_freshness` is still a raw JSON `<pre>`.
3. **`ask.js:41` — the earlier follow-up 2 is not addressed.** Focus restoration still matches by button label, so it can land on the wrong row's "Remove entry".
4. **`__main__.py:296-302` — seeding errors aren't handled.** If assignment fails (for example, the profile limit is reached), startup crashes with a traceback, and the profile already created can be left orphaned. A crash in `bootstrap_context` behaves the same way. Fix: catch these and exit with a short message.
5. **`tests/test_ask_composition.py:598-600` — possible flaky test.** It picks a free port, closes it, then starts the CLI on it, so another process could grab the port in between.

## Test evidence gap (needed before integration)
The packet's `checks.txt` says the 210 Python + 58 Node pass happened *before* the empty-`CodeIndex` startup change, and that the "current full rerun… pending". Your note says everything passes, and the two live CLI tests passed after the change. The integrator should record the full `python -m unittest discover -s tests` and `node --test tests/ui/` results at `2c258da` itself. I have not inferred that they pass.

This approval covers only `2c258da09a31913d54d8da3086ad9bbeaffc2765`. Chrome, keyboard and screen-reader acceptance is still the root's to do.
