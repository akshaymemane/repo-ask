# Follow-up: saved plan is hard to read (deferred)

Reported by the user on 2026-11-16 after the first real plan on Groq gpt-oss-120b
(`laundro_frontend_v2`, "integrate a payment gateway", 6 steps). The user accepted
this as future work; it does not block M1 sign-off.

## What the user saw

Conversation thread:
- The assistant message is the raw text `Plan saved: plan_<id>`, followed by an empty
  info icon row and a divider. The plan card below it carries the real information.

Plan view (main pane plus details panel):
1. The main pane is almost empty: a title, "Open plan editor", the user request and
   the same `Plan saved:` line. The plan content itself (findings, steps, validation,
   risks, questions) is not shown as a readable document anywhere.
2. The details panel starts with internal identifiers: version ID, a SHA-256 that
   overflows the panel, the commit hash repeated several times, snapshot IDs and the
   raw repository ID `gh:748959122` instead of `laundro_frontend_v2`.
3. Readiness is shown as raw codes (`base_choice_required, blocking_questions,
   execution_not_configured, implementation_not_permitted`, `source_stale`) with no
   plain-language explanation or next action.
4. Citations are grey centered blocks with full commit hashes; they are not
   clickable-looking and are hard to scan.
5. The editor form is laid out inline: labels sit beside or after small textareas
   ("goal", "user request", "requirements (one per line)", "risks (one per line)")
   and wrap unpredictably. Fields are too small to read the content.
6. M2 execution and publication controls (execution profile, publication policy,
   "Retain pinned base") appear in the M1 plan view while execution is parked.
7. Blocking open questions, the main thing a user must act on, are not prominent.

## Suggested direction (for the experience owner to shape)

- Render the saved plan as a document in the main pane: Goal; Requirements;
  numbered Steps with paths and citation chips that open the code viewer; Validation;
  Risks and assumptions; Open questions with blocking ones highlighted and an inline
  answer field.
- Thread message: replace `Plan saved: <id>` with the plan card only.
- Move identifiers (version, hash, snapshot, revision) into a collapsed "Details"
  section; show repository names, short revisions.
- Translate readiness codes into sentences with a next step, e.g. "Answer 2 blocking
  questions" or "Execution is not set up (coming in M2)".
- Edit mode as a separate stacked form (label above full-width field).
- Hide execution/publication controls while M2 is parked, or collapse them under
  "Implementation (M2)".
