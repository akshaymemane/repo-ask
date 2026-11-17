# Changelog

All notable user-visible changes are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/) (pre-1.0: minor versions may change behavior).

## [Unreleased]

### Added
- Open-source project files: contributing guide, security policy, code of conduct,
  third-party notices, issue and pull request templates, and CI for Python 3.10–3.13 on
  Linux and macOS plus UI tests and a package build check.

## [0.1.0] — first public preview

### Added
- **Workspace foundation:** durable SQLite storage with migrations, a recoverable job
  queue, OS-vault secret references and a loopback-only web app with host and origin checks.
- **GitHub:** one-click private GitHub App creation from a manifest, installation discovery,
  a paginated repository catalog designed for hundreds of repositories, and per-repository
  **Use in Ask** and **Allow changes** switches.
- **Indexing and retrieval:** persistent snapshots of committed source, full-text search,
  optional vector search (sqlite-vec), credential and generated-file exclusion, bounded
  retries and restart recovery.
- **Ask and plans:** repository routing with reasons, cited answers, saved conversations,
  and editable, immutable-versioned implementation plans with launch validation.
- **Models:** Ollama, OpenAI-compatible endpoints and the Claude Code CLI as providers,
  assigned per role, with local-only mode on by default and explicit per-profile opt-in for
  sending source.
- **Implementation sessions:** Claude Code in a network-less, capability-dropped container
  with resource limits; live progress, guidance messages, diff, validation checks, stop with
  containment confirmation, and interrupted/retry recovery.
- **Draft pull requests:** reviewed publication to new `opendevin/…` branches as draft PRs,
  generated-file omission, and reconciliation that never duplicates a branch or PR.
- **Interface:** Ask, Sessions, Repositories and Settings in a responsive dark/light
  workspace with keyboard navigation, visible focus and 44px touch targets on small screens.

### Known limitations
- Single user on one computer; not safe to expose on a network.
- One writable repository per session; cross-repository execution is planned.
- Skills, plugins/MCP tools and memory are not available yet.
- Claude Code is the only coding-agent adapter.
