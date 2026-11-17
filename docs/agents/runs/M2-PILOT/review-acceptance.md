# Independent review — M2-PILOT

- Reviewer/harness/personas: independent Codex session; quality-reviewer + security-reviewer; opposite harness to the Claude pilot coordinator.
- Author and exact reviewed commit: integrated team implementation, Claude coordinator; `8e97370d65f32de5f963400f03a400cb4f6709ab`, `work/opendevin-integration`.
- Worktree: `../opendevin-review-m2-pilot`; read-only, no edits.
- Commit-bound packet: Git checkout at the exact SHA above; pilot `evidence.md` and `evidence.json`. No separate content-hash manifest supplied.
- Requirements/contracts read: Master PRD M2 exit/completion rules; F05 SE-01–12; F06 PR-01–11; publication contract; requested personas, workflow, board, review records and README instructions.
- Decision: **approve exact commit**. No release blockers identified.

## Findings

All entries below are non-blocking follow-ups. Owners are assigned here where the pilot left them unassigned.

| Severity | File and line | Requirement / contract | Evidence and requested fix |
| --- | --- | --- | --- |
| Minor | `docs/agents/runs/M2-PILOT/evidence.md:26` | UX finding 1 | Repository status incorrectly shows “Off” after indexing. **Experience owner:** align status with actual catalog/index state. |
| Minor | Same, `:27–28` | UX findings 2–3 | Profile selection and session launch are difficult to discover, but the documented route works. **Experience owner:** expose profile choice and make “Start session” accurately describe its action. |
| Resolved | Same, `:29` | UX finding 4 | Stale M2 copy fixed in `f931041`, independently reviewed. |
| Minor | Same, `:47` | UX finding 5 / PR-04 | Generic default title is editable. **Experience owner:** derive it from the plan goal. |
| Minor | Same, `:48` | UX finding 6 / PR-02 | Preview omits the generated-path list; PR body discloses it and bytes are excluded. **Experience owner:** display `omitted_paths` before publication. |
| Minor | Same, `:49` | UX finding 7 | Timeline reports the actual CLI default; profile offers no model selector. **Integration owner:** clarify selection and expose supported configuration. |
| Minor | Same, `:59–60` | UX finding 8 | Latest-attempt retry restriction is correct; `retry_exists` lacks useful guidance. **Runtime/experience owners:** explain and link the successor attempt. |
| Minor | `docs/agents/board.json`, M2-PILOT/M2-INTEGRATE cards | Coordination accuracy | Board still records prerequisites as pending despite later evidence. **Coordinator:** reconcile status with this acceptance decision. |
| Minor | `docs/agents/runs/M2-PILOT/evidence.md:18–21` | Content-free evidence | `evidence.json` is content-free; the Markdown log includes short synthetic calculator source fragments. No credentials or private source found. **Coordinator:** remove snippets if strict source-free coordination artifacts are required. |

Existing minor follow-ups remain owned: runtime owns snapshot diagnostics/normalization/test coverage and omitted-list truncation/guard tests; integration owns the adapter test’s reused launch marker. These do not demonstrate a reachable publication or containment failure.

## Coverage and limitations

The recorded live pilot satisfies the representative task gate: explicit source consent and publication authorization; GitHub-connected disposable repository; prompt → cited immutable plan → real isolated session → actual fix and successful in-container validation → manually published draft PR #1. Captured read-only GitHub results confirm one changed file, configured commit identity, no bytecode, and unchanged `main`.

Cancellation reached `cancelled` in 1.2 seconds with confirmed containment and no remaining session containers. SIGKILL recovery terminated the recorded container, marked the attempt `interrupted/runtime_interrupted`, and disclosed possible checkpoint loss. Earlier Docker/model proofs provide additional isolation, validation and cancellation evidence.

| Acceptance scenario | Evidence classification |
| --- | --- |
| F05 pinned launch, isolated execution, events/diff/checks | Live pilot; service/runner integration tests supplement |
| F05 reconnect/replay | Service and UI integration tests; no explicit live reconnect exercise recorded |
| F05 stop and interruption recovery | Live pilot plus recovery tests |
| F05 unsupported scope, failed/unavailable checks, containment failure, budgets and follow-up boundaries | Recorded automated coverage; not all exercised live |
| F06 scenario 1: accurate draft PR | Live pilot plus producer/publisher integration |
| F06 scenario 2: double-click, lost response, restart yield one PR | Automated service/recovery coverage; no live GitHub fault injection |
| F06 scenario 3: failed publication preserves artifacts and avoids duplicates | Automated coverage; live permission-denial recovery supplements |
| F06 scenario 4: empty diff and protected/default branch safety | Automated coverage; live default branch unchanged |
| F06 scenario 5: explicit automatic policy and validation gate | Automated coverage; pilot used manual publication |
| F06 scenario 6: permission revocation | Service tests and real producer/publisher integration; live missing-permission denial |
| F06 scenario 7: stale preview/conflicting base | Automated coverage; live base was unchanged |

The three pilot-discovered defects are closed with reviewed fixes and subsequent live evidence:

- Plan preflight wiring: `f931041`, independently approved; plan became ready.
- Generated artifacts: `fb1ba26`, independently approved; successor attempt omitted only newly added generated files and published the intended change.
- Read-only App manifest: `5048484`, independently approved; explicit permission upgrade and installation acceptance enabled publication while per-call token scopes remained narrow.

Publication review history also closes the earlier purge fencing, uncertain-outcome reconciliation, recovery races and UI retry issues. Setup and recovery instructions are present in README.

Independently reproduced: **9 publication API tests passed**. With `PYTHONPATH=tests`, all four publication integration tests were **environment-blocked during temporary-directory setup**, before assertions. The original command also exposed an import-path dependency. Full-suite, Docker, model and GitHub results remain supplied evidence; I made no network calls or live runtime claims.

## Integration recommendation

Accept the M2 exit gate at this exact commit. Recorded behavior meets the documented single-repository, single-adapter scope; operational failures are inspectable and setup/recovery guidance exists. Track the minor follow-ups above and update coordinator-owned status. This review grants no additional publication or merge authorization.

Verdict: M2 accepted at 8e97370