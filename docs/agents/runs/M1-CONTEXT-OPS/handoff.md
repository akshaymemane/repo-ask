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
