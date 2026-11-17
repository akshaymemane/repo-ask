No findings. The grants match the publication contract without extra write permissions. Token requests remain narrower per call; capability checks and catalog permission refresh preserve denial for existing read-only installations. Setup copy is accurate, and the exact-dictionary assertion meaningfully guards against excess grants.

Test attempt: `python3 -m unittest tests.test_github_manifest` — all 30 tests errored during setup because the read-only sandbox prevented temporary-directory creation; assertions were not reached.

Verdict: approve exact commit 5048484