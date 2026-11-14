# M1-CATALOG-UI final re-review: APPROVED for `2432f5eb6f56c3411af7b07be23888a1ba11c581`

The combined approval holds. This commit equals my approved `dd7259c` plus this focus fix, and I found no blockers.

**Basis:** I read the 3-file diff against `dd7259c`, the `app.js` snapshot and `manifest.json`. I did not recompute the hashes and I ran nothing.

**Test and browser results, as reported by you:** 32 of 32 Node checks pass. The existing focus test failed before the fix and passes after it. In Chrome, saving a role moves focus to the H2, there is exactly one App form, and there is no horizontal overflow at 1280 or 640 pixels. I did not see these results myself.

## Delta check (`app.js:907-921`, `930-935`, `dom.mjs:205-210`)

- **Focus is captured before the button is disabled.** `perform` now records focus before setting `disabled`, which fixes the problem Chrome showed. It counts focus on the button itself, or anywhere inside its form. For buttons outside a form (Test, Confirm delete, GitHub actions), `inside(null, …)` simply returns false, so the button-only check covers them.
- **Restore only happens when focus was actually lost** (it is on `body` or on a removed element). If the user moved focus elsewhere while the save was pending, it is left alone, so the fix doesn't steal focus (UX-10).
- **Where focus goes back to:**
  - If the button still exists (catalog saves, provider tests, failed mutations), focus returns to the button.
  - If the panel was rebuilt (successful provider or GitHub saves), focus goes to the panel heading. The panel used is the long-lived `.connected-panel` section captured before the save, so it is still valid after the rebuild.
- **No double move.** The panel loader's own restore step sees focus already on `body` and does nothing, so only `perform` moves focus.
- **Route check now covers the catalog.** `restorePanelFocus` now checks the Repositories route for `catalogPanel` and Settings for the other panels. Before this, catalog restores could only happen while on Settings. If the user has switched routes while a save was pending, `button.focus()` on a hidden button simply does nothing.
- **Test DOM change is realistic.** The stand-in now blurs to `body` when a focused element is disabled, matching what Chrome showed. It only adds that blur, so the stand-in is not made weaker.
- **Nothing else changed:** the load and save barriers, secret handling and error-message reduction are untouched.

**For the coordinator:** this exact commit is ready to integrate. F02 controls are still deferred to the extension card you will assign.
