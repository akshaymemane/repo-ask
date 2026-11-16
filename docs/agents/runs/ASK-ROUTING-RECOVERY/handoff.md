# Ask routing recovery handoff

- Author and role: Claude, experience
- Branch: `task/ask-routing-recovery`
- Base: `9f143e7` (integration)
- Origin: the user asked for UI/UX polish before M2. A Chrome pass of M1 against a fresh
  data dir turned up three first-run problems; the user asked to fix them before M2.
- Status: ready for review

## Behavior

1. **Sample repositories never matched a question.** Routing reads catalog metadata only:
   the name plus README headings and `name:`/`description:` lines
   (`indexing/service.py`, profile summary). The bundled examples had no README, so their
   profile was "No README or manifest evidence retained" and every natural question,
   even "checkout", returned `no_match`. Each example now has a short `README.md` whose
   section heading names what it does, checked against its source (Kafka `order.created`,
   `orders` and `order_outbox` tables). Routing logic is unchanged.
2. **The no-match notice was duplicated and stuck.** A routing miss threw an error that
   showed in the page status line (auto-send path) or the composer error, in addition to
   the routing card, and none of these cleared after choosing repositories. The routing
   error is now `silent`: it keeps the text in the composer but shows nothing because the
   card already explains. Choosing repositories while a question is waiting clears the
   card and status and sends the question, matching the existing candidate buttons
   (`onPickRoute`).
3. **The first click after route focus was lost.** `.persistent-ask > h1` became visible in
   the flow only while focused. Blurring it collapsed it and moved the page up about 20px, so
   the mouseup missed (seen on "Choose…"). It is now an overlay label, the same pattern as
   `.conversation > .view-title:focus`, and keeps a visible outline.

Changed files:

- `repoask/web/ask.js`: silent routing error; `onScopeChange` resumes the waiting question;
  auto-send does not repeat a silent error.
- `repoask/web/composer.js`: `submit` does not render a `silent` failure.
- `repoask/web/styles.css`: focused Ask h1 positioned as an overlay; `.persistent-ask` is
  `position: relative`.
- `repoask/examples/*/README.md`: new, four files.
- `tests/ui/ask-chat.test.mjs`: no-match → Choose… → send test; focused-heading overlay test.
- `tests/test_context_purge_recovery.py`: the orders-api example has 5 files now; the second
  count compares against `len(original.files)` instead of a literal.

No contract, API or schema changes.

## Verification

| Scenario | Command or check | Result |
| --- | --- | --- |
| UI suite | `node --test tests/ui/*.test.mjs` | 199 pass, 0 fail (after review fixes) |
| Python suite | `.venv/bin/python -m unittest discover -s tests` | 523 OK, 9 skipped |
| New tests fail without fix | Ran each new test against the base files | Notice test: 2 notices instead of 1. Overlay test: `position` not `absolute` |
| Routing on fresh store | `POST /api/route` | "How does checkout create an order?" → `needs_selection` with all four; "What does the outbox table store?" → orders-db; "quantum flux capacitor" → `no_match` |
| Chrome, fresh data dir | Asked a question that matches no repository | Card shown once, no status line; focused heading shows as an overlay pill |
| Chrome, fresh data dir | Clicked Choose… once | Picker opened on the first click |
| Chrome, fresh data dir | Picked orders-api → Add | Card cleared; question sent automatically; Cancel → "Cancelled." with Retry |
| Chrome, fresh data dir | Asked the checkout question | "Which repository?" card with orders-api, orders-db, notifications-worker, storefront-web |

## Codex review rounds (author-run, pre-coordinator)

Cross-provider review with gpt-6-astra through the Codex CLI (read-only sandbox), via
`astra-review`. Round 1 reviewed `b0bc667`; rounds 2 and 3 reviewed the current contents of
the same files. These rounds are author-side checks, not the independent approval
`AGENTS.md` requires.

| Round | Finding | Disposition |
| --- | --- | --- |
| 1 | HIGH: resuming sent the original question even after the user edited or cleared it | Fixed. `resumePending()` sends the current composer text, sends nothing when it is empty, and is shared by `onPickRoute` and `onScopeChange` (`onPickRoute` had the same flaw before this change) |
| 1 | HIGH: silent routing errors removed the screen-reader announcement | Fixed. The composer has a visually hidden `aria-live` announcer; silent failures and the auto-send path announce there, and the card stays the only visible notice |
| 2 | HIGH: a manual submit during a resumed send returned early, so the composer cleared the text; a later 4xx lost the question | Fixed. `send()` throws "Still sending the previous question." while pending; `resumePending()` clears only text that still matches what it sent |
| 3 | HIGH: text typed while a send is in flight is discarded on success (`send()` clears the stored draft and `load()` rebuilds the composer) | Fixed at the user's request, although the bug was already on `9f143e7` and affected every Ask send. `send()` saves differing composer text as the draft before `load()`; `composer.submit()` clears only the sent text |
| 4 | HIGH: a send that finished after the user left (discarding drafts) restored the discarded text | Fixed. The draft is saved only while `token === epoch`; a stale completion removes it as before |
| 5 | Branch `9f143e7..working tree` | **PASS**, no findings |

Rounds 4 and 5 reviewed the whole branch against `9f143e7`. Tests added (each failed before
its fix): edited or cleared draft on resume, announcer content, overlapping submit followed by
a rejected send, typing during a normal and a resumed send, and a stale send after leaving.
After the fixes: UI suite 199 pass, 0 fail.

## Risks and next action

- Not verified: a completed model answer, citations, the source panel and Generate plan.
  Local Ollama runs llama3.2 on CPU only here. One answer was still pending after 5+ minutes,
  and a direct 10-token request timed out after 60 s. Needs a faster provider (for example,
  the Claude CLI profile).
- The new READMEs change demo snapshot revisions and add one file per repository. Anything
  that pins example file counts or revisions outside `tests/` would need updating;
  none was found in `tests/`.
- `css.mjs` does not evaluate `:not(...)`, so the overlay test checks only the focused state.
- Environment note: run the app with `.venv/bin/python`. The system `python3` lacks
  `keyring`, so GitHub setup reports the secure store as unavailable.
- No background processes from this task besides the throwaway app on 8765, which uses a
  scratchpad data dir.
- Reviewer: independent (Codex). Scope: `ask.js` resume path (pending-question state, epoch
  guards, error handling when the scope update succeeds but the send fails), the silent
  error contract between `ask.js` and `composer.js`, draft preservation in `send()` and
  `composer.submit()` (which now changes every Ask send, not only resumed ones), and the
  accuracy of the README text. Review the branch head against base `9f143e7`.
