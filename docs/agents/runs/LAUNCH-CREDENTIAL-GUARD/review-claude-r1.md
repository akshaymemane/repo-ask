# LAUNCH-CREDENTIAL-GUARD review — Claude, round 1

Verdict: **APPROVED**

- Reviewed commit: `6d35b04` (author: Codex, retrieval/platform builder)
- Reviewer: Claude (coordinator for the launch-readiness wave), opposite harness

## Findings

None blocking.

Advisory (not required for approval):

1. **Minor — `sk-` can match after a leading hyphen.** `repoask/platform/credentials.py:12`. `\b` treats `-` as a
   boundary, so a long kebab identifier such as the CSS custom property `--sk-button-background-color` matches and the
   whole file is excluded from indexing. Probe: `contains_credential('--sk-button-background-color: red') -> True`;
   `task-…`, `risk-…`, `sk-learn` correctly return False. Conservative (fails closed), so acceptable for launch. A
   follow-up could use `(?<![\w-])sk-` for the `sk-` alternative only.
2. **Note — existing indexes are not rebuilt.** Files that were indexed before this change keep their chunks until the
   repository is re-indexed or purged. There are no public installations yet, so no migration is needed for 0.1.

## Checks run (outside the author's sandbox)

- `python -m unittest discover -s tests` — 618 tests, OK (9 skipped, opt-in Docker).
- `node --test tests/ui/*.test.mjs` — 286/286.
- Probed true positives (`sk-` + 40 chars, `github_pat_` + 30 chars) and negatives listed above.
- The author's 69 failures / 99 errors were sandbox socket/process denials; none reproduce here.
