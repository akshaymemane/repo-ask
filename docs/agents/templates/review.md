# Independent review — <task ID>

- Reviewer/harness/session and persona:
- Author and exact reviewed commit:
- Commit-bound packet path and manifest identity:
- Requirement IDs, contracts and handoff read:
- Decision: changes requested / approve exact commit / blocked

## Findings

| Severity | File and line | Requirement / contract | Evidence and requested fix |
| --- | --- | --- | --- |
| <blocking / major / minor> | <path:line> | <ID> | <reproduction or reasoning> |

Use “No findings” only after describing review coverage. Do not invent runtime checks.

## Coverage and limitations

List code paths, failure cases and evidence inspected. Distinguish author-provided results,
independently reproduced checks and tests requested from the integrator. Reviewers do not
edit author code. Approval binds to the exact commit; material follow-up changes need review.

## Integration recommendation

State remaining gates, security review needs and affected combined checks. Approval is
not authorization for external publication or a statement that the branch was integrated.
