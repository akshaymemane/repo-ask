- Reviewer: Codex, independent quality reviewer; read-only.
- Exact comparison: `29209a3..1f29044`; author: Akshay Memane / Claude co-author.
- Sources: master PRD, F07, workflow, reviewer persona, M1 services contract and provider handoff. No commit-bound packet or redesign task card was supplied.
- Decision: changes requested.

## Findings

| Severity | File and line | Requirement / contract | Evidence and requested fix |
| --- | --- | --- | --- |
| MEDIUM | `repoask/web/app.js:1108` | AI-06; accurate policy display | Removing the policy form also removes its `executionUI.refresh()` call. The remaining Privacy switch only PATCHes settings (`settings.js:115`). Change local-only, then open Coding agent: its cached “Workspace local-only” message still reports the previous value until manually reloaded. Refresh execution settings after a successful Privacy change. Backend enforcement remains intact. |
| MEDIUM | `repoask/web/app.js:1136` | AI-02; consistent model assignments | The new automatic remount can race an existing `mountModels()` request, which has no generation guard. For example, an Ollama Refresh captures profiles, then waits on discovery; an advanced profile save finishes and renders fresh pickers; the older discovery finishes last and replaces them with stale profiles/assignments. Add a per-host generation fence to `mountModels()`, including its error path. |
| LOW | `repoask/web/app.js:1162` | Accessible, usable forms | Hiding the dimensions label leaves its number input enabled and subject to browser validation. Enable Embeddings, enter `0` or `20000`, then disable Embeddings: saving the otherwise valid chat profile is blocked by an invisible invalid control. Disable the dimensions input whenever Embeddings is unchecked; retain the existing conditional payload construction. |

## Coverage and limitations

Inspected removed role/policy flows, secret clearing, mutation guards, focus restoration, refresh callbacks, accessibility markup, CSS selectors and test changes. No files edited.

Independently ran `node --test tests/ui/*.test.mjs`: **198 passed; 4 were blocked by the read-only sandbox’s temporary-directory restrictions**. Browser layout and native constraint validation were assessed from code, not exercised in a real browser.

## Integration recommendation

Fix the findings and add focused regression coverage for policy refresh, stale Models responses and hidden invalid dimensions. Rerun the UI suite with writable temporary storage.

**Verdict: request changes.**