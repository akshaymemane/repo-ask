# Builder handoff — M2-SESSION-UX

## Identity

- Author/harness and session ID: Claude experience agent (Claude Code subagent, model claude-opus-5-5); launched by the coordinator for this card.
- Persona, branch and worktree: experience and accessibility engineer; `task/m2-session-ux`; `/Users/apple/workspace/vibe-coding/opendevin-m2-session-ux`.
- Base SHA and submitted commit SHA(s): card base `51f5839`, branch base `9312a10` (brief commit); implementation `bf90958`; this handoff is in the commit that follows it.
- Task card and requirement IDs: `docs/agents/runs/M2-SESSION-UX/task.json` and `brief.md` (F05 session UI follow-up).
- Status: review (round 1 findings addressed; see "Review round 1").

## Outcome

Implements the coordinator's brief in the UI only, with no API or Python changes. The sessions list and session page now show names in place of raw identifiers. Every finished session opens with a plain-language result card. The timeline folds start-up steps into one group, the diff renders inline, and the composer appears only while the session can take input.

Changed files (all inside the card's write scope):

- `repoask/web/sessions.js`: list, detail page, timeline, result card, diff/checks tabs, composer, header actions. The publication area gained a single `onChange` hook; its own logic is unchanged.
- `repoask/web/shell.js`: recent items accept an optional `tooltip` and expose it as the link `title`. This touches recent labels only.
- `repoask/web/styles.css`: replaced the old "Session page" block with a session design block built on the shared tokens.
- `tests/ui/session.test.mjs`, `tests/ui/session-services.test.mjs`, `tests/ui/shell.test.mjs`: updated where they pinned removed copy.
- `tests/ui/session-ux.test.mjs`: new, 17 tests.
- `docs/agents/runs/M2-SESSION-UX/status.md` and this handoff.

`repoask/web/app.js` and `repoask/web/ui.js` did not need changes. `relativeTime` and `badge` are reused from `ui.js`. Repository names use the existing `readRepositoryPages` from `repo-source.js`.

Contracts consumed (read-only):

- `GET /api/sessions`, `/api/sessions/<id>`, `/events`, `/messages`, `/diff`, `/validations`.
- `GET /api/sessions/<id>/publication` and `/api/publications/<id>`.
- `GET /api/plans/<id>` (plan titles).
- `GET /api/repositories` (names).

No deviations from these contracts.

## Brief item → change → test

| Brief item | Change | Test evidence |
| --- | --- | --- |
| List rows: status badge, plan title (link), repository name, attempt N, relative time, duration, short base SHA; raw ids only in titles | Rows in `ul.session-list`. The whole row is the link's hit area and the focus ring is drawn on the row. Plan titles come from `GET /api/plans/<id>`, fetched once per plan per panel. Names come from the paged `/api/repositories`, cached for 5 min. | `session-ux`: "session list rows show status, plan title, repository name…" (asserts no `ses_`, `gh:`, plan or version id, or full SHA in visible text; ids in `title`) |
| Compact filter toolbar; date filter folded; count only when filtering; small Reload | `form.session-toolbar[role=search]` contains search, state (All/Active/Finished), a repository select listing names, the date filter inside a `<details>`, and a ghost "Reload" button labelled "Reload sessions". The status line reads "N of M loaded sessions match." only while a filter is active. | `session-ux`: "the compact toolbar filters…"; `session`: pagination and 404 tests unchanged and passing |
| Calm empty/loading states linking to Ask | Loading shows "Loading sessions…". The empty state is a dashed card, and the "Create a plan in Ask" link stays even when the API is missing. | `session-ux`: "an empty session history is calm…"; `session`: "missing sessions API…" |
| Sidebar: short plan title plus "repository · attempt N · status" | `publishRecent` now uses the title, a tooltip with the full title, and meta in the form `demo · attempt 2 · cancelled`. | `session-ux`: "the rail lists recent sessions…"; `session`: rail test (id fallback); `shell`: tooltip assertion |
| Layout uses width; mobile stacks | Session page `.page-inner` is up to 1280px wide (list 980px). The header spans the page, with main plus a sticky pane card below. One column at ≤1000px. | Playwright/Chrome at 1440 and 390: horizontal overflow 0px on all four pilot sessions and the list |
| Header: title, badge, repository, base@sha, attempt with previous/next links, elapsed; state actions | `header.session-header` contains the crumb, h2 title, phase badge, live indicator and meta line. Actions: Stop (unfinished, or failed containment), "Retry as a new attempt" (finished, no successor), "Create draft PR…" (completed only) or "View draft PR" / "Draft PR status" (any publication), each jumping to the PR tab and focusing its control. | `session-ux`: header test, "Create draft PR…" test, interrupted-has-no-PR-action test; `session`: "Stop sits in the session header…" |
| Result summary card per terminal state; agent final message as text; replace "completed · completed" | `renderResult()` covers completed (stats plus checks phrase), cancelled, interrupted (the brief's wording, gated on recorded containment and the edits-lost flag, plus Retry), and failed/blocked (plain text with the code in small print). The final message is set via `textContent` in a `figure`. The old `state · phase` h2 is removed. | `session-ux`: "a finished session leads with a plain-language result…" (5 cases), "interrupted result offers Retry…", "the final agent message … is text, never markup" |
| Timeline: marker, short label, relative time; exact time and #seq in title; setup collapsed; work groups; plain checkpoints; agent messages styled | `describeEvent()` maps only known fields. Start-up steps fold into "Set up · 8 s · model", which is open only while the session is still starting. Tools and checkpoints fold into "Worked for … · N steps in F files". Checkpoints read "no changes" or "+1 −1 in 1 file · 2 paths left out". Agent prose renders as message boxes, and the final message is clamped there because the card shows it in full. `<details>` keep the reader's open/closed state across polls (previously reset every 2 s). | `session-ux`: "the timeline folds setup…"; `session`: replay/dedupe test (`<unsafe>.py` stays text) |
| Live / Reconnecting / Offline indicator; Reconnect only when not live | `.session-live[role=status]` with a dot, label and detail. The "Saved activity through #N…" sentence moved to its `title`. The Reconnect button is hidden while live. Connection messages are ephemeral and cleared by the next successful refresh; action outcomes stay. | `session`: "lost connectivity…"; `session-ux`: header test (Live → Reconnecting → Live via Reconnect) |
| Composer only while input is possible; "Send guidance" / "Answer the agent's question"; question_id targeting kept; ended line with retry | The label follows the selected target. The target select is hidden when there is only one choice. The form is hidden once ended, unless an unsent draft exists, in which case it stays read-only so the user's text is never discarded. `p.session-ended` reads "This session has ended." and offers Retry unless the result card already does. | `session-ux`: running/question test, terminal test; `session`: unknown-outcome reconciliation, terminal-draft read-only, question card/Reply… |
| Progress tab: overall state; honest small note | Badge (running / needs your input / stopping / done / stopped / interrupted / failed) plus step count. The note is kept in small muted text. | `session`: detail-pane test (steps); visual |
| Diff tab: "1 file · +1 −1 · base main@2605d80"; inline unified diff with +/− colouring, open for small diffs; left-out paths with plain reasons; hashes folded | Diffs render as line spans (`diff-add`/`diff-del`/`diff-hunk`/`diff-meta`, with the +/− kept in the text). Files open by default when there are ≤5 files and ≤400 lines. Reader toggles survive refresh. Rejected paths show reasons such as "generated file, left out". Hash, artifact and base commit sit in "Checkpoint details". | `session-ux`: Diff-tab test, large-diff/toggle test; `session`: detail-pane totals |
| Checks tab: command block, pass/fail badge, duration, output; environment folded | `section.check-item` contains a badge, "Check N · required · 3 s · exit 0", the command in `pre > code`, "Expected:" when present, and the output. Environment details (image, network, cwd, source, times) sit in a `<details>`. | `session-ux`: Checks-tab test; `session-services` (real service bridge): "All recorded checks passed" |
| Keep every existing behaviour and its tests | Stop/retry keys, message idempotency and reconciliation, source-loss redaction (including hidden tabs), late-response fencing, replay cursor, publication panel, focus restoration and live regions are all kept. | All 228 baseline UI tests still pass; 7 were updated only where copy or placement changed (listed below) |

Tests updated because copy or placement changed (each still proves the same behaviour):

- Composer lookup: "Follow-up" → the visible label ("Send guidance" / "Answer the agent's question").
- "Send message" → "Send"; "Clarification · queued" → "Guidance · queued" (real bridge test).
- Late-response test: asserts that the old session's facts never render and the title stays "Session". It previously matched `/new/`, which only matched the Retry label.
- Detail test: the plan link is in the header (`Plan v3`, aria-label includes the title). Diff totals use the new summary format.
- Stop test: Stop sits in `.session-header`. With failed containment its label is "Request stop again", matching the result card's advice.
- Connectivity test: asserts the indicator text, the visible Reconnect button and the retained badge, in place of the old sentence and the `running · agent` heading.
- Rail test: exact meta in the form `gh:1 · attempt 1 · needs your input` (id fallback without a catalog).

Also fixed while here: a finished session with `stop_requested: true` used to keep saying "Stop requested… work is not confirmed stopped". It no longer does (`session-ux` result test asserts this).

## Verification evidence

| Requirement | Command or scenario actually run | Result / evidence |
| --- | --- | --- |
| UI suite | `node --test tests/ui/*.test.mjs` | exit 0; 245 tests, 245 pass (baseline before changes: 228/228) |
| Python suite | `/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python -m unittest discover -s tests` | exit 0; `Ran 611 tests`, `OK (skipped=9)` (run on the implementation tree and re-run on `bf90958`) |
| Real-data rendering, 1440 and 390 | Read-only preview proxy (worktree web assets plus GET-only forwarding of `/api/*` to `127.0.0.1:8765`; non-GET answered 405 by the proxy). Playwright driving system Chrome over the list and the four pilot sessions; only tabs and disclosures were clicked. | Screenshots reviewed (light and dark). `horizontal overflow 0px` at both widths. `non-GET requests attempted: none`. |
| Keyboard and visible focus | Same harness: 40 Tab presses on the interrupted session at 1440 | Order: rail → crumb → previous attempt → plan → conversation → header actions → result Retry → Set up → Run details → tabs. Every stop had a `solid/2px` outline. Row focus ring visible on the list in dark mode. |
| Labels, live regions, headings | DOM assertions in `session-ux` | Live indicator `role=status`; separators `aria-hidden`; timeline markers `aria-hidden`; composer and toolbar controls labelled (sr-only labels for the compact toolbar); h2 title then h2 sections (an sr-only "Result" heading on the card), no skipped levels |

Fixture-only versus real: all new tests use fixtures. Real integration is covered by the existing `session-services` bridge test, which passes, and by the read-only visual run against the live pilot data. No real data was copied into tests. Screenshots stay in the session scratchpad (not committed) because they show pilot repository names.

Not run: screen-reader testing with real assistive technology; browsers other than Chrome; manual zoom at 200%.

## Review round 1

Codex reviewed `c187e61` and requested changes (3 × P2). All three are fixed in the commit that follows this handoff edit, and each has a focused test in `tests/ui/session-ux.test.mjs`. Each of the four new tests was confirmed to fail against `c187e61` and pass with the fix.

| Finding | Change | Test |
| --- | --- | --- |
| P2 `sessions.js:37`: failed, interrupted or blocked sessions with `stop_requested: true` showed a "stopping" badge | `phaseBadge` handles every terminal state before the stopping check. Unfinished work with a stop request still shows "stopping". | "every terminal state wins over a recorded stop request in the badge": failed, interrupted, blocked, cancelled and completed with `stop_requested: true`, a running control case, and the rendered header badge |
| P2 `sessions.js:953`: when the session read succeeded but a child read failed, the indicator said "Live" and hid Reconnect while the status asked the user to reconnect | A partial failure sets the indicator to "Reconnecting… · some saved state unavailable", which keeps Reconnect visible. A later refresh with no failures returns to "Live", hides Reconnect and clears the advice. | "a failed child read degrades the indicator and keeps Reconnect until a refresh fully succeeds": validations return 503, then recovery through Reconnect |
| P2 `sessions.js:519`: an in-flight plan-title read was cached as `null`, so leaving and returning before it resolved repainted early, the old completion was fenced, and the title stuck at "Saved plan" | Resolved titles (`planTitles`) are kept separate from in-flight reads (`planReads`). Re-entry awaits the pending promise. A failed read is not cached and is retried on the next load. | "a plan title still loading when the reader leaves and returns is awaited…" (delayed response across list → detail → list; one read only), and "a failed plan title read is retried by the next load" |

Round 1 checks run: `node --test tests/ui/*.test.mjs` exit 0, 249 tests, 249 pass. No Python files changed in this round; the Python suite result above (611 OK, 9 skipped on `bf90958`) still applies to unchanged Python code.

## Risks and next action

Known gaps and deferrals:

1. **Cold load into `#/sessions` can show conversations in the rail.** `ask.js` loads conversation history unconditionally at boot. When that request finishes after the sessions list, it overwrites "Recent sessions". This happened in some, but not all, cold loads during the visual run. In-app navigation is unaffected. The fix belongs in `ask.js` (forbidden scope for this card): skip `setRecent` while the route is not Ask. Owner: coordinator / Ask owner. This race existed before this card.
2. **The list cannot show "PR open".** The session list and detail projections report `publication.state: "not_started"` even for the session whose draft PR is published (observed on the pilot). The detail page reads `/publication` and shows "PR open" correctly, but list rows would need a read per row. Suggested follow-up: the API projects the real publication state, or adds `plan_title`, on session rows. Owner: coordinator / runtime.
3. **Plan titles cost one GET per distinct plan on a page.** At most 25, cached per panel. A `plan_title` field in the session list projection would remove these reads; that is an API change, so out of scope.
4. **Repository names page through `/api/repositories?limit=100`.** Cached for 5 minutes per panel. On a failure the raw id is shown, which is the honest fallback.
5. **Agent messages are plain text.** Markdown is not rendered, per the brief ("rendered as text, never HTML"), so markdown syntax such as backticks and `**` stays visible.
6. **User messages stay in a separate "Your messages" section.** It is hidden when empty; messages are not interleaved into the timeline.
7. **On mobile the details pane stacks after the thread.** The Diff and Checks tabs therefore sit at the bottom of the page.

Behaviour changes to note for review:

- Stop and Retry moved from the composer row to the header. Retry is hidden, rather than disabled, while a session runs.
- New badge labels: "starting" (queued/provisioning), "running checks" (validating), "PR merged".
- The header PR action appears only for completed sessions (or when a publication exists). The PR tab itself is unchanged and still offers publishing per server rules.

Other items:

- Migrations/configuration needed: none.
- Background processes still running: none. The preview proxy (scratchpad, port 8799) was stopped after the visual run.
- Reviewer and requested review scope: Codex (opposite harness). Review `9312a10..<handoff commit>`: `repoask/web/sessions.js` (list/detail; the publication area changed only by the `onChange` hook), `repoask/web/shell.js`, the session block in `repoask/web/styles.css`, and the tests. Points worth checking: source-loss redaction still clears the result card and its final message; focus restoration across repaints; the composer draft-retention rule.
- Blocker owner and unblock action: none blocking; deferral 1 needs an `ask.js` owner.
