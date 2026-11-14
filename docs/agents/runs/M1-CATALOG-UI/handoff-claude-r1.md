# Coordinator UI follow-up

The coordinator temporarily took exclusive ownership of the idle UI worktree after
Claude review of94ad03e. No external UI writer was active; Ask and indexing authors
kept their separate scopes.

Fixed the blocking overlapping GitHub reads with a generation fence and mutation
barrier, including sanitized malformed installation URLs. The setup-return message
now survives panel reloads. Catalog permission saves block page/filter reloads and
GitHub access changes until their outcome settles, invalidate older reads and
reconcile authoritative checkbox values. Added reload feedback and restored focus
after provider saves or workspace status refreshes.

Four new delayed-response/browser-behavior checks cover those boundaries. The full
Node suite passes32/32. Tests use the existing DOM stand-in and actual service bridge;
layout and assistive-technology behavior still require the coordinator Chrome check.
No GitHub credentials or account mutations were used. This follow-up requires
independent re-review against its exact commit; it is not an approval by its author.
