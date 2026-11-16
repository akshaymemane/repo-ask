# M2-PRS round 2 findings (consolidated by the coordinator)

Reviewed commit `5a551d1`. Security reviewer (Claude, fresh): **approve** with 2 minor. Quality reviewer
(Claude, fresh): **request changes** — round-1 items 1-3, 5-9, 11-17 resolved; 4 and 10 partial.
Line numbers refer to `repoask/publication/service.py` at `5a551d1`.

## Must fix

N1. MAJOR `retry()` (580-598, with 562) leaves the old job stuck. If `recover()`'s read times out, the row
    stays pending and job X unresolved; the second `reconcile()` then succeeds, retry enqueues Y and sets
    `job_id=Y`; X is never resolved and `recover()` (joins `p.job_id=j.id`) can never find it again →
    workspace permanently degraded. Fix: in the enqueue transaction refuse while the current job is
    `needs_reconciliation`, or resolve it there first; or act only on the outcome `recover()` reached.
    Test: first reconcile read fails, second succeeds, `counts()['needs_reconciliation']==0` after retry.
N2. MAJOR overlapping `recover()` (560-572; `_state` 264-281 outside a run). Rows are read outside a
    transaction, then forced to `reconciling` and `resolve_reconciliation` called without rechecking. A
    double-clicked retry or a retry during startup recovery can (a) raise `InvalidTransition` (platform
    error, not PublicationError) so a same-key retry fails; (b) write `reconciling` over a row whose new job
    Y is already leased, so the live worker's fence sees `reconciling` and ends terminal
    `blocked/publication_stopped`. Also a PublicationError inside reconcile's handler on a now-terminal row
    escapes `recover()` and aborts the startup loop. Fix: move to `reconciling` in one conditional
    transaction (`j.state='needs_reconciliation' AND p.job_id=j.id`); treat InvalidTransition on resolve as
    already resolved (or serialize recover with a lock); catch per-row errors. Add an interleaving test.
N3. MAJOR (coordinator) snapshot cost and lock scope. `_fence` and `_public` call
    `sessions.publication_snapshot` (base64 file bytes) at every fence, per blob, and on every
    `get()`/`_state`, partly inside `BEGIN IMMEDIATE`. The real `SessionService.publication_snapshot`
    (now approved on task/m2-pub-snapshot, `23e836c`) opens its own store reads and decodes artifacts:
    quadratic cost and nested store access under the write lock. Fix: `get()`/`_public`/`_state` must not
    call the snapshot — persist the content-free check summary at publish time (and update it only from
    run facts); fences revalidate eligibility once per external step outside any write transaction, and may
    reuse the bound snapshot within one step. You can read the real producer with
    `git show 23e836c:repoask/sessions/publication.py` and `git show 23e836c:repoask/sessions/service.py`.

## Minor (fix in this round)

N4. `refresh` (609-610): type-check `pr` (dict, matching number) → `pull_request_invalid`, return safe row.
N5. `compare` (client 264-265): `previous_filename` must be absent, None or str, else `malformed_output`.
N6. Manual failed-check test (tests 319-324): assert `published` and that the disclosure reached
    `create_pull_request` (record the body in the fake).
N7. `reconcile` with no commit (527-530): go to `queued` before any remote read when `commit_sha` is NULL.
N8. Assert the `get()` check-summary unavailable branch (or its replacement after N3).
