# OpenDevin

OpenDevin is an open-source, self-hosted workspace for finding the right GitHub
repository, discussing a change, saving an implementation plan, and following an
agent session through to a pull request.

Development is in progress. GitHub App connections, repository discovery, model
profiles, secure credential references and durable background jobs are integrated.
Persistent indexing and its UI are under review. Saved Ask conversations, plans,
isolated implementation sessions and customization are the next implementation
slices. The bundled Ask demo remains usable throughout development; it does not
represent a connected GitHub account or a completed implementation session.

The [Master PRD](Master%20PRD.md) and [12 feature specifications](docs/features)
define the intended product. The [development workflow](docs/agents/README.md) and
[task board](docs/agents/board.json) record the current delivery state.

## Run locally

Use Python3.10 or later with SQLite FTS5. Git is required for explicit local
checkouts. A project virtual environment keeps optional integrations isolated:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[full]'
opendevin --data-dir ~/.local/share/opendevin
```

Open [http://127.0.0.1:8765](http://127.0.0.1:8765). Omitting `--data-dir` runs an
in-memory demo; GitHub credentials and credentialed profiles require persistent
storage. Without optional packages, `python3 -m repoask` still runs the sample.
The Python package retains its existing `repoask` name for compatibility.

Credential setup uses the supported OS vault: macOS Keychain, Linux SecretService
or Windows Credential Manager. Missing or locked secure storage blocks credential
setup; there is no plaintext fallback. Metadata, source context and vectors belong
in a private data directory. The app binds to loopback for a single user. Remote
hosting needs a separate authentication and TLS design.

## GitHub and model setup

Open Settings → GitHub → **Connect GitHub**. OpenDevin creates a private, read-only
GitHub App from a manifest; you review it on GitHub, click Create, and the App ID and
private key are stored in your OS credential vault automatically. Then install the App on
the repositories you want. To reuse an App you already have, use "Use an existing GitHub
App" and enter its App ID, slug and private key; its Setup URL must be
`http://127.0.0.1:8765/api/github/callback` for the default port. OpenDevin does not
import your GitHub CLI login. Write access (contents and pull requests) is a separate,
later step for publishing. "Use in Ask" and "Allow changes" are independent per repository.

Provider profiles support Ollama and OpenAI-compatible chat/embedding endpoints.
Configure capability flags, limits, dimensions, credentials and role assignments.
Local-only mode is enabled by default. Remote source processing additionally needs
explicit profile opt-in. Connection tests send synthetic content. Missing token
pricing is reported as unknown.

With Ollama already running and a downloaded model, the legacy demo can generate
cited answers immediately:

```sh
python -m repoask --model YOUR_LOCAL_MODEL --data-dir ~/.local/share/opendevin
```

Use the bundled **Trace checkout** example and open its citations in the source
pane. The samples contain a storefront, orders API, migration and notification
consumer. Source citations refer to the indexed snapshot.

Explicit local checkouts remain supported by the demo:

```sh
python -m repoask --repo web=/path/to/storefront --repo api=/path/to/orders-api
```

The legacy demo supports up to eight explicit checkouts and rebuilds its in-memory
index at startup. The new GitHub catalog has separate pagination and is designed
for hundreds of repositories. Until the persistent Ask slice is integrated, its
provider roles and connected catalog do not replace the legacy demo's startup
model and repository picker.

## Development and verification

```sh
python -m unittest discover -s tests
node --test tests/ui/*.test.mjs
```

Vector checks require the `vectors` extra, which includes APSW and sqlite-vec.
[ADR0002](docs/architecture/0002-vector-store.md) records why vectors use a separate
SQLite connection. The development lockfile records a tested environment; resolve
optional packages for your operating system rather than copying virtual environments.

The development team uses separate worktrees and review gates. On the configured
workstation, attach to visible worker windows with:

```sh
tmux attach -t opendevin-dev
```

Terminal activity is separate from acceptance: the board and exact-commit review
artifacts record what has actually passed. Quota-limited workers are resumed from
saved sessions; a stopped process never counts as completed work.

Released under the [MIT License](LICENSE).
