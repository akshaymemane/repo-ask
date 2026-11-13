# F10 — Inspectable memory management

Status: Draft | Milestone: M3 | Parent: [Master PRD](../../Master%20PRD.md)

## Outcome and boundaries

Keep durable user preferences and reusable project knowledge across Ask conversations and sessions. Users can inspect what is remembered, why it exists, where it applies and how to change or delete it.

Memory is separate from indexed repository source, generated summaries, chat history and skills. It provides relevant context; it cannot override current source, explicit user instructions or permissions. No training on private content is implied.

## Functional requirements

- **ME-01:** Create manual memories with title/content, scope, type, tags, provenance and optional expiration/review date.
- **ME-02:** Scope memories to workspace/user or stable repository IDs. A session can have temporary context that is not promoted to durable memory.
- **ME-03:** Offer inferred memory as a pending proposal after useful conversation/session outcomes. Proposal-only is the default; users can enable narrowly scoped auto-save of preferences with visible provenance and audit history.
- **ME-04:** Retrieve relevant, active memories under a bounded context budget. Display included memory IDs/versions in plan context previews and session history.
- **ME-05:** Give current source and explicit user instructions precedence. Conflicting or stale memories are labeled and can be excluded; factual repository memories should carry commit evidence when available.
- **ME-06:** Support search, filters, edit/version history, accept/reject proposals, archive, expiration, export and permanent deletion.
- **ME-07:** Do not store credentials or provider keys as memory. Apply sensitive-content checks to proposed saves and keep automatic memory collection disabled for excluded sources.
- **ME-08:** Disabling memory prevents retrieval and proposals for future calls. Disabling does not silently delete stored entries; explain the separate purge action.
- **ME-09:** Repository access loss immediately excludes its memories from retrieval. Global memories derived from that source must also retain source associations and obey exclusion/redaction rules.
- **ME-10:** Deduplicate near-identical proposals while retaining provenance. Never silently replace a user-authored memory with a model inference.
- **ME-11:** Pin included versions for reproducibility, subject to deletion/redaction. Permanent deletion removes retrievable content, vectors and context copies under F12 policy, leaving only a minimal tombstone where needed.

## Examples and boundaries

“Prefer pytest for new Python tests” is a preference. “Billing uses a particular queue” is repository knowledge requiring source and freshness. “Follow these five migration steps” is better expressed as a skill. A raw repository summary belongs to F02, not an inferred memory entry.

A new conversation may retrieve relevant memories but must not import unrelated private conversations wholesale. Cross-repository memory retrieval requires an explicitly workspace-scoped entry and retained source-access eligibility.

## Data and proposed interfaces

`Memory`: stable ID, scope/repo IDs, type, status and active version. `MemoryVersion`: text, author/source, evidence references, created/review/expiry times and content hash. `MemoryProposal`: candidate, reason, generating conversation/session, decision and deduplication reference. `MemoryBinding`: plan/session, version, retrieval reason and redaction status.

Routes: CRUD `/api/memories`, proposal list/accept/reject routes, `/api/memories/export`, and memory settings/context preview. Destructive deletion is explicit and reports completion across text, vector and derived context storage.

## Failure behavior

If memory retrieval fails, Ask can proceed with source context while reporting degraded memory use. A stale entry is not presented as verified code behavior. Embedding failure preserves editable memory text and allows lexical retrieval. User deletion does not claim to erase data already transmitted to an external provider or included in a remote PR; surface those limits at deletion time.

## Acceptance criteria

1. A manual repository memory is retrieved for that repository, visible in context preview and absent from an unrelated repository's context.
2. Inferred knowledge stays pending until accepted under the default configuration.
3. Editing a memory creates a new version; earlier sessions identify the version they used unless content has been permanently deleted.
4. Current source contradicting a memory produces a conflict indicator rather than a false factual assertion.
5. Expired, archived, deleted or access-revoked memories never appear in new retrieval, including through vector search.
6. Disabling prevents new retrieval/proposals; permanent deletion removes content from active stores and produces a tombstone in historical context.

## Dependencies and measures

Depends on F02 retrieval, F04/F05 context assembly and F12 retention. Measure proposal acceptance, stale/conflicting retrieval and user corrections. Do not optimize memory quantity as a success metric.
