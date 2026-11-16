# Independent review — M2-PUB-SNAPSHOT

- Reviewer: Claude quality-reviewer (opposite harness to the Codex author), read-only session.
- Exact reviewed commit: `23e836c` on `task/m2-pub-snapshot`; base `97f8c30`.
- Packet: detached checkout `opendevin-review-m2-snapshot` with `.review-packet/` (diff, coordinator test results).
- Decision: **approve exact commit 23e836c**. No blocking or major findings.

## Findings (all LOW, recorded as follow-ups)

| Severity | File and line | Finding | Requested fix |
| --- | --- | --- | --- |
| LOW | repoask/sessions/publication.py:70-71 | Secret-content rejection reports `rejected_paths` although the UI shows no rejected path. | Use a distinct code (e.g. `sensitive_content`) and test it. |
| LOW | repoask/sessions/publication.py:50-52 | Rejection checks the normalized path but exports the original key (`./x`). Consumer regex rejects it; impact low. | Require `validate_relative_path(path) == path`. |
| LOW | tests/test_sessions_publication_snapshot.py:196-202 | The byte_count half only proves a DB CHECK, not the code branch. | Rename or reword. |
| LOW | tests/test_sessions_publication_snapshot.py | Missing cases: rejection by count only, workspace_mib/max_files bounds, invalid policy, zero/multiple write repositories, missing runner row, secret branch, automatic-eligible happy path through the consumer. | Add focused cases. |

## Coverage

Verified by reading code: exactly the 16 contract keys; outcome/validations carry no container id, PID,
socket, token or host path; checkpoint built from the latest verified capture with hash, byte_count,
base_sha and per-file agreement checks; modes limited to 100644/100755; symlinks rejected at capture;
failure codes for source unavailable/purged/excluded (live policy hash), stale/redacted artifacts,
non-terminal session, unverified containment, rejected paths; frozen size limits; compatibility with the
publisher's `_snapshot`, `_entries` and `_automatic_ok`. Reviewer ran no commands; coordinator ran
`test_sessions*.py` 74 OK (3 skipped) and the full suite 541 OK (9 skipped) on `23e836c`.
