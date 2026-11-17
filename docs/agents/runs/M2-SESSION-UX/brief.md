# M2-SESSION-UX design brief (coordinator)

Direction: a tool people return to many times a day. Dense, calm and scannable, matching the redesigned
dark UI (tokens in styles.css; the Settings redesign is the most recent reference). One memorable detail:
a **result summary** at the top of every finished session that says, in plain words, what happened and
what to do next. No new dependencies. Backend/API unchanged — UI only.

Audit of the current UI (live app, pilot sessions: completed+published, cancelled, interrupted):

## Sessions list (#/sessions) and sidebar
- Rows are walls of raw identifiers (ses_…, pv_…, gh:1460459675, 40-char SHAs). Show per row: status badge
  (colour + text), plan title (primary, links to the session), repository name (not gh:id), "attempt N",
  relative time and duration, short base SHA. Raw ids only in a title attribute or details.
- Filter area is oversized: compact toolbar (search, state filter, repository filter); the date filter
  small or folded; drop "N visible of M loaded…" unless filtering; Reload becomes a small icon/text button.
- Empty and loading states are calm and useful (link to Ask).
- Sidebar "Recent sessions" shows "gh:1460459675 · attempt 1": show a short plan title plus
  "repository · attempt N · status".

## Session detail (#/sessions/<id>)
- Layout uses the available width (main column + side pane, e.g. up to ~1280px), not two cramped columns.
  Mobile stacks.
- Header: plan title, status badge, repository name, base branch @ short SHA, attempt N with previous /
  successor links, elapsed. Primary actions in the header by state: Stop (running), Retry as a new attempt
  (terminal), Create draft PR / View draft PR (when available; jumps to the PR tab).
- Result summary card for terminal states, in plain language, plus the agent's final message (rendered as
  text, never HTML): completed → "Changes ready for review: 1 file, +1 −1, checks passed"; cancelled →
  "Stopped by you; the container was removed"; interrupted → "OpenDevin stopped while this session ran. The
  container was cleaned up; edits after the last checkpoint may be lost." + Retry; failed → the error in
  plain words with the code in small print. Replace "completed · completed".
- Timeline: readable entries (icon/marker, short label, relative time; exact time and #seq in title).
  Collapse setup transitions (queued, access check, source acquired, provisioning) into one "Set up" group;
  keep agent work groups; checkpoints read "Checkpoint saved · no changes" or "+1 −1 in 1 file"; the
  agent's messages styled as messages.
- Connection: a small live indicator (Live / Reconnecting / Offline) instead of the sentence; Reconnect
  only when not live.
- Composer only while the session can receive input; label "Send guidance", and "Answer the agent's
  question" when a question is pending (keep the existing question_id targeting). On terminal sessions show
  a one-line "This session has ended" with the retry action instead.
- Progress tab: plan steps with an overall state (running / done / stopped); keep the honest note that the
  agent does not report per-step completion, but small.
- Diff tab: summary "1 file · +1 −1 · base main@2605d80"; show the unified diff inline with +/− colouring,
  expanded by default for small diffs; omitted/rejected paths listed with plain-language reasons
  (generated files left out); hashes and artifact ids folded into details.
- Checks tab: each check as command (code block), pass/fail badge, duration, output; environment (image
  digest, cwd, network) folded.
- Keep every existing behavior (stop, retry, follow-up/questions, reconnect/replay, publication panel,
  focus management, live regions) and their tests; update tests that pinned removed copy so they still
  prove the behavior.
