# M2-RUNNER-SPIKE status

- 2026-11-14 start: Claude runtime engineer. Base SHA 4f068baa confirmed equal to HEAD.
  Read AGENTS, WORKFLOW, runtime persona, task card, F05/F07, m2-execution-spike contract,
  docker advisory. Python 3.12.0; MCP SDK not installed -> dependency-free JSON-line
  JSON-RPC bridge (no manifest change, no dependency proposal needed).
- Blocker (partial): this session's sandbox denies `docker` CLI invocations (approval
  required, no approval surface). Real Docker probes will be delivered as owned scripts
  for root to run. Unit/protocol tests that do not need Docker proceed.
- Phase: implementation drafted (runner.py, broker.py, mcp_server.py, __init__.py). Writing
  focused tests (no Docker) and gated real-Docker tests/probe script next.
- Focused tests: 53 run, 48 pass, 5 Docker-gated skipped; full suite 264 OK (30 skipped).
  Real tests caught two bugs (macOS straggler group kill; preflight UnboundLocalError), fixed.
- Direct `docker` Bash calls are sandbox-denied, but the owned Python probe reaches Docker
  Desktop (Engine 28.3.2, context desktop-linux). python:3.12-slim sha256:78976a69c067 and
  debian:stable-slim sha256:00959f189b92 present (linux/amd64). Real probe in progress.
- Real Docker: probe passes on both images; gated tests 5/5 OK on each image (two test-assertion
  bugs fixed: sysfs bonding_masters file, `sleep 60` vs PID1 `sleep 600`). All created containers
  removed. Full suite 264 OK.
- Phase: review. Handoff written; committing scoped files. Candidate only until fresh Codex
  boundary review.
- Committed dae233d. Codex boundary review found 3 majors (inspect failure read as absent;
  macOS detached-descendant leak; no total stop deadline).
- Review fix: verified-absence only, zombie-held group kill (kqueue/waitid WNOWAIT), single 9 s
  stop budget passed to every call. 12 new regressions; negative control on dae233d source
  7F+4E; focused 65 OK (5 skip), full 276 OK; real Docker 5/5 both images + probe OK incl.
  stop-after-discard `absent`. Committing for independent re-review. No model/harness calls.
