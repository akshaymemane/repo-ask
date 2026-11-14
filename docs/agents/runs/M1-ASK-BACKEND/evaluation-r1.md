# R1 expanded routing evaluation

The earlier evaluation.md and routing-results.json remain unchanged. They report the original synthetic GitHub metadata development benchmark at 50/50 top-three recall, baseline 49/50, and the separate initial README-only local/demo limitation at 12/50 (24%) recall. No live inference or index-dependency approval is implied.

New inputs: tests/fixtures/routing/expanded-r1.json adds 12 answerable path-bearing tasks, two path-only ambiguous/unknown probes and two absent path-bearing tasks. Eight cases use valid pins; four explicitly name known owner/repository entries. Source files, read/write, I/O, client/server and a nonexistent owner/name occur within these prompts. Evaluation still uses real GitHubService, IndexService, SQLite and jobs with synthetic injected discovery/source. The catalog remains 250 repositories, 25 indexed. No model, embeddings, account, or network calls ran.

Final measured results (routing-results-r1.json):

| Slice | Result |
| --- | --- |
| Original 50 answerable tasks | 50/50 top-three recall; basic catalog lexical baseline 49/50 |
| Original five multi-repository tasks | 10/10 expected labels in top three; 5/5 complete coverage; same as baseline |
| Twelve new path-bearing answerable tasks | 12/12 complete top-three coverage; 12/12 exact selected scope with resolved status |
| Original ambiguity and absent probes | Both ambiguity requests need selection; both absent requests return no_match |
| Path-only ambiguous/unknown probes | One needs_selection, one no_match; neither auto-selects a repository |
| Path-bearing absent probes | Both no_match |
| Collision/qualified/revoked/missing-pin probes | Passed |

The initial expanded run is retained in routing-results-r1-initial.json: top-three coverage was 12/12 but correct scope only 10/12 (83.3%). Those two cases incorrectly labeled odd-numbered fixture repositories with owner `team` instead of actual `owner`. Fixing fixture labels made them valid owner-qualified examples; it does not establish support for invalid owners. One absent query still matched a generic action word (`Build`) in tooling metadata. The next full regression attempt caught that false-positive selection request; adding `build` to generic action filtering fixed it. Path tokens are now removed from catalog feature terms and only matched as explicit identities when equal to known current catalog names. The old full-run failure was diagnostic during iteration, not a claimed final pass.

Final measurement command actually run: root .venv interpreter with `PYTHONPATH=.:tests`, importing `test_ask_routing_evaluation.evaluate`, writing routing-results-r1.json and asserting answerable recall, path scope and absent results. Final full unittest discovery independently ran the expanded labeled test successfully. These remain development-set measurements used for tuning, not held-out real-catalog accuracy. The pre-existing README-profile limitation and unapproved index dependency remain explicitly open to the coordinator/index owner.
