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
| UI suite | `node --test tests/ui/*.test.mjs` | 194 pass, 0 fail |
| Python suite | `.venv/bin/python -m unittest discover -s tests` | 523 OK, 9 skipped |
| New tests fail without fix | Ran each new test against the base files | Notice test: 2 notices instead of 1. Overlay test: `position` not `absolute` |
| Routing on fresh store | `POST /api/route` | "How does checkout create an order?" → `needs_selection` with all four; "What does the outbox table store?" → orders-db; "quantum flux capacitor" → `no_match` |
| Chrome, fresh data dir | Asked a question that matches no repository | Card shown once, no status line; focused heading shows as an overlay pill |
| Chrome, fresh data dir | Clicked Choose… once | Picker opened on the first click |
| Chrome, fresh data dir | Picked orders-api → Add | Card cleared; question sent automatically; Cancel → "Cancelled." with Retry |
| Chrome, fresh data dir | Asked the checkout question | "Which repository?" card with orders-api, orders-db, notifications-worker, storefront-web |

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
  error contract between `ask.js` and `composer.js`, and the accuracy of the README text.
