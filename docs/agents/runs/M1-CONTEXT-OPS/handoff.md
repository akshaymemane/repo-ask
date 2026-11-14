# Background composition candidate

Coordinator-owned service composition now accepts context and Ask services before
workers start, registers handlers/purge hooks, and closes vectors after workers.
Local purge disables retrieval before removing duplicated answers and physical data.
Schema7 stores content-free scheduling signatures and run references. The scheduler
bounds queued background work, waits for configured embedding-role verification,
tracks catalog/model changes, and avoids requeueing unchanged completed signatures
after restart. Explicit eligibility changes invalidate markers without clock fences.
One repository failure does not prevent other candidates from being scheduled.

Seven application-service checks and three real SQLite/queue scheduler checks pass;
full root suite131 passed before the final additive pagination test. Context UI
has38 passing Node checks. Saved HTTP export/run-history adapters now support
bounded cursor continuation. Actual CLI composition is still gated on corrected
IndexService/Ask approvals; no private account ingestion or runner is claimed.
Independent review and real combined HTTP/browser checks remain required.

## CLI and migration bridge follow-up

Corrected indexing through3def367 is independently approved and its exact full
147-test tree passed. The root integration initially passed173 Python checks.
The CLI now composes persistent context, background scheduling and explicit
local/demo registrations. Startup preserves a pending purge instead of blocking
unrelated sources. Unchanged bundled content does not become stale merely because
the app restarts, and GitHub names update by stable ID without rewriting snapshots.

The original source explorer is still available during migration. Its repository,
search and source endpoints now honor current persistent selections, exclusions
and content filtering. Local/demo purge removes its duplicate memory/FTS payload
before physical persistent cleanup; late answers are discarded if access changed.
This closes a real migration boundary where old endpoints could otherwise serve
content after a new-context purge. Five actual HTTP/SQLite bridge checks pass,
alongside two metadata-freshness/rename checks. The intermediate full177 suite
passed before those final three tests. No real account/source was used.

These coordinator additions require their own independent review. Main Ask
composition and its asset remain gated on the corrected Ask and UI reviews.
