# M1-CATALOG-UI re-review: APPROVED for `dd7259ca1959da620ff555b8cda79f73e0dd9215`

No blockers remain. This approval covers this exact commit against base `b82d811`.

**Basis:** I only read code: the packet snapshots, `manifest.json`, `checks.txt`, `handoff-claude-r1.md` and the diff against the base. Since `94ad03e`, only `app.js` and `catalog.test.mjs` changed, plus run docs; the hashes for `index.html`, `styles.css`, `dom.mjs`, `app.test.mjs` and the services tests are the same. I did not recompute the hashes, run anything, edit anything or touch live accounts.

**Test results, as reported by you:** 32 of 32 Node checks passed in your root run. The final Chrome check is still running. I did not see either result.

**Independence:** you authored this follow-up and I'm the separate reviewer. I approve the code, not the process.

## What I asked for, checked in the code

1. **GitHub overlapping loads (my blocker): fixed.**
   - `app.js:939` numbers each load and `949` drops any response that isn't the newest. A superseded load can't show an error or move focus either (`990-991`).
   - `githubMutation` (`927-933`) makes all earlier loads out of date and allows only one GitHub change at a time. `loadGitHub` skips reloading while a change is pending and tells the user why (`935-937`).
   - After a save succeeds, the reload runs once the pending flag is cleared (`987`).
   - Tests: `catalog.test.mjs:204-237` checks that the newest load wins with exactly one App form, and that no reads happen while a configure is pending.
2. **Setup-return message: fixed.** It is now added after the panel is cleared (`941-944`), so it survives reloads and appears exactly once. Test: `:212`, `:222`.
3. **Catalog during a permission save: fixed.**
   - A pending save count disables the Reload, Apply, Previous and Next controls, and `loadCatalog` refuses to run (`1005-1018`).
   - Each save makes any earlier catalog read out of date (`1057`).
   - GitHub access changes are refused while a save is pending (`929`), and saves are refused while a GitHub change is pending (`1054`). Only one save can run at a time (`1055`).
   - Test: `:239-257`.
4. **Bad install link error text: fixed.** A failed `new URL()` now shows a fixed message (`964`). Links containing a username or password are also rejected (`965`). The test checks the hidden text isn't echoed (`:259-265`).
5. **Focus restoration: fixed.** If focus was inside a panel that gets rebuilt, it moves to the panel heading (`921-926`, `991`, `1148`). A status refresh puts focus back on the element that had it (`822-828`). Test: `:266-269`.

The earlier fixes are unchanged: provider load numbering, the frozen and reconciled permission checkboxes, and the textarea `type` fix.

## Regressions and security

I traced the order of events between GitHub changes, catalog saves and reloads. Every mutation control sits inside a panel that is cleared before any reload starts. So no save can begin while an older read is still in flight, and every fence holds. Nothing changed in how the UI handles secrets, escapes server text or reduces error messages. F02 controls are correctly left out, as you asked.

## Non-blocking notes

- **n1:** If a catalog save is pending, `githubMutation` refuses an App configure (`929`). The PEM key is cleared before that check (`986`), so the user has to paste it again. This is safe, just a small annoyance.
- **n2:** `app-status` messages are set directly (`936`, `1094`) instead of through `announce()`. A repeated message may not be read out again by a screen reader.

**For the coordinator:** merge once your Chrome check at desktop and narrow widths passes. Nothing goes back to the author.
