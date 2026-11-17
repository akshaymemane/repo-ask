# OpenDevin

OpenDevin is an open-source, self-hosted workspace for finding the right GitHub
repository, discussing a change, saving an implementation plan, and following an
agent session through to a pull request.

Development is in progress. GitHub App connections, repository discovery, persistent
indexing, saved Ask conversations and plans, isolated implementation sessions in Docker
with Claude Code, and draft pull request publication are integrated (M2). Customization
(skills, plugins, memory) is next. The bundled Ask demo remains usable; it does not
represent a connected GitHub account.

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

Open Settings → GitHub → **Connect GitHub**. OpenDevin creates a private GitHub App
from a manifest (contents and pull requests read & write, metadata read); you review it on GitHub, click Create, and the App ID and
private key are stored in your OS credential vault automatically. Then install the App on
the repositories you want. To reuse an App you already have, use "Use an existing GitHub
App" and enter its App ID, slug and private key; its Setup URL must be
`http://127.0.0.1:8765/api/github/callback` for the default port. OpenDevin does not
import your GitHub CLI login. OpenDevin writes only to repositories where you turn on
**Allow changes**, only on new `opendevin/…` branches, and only as draft pull requests; it
never merges or touches the default branch. Apps created before this change were read-only:
raise Contents and Pull requests to "Read and write" in the App's settings on GitHub, accept
the new permissions on the installation, then click **Sync** on the Repositories page.
"Use in Ask" and "Allow changes" are independent per repository.

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

## Implementation sessions and draft pull requests

Requirements: Docker running, a container image already present locally (sessions never pull
images and have no network; for Python, `docker pull python:3.12-slim` beforehand), and the
Claude Code CLI installed and logged in with your own account (`claude`). Start OpenDevin with
`--data-dir` so sessions and publications survive restarts.

1. Settings → Privacy: turn off **Keep everything on this computer**. The coding agent sends
   the plan and permitted source to Anthropic.
2. Settings → Coding agent: set **Pull request author** (name and email used for commits), then
   create an execution profile with your image, tick **Allow sending repository source to the
   external coding model**, and run **Test execution profile** until it passes.
3. Repositories: turn on **Use in Ask** and **Allow changes** for the target repository.
4. Ask: describe the change with the repository chip attached and click **Generate plan**. Plans
   start without an execution profile: open the plan, **Edit plan → Execution and publication**,
   choose the tested profile and **Save immutable version**, then **Start session** there.
5. The session page shows progress, the diff and checks. Validation runs inside the container.
   **Stop session** cancels and confirms the container is gone.
6. PR tab → **Create draft PR**: review repository, branches, changed paths and checks, edit the
   title and description, then **Publish draft PR**. Newly generated files (for example
   `__pycache__/`) are left out and listed in the description; other rejected paths block.

Recovery: if OpenDevin stops while a session runs, the next start confirms the container and agent
are gone and marks the session **interrupted** (edits after the last checkpoint may be lost); use
**Retry as a new attempt**. A publication whose GitHub response was lost is reconciled against
GitHub on the next start or on **Retry**, and never creates a second branch or pull request.

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
