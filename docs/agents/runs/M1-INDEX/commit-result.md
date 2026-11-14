# M1-INDEX commit provenance — R2

Original assignment: db85564688f25ab7345cdcd689fe18fd160c6d7a.
Coordinator schema5: e7c4a5e328b69207804cbbbbf3fdcae7deb0f4bd.
Actual original submission: d8f1005eeb13f544c3fc465ff2fc66acaa2c4a7d.
Actual R1 fix submission / current R2 review and revision base:
469954f9a6bedc003d7de1e61c3074f2b5a711b7.
The coordinator created both submitted commits after the earlier worker Git lock
failures. Those historic failures do not mean the reviewed commits are absent.

R2 staging attempt failed with exit128:

```
git add repoask/indexing/service.py tests/test_indexing_retry_limits.py docs/agents/runs/M1-INDEX
fatal: Unable to create '/Users/apple/workspace/vibe-coding/repo-ask/.git/worktrees/opendevin-m1-index/index.lock': Operation not permitted
```

No R2 commit was created. HEAD remains the reviewed469954f. The linked worktree Git
administration directory is outside the worker's writable sandbox. No bypass,
alternate Git directory, lock removal, reset or remote mutation was attempted.
Coordinator must stage/commit the preserved exclusive-scope changes from an authorized
environment before the required new exact-commit independent review. files.sha256
identifies the current packet, excluding itself. No remote publication is authorized.
