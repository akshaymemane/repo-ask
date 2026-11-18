# Open-source launch checklist

Status as of 2026-11-18 (updated after the 100,000-chunk validation and the product site). Everything in **Done** is on `work/opendevin-integration`, independently reviewed by the other
coding agent and covered by tests. Items under **Maintainer decisions** cannot be decided by the agents.

## Maintainer decisions (blocking a public announcement)

1. **Product name.** The Master PRD records that "OpenDevin" collides with the earlier open-source OpenDevin project
   (now OpenHands). Announcing under this name invites confusion and possible trademark trouble. Choose a final name
   before making the repository public; renaming touches README, UI title, CLI command (`opendevin`), package name
   (`opendevin-local`), branch prefixes (`opendevin/…`) and the GitHub App manifest name.
2. **Release branch.** `main` is far behind `work/opendevin-integration`. Decide how to land it (fast-forward/merge or a
   squashed initial public commit). A squashed history also drops the development records' commit metadata if you prefer
   not to publish them; `docs/agents/` can be kept, trimmed or removed.
3. **Repository settings.** Enable GitHub private vulnerability reporting (SECURITY.md points to it), and decide on
   branch protection for the release branch (require the CI workflow).
4. **Make the repository public** and tag `v0.1.0` (CHANGELOG has the 0.1.0 notes; move "Unreleased" entries under it).
5. **Product site.** `site/` holds the landing page and user manual; `.github/workflows/pages.yml` deploys it from
   `main` (changes under `site/**`) or by manual dispatch. Before the first deploy: finalize the name (13 pages and the
   screenshot carry it), set Pages source to GitHub Actions, and decide whether the site lives at the default
   `<owner>.github.io/<repo>/` address or a custom domain. A private repository on a free plan cannot serve Pages.
6. **Remote branches.** `origin` still has old `task/*` branches and the diagnostic `ci/macos-startup` and
   `ci/fast-bind` branches; delete when convenient.

## Done in the launch wave

| Item | Evidence |
| --- | --- |
| Open-source files: CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, THIRD_PARTY_NOTICES, CHANGELOG, issue/PR templates, Dependabot | LAUNCH-READINESS |
| Public README with quick start, security model, troubleshooting, roadmap and a real screenshot | LAUNCH-READINESS |
| CI: Python 3.10/3.12/3.13 on Ubuntu and macOS, UI tests, package build + wheel smoke, workstation-path guard | `.github/workflows/ci.yml` |
| Privacy: one credential detector for indexing, session logs and exports; adds `sk-`, `github_pat_`, Slack, Google key formats | LAUNCH-CREDENTIAL-GUARD |
| F04 AC6: an advanced base branch is shown before launch and retry; retaining the saved base is recorded | LAUNCH-FRESHNESS |
| F12 OP-10: users can delete a finished session's retained content | LAUNCH-SESSION-PURGE |
| Ask keeps a question waiting for a repository choice across reloads and restarts; shows why repositories were suggested | LAUNCH-READINESS, LAUNCH-ROUTE-CONSUMED |
| System health reports the persistent index, model roles and execution runtime (codes only) | LAUNCH-HEALTH-PROJECTION |
| Startup never waits on an unresponsive Docker daemon (was 30s+) | LAUNCH-STARTUP-RECOVERY |
| Startup never waits on reverse DNS at bind time (8s+ on macOS CI) | LAUNCH-FAST-BIND |
| Slow local models: plan-specific failure copy, actionable timeout hint, 600s local Ollama default, README guidance | LAUNCH-READINESS |
| Spec/contract drift fixed (F02 acquisition, F07 adapters, M1 manifest permissions) | LAUNCH-READINESS |
| Draft PRs: title from the plan goal; description lists steps, checks, omitted paths and limitations (redacted, bounded) | M2-FOLLOWUPS-PR-DEFAULTS |
| Execution profiles can pin a Claude model (`--model`), stored on the immutable version | M2-FOLLOWUPS-AGENT-MODEL |
| Session errors explained in plain words; a stale Retry links the newer attempt | M2-FOLLOWUPS (session errors) |
| Publication hardening: `sensitive_content` code, canonical paths only, missing snapshot tests | M2-FOLLOWUPS-LOWS |
| PRD reference workload validated at 100,000 chunks: catalog p95 1.6 ms, routing p95 936 ms (gates 1 s / 2 s) | LAUNCH-PERF-100K |
| Index disk cap no longer blocks the reference workload (4 GiB live pages, 1 GiB free-space reserve, legacy runs recover) | LAUNCH-PERF-100K |
| Product site and user manual (`site/`), link/landmark test in CI, Pages workflow (not yet deployed) | LAUNCH-SITE |

## Verified by hand

- Product site rendered in Chrome at 390 px and 1440 px, light and dark: no horizontal overflow, skip link and
  active-page marking work; UI labels and CLI flags quoted in the manual match the code.
- Real local inference with Ollama (llama3.1:8b) through the UI: cited answer, citation opens the exact snapshot lines,
  pending repository choice survives a server restart, 390px and 1440px layouts.
- Clean wheel install serves the app; foreign Host and cross-origin POST are rejected (403).
- Session purge end to end in a browser against real session services (fixture runner).
- Full git history scanned for credentials: only synthetic test values.

## Not yet measured (Master PRD §11 release gates)

These are product-quality measurements, not code defects. Remaining reference-workload validation needs real repositories and time:

- 10-task end-to-end execution benchmark (≥8 reach a reviewable draft PR). One live pilot is recorded.
- 30-plan factual-support review.
- Reference hardware: the 100,000-chunk run used a 12-core / 32 GiB macOS host, larger than the PRD's 8-core /
  16 GiB reference, with lexical retrieval only (no embeddings). Method and limits are in
  [LAUNCH-PERF-100K](agents/runs/LAUNCH-PERF-100K/results.md).
- Repeated stop-latency distribution (single measurements are within target).

## Known limitations to state at launch

- Single user on one computer; not safe to expose on a network.
- CPU-only local models are slow (minutes per answer for 8B models on a laptop CPU).
- Claude Code is the only coding-agent adapter; one writable repository per session.
- Skills, plugins/MCP and memory (M3) are not built.
