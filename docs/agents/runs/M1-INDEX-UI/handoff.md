# Context UI and adapter handoff

Coordinator authored this additive slice after the initial connected UI was
independently approved. It displays actual snapshot identity, coverage, mode and
job phases, pins the displayed embedding version on explicit index requests,
and supports pause/resume, retrieval selection for local/demo sources, exclusion
editing and explicit two-step purge. Polling avoids hidden routes and focused or
dirty editors. Mutation/read generation fences prevent stale actionable views.

ContextAPI adds exclusion reads/writes and a composed local-purge callback; it
never accepts host paths. Actual local purge remains disabled unless application
composition supplies the callback. The indexing author has been assigned the
additive set_exclusions method. GitHub purge still uses its durable service.

38 Node checks and4 ContextAPI tests pass. UI checks use a DOM stand-in and the
existing real-service bridge; they are not live indexing/browser evidence.
Integration remains gated on the corrected IndexService and app factory wiring.
No real GitHub App configuration or account writes were performed.
