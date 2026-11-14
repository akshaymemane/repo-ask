# Proposal to root: limited trusted follow-up callback for ToolBroker

Status: proposal only. `repoask/execution/broker.py` is NOT edited by M2-SESSIONS; this
needs root acceptance, a producer-owner assignment and independent review first.

## Problem

`ClaudeAdapter` has no proven stdin/resume follow-up channel (`follow_up: false`).
Today `send_message` without `question_id` stays `queued` with reason
`follow_up_unsupported`, and becomes `rejected/session_ended` when the attempt ends.
It is never reported as delivered.

## Minimal interface (no tool inventory change)

```
ToolBroker(runner, handle, *, guard, emit, checkpoint=None, ask_user=None,
           excluded_paths=(), annotate=None)
annotate(tool_name: str) -> str | None
```

- The broker calls it only for a call that already passed the post-call guard with
  `ok=True`, right before it returns the result. It never calls it for denials/errors.
- When the callback returns text, the broker appends
  `"\n\n[Message from the user via OpenDevin]\n" + text[:8000]` to the tool result,
  emits `tool_annotated {tool, chars}` and returns. Exceptions mean no annotation.
- The service picks the oldest queued generic message, marks it `delivered` inside the
  fenced transaction before returning text, and `acknowledged` on the matching
  `tool_finished` (broker returned it). If no later tool call happens, the message
  stays queued, and is then rejected at the end. Delivery is never faked.
- Annotations carry user text only. They cannot add tools, grants, paths or scope.
  The material-change filter (`plan_amendment_required`) still applies before queueing.
- The tool names/schema and the adapter's exact seven-tool inventory check stay as they are.

Tests the broker owner would add: annotation only after allowed calls; none after a
denial or stop; bounded size; no annotation once the broker is closed.
