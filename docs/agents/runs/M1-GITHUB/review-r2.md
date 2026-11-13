APPROVED — exact commit `c14e319a6b8263007933c9ba2af970554637eb62` for M1-GITHUB.

Both prior blocking findings are resolved:

- Verified callbacks atomically cancel and replace active discovery runs, preventing stale metadata or pages from restoring downgraded permissions.
- Discovery token-endpoint 404s revoke the affected installation’s grants. Run-state fencing prevents stale responses from invalidating newer callback grants; other installations remain accessible.

No additional blocking regression or security-boundary findings against `docs/contracts/m1-services.md` and F01.

Verified all 14 snapshot hashes against the manifest and submitted Git objects, plus the exact base/submitted diff. Runtime tests were not run independently. Reported evidence is 36 focused tests passing; the full suite still requires the integrator’s rerun of five sandbox-blocked HTTP tests.

No edits or agents spawned.
