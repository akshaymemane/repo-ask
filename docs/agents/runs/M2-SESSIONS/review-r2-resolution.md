# Review R2 resolution

Candidate base: `02843c32e1c4b7991663acd57939e90673369773`

All four R2 major findings are addressed in the next candidate:

- Tool broker authorization now re-resolves current profile consent and image at
  the pre-call guard, transactional admission, and post-call guard.
- Artifact listings apply the same live-source policy as diffs, events,
  validations, and messages; hashes and byte counts are tombstoned on loss.
- Retry can repeat the predecessor's exact immutable plan version after a newer
  version exists, while retaining fresh access, implementation, exclusions,
  profile permission, deletion, and containment checks.
- Automatic publication eligibility now requires the on-success policy, a
  reviewable checkpoint, zero rejected paths, every required validation passed,
  non-stale artifacts, confirmed containment, and current source authority.

Verification:

- `python -m unittest discover -s tests -p 'test_sessions_review.py'` — 23 passed.
- `python -m unittest discover -s tests -p 'test_sessions*.py'` — 56 passed,
  3 skipped (Docker-dependent).

The existing AF_UNIX `ResourceWarning` appeared once in the broader slice and
does not fail the suite. The candidate still requires fresh independent review;
this document is author evidence, not approval.
