# Independent review — M2-GENERATED-OMIT

- Reviewer: Claude quality-reviewer with boundary checks (fresh, read-only). Author: Codex runtime builder
  (coordinator committed because the builder sandbox could not write the git index lock).
- Exact commit: `fb1ba26`; base `62f33cd` (includes coordinator contract commit `e74bb3b`).
- Decision: **approve exact commit fb1ba26**. Two minor follow-ups (owner: runtime).

## Findings

| Severity | Location | Finding | Requested fix |
| --- | --- | --- | --- |
| minor | sessions/publication.py:47-52,61-62; publication/service.py:114-118,375-376; tests | Anti-relabel and overlap guards are correct but untested: forged non-generated path labelled excluded_generated/added, base-tracked path labelled added, duplicate omitted path, omitted∩changed/deleted, publisher omitted mismatch/overlap. Not exploitable (omitted bytes never enter `changed`). | Add focused tests (a)-(e). |
| minor | publication/service.py:169-171, 230-232 | Omitted path list is appended last and the body is truncated at 65536 without a marker; large Python repos can exceed it. Totals still shown as `rejected: N`. | Cap listed paths ("and K more"), state the count, keep within budget; consider capping preview `omitted_paths`. |

## Verified (code reading)

Exact rule (`excluded_generated` AND `added`) in snapshot and publisher; every other reason, and generated paths that are
modified/deleted, still block; omitted paths re-validated against the base manifest and `publication_rejection` (precedence
prevents .git/hook/shadow relabel); omitted entries never uploaded and overlap rejected in snapshot, `_snapshot` and `_entries`;
integrity checks intact (`stats.rejected == len(omitted)`, checkpoint/patch lists equal); eligibility counts only blocking
rejections, with a conservative fallback; stored outcomes not reinterpreted (old sessions need a new run). Coordinator ran the
full Python suite OK (9 skipped) and 228/228 UI on `fb1ba26`.
