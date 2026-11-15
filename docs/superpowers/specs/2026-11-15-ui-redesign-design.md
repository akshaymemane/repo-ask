# OpenDevin UI/UX redesign — design

Date: 2026-11-15 · Status: draft for approval · Features: F11 (primary), F01, F02, F03, F04, F05, F07

## Intent

Using the app for real (GitHub connected, three private repositories indexed) showed
that every screen is a stack of forms that exposes internal identifiers. To ask one
question you type `gh:1444557814` into a textarea, click "Save repository scope", then
find the question box below the setup controls. Repositories lists the same repositories
three times with contradictory status. Settings is a single page with 12 inputs, five
selects and a separate Save button for each model role. The user wants the product to
feel like Devin: a conversation-first workspace in which the app does the bookkeeping.

Success means a new user can connect GitHub, choose repositories, ask a question and
read a cited answer without typing an identifier, saving a form or reading a paragraph
of policy text. The behavioral contracts in F01–F07 still hold: the redesign changes
how the app presents them, not what it permits.

## Goals

- Use one app shell everywhere: a left rail, a center work area and a right panel that
  opens when content needs it.
- Make Ask a chat: a message thread, a composer, and repository selection inside the
  composer (`+` picker and `@` mentions) at any point in a conversation.
- Give sessions their own three-pane page: agent activity in the center, and
  Progress/Diff/Checks/PR tabs on the right.
- Show one repository list, with plain status and controls that save immediately.
- Split Settings into sections, with model discovery and no per-field Save buttons.
- Replace the empty Ask page with a first-run setup checklist, and replace the manual
  GitHub App form with the GitHub App Manifest flow.

## Non-goals

- Changing permission, retrieval, planning, execution or publication rules.
- Building customization screens (Skills, Plugins, Memory) ahead of M3.
- Adding a frontend framework or a build step.
- Fixing backend defects found during the audit (see "Related defects"), except where
  this design lists a backend addition.

## Anti-goals (failure even if it works)

- **Hiding the truth.** Demo data shown as real, lexical-only search shown as full
  search, or an unavailable action shown as available. UX-02, UX-08 and UX-09 still apply.
- **Deleting provenance.** Model, destination, base commit, snapshot and cost move out of
  the main reading flow into detail views and tooltips. They are not removed.
- **Losing keyboard or screen-reader access.** UX-10 still applies, including focus
  management for the modal, the `@` menu and the slide-in panel.
- **Copying Devin's branding,** visual identity or names. Only the layout pattern is borrowed.
- **Dropping unsaved input.** UX-11 still applies: drafts survive navigation.

## Constraints

- Plain JavaScript ES modules served as static files by `repoask/__main__.py` `ASSETS`.
  Every new module must be added to `ASSETS`: `app.js` imports modules at load time, so
  a missing entry breaks the whole UI (this happened with `sessions.js`).
- Keep the existing `#/` hash routing, including the durable URLs required by UX-03:
  `#/ask/<id>`, `#/plans/<id>`, `#/sessions/<id>`.
- `tests/ui/*.test.mjs` (Node test runner with the DOM helper in `tests/ui/dom.mjs`) must
  pass after each phase. Tests are updated with the UI, never deleted to make it pass.
- The work happens under `AGENTS.md`: it needs a board card with exclusive write scope
  `repoask/web/**`, `tests/ui/**`, plus the specific backend files in "Backend additions".
- Desktop first; at narrow widths, plans, session status and Stop stay readable (F11).

## Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **A. Plain JS, new shell and design system, rebuild each page** | No build step, packaging unchanged, tests updated rather than rewritten; more hand-written DOM code | **Chosen** by the user |
| B. Rewrite in React + Vite + TypeScript | Better component model; adds Node to build/packaging, rewrites tests, larger risk | Rejected |
| C. Redo only the shell and Ask now; restyle the rest later | Fastest visible win; two visual styles coexist for a while | Rejected: the user wants every page redesigned |

Layout options: A always-visible right panel, B a two-pane panel that opens on demand.
The user chose: **Ask uses two panes, and the right panel opens for a code file or PR. The
Session page always has three panes.** This matches how Devin uses the third pane.

## Design

### Shell (every page)

- **Left rail, 200px, collapsible:**
  - product mark,
  - "New conversation" button,
  - Ask, Sessions and Repositories,
  - a Recent list scoped to the current area (conversations in Ask, sessions in Sessions),
  - Settings pinned to the bottom.
- **Recent items:**
  - each shows a title, relative time and one status hint: "plan ready", "session
    running", "needs your input" or "PR #12 open";
  - an unread or attention dot appears where relevant;
  - the list pages lazily.
- **Header of the center pane:** the current title, compact pills for the repositories in
  scope, and one model pill ("llama3.2 · local"). Clicking the model pill shows the full
  destination, policy and usage detail that is inline today.
- **Workspace mode:** shown only when it means something. A "Sample workspace" pill
  appears only in actual demo mode (see "Backend additions").
- **Layout:** the body scrolls; the rail and composer stay fixed. No nested scroll
  container for the whole page.
- **Design tokens on `:root`:** surface, raised, border, text, muted, accent, success,
  warning, danger and info, with a dark default and a light theme through
  `prefers-color-scheme`. A single type scale and an 4/8px spacing scale.
- **Status:** shown with text plus color, never color alone (UX-10).

### Ask

**New conversation.** The page shows "What are we working on?" and a large composer.
No conversation is created on the server until the first message is sent. That create
call carries `title` set to the first ~60 characters of the message, and any repository
IDs already chosen. The existing `POST /api/conversations` accepts both.

**Composer** (fixed at the bottom of the thread):

- **Multiline input.** Enter sends; Shift+Enter adds a new line.
- **Below the input:** a `+` button, the repository chips (each with ✕), and the send
  button. While a generation runs, the send button becomes Cancel (ASK-09).
- **The `+` button opens the repository picker modal:**
  - a search field, focused on open;
  - a "Recently used" group above "All repositories";
  - each row shows a checkbox, name, owner/language and a status badge (keyword only,
    indexing N%, off);
  - repositories that are not indexed are shown disabled with an "Index now" link;
  - the footer shows "N selected", Cancel and "Add N";
  - keyboard: ↑/↓ moves, Space toggles, Enter confirms, Esc closes; focus is trapped
    inside the modal while open and returns to `+` when it closes;
  - data comes from `GET /api/context/repositories?query=` with cursor paging.
- **Typing `@` opens an inline menu** anchored at the caret, using the same data source
  filtered by the text after `@`. Choosing an item removes the `@query` text and adds a
  chip. ↑/↓/Enter/Esc work as in the picker.
- **Chips can be added or removed at any time, including mid-conversation.** Each change
  calls `PATCH /api/conversations/<id>` with `repository_ids` and `expected_revision`, and
  the thread shows a small system line such as "Added cube-workbench". On a revision
  conflict, the app reloads the conversation and re-applies the user's chip edit once;
  if it conflicts again, it shows an inline error. This is a deliberate improvement over
  Devin, which cannot add a repository to an existing conversation (RT-07 allows it).
- **When the scope changes after a plan exists,** the plan card shows "Made before
  cube-workbench was added · Regenerate". Regenerating creates a new plan version (ASK-05).

**No repositories chosen.** Sending calls `POST /api/route`. The thread shows a routing
step: "Looked in rcnl-app because the name matches · change". If routing returns
`needs_selection`, the thread shows the candidates as a choice card ("Which repository?"
with one button per candidate and "Choose…" to open the picker); nothing is saved until
the user picks (RT-05). Choosing applies the scope and continues the question. The full
routing explanation stays in the history (RT-09).

**Thread rendering:**

- **User messages** are right-aligned bubbles.
- **Assistant answers** are prose blocks with inline citation chips such as
  `api.ts:14–58`.
- **Work steps** ("✓ Looked in …", "✓ Read 12 files · keyword search") are collapsible
  muted lines.
- **Pending state:** a typing indicator with elapsed time, and Cancel in the composer.
  "Queued" is shown as "Waiting for the model…" instead of the request ID.
- **Failures** show an inline error with Retry (ASK-09) and a link to the relevant setup
  if the cause is setup.
- **Plans appear as cards in the thread:** title, step count, version, readiness, "View
  plan" and the primary "Start session" action. Start is disabled with a visible reason
  when the plan isn't ready (F11 criterion 4).
- **Per-message model, destination, usage and cost** move into a hover/focus "ⓘ" detail
  on each assistant message.

**Right panel in Ask** (opens on demand, 420–520px, resizable, closable with Esc or ✕):

- **Code viewer.** Clicking a citation chip opens the file at the cited range, with the
  range highlighted. A header shows repository · branch @ short SHA and a link to view
  the file on GitHub. Several files open as tabs. Data comes from
  `GET /api/context/source`, which returns at most 500 lines plus up to 50 lines of
  context per request, together with `total_lines`. The viewer opens on the cited range
  with 50 lines of context, and loads earlier or later windows of up to 500 lines on
  scroll or "Show more" (builder's call: no new endpoint). This satisfies UX-07: the
  conversation stays in place.
- **Plan view.** "View plan" opens the plan in the panel, with the existing editor
  behavior (fields, immutable versions, unsaved-edit protection under UX-11) restyled to
  match: steps as a checklist, assumptions and open questions as callouts, and an
  "Export prompt" action (ASK-06).
- **PR view.** Opens when a PR card is clicked, once F06 lands. Until then, PR cards
  aren't rendered.

### Sessions

**Session list (rail).** Sessions with a phase badge (running, needs your input,
completed with failing checks, PR open, failed) and elapsed time. A search field and
filters for active vs finished sit at the top of the rail list, and apply to loaded pages
as the current UI already discloses.

**Session page** (three panes, always):

- **Center: activity thread.**
  - The thread opens with "From plan vN · back to conversation".
  - Agent work appears as collapsible "Worked for 2m 10s · +38 −4 in 2 files" groups,
    then narrative messages.
  - Agent questions (`waiting_for_user`) appear as cards with quick-answer buttons where
    the question offers choices, plus a free-text reply.
  - Validation runs appear as steps.
  - Replay and reconnect come from the existing event APIs (UX-06), and live output
    never takes focus (UX-10).
- **Composer.** "Guide the agent while it works…" sends follow-up messages. Stop is a
  persistent button next to it whenever the session is active, with a clear termination
  result (UX-12).
- **Right panel tabs:**
  - Progress: the plan checklist with live state.
  - Diff: per-file collapsible unified diff with +/− counts and base SHA.
  - Checks: validation commands with passed/failed/not-run.
  - PR: draft publication preview and action, from the F06 contract; until F06 exists,
    the tab shows "Publishing isn't available yet" with the saved publication policy.
- **Lost connectivity** shows the last confirmed state with "Reconnecting…", never a
  running animation (F11 key states).
- **The page can be built only against the merged session UI module (`sessions.js`) and
  the session backend.** Until `task/m2-sessions` is integrated, the Sessions area shows
  one honest empty state ("Sessions aren't available in this build") with no filter
  fields.

### Repositories

- **One table** merging the GitHub catalog (`GET /api/repositories`) with index state
  (`GET /api/context/repositories`), keyed by repository ID.
- **Columns:** repository (name, language, last push), status, "Use in Ask" switch,
  "Allow changes" switch.
- **Status:** one plain badge: Indexed · keyword only, Indexed, Indexing N%, Waiting
  (rate limit, with time), Failed (with reason and Retry), Not indexed, No access. The
  contradictory "deep indexing HTTP integration pending" message is removed.
- **Switches save immediately:**
  - an optimistic UI update, rolled back with an inline error on failure;
  - "Allow changes" asks for confirmation the first time for each repository, because
    it grants implementation permission (GH-05);
  - mutations use the existing `PATCH /api/repositories/<id>` and context endpoints.
- **Top bar:** search plus filter chips (All, In Ask, Can change, Problems), and a Sync
  button with "synced <time>". Owner, language, archived and fork filters move into a
  "More filters" popover. Filters that apply to the loaded page only stay labeled that way.
- **Clicking a row opens the detail panel on the right:**
  - full name, visibility, branch @ SHA;
  - files indexed and skipped, with skipped reasons in plain words;
  - ignored paths as chips with "＋ Add" (the exclusions API);
  - Reindex now, View on GitHub;
  - a "Danger zone" with "Delete local index…", confirmed in a modal (GH-10 purge).
- **Lexical-only hint.** When no embedding role is assigned, a single banner offers
  "Turn on smarter search" and links to Settings → Models with the detected embedding
  model preselected.
- **Sample repositories** appear only in demo mode. When GitHub is connected, they are
  not listed (see "Backend additions").

### Settings

A secondary nav with five sections. Each section saves controls on change, with
optimistic feedback and inline errors; there are no per-field Save buttons.

- **GitHub:**
  - connection card (account, installations, last sync), Sync, "Manage on GitHub",
    Disconnect (with confirmation);
  - "Connect GitHub" runs the Manifest flow (below);
  - the manual App ID/slug/PEM form moves behind "Use an existing GitHub App" for
    rotation and recovery;
  - the "Index newly discovered repositories" option stays.
- **Models:**
  - one card per provider ("Ollama · this computer · connected · 7 models found",
    with Test);
  - a "Which model does what" list: one dropdown each for answering, writing plans,
    smarter code search (embeddings) and repository summaries, populated from discovered
    models plus existing profiles;
  - choosing a model that has no profile creates one with defaults, then assigns the
    role, so the user never sees the profile form. Designer's call on defaults for
    local Ollama: a 180s timeout (the current 60s default is too short for CPU-only
    models), the model's reported context length, and 1024 output tokens;
  - "Add OpenAI-compatible provider" opens a short form (name, base URL, model,
    credential), with timeouts, token limits, prices and dimensions collapsed under
    "Advanced";
  - embedding dimensions are filled in by probing the model, not typed;
  - a warning appears when a role's model is CPU-bound (Ollama `/api/ps` reports
    `size_vram: 0` for the loaded model) or the timeout is likely too short.
- **Coding agent:** execution profiles from `sessions.js`, restyled. Same behavior and
  immutable versions.
- **Privacy:** local-only switch and per-profile source-sharing opt-in, each with one
  sentence of explanation and a "Learn more" disclosure for the rest.
- **System health:** the current health cards (storage, jobs, credentials, index,
  schema), read-only, for troubleshooting.

### First-run setup

When GitHub isn't connected, no repository is indexed, or no answering model is
assigned, the Ask empty state becomes a three-step checklist. Each step shows its done
state, and the checklist disappears once all three are done.

1. **Connect GitHub** (Manifest flow).
2. **Choose repositories to search.** A checklist of discovered repositories, then
   "Index N repositories"; the user can keep going while indexing runs (UX-01, criterion 1).
3. **Pick models.** "Found Ollama with llama3.2 and nomic-embed-text. Use them?" assigns
   the answering and embedding roles in one click; "Choose…" goes to Settings → Models.

"Try the sample workspace" remains as an explicit demo link (UX-02).

### GitHub App Manifest flow

GitHub's App Manifest flow creates a GitHub App from a JSON manifest and returns its
credentials to the app. It replaces manual App creation (the step that failed today
because of trailing spaces in the Setup URL).

1. **The UI calls a new `POST /api/github/manifest/start`.** It returns the GitHub form
   action URL (`https://github.com/settings/apps/new`, or
   `https://github.com/organizations/<org>/settings/apps/new` when the user picks
   "Create under an organization" and enters its name; the personal account is the
   default), a one-time `state`, and the manifest JSON:
   - name `opendevin-<user>-<short-random>`;
   - `url` and `redirect_url` pointing to `http://127.0.0.1:<port>/api/github/manifest/callback`;
   - `setup_url` set to the existing `/api/github/callback`;
   - no `hook_attributes` (GitHub rejects loopback webhook URLs even when inactive; verified live 2026-11-15);
   - `public: false`;
   - `default_permissions` `contents: read`, `metadata: read`;
   - `request_oauth_on_install: false`, `setup_on_update: false`.
2. **The UI submits a hidden HTML form** that POSTs `manifest` to that URL, with
   `?state=`. The user reviews the pre-filled app on GitHub and clicks Create.
3. **GitHub redirects to `/api/github/manifest/callback?code=…&state=…`.** The server:
   - validates `state` (single use, short expiry, as in GH-01);
   - calls `POST https://api.github.com/app-manifests/<code>/conversions`;
   - stores the returned PEM in the OS credential store and calls the existing
     `GitHubService.configure(app_id, slug, pem)`;
   - discards the client secret and webhook secret it doesn't use, never logging them;
   - redirects to the UI, which immediately offers "Install on your repositories" (the
     existing `begin_connect` install link).
4. **Write permissions** (`contents: write`, `pull_requests: write`) are not requested at
   creation. Enabling publication later links the user to the app's permission page
   (GitHub then asks installers to approve).

The exact manifest fields, form target and conversion endpoint must be verified against
current GitHub documentation during implementation, as F01 already requires for
permission names. The design assumes GitHub accepts an `http://127.0.0.1` redirect URL
for manifest creation; if it does not, the fallback is the guided manual form, which
pre-fills the Setup URL with a copy button.

## Backend additions (small, explicit)

| Addition | Why | Where (proposed) |
|---|---|---|
| Manifest start and callback endpoints | GitHub setup in one click | `repoask/github/service.py`, `repoask/api.py` |
| Model discovery: `GET /api/provider-profiles/discover` listing local Ollama models (name, size, family, embedding-capable) via `/api/tags`, and an embedding dimension probe | Model dropdowns without typing | `repoask/providers/` |
| `/api/workspace` mode reflects the GitHub catalog: `local`/`connected` when a connection exists, `demo` only for the explicit sample workspace | The wrong "Sample workspace" badge | `repoask/platform/workspace.py` |
| Exclude bundled demo snapshots from `/api/context/repositories` when running with a data directory and a GitHub connection | Demo repos mixed into the real list | indexing/context service |
| Asset entries for new web modules | Avoid the load failure seen with `sessions.js` | `repoask/__main__.py` `ASSETS` |

None of these change existing request or response contracts; they are additions or
corrections of state labels. Contract docs in `docs/contracts/` are updated with them.

## Build phases

Each phase ships working and keeps `node --test tests/ui/*.test.mjs` green.

1. **Shell and design system:** tokens, rail, header, page scroll, honest workspace pill.
2. **Ask:** chat thread, composer, `+` picker, `@` mentions, mid-conversation scope edits,
   routing and choice cards, code viewer and plan panel.
3. **Repositories:** merged table, immediate switches, detail panel, demo exclusion.
4. **Settings:** sections, model discovery and role dropdowns, short provider form.
5. **Setup:** first-run checklist and the Manifest flow.
6. **Sessions:** three-pane page on top of the merged `sessions.js`, completed once the
   session backend integrates.

## Related defects found during the audit (out of scope, tracked separately)

- An Ask answer job hit `lease_expired` three times and blocked the single worker, so a
  later question stayed queued. `llama3.2` was running on CPU with a 60s profile
  timeout. App restarts during the audit may have contributed; the root cause is
  unconfirmed.
- The M2-SESSION-UI candidate was merged without its pending independent review (user
  decision, 2026-11-15).

## Left to the builder

- Exact visual values (colors, radii, spacing) within the token system, checked for WCAG
  AA contrast in both themes.
- Module split inside `repoask/web/`. Suggested: `shell.js`, `ask.js`, `composer.js`,
  `picker.js`, `panel.js`, `repositories.js`, `settings.js`, `setup.js`, `sessions.js`.
- How recent-list status hints are derived from existing list responses, without new
  endpoints where possible.
- Copy for empty and error states, following UX-08: name the problem, offer the next action.
