# UI-REDESIGN independent review — round 2

Verdict: **APPROVED** for exact commit
`b830f7a95ac6a2d822e54664936414bbdb93ab67`.

Reviewer: fresh native Codex quality/security reviewer. I reviewed the exact worktree
commit against the approved UI redesign design and implementation plan, the Master
PRD accessibility and 200+ repository requirements, and every finding in
`review-r1.md`. I changed no product source, made no GitHub or other account calls,
and did not touch the user's live application on port 8765.

## Round-one disposition

1. **Unsaved plan launch — resolved.** All editor input/change paths bubble through
   one dirty handler; structural mutations explicitly use the same handler. Start is
   disabled while dirty and rechecks the dirty state, immutable plan hash/readiness,
   execution projection, and current pinned-profile consent before POSTing. Save or
   an explicitly confirmed discard is required. The regression exercises an ordinary
   step-field edit, forced button activation, discard, and the eventual launch body.
2. **Repository save race — resolved.** Each queued write captures a frozen complete
   selection snapshot and an intent generation. A failed older write cannot reset a
   newer target. The fail-first/queued-second regression observes the exact two PATCH
   bodies and the final switches.
3. **Manifest state consumption — resolved.** The service checks expiry and secure
   storage, then claims the state under the same lock immediately before conversion.
   Tests prove lock/unlock retry makes no premature conversion call and concurrent
   callbacks make exactly one conversion.
4. **200+ repositories — resolved.** The shared bounded-response reader traverses
   cursor pages, rejects repeated cursors, and deduplicates stable repository IDs.
   Setup and the merged catalog use it. The catalog regression reaches record 205 and
   applies owner/fork/archive filters across all pages; language filtering uses the same
   loaded set.
5. **Incomplete redesign — resolved for the approved functional flow.** Plan editing
   is in the Ask side panel; Sessions owns a persistent list/thread/detail layout and
   Progress/Diff/Checks/PR tabs; repository detail has native index, exclusions and
   purge controls; catalog filters and pagination are present. No unsupported scope
   ruling is claimed.
6. **Scope removal staleness — resolved.** Both added and removed repositories mark a
   saved plan stale, so the saved version cannot be launched as if its scope were
   unchanged.

## Independent checks

| Check | Result |
|---|---|
| `git diff --check 44b8b6d..b830f7a` | Pass |
| Targeted Node suite: Ask, repositories, sessions, setup and shell | 55/55 pass in 10.54 s |
| `test_github_manifest.py` | 30/30 pass |
| `test_web_assets.py` | 2/2 pass |
| `test_workspace_mode.py` | 2/2 pass |
| `test_context_api.py` | 7/7 pass |

The author's wider evidence on the same exact head reports 176/178 UI tests and
124/124 focused Python tests. The two UI failures occur before UI execution because
this branch does not contain the independently developed M2 Sessions fixture; they are
an integration dependency, not a reproduced UI defect.

## Remaining integration and external gates

- Run the complete UI suite after M2 Sessions is integrated, then exercise the session
  page against that real local backend.
- The live GitHub Manifest flow creates an account resource and remains an explicitly
  user-authorized acceptance action; unit/concurrency coverage is not a substitute.
- The approved design's manual 390px and keyboard checks are recorded in
  `acceptance.md`. This review inspected the corresponding layout/focus code and reran
  its automated focus tests; it did not repeat a separate visual-browser session.
- The server contract does not yet offer question choices or per-step progress. The UI
  reports those limitations rather than inventing state. The advanced legacy provider
  editor and now-unused `context.js` are bounded cleanup/product follow-ups, not blockers
  to this candidate's redesigned primary flows.

Approval authorizes coordinator integration of this exact local commit. It does not
authorize remote publication or represent M2 end-to-end completion.
