**CHANGES_REQUESTED** — M0-EXPERIENCE, Claude, branch `task/m0-experience`.

Reviewed exact commit `f1fc0b4a954c0012f527970415b2a15dd650927e`, base `bd8c3afd18a6fe23dd984455c194743595935577`. Independently verified all seven snapshot hashes against the manifest and commit objects, and verified the packet diff.

1. **Major — Returning to Ask leaves keyboard focus invisible.**
   **Location:** `repoask/web/index.html:46`; `repoask/web/app.js:428`; `.sr-only` in `repoask/web/styles.css`.
   **Requirement:** UX-10; accepted M0 contract §7 requires visible focus on route changes.
   **Reproduction:** Keyboard-activate Repositories or Settings, then activate Ask. `showRoute(true)` focuses `#ask-title`, which is permanently clipped by `.sr-only`. Its focus outline is clipped too, leaving no visible indication of the new focus location. The handoff explicitly acknowledges this behavior.
   **Requested fix:** Give the Ask heading a visible focused presentation, or use a visible heading as the route focus target. Preserve the conversation and source pane. Owner: M0-EXPERIENCE author.

Reviewed routing, Ask preservation, scope selection, citation parameters, legacy fallback versus failures, unknown statuses, async guards and focus restoration. Source requests have abort/identity guards; status refreshes reject stale responses. No additional concrete blocking findings emerged from inspection.

The packet reports **14/14 Node DOM tests passing**; I inspected those tests but did not rerun them. They check focus identity without modeling CSS visibility, so they miss this finding. **I ran no browser checks**; real Chrome QA remains with the coordinator. No files were edited.
