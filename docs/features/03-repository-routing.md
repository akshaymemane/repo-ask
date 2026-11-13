# F03 — Natural-language repository routing

Status: Draft | Milestone: M1 | Parent: [Master PRD](../../Master%20PRD.md)

## Outcome and boundaries

Translate a task description into an explainable set of likely repositories across a catalog of 200+. Users can describe a feature, product, endpoint or symptom without remembering a repository name. Routing chooses planning context, not authorization to modify code.

Support multiple candidates and cross-repository analysis. M2 implementation is limited to one writable repository per session; routing must not hide related repositories because of that limitation.

## Functional requirements

- **RT-01:** Search repository names, descriptions, topics, README profiles and generated summaries first, then retrieve source from the strongest candidates.
- **RT-02:** Respect explicit `owner/repo` mentions and user-pinned repositories while reporting missing access or insufficient context.
- **RT-03:** Display a short ranked candidate list with reasons, evidence links where available, freshness and coverage. Generated confidence labels are qualitative, not calibrated probabilities.
- **RT-04:** Prioritize accessible repository evidence over conversation guesses. Memory and recent use may influence ranking but cannot suppress contradictory current source.
- **RT-05:** For ambiguous requests, ask a focused repository-choice question and preserve all plausible candidates. Do not create a launchable plan until write scope is resolved.
- **RT-06:** When nothing matches, say what was searched, offer manual selection and optionally schedule deeper indexing. Never fabricate a repository.
- **RT-07:** Allow add/remove/pin actions at any point. Changing scope invalidates incompatible plan assumptions and requires a new plan version.
- **RT-08:** Support exact-name collisions across owners; stable repository IDs carry through selection.
- **RT-09:** Preserve the prompt and routing explanation in conversation history so the selection is auditable.
- **RT-10:** Only return repositories the user currently permits for retrieval. Read-only candidates may inform planning but are labeled unavailable for implementation.

## Routing contract

Input: prompt, optional conversation ID, pinned repository IDs, catalog generation and index availability. Output: candidate repository IDs, rank, reason, supporting citations, freshness, ambiguity status and recommended next action.

States: `resolving`, `resolved`, `needs_selection`, `no_match`, `degraded`. “Resolved” describes usable planning scope; it does not promise that all required source has been indexed. Plan readiness in F04 performs the evidence check.

Proposed `POST /api/route` returns a persisted routing decision or a job ID for longer resolution. Conversations reference the decision version; selection changes do not mutate earlier messages.

## Examples

- “Fix order confirmation emails” finds a notifications worker and related order API; Ask distinguishes the component responsible for delivery from the producer.
- “Update our website header” with several frontend repositories asks which site, showing owner/name and descriptions.
- “In acme/billing-api, add invoice filtering” pins that repository and reports whether code indexing is ready.
- “Fix an app that is not connected” returns no verified match and offers repository selection/setup.

## Failure and recovery

Without embeddings, lexical routing remains available and is labeled degraded. Metadata-only matches may be proposed immediately; source-specific findings wait for code retrieval. An active refresh cannot silently remove a user's pinned scope; access loss is surfaced and blocks downstream work.

Ranking thresholds and candidate counts are tunable implementation settings, chosen with the evaluation set rather than hard-coded from a model's self-reported confidence.

## Acceptance criteria

1. On 50 labeled answerable tasks against a 250-repository catalog, expected repositories appear in the top three for at least 90% of tasks; report multi-repository coverage separately.
2. Ambiguous tasks produce a selection request rather than silently choosing a writable target.
3. Explicit owner-qualified names are distinguished from identically named repositories in other organizations.
4. Manually selecting a repository persists across follow-up questions and triggers plan revalidation when scope changes.
5. Revoked, excluded and nonexistent repositories cannot be introduced through stale summaries or memory.
6. A no-match result remains a no-match result even when the model supplies a plausible invented name.

## Dependencies and measures

Depends on F01 catalog and F02 retrieval; used by F04. Track top-three recall, wrong high-confidence selections, clarification rate and user overrides. Evaluate ambiguous/absent tasks separately so a forced guess does not improve apparent accuracy.
