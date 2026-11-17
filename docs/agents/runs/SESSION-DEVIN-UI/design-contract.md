# Session workspace design contract

- Product surface: session detail at `#/sessions/<id>`.
- User job: supervise a coding agent, understand its current phase, inspect its work, intervene safely, and review the result without losing context.
- Primary actions: send guidance while active; inspect Diff and Checks; create or open a draft PR after completion.
- Hierarchy: command header → execution phase rail → workstream → persistent workspace inspector.
- Direction: dense, calm engineering cockpit. The phase rail is the memorable orientation device.
- Reference observations: Devin-style workspaces keep the agent conversation/activity beside persistent engineering tools rather than presenting equal-weight dashboard cards. OpenDevin maps that pattern to the capabilities it actually has: plan, diff, checks, publication, and run details.
- Target viewports: 1440×900 desktop and 768×900 compact/tablet.
- Constraints: static DOM/CSS, no new dependency, existing dark/light tokens, keyboard-operable tabs, safe text/Markdown renderer, current session safety semantics unchanged.

## Content states

- Loading: stable header/workspace skeleton and explicit loading copy.
- Empty: session index explains how to create the first session.
- Error: connection/result states retain recovery actions and error codes.
- Partial: unavailable source, diff, checks, or plan data remains explicitly labeled.
- Success: result summary leads to Diff, Checks, and draft PR review.
- Permission: source-policy redaction removes source-bearing activity and artifacts.
