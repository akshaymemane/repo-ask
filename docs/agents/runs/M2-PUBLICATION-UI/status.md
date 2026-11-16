# M2-PUBLICATION-UI status

- 2026-11-16: started by Claude experience agent on task/m2-publication-ui (base 0695f0c).
  Read card, contract (incl. coordinator additions), publication_api.py and service shapes.
  Baseline `node --test tests/ui/*.test.mjs`: 206 pass, 0 fail.
- Decision: the "Pull request author" identity card lives in `createExecutionSettings`
  (repoask/web/sessions.js), which owns the Settings → Coding agent DOM; settings.js unchanged.
