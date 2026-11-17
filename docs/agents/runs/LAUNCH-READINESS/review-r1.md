# LAUNCH-READINESS review — round 1

Verdict: **CHANGES_REQUESTED**

- Reviewed commit: `d3902bdd34c129b602454057bd18037e6b48b849`.
- Reviewed commits: `40d84de`, `d3902bd`; diff `437ef26..d3902bd`.
- Branch/worktree: `task/launch-readiness` / `./`.
- Reviewer: independent Codex quality reviewer; author: Claude.
- Inputs: AGENTS.md, reviewer persona, workflow, Master PRD, F03/F04 specifications, `docs/contracts/m1-ask-plans.md`, board and available review records. No launch-readiness task card or author handoff was present; the user's assignment supplies review scope. Relevant requirements: RT-03/05/06/07/09/10, Ask recovery and deletion/purge privacy, accurate release instructions.

## Findings

1. **Major — release documentation puts the coding agent inside the container, overstating the isolation boundary.**
   `README.md:25-27`, `README.md:138-139`, `SECURITY.md:30`, `CHANGELOG.md:30-32`.
   The particularly explicit changelog claim, “Claude Code in a network-less, capability-dropped container,” is false. `repoask/execution/claude.py:420-457` creates a host temporary working directory and launches the CLI through host `run_stream`; repository tools are mediated through the broker (`repoask/execution/broker.py:1-11`). The Docker flags apply to the runner (`repoask/execution/runner.py:715-721`), not the CLI. The host CLI needs network access to Anthropic and its own login. **Fix:** consistently distinguish the host coding-model process from repository commands/files in the network-disabled container; scope the capability/root/resource-limit guarantees to that container. Preserve the separate source-consent explanation.

2. **Major — a consumed repository choice resurrects when scope is later cleared.**
   `repoask/ask/conversations.py:95-110`, `repoask/ask/conversations.py:120`, restored by `repoask/web/ask.js:318-323`.
   `_pending_route` checks current scope only; choosing repositories never durably retires the routing decision. Independently reproduced with the real Ask test fixture: create an unscoped conversation, route `mail delivery`, set scope to `[repo]` at revision 1, then set scope to `[]` at revision 2 without sending a message. `get()` returns the original pending prompt/candidates again. The UI can then automatically submit that old prompt on another repository selection. This also occurs if a user clears the composer before choosing repositories, so no message consumes the route. It contradicts `docs/contracts/m1-ask-plans.md:181` (“Choosing repositories ... clears it”). **Fix:** durably mark the pending route consumed on successful scope selection, or bind pending eligibility to the conversation scope revision at route creation. Keep historical decisions for audit. Add a regression for scope add → clear → reload and for a cleared prompt followed by scope selection/removal.

3. **Minor — README references an image absent from the reviewed commit.**
   `README.md:11` references `docs/images/ask.png`, but `git ls-tree -r --name-only d3902bd docs/images` returns no files. The preview therefore has a broken screenshot when checked out or viewed on GitHub. **Fix:** include the image in the submitted commit or remove the reference. An untracked `docs/images/` appeared during review; it is outside this exact-commit approval.

4. **Minor — model-role wording promises unsupported Claude embeddings.**
   `README.md:30-31` presents Ollama, any OpenAI-compatible endpoint and Claude Code CLI as assignable to all listed roles, including embeddings. `repoask/providers/service.py:230-237` explicitly rejects an embeddings capability for Claude CLI. Endpoint capabilities also vary. **Fix:** say chat-capable providers serve answers/plans/summaries, and embeddings require an embedding-capable Ollama or compatible provider.

## Claim audit and CI inspection

The remaining implementation claims were traced to code, with the following scope and qualifications:

| Claims in README / SECURITY / CHANGELOG | Code evidence and assessment |
| --- | --- |
| Loopback, host/origin checks, single-user/no login | `repoask/__main__.py:63-78`, `repoask/__main__.py:302`; loopback server and request checks support the stated deployment boundary. |
| Memory demo, persistent state, local checkouts, eight-repository cap, model flag, default port | `repoask/__main__.py:260-318`, `repoask/platform/db.py:16-31`; CLI instructions match parser/composition. Bundled demos are loaded at `__main__.py:290-291`. |
| OS credential storage, fail closed, no plaintext fallback | `repoask/platform/keyring_backend.py:14-35`, `repoask/platform/keyring_backend.py:43-66`; explicitly selected platform vaults. The CLI login belongs to the external CLI, as SECURITY's final paragraph explains. |
| GitHub manifest, private app, permissions, callback, per-repository permissions | `repoask/github/service.py:49-87`, `repoask/github/service.py:89-112`, `repoask/github/service.py:578`; configuration and access checks support these claims. App ID itself is ordinary metadata, not a vault secret. |
| Committed snapshots, no repository build/install execution, file exclusions | `repoask/indexing/snapshots.py:9-19`, `repoask/indexing/snapshots.py:46-79`, `repoask/indexing/safety.py:53-67`; bounded Git object reads and explicit exclusions. Exclusion is a filename policy, not a guarantee that all secrets in arbitrary source are detected. |
| FTS and optional vectors | `repoask/index.py:166`, `repoask/platform/index_schema.py:37`, `repoask/indexing/vectors.py:18-41`; APSW loads sqlite-vec on its separate connection, avoiding dependence on stdlib SQLite extension loading. |
| Routing, citations, immutable versioned plans and launch checks | `repoask/ask/routing.py:17-120`, `repoask/ask/conversations.py:125-158`, `repoask/ask/plans.py:129-217`; implemented, subject to finding 2. |
| Local-only default, per-profile remote-source consent, synthetic connection tests | `repoask/providers/service.py:166-172`, `repoask/providers/service.py:463-468`, `repoask/providers/service.py:693`; execution consent is separately checked at `repoask/execution/claude.py:302-307`. |
| Sessions, stop/restart recovery, one writable repository, publication | `repoask/sessions/runtime.py:171-193`, `repoask/sessions/runtime.py:331-339`, `repoask/sessions/service.py:756-766`, `repoask/publication/service.py:223-248`, `repoask/publication/service.py:484-510`, `repoask/publication/service.py:564-666`; implementation supports the described mechanisms, subject to finding 1. Idempotent/reconciled publication is implemented; “never duplicates” is an intended invariant, not independently proven against live GitHub here. |
| UI routes, dark/light styling, keyboard/focus/touch targets | `repoask/web/app.js`, `repoask/web/styles.css`, UI suite; static implementation and DOM tests exist. No independent rendered browser, screen-reader or pointer-target certification in this review. |

The roadmap's “Done” and README's end-to-end assertion describe release acceptance, which code inspection alone cannot establish. Existing records include outstanding provider/browser acceptance qualifications; this review does not certify live GitHub, Docker, Claude or real-model operation. SECURITY's reporting-channel availability, seven-day acknowledgement, support policy, repository URLs, release history and governance/review-history statements are operational or historical assertions, not properties executable code can prove. Confirm them with the maintainer before publication. The reviewed diff also does not add a changelog entry for pending-route restoration.

CI's six Python matrix entries are Ubuntu/macOS × 3.10/3.12/3.13 (3.11 is not included). No Python 3.10 syntax incompatibility was found in product or test Python files. The UI job correctly sets `REPOASK_TEST_PYTHON`; three real-service bridges honor it. `tests/ui/services.test.mjs:16,26` still invokes `python3` directly, but setup-python normally supplies both names on these runners; aligning it with the override would improve local portability. Stdlib FTS5 is required by the code; local creation succeeded. The matrix runners themselves were not available to this review.

The build job uses the appropriate `python -m build` frontend, declares `setuptools>=77` for the modern license metadata, and smoke-checks packaged web assets. Package discovery/data declarations include `repoask` and its web/examples assets. No definite workflow defect was established by static inspection. Actual dependency installation, isolated build, wheel installation and six-platform-version execution were not run: no package installation was authorized, network is restricted, and this review may write only its deliverable. CI cannot be reported green from this sandbox.

Tracked-file searches found no remaining personal workstation absolute paths. Matches for `/Users/private`, `/Users/fixture` and host-path regexes are synthetic redaction tests/implementation, not leaked personal paths. Paths in this review's command record are the explicitly requested local interpreter.

## Checks run

- `/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python -m unittest discover -s tests -p "test_ask*.py"`: **44 tests, 43 passed, one error**, 109.130 seconds. `test_cli_model_seeds_missing_roles_without_inference_or_overwriting_saved_choices` cannot bind loopback (`tests/test_ask_composition.py:44`, `PermissionError: [Errno 1] Operation not permitted`). The added pending-route test passed.
- `REPOASK_TEST_PYTHON=/Users/apple/workspace/vibe-coding/repo-ask/.venv/bin/python node --test tests/ui/*.test.mjs`: **287 tests, 285 passed, two failed**. Both failures are the real session/profile bridge tests (`tests/ui/session-services.test.mjs:22,55`): synthetic execution-profile bootstrap returns `execution_test_failed`. A repeat produced the same counts and failure signatures. Unix-domain socket bind is independently denied with the same sandbox permission error; the execution broker requires it at `repoask/execution/broker.py:360-363`. This supports an environmental explanation but does not turn those failures into passing evidence. All added recovery/reason UI tests passed.
- Requested `python3 -c "import ast,sys; [ast.parse(open(f).read(), feature_version=(3,10)) for f in sys.argv[1:]]" $(git ls-files 'repoask/*.py')`: **passed**. The Git pathspec includes nested product modules. Repeated for tracked test Python files: **passed**. This checks grammar, not runtime compatibility with actual Python 3.10/3.12/3.13.
- `python3 -m unittest tests.test_web_assets`: **2 passed**.
- Local SQLite FTS5 virtual-table creation: **passed**, SQLite 3.42.0.
- Independent real-service probes: `no_match` restores its prompt; a subsequent user message suppresses pending state; repository purge suppresses pending state; scope add/remove reproduces finding 2. Existing added test covers multiple decisions and conversation deletion. No sequential deletion/purge prompt disclosure found; concurrent read/delete linearizability was not independently stress-tested.
- Exact diff, metadata/workflow/template review, tracked path search and screenshot Git-tree check performed. No external services, real inference or Docker sessions invoked.

## Integration recommendation

Return findings 1–4 to Claude; rerun affected checks at the corrected exact commit and obtain unrestricted CI/build evidence. Only this review file was written by the reviewer; no commit made. README and stylesheet edits plus untracked images appeared from another writer during review and were preserved; findings use the submitted Git objects, not those later edits. Runtime checks exercised the checkout at HEAD `d3902bd`; no product Python/JavaScript changes were observed during those checks. No publication or merge is authorized by this review.
