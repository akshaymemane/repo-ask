# M1-PROVIDER-QUICK-FORM independent review — round 1

Verdict: **CHANGES REQUESTED** for exact candidate
`ae02d5984431278ff5d7fe9625b612d6b0ceceab`.

Reviewer: fresh native Codex reviewer, 2026-11-16. I changed no product source and
made no provider, credential, account or live-application calls.

## Evidence

- Exact diff from integration base `475f4517e99b6eaaa08ad1d7205eae90a0897c67`
  is limited to `settings-models.js`, its styles and UI tests.
- Focused settings-model tests: **9/9 passed**.
- Complete UI suite with the integrated Python bridge: **180/180 passed** in
  12.163 seconds.
- `git diff --check 475f451..ae02d59`: passed.
- The normal path is otherwise correct: structured output defaults on and can be
  disabled; loopback endpoints omit source consent; a remote endpoint exposes an
  unchecked consent control; the copy identifies code snippets, destination use and
  the separate Local-only requirement; secrets remain password inputs and are cleared
  by the existing success/failure paths.

## Finding

1. **Major — source-sharing consent survives a destination change.**

   `repoask/web/settings-models.js:63-70` binds the checkbox to the modal, but the
   Base URL input handler only toggles visibility. Once the user checks “Send
   repository source to this provider” for one remote URL, changing the Base URL to a
   different remote provider leaves `share.input.checked` true. Changing remote →
   loopback hides the checked control, and changing back to any remote URL reveals it
   still checked. Submission at lines 83-86 then grants `allow_external_source: true`
   to the final endpoint, even though the explicit opt-in was made while a different
   destination was displayed.

   This violates the destination-specific, explicit external-processing expectation
   in F07 AI-06 and the requested “no accidental consent persistence” review gate.
   The existing remote test (`tests/ui/settings-models.test.mjs:115-134`) checks the
   default and direct opt-in but never changes the endpoint after opting in.

   **Required fix:** clear source-sharing consent whenever the normalized destination
   changes (and when the control becomes hidden), or bind the consent to the exact
   endpoint for which it was checked. Add regressions for remote-A → remote-B and
   remote → loopback → remote. The final remote destination must require a fresh,
   visible opt-in.

No other major or blocking finding was found. Re-review must bind to the corrected
exact commit; the passing suites do not override this consent-boundary defect.
