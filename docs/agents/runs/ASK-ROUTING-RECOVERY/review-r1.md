# Independent review — ASK-ROUTING-RECOVERY

- Reviewer/harness/session and persona: Codex (`codex-cli`, independent session, quality-reviewer persona).
- Author and exact reviewed commit: Claude; `1eaee632fe4e41bd4ad8bbd58922293f6457557e`.
- Branch/worktree: `task/ask-routing-recovery`; detached checkout at `/Users/apple/workspace/vibe-coding/opendevin-review-ask-routing-recovery`.
- Base: `9f143e7`.
- Commit-bound packet path and manifest identity: Not supplied; reviewed Git objects directly and verified HEAD.
- Requirement IDs, contracts and handoff read: AGENTS.md, workflow, reviewer persona, review template, author handoff, Master PRD, F03/F04 specifications and `docs/contracts/m1-ask-plans.md`. Relevant requirements: RT-05/06/07, ASK-01/02/05/09.
- Decision: **approve exact commit 1eaee63**

## Findings

Reviewed routing recovery, draft preservation, asynchronous completion and adjacent Ask flows as described below. **No findings.**

## Coverage and limitations

Inspected `git diff 9f143e7..1eaee63` and all three commits in `git log 9f143e7..1eaee63`.

Coverage included silent routing errors and announcements, edited/cleared pending prompts, repository selection, overlapping sends, successful and rejected submissions, epoch guards, autosend, landing send, plan editing, cancel/retry and navigation guards.

Checked all four example READMEs against their sources. Their descriptions are consistent with the examples. The changes add sample indexing/routing evidence; they do not modify routing algorithms or permissions for other repositories. Reviewed the recovery test’s updated file counts.

Independent checks:

- `node --test tests/ui/*.test.mjs`: **195 passed; four blocked by sandbox filesystem restrictions** affecting temporary-directory creation. All added Ask tests passed. A repeat confirmed the same four environmental failures.
- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests`: unsuccessful under this sandbox—518 tests discovered, 392 errors, 12 failures, nine skipped. Temporary-storage and socket restrictions prevented a usable regression result; this is not evidence of product regressions.
- No files edited.

The author’s reported full-suite and Chrome results remain author-provided evidence. I did not independently verify real-browser layout, screen-reader announcements or completed provider-backed answers. The CSS test verifies declarations, not actual pointer behavior.

## Integration recommendation

The coordinator may integrate this exact commit after rerunning the affected UI and Python checks in an environment permitting temporary files and sockets. Confirm focused-heading click behavior in a real browser and complete a provider-backed answer/citation/plan smoke check.

No additional security-boundary review is indicated by this diff. Approval does not authorize publication or assert integration has occurred.