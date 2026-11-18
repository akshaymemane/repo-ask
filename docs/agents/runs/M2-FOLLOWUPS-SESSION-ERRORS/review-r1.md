# Verdict

Changes requested: one major privacy regression in 855f9f2. No blocking finding in fc95197.

## Reviewed commit

Branch `task/session-errors`, exact HEAD `855f9f2c439a012deb1f3fa8ea23b5cc4c829b01`; reviewed `git diff 9766f5a..HEAD`, comprising fc95197 and 855f9f2. Review performed independently of the Claude author. Read AGENTS.md, Master PRD.md, quality-reviewer persona, workflow, F02/F05 specs and docs/contracts/m2-sessions.md. No task-local card/handoff was present at the requested run path; the user's review assignment supplies scope. Only this review file was written; no commit made.

## Findings

1. **Major / P1 — deleted credential lines escape all shared guards** (`repoask/platform/credentials.py:12`; IX-03 and session privacy boundary). The new negative lookbehind rejects every hyphen immediately before `sk-`, including the deletion marker in a unified diff containing a real bare key. For synthetic `key = 'sk-' + 'A' * 40`, `patch = '@@ -1 +0,0 @@\n-' + key + '\n'` was detected by the old regex. At this HEAD, `decode(patch.encode())` returns the patch, and both `redact_text(patch)` and `export_text(patch)` retain the complete key. This affects diagnostic/diff text even when credential assignments elsewhere get additional caller-specific redaction. A saved patch can also pass the indexing content guard. Narrow the false-positive exception rather than excluding all hyphen-adjacent keys, and add deleted-line privacy coverage across consumers. Owner: author; integration should wait for a fix and exact-commit re-review.

Reproduction (synthetic values only; run from repository root with the requested interpreter):

```python
import re
from repoask.indexing.safety import decode
from repoask.sessions.redaction import redact_text
from repoask.ask.common import export_text
key = 'sk-' + 'A' * 40
patch = '@@ -1 +0,0 @@\n-' + key + '\n'
assert re.search(r'\bsk-[A-Za-z0-9_-]{20,}\b', patch)  # previous behavior
assert decode(patch.encode()) == patch
assert key in redact_text(patch)
assert key in export_text(patch)
```

## Checks

- Requested interpreter: `../repo-ask/.venv/bin/python`. `-m unittest discover -s tests -p test_credential_detection.py`: **4 passed**, including real storage/embedding guard coverage with synthetic inputs.
- `REPOASK_TEST_PYTHON=../repo-ask/.venv/bin/python node --test tests/ui/*.test.mjs`: **303 passed, 2 failed**, reproduced in a second run. Both failures are in `tests/ui/session-services.test.mjs:22` and `:55`, during bootstrap at `tests/ui/session-service-bridge.py:65`: synthetic execution-profile check returns `execution_test_failed`. These failures prevent full integration approval; their underlying cause was not established by this review.
- `node --test tests/ui/session-errors.test.mjs`: **1 passed**, also passed within the full suite.
- Broader `PYTHONDONTWRITEBYTECODE=1 ../repo-ask/.venv/bin/python -m unittest discover -s tests` was attempted with output piped through `tail -25`, then interrupted (exit 130) before a result; no full-regression pass is claimed. The sandbox denied `ps`, so child-process state could not be independently inspected.
- Additional in-memory probes: **45 passing placement/format cases** (plain, ant and proj `sk-` formats). Each checked contains_credential, session contains_secret, indexing decode rejection, session redact_text and export_text removal. Placements: start, single/double quotes, equals, colon, whitespace, brackets, newline/start of line, JSON, `KEY=...` env syntax, URL query `?key=...`, Authorization with/without Bearer, spaced list marker and parentheses. Additional hyphen-prefix probes exposed finding 1. These probes were executed without editing tests; the reproduction above preserves the failure evidence.
- All eight ERROR_TEXT codes exist: retry_exists, session_active, plan_not_ready, publication_in_progress, purged, idempotency_conflict and source_unavailable are raised in `repoask/sessions/service.py`; runtime_in_use is documented in `repoask/sessions/errors.py` and produced by runtime leadership/preflight. Wording matches the underlying conditions. Minor precision: holding runtime leadership does not prove a session is currently executing, although it does mean another process owns session processing.
- Retry conflict refresh does not recurse or POST: it calls the guarded refresh once, then returns; refresh schedules ordinary read polling. Epoch checks prevent stale-view updates. Existing 4xx key clearing is unchanged; network/5xx/unknown outcomes retain the retry key, and base_advanced preserves it. Server retry checks the same idempotency key before successor existence, so same-key reconciliation still returns the existing session. A busy refresh may defer visibility until polling, but does not loop retries.
- Searched all `repoask/web` executionRequest references and message comparisons. Consumers branch on structured code/status, not the previous humanized error.message strings; remaining message comparisons concern agent output. No wording-dependent caller regression found. HTTP error code/status/details and safe fallback remain preserved.

Sandbox limits: workspace-write with restricted network and approval policy never; no permission bypass, package installation, real provider calls or remote writes attempted. UI bridge failures are reported as observed, not assumed to be caused by the sandbox. Browser evidence uses the repository DOM harness, not a live browser. No real Docker/provider/publication pilot was performed.
