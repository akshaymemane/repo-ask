# OpenDevin UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the form-heavy web UI with a conversation-first shell: chat-style Ask with a repository picker and `@` mentions, a merged Repositories list, sectioned Settings with model discovery, a first-run checklist with GitHub App Manifest setup, and a three-pane Session page.

**Architecture:** Plain ES modules in `repoask/web/`, served as static assets by `repoask/__main__.py`. A shared shell (left rail, header, slide-in right panel) hosts one page module per route. Small shared modules (`ui.js`, `repo-source.js`, `picker.js`, `mentions.js`, `composer.js`, `thread.js`) are composed by the page modules. There are three small backend additions: workspace mode and demo exclusion, Ollama model discovery, and the GitHub App Manifest flow.

**Tech Stack:** Vanilla JS (ES modules, no build), CSS custom properties, Node `node:test` with the fake DOM in `tests/ui/dom.mjs`, Python 3.12 stdlib HTTP plus `unittest`.

**Spec:** `docs/superpowers/specs/2026-11-15-ui-redesign-design.md`

## Global Constraints

- No frontend framework, bundler or build step. Every new module gets an entry in `ASSETS` in `repoask/__main__.py`.
- Keep the hash routes and durable URLs: `#/ask`, `#/ask/<id>`, `#/plans/<id>[/<version>]`, `#/sessions`, `#/sessions/<id>`, `#/repositories`, `#/settings`, and add `#/settings/<section>`.
- Never present an unavailable action as available. Unavailable actions are absent or disabled, with a visible reason (F11 UX-02, UX-08, criterion 4).
- Status uses text plus color, never color alone. Visible focus on every control (UX-10).
- Drafts survive navigation: composer text, chip edits and plan edits (UX-11).
- Keep Stop visible in an active session (UX-12).
- Provenance (model, destination, base SHA, snapshot, usage, cost) moves to detail views and tooltips, never removed.
- Legacy in-memory demo mode (no `--data-dir`) keeps working. Its existing legacy Ask DOM is restyled only; behavior is unchanged.
- No Devin names, logos or brand colors.
- Copy uses plain words: "Use in Ask", "Allow changes", "Indexed · keyword only", "Smarter code search".
- Timeout default for auto-created local Ollama profiles is 180 seconds; output tokens 1024; context = model's reported context length.
- Run checks after each task. Use targeted Python tests, because the full Python suite has a known stall in Ask shutdown:
  - `node --test tests/ui/*.test.mjs`
  - `.venv/bin/python -m unittest discover -s tests -p '<file>'`

## Review Focus

1. **Large catalogs** (hundreds of repositories). The picker and `@` menu search on the server with cursor paging, and show only the first page plus "Load more". Typing never blocks. Test owner: Task 7.
2. **The same conversation open in two tabs.** A scope PATCH returns 409. The app reloads the conversation, re-applies the user's chip edit once, then shows an inline error if it conflicts again. Test owner: Task 11.
3. **A network failure while toggling** "Use in Ask" or "Allow changes". The switch rolls back to the saved value and shows an inline error. A second click while saving is ignored. Test owner: Task 13.
4. **A backend service is missing:**
   - `--data-dir` omitted, so no saved Ask, GitHub or providers;
   - sessions API returns 404.
   The shell still loads, and each area shows one honest empty state with no dead controls. Test owners: Task 4 and Task 17.
5. **Keyboard-only use:**
   - the picker traps focus and returns it to `+` when it closes;
   - Esc in the `@` menu closes the menu without clearing the draft;
   - Esc on the right panel closes it and returns focus to the citation.
   Test owners: Tasks 5, 8 and 12.

---

## File Structure

| File | Responsibility |
|---|---|
| `repoask/web/styles.css` | Rewritten around design tokens; legacy selectors kept for demo mode |
| `repoask/web/index.html` | Shell markup: rail, header, `#page`, `#side-panel`; legacy demo Ask block retained |
| `repoask/web/ui.js` (new) | DOM primitives: `el`, `button`, `badge`, `toggleSwitch`, `relativeTime`, `createModal` |
| `repoask/web/shell.js` (new) | Rail navigation, recent list, header, workspace pill |
| `repoask/web/panel.js` (new) | Right slide-in panel with tabs |
| `repoask/web/repo-source.js` (new) | Repository search across catalog and context; status mapping |
| `repoask/web/picker.js` (new) | Repository picker modal |
| `repoask/web/mentions.js` (new) | `@` inline menu on a textarea |
| `repoask/web/composer.js` (new) | Composer with chips, `+`, `@`, send/cancel, draft |
| `repoask/web/thread.js` (new) | Render messages, steps, citations, plan, routing and error cards |
| `repoask/web/code-viewer.js` (new) | File viewer tab for the panel |
| `repoask/web/ask.js` | Rewritten: composes composer, thread, panel; the plan editor moves into `plan-panel.js` |
| `repoask/web/plan-panel.js` (new) | Plan view and editor, extracted from `ask.js` and restyled |
| `repoask/web/repositories.js` (new) | Merged repository table and detail panel (absorbs the catalog code in `app.js` and the per-repo actions in `context.js`) |
| `repoask/web/settings.js` (new) | Settings sections: GitHub, Privacy, System health, Coding agent host |
| `repoask/web/settings-models.js` (new) | Models section: providers, discovery, role dropdowns, short provider form |
| `repoask/web/setup.js` (new) | First-run checklist and Manifest start |
| `repoask/web/sessions.js` | Re-laid out into the three-pane session page |
| `repoask/web/app.js` | Shrinks to router plus composition of shell and pages |
| `repoask/web/context.js` | Deleted at the end of Task 13 (its behavior moves to `repositories.js`) |
| `repoask/__main__.py` | `ASSETS` entries; workspace mode; manifest callback base URL |
| `repoask/platform/workspace.py` | `connected` mode |
| `repoask/context_api.py` | Demo rows excluded when GitHub is connected |
| `repoask/providers/discovery.py` (new) | Ollama model discovery and embedding dimension probe |
| `repoask/github/client.py`, `repoask/github/service.py` | Manifest conversion and in-memory manifest state |
| `repoask/api.py` | Discovery and manifest routes |
| `tests/ui/*.test.mjs` | One new test file per new module; existing tests migrated to new labels |
| `tests/test_web_assets.py` (new) | Every imported web module has an `ASSETS` entry |
| `docs/contracts/m1-services.md` | Documents `connected` mode, discovery and manifest endpoints |

Test helpers available from `tests/ui/dom.mjs`:
- `createBrowser(html, {hash, respond})`, where `respond(method, url, options)` returns `{status, body}`;
- `install(browser)`, `input(el, value)`, `keydown(el, key, props)`, `settle(rounds)`, `visibleText(el)`.
- Elements support `querySelectorAll`, `closest`, `classList`, `dataset`, `focus()` and `showModal()`.

---

## Phase 0: Backend additions

### Task 1: Honest workspace mode and demo exclusion

**Files:**
- Modify: `repoask/__main__.py:98-112` (the `/api/workspace` branch)
- Modify: `repoask/context_api.py:16-30` (`/api/context/repositories`)
- Modify: `docs/contracts/m1-services.md`
- Test: `tests/test_saved_api_boundary.py` (add cases), `tests/test_context_api.py` (add cases)

**Interfaces:**
- Produces:
  - `/api/workspace` field `mode` takes the values `"demo" | "local" | "connected"`; it is `"connected"` when `services.github.status_summary()["status"] == "connected"`.
  - `catalog.source` is `"github"` in connected mode.
  - `/api/context/repositories` omits rows whose source is `demo` while a connected GitHub connection exists.

- [ ] **Step 1: Write failing tests**

```python
def test_workspace_mode_is_connected_when_github_connected(self):
    # arrange a server with services whose github.status_summary() returns {"status": "connected", ...}
    body = self.get_json("/api/workspace")
    self.assertEqual(body["mode"], "connected")
    self.assertEqual(body["catalog"]["source"], "github")

def test_workspace_mode_stays_demo_without_connection(self):
    self.assertEqual(self.get_json("/api/workspace")["mode"], "demo")

def test_context_repositories_hide_demo_rows_when_github_connected(self):
    names = [r["name"] for r in self.get_json("/api/context/repositories")["repositories"]]
    self.assertNotIn("orders-api", names)
    self.assertIn("akshaymemane/rcnl-app", names)
```

Follow the existing server and fixture setup in each file; the GitHub fixture uses the synthetic transport already used by `tests/test_github_service.py`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `.venv/bin/python -m unittest discover -s tests -p 'test_saved_api_boundary.py'` and the same for `test_context_api.py`.
Expected: the new cases fail on `mode`, `source` and the demo name assertions.

- [ ] **Step 3: Implement**
- In `__main__.py`, after setting `result["catalog"]["github"]`, set `mode` and `catalog.source` when the summary status is `connected`.
- In `context_api.py`, add `AND source <> 'demo'` to the list query when a `github_connections` row with `status='connected'` exists. Read it in the same transaction.

- [ ] **Step 4: Run both files and confirm they pass**

- [ ] **Step 5: Document in `docs/contracts/m1-services.md`** the new mode value and the demo filter rule.

- [ ] **Step 6: Commit**

```bash
git add repoask/__main__.py repoask/context_api.py docs/contracts/m1-services.md tests/test_saved_api_boundary.py tests/test_context_api.py
git commit -m "fix: report connected workspace mode and hide demo repos once GitHub is connected"
```

### Task 2: Ollama model discovery

**Files:**
- Create: `repoask/providers/discovery.py`
- Modify: `repoask/api.py` (route), `repoask/providers/__init__.py` (export)
- Test: `tests/test_provider_discovery.py`

**Interfaces:**
- Consumes: the loopback-only transport rules in `repoask/providers/transport.py`. Reuse its URL validation; do not open a new non-loopback path.
- Produces:
  - `discover_ollama(base_url: str = "http://127.0.0.1:11434", *, transport) -> dict` returns:
    - `{"reachable": bool, "models": [{"name": str, "family": str|None, "parameter_size": str|None, "context_length": int|None, "embedding": bool, "loaded": bool, "gpu": bool|None}], "error_code": str|None}`;
    - `embedding` is true when the families contain `bert` or `nomic-bert`, or the name contains `embed`;
    - `gpu` is `size_vram > 0` from `/api/ps` (None when not loaded).
  - `probe_embedding_dimensions(base_url: str, model: str, *, transport) -> int` posts `{"model": model, "input": "dimension probe"}` to `/api/embed` and returns `len(embeddings[0])`.
  - Routes:
    - `GET /api/provider-profiles/discover` (optional `base_url`) returns `discover_ollama(...)`;
    - `POST /api/provider-profiles/discover/dimensions` with body `{base_url, model}` returns `{"dimensions": int}`.

- [ ] **Step 1: Write failing tests** with a fake transport:

```python
def test_discovery_lists_models_and_flags_embeddings(self):
    t = FakeTransport({"/api/tags": {"models": [
        {"name": "llama3.2:latest", "details": {"family": "llama", "families": ["llama"], "parameter_size": "3.2B"}},
        {"name": "nomic-embed-text:latest", "details": {"family": "nomic-bert", "families": ["nomic-bert"]}}]},
        "/api/ps": {"models": [{"name": "llama3.2:latest", "size_vram": 0, "context_length": 8192}]}})
    out = discover_ollama(transport=t)
    self.assertTrue(out["reachable"])
    by = {m["name"]: m for m in out["models"]}
    self.assertTrue(by["nomic-embed-text:latest"]["embedding"])
    self.assertEqual(by["llama3.2:latest"]["gpu"], False)
    self.assertEqual(by["llama3.2:latest"]["context_length"], 8192)

def test_discovery_unreachable_is_not_an_exception(self):
    out = discover_ollama(transport=FakeTransport(raise_connection=True))
    self.assertEqual(out, {"reachable": False, "models": [], "error_code": "provider_unreachable"})

def test_discovery_rejects_non_loopback(self):
    with self.assertRaises(ValueError):
        discover_ollama("http://example.com:11434", transport=FakeTransport({}))

def test_probe_embedding_dimensions(self):
    t = FakeTransport({"/api/embed": {"embeddings": [[0.0] * 768]}})
    self.assertEqual(probe_embedding_dimensions("http://127.0.0.1:11434", "nomic-embed-text:latest", transport=t), 768)
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `.venv/bin/python -m unittest discover -s tests -p 'test_provider_discovery.py'`. Expected: ImportError.
- [ ] **Step 3: Implement** `discovery.py` and the two routes in `api.py`, next to the existing `/api/provider-profiles` handling.
- [ ] **Step 4: Run the tests and confirm they pass**, plus `test_providers_service.py`.
- [ ] **Step 5: Document** both routes in `docs/contracts/m1-services.md`.
- [ ] **Step 6: Commit** with message `feat: discover local Ollama models and probe embedding dimensions`.

### Task 3: GitHub App Manifest flow (backend)

**Files:**
- Modify: `repoask/github/client.py`, `repoask/github/service.py`, `repoask/api.py`, `repoask/__main__.py` (pass `public_base_url`)
- Test: `tests/test_github_manifest.py`

**Interfaces:**
- Consumes: `GitHubService.configure(app_id, slug, private_key, *, index_new=False)` (existing).
- Produces:
  - `GitHubClient.convert_manifest(code: str) -> dict` makes an unauthenticated `POST /app-manifests/{code}/conversions` and returns `{id, slug, pem}`. Other fields are dropped before returning.
  - `GitHubService.begin_manifest(*, public_base_url: str, organization: str | None = None) -> dict` returns `{"action": str, "state": str, "manifest": dict, "expires_at": int}`:
    - state is in-memory, single use, valid 10 minutes;
    - `organization` must match `^[A-Za-z0-9-]{1,39}$`.
  - `GitHubService.finish_manifest(state: str, code: str) -> dict` validates and consumes the state, converts the manifest, calls `configure(...)` and returns the public connection.
  - Errors are `GitHubError` with code `manifest_state_invalid` (unknown, used or expired) or `manifest_conversion_failed`.
  - Routes:
    - `POST /api/github/manifest/start` with body `{organization?}` returns the begin payload;
    - `GET /api/github/manifest/callback?code&state` redirects with 303 to `/#/settings/github?github=manifest_created`, or `?github=<error_code>`.
  - Manifest JSON, exact:
    - `name: "opendevin-" + <random 6 lowercase hex>`;
    - `url` and `redirect_url`: `<public_base_url>/api/github/manifest/callback`;
    - `setup_url: <public_base_url>/api/github/callback`;
    - `hook_attributes: {"url": <public_base_url>/api/github/webhook-disabled, "active": false}`;
    - `public: false`;
    - `default_permissions: {"contents": "read", "metadata": "read"}`;
    - `default_events: []`;
    - `request_oauth_on_install: false`;
    - `setup_on_update: false`.
  - `public_base_url` is `http://127.0.0.1:<port>` built in `__main__.py` from the bound port.

- [ ] **Step 1: Write failing tests** with the synthetic GitHub transport:

```python
def test_begin_manifest_pins_urls_and_read_only_permissions(self):
    out = self.service.begin_manifest(public_base_url="http://127.0.0.1:8765")
    m = out["manifest"]
    self.assertEqual(out["action"], "https://github.com/settings/apps/new")
    self.assertEqual(m["setup_url"], "http://127.0.0.1:8765/api/github/callback")
    self.assertEqual(m["redirect_url"], "http://127.0.0.1:8765/api/github/manifest/callback")
    self.assertEqual(m["default_permissions"], {"contents": "read", "metadata": "read"})
    self.assertFalse(m["hook_attributes"]["active"])
    self.assertRegex(m["name"], r"^opendevin-[0-9a-f]{6}$")

def test_begin_manifest_for_organization(self):
    out = self.service.begin_manifest(public_base_url="http://127.0.0.1:8765", organization="acme-co")
    self.assertEqual(out["action"], "https://github.com/organizations/acme-co/settings/apps/new")

def test_finish_manifest_configures_connection_once(self):
    start = self.service.begin_manifest(public_base_url="http://127.0.0.1:8765")
    self.transport.reply("POST", "/app-manifests/abc/conversions", {"id": 42, "slug": "opendevin-a1b2c3", "pem": TEST_PEM, "client_secret": "s", "webhook_secret": "w"})
    conn = self.service.finish_manifest(start["state"], "abc")
    self.assertEqual(conn["app_id"], "42")
    with self.assertRaises(GitHubError) as e:
        self.service.finish_manifest(start["state"], "abc")
    self.assertEqual(e.exception.code, "manifest_state_invalid")

def test_finish_manifest_rejects_expired_state(self):
    start = self.service.begin_manifest(public_base_url="http://127.0.0.1:8765")
    self.clock.advance(600_001)
    with self.assertRaises(GitHubError):
        self.service.finish_manifest(start["state"], "abc")

def test_secrets_never_logged_or_returned(self):
    ...  # assert client_secret/webhook_secret/pem absent from the finish return value and from captured log output
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `.venv/bin/python -m unittest discover -s tests -p 'test_github_manifest.py'`.
- [ ] **Step 3: Implement** the client method, the service methods (states in a dict guarded by a lock, keyed by sha256 of the state), the routes, and `public_base_url` wiring.
- [ ] **Step 4: Run** `test_github_manifest.py`, `test_github_service.py` and `test_github_client.py`, and confirm they pass.
- [ ] **Step 5: Verify against current GitHub documentation**: the manifest fields, the form action URLs and the conversion endpoint. Record the doc URL and the date checked in `docs/contracts/m1-services.md`, together with the route docs.
- [ ] **Step 6: Commit** with message `feat: create GitHub App from a manifest and store its key automatically`.

---

## Phase 1: Shell and design system

### Task 4: Tokens, shell markup, shell and panel modules, asset guard

**Files:**
- Modify: `repoask/web/styles.css`, `repoask/web/index.html`, `repoask/web/app.js`, `repoask/__main__.py` (`ASSETS`), `tests/ui/css.mjs` (resolve `var()` from `:root`)
- Create: `repoask/web/shell.js`, `repoask/web/panel.js`, `tests/ui/shell.test.mjs`, `tests/test_web_assets.py`
- Migrate: `tests/ui/app.test.mjs` (selectors for nav, workspace pill, focus styles)

**Interfaces:**
- Produces:
  - `createShell({document}) -> {setRoute(route: string): void, setRecent(items: Array<{href, title, meta, attention?: boolean}>, {heading: string}): void, setHeader({title: string, pills?: Array<{text, tone?}>}): void, setWorkspaceMode(mode: "demo"|"local"|"connected"): void, page: HTMLElement}`.
  - `createSidePanel(host: HTMLElement) -> {openTab({id: string, title: string, render: (body: HTMLElement) => void, href?: string}): void, closeTab(id): void, close(): void, isOpen(): boolean}`:
    - Esc and ✕ close the panel;
    - on close, focus returns to the element that was focused when the first tab opened.
  - DOM ids: `#rail`, `#rail-nav`, `#recent`, `#page-header`, `#page`, `#side-panel`. The legacy `#view-ask` block stays, rendered only in demo mode.
  - CSS tokens on `:root`:
    - colors: `--surface`, `--raised`, `--border`, `--text`, `--muted`, `--accent`, `--success`, `--warning`, `--danger`, `--info`;
    - `--radius`, `--space-1..6`;
    - a dark default and a light theme under `@media (prefers-color-scheme: light)`.
  - `tests/ui/css.mjs` gains `var(--name)` resolution from `:root` declarations.

- [ ] **Step 1: Write failing tests**

```js
test('shell renders rail nav with Sessions and marks the current route', async () => {
  // createBrowser(html, {hash:'#/repositories', respond: legacyDemoResponder}); install; import app.js; settle
  const nav = b.document.getElementById('rail-nav');
  assert.deepEqual(nav.querySelectorAll('a').map(a => a.textContent.trim()), ['Ask', 'Sessions', 'Repositories']);
  assert.equal(nav.querySelector('a[aria-current="page"]').textContent.trim(), 'Repositories');
  assert.ok(b.document.querySelector('#rail a[href="#/settings"]'));
});

test('workspace pill shows only in demo mode', async () => {
  // responder returns /api/workspace mode "connected"
  assert.equal(b.document.getElementById('workspace-mode').hidden, true);
});

test('side panel closes on Escape and restores focus', async () => {
  const opener = b.document.createElement('button'); b.document.body.append(opener); opener.focus();
  const panel = createSidePanel(b.document.getElementById('side-panel'));
  panel.openTab({id: 'f', title: 'api.ts', render: body => body.append('x')});
  keydown(b.document.getElementById('side-panel'), 'Escape');
  assert.equal(panel.isOpen(), false);
  assert.equal(b.document.activeElement, opener);
});

test('app shell loads when saved services return 404', async () => {
  // responder: only legacy endpoints succeed; /api/github/*, /api/provider-profiles, /api/sessions return 404
  assert.match(visibleText(b.document.body), /Ask/);
  assert.equal(b.document.querySelectorAll('#page button[disabled]:not([title])').length, 0);
});
```

```python
class WebAssetsTest(unittest.TestCase):
    def test_every_imported_module_is_served(self):
        # parse `from "./x.js"` and `import("./x.js")` in repoask/web/*.js; assert "/x.js" in repoask.__main__.ASSETS
        ...
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `node --test tests/ui/shell.test.mjs` and `.venv/bin/python -m unittest discover -s tests -p 'test_web_assets.py'`.
- [ ] **Step 3: Implement**
  - Shell markup and modules.
  - Token-based CSS:
    - body scrolls, with the rail and composer `position: sticky`;
    - focus rings use `outline: 2px solid var(--accent)`.
  - `app.js` builds the shell and routes into `#page`. `ASSETS` gets `shell.js` and `panel.js`.
  - Update `app.test.mjs` selectors. Keep every behavioral assertion.
- [ ] **Step 4: Run** `node --test tests/ui/*.test.mjs` and `test_web_assets.py`. Expected: all pass. The 2 known session-backend failures in `session-services.test.mjs` remain until that backend integrates.
- [ ] **Step 5: Commit** with message `feat(web): add token-based shell with rail, header and slide-in panel`.

### Task 5: UI primitives and accessible modal

**Files:**
- Create: `repoask/web/ui.js`, `tests/ui/ui.test.mjs`
- Modify: `repoask/__main__.py` (`ASSETS`)

**Interfaces:**
- Produces, from `ui.js`:
  - `el(tag, text?, className?) -> HTMLElement`
  - `button(parent, text, onClick, {variant?: "primary"|"danger"|"ghost", title?}) -> HTMLButtonElement`
  - `badge(tone: "ok"|"warn"|"info"|"danger"|"off", text) -> HTMLElement`
  - `toggleSwitch({label, checked, onChange: (next: boolean) => Promise<void>}) -> {root, set(checked: boolean): void}`:
    - renders `button[role=switch][aria-checked]`;
    - flips optimistically and calls `onChange`;
    - on reject, reverts and shows the error text in an `aria-live` element;
    - ignores clicks while pending.
  - `relativeTime(ms: number, now = Date.now()) -> string` returns "now", "N min ago", "N h ago", "yesterday", or a `D Mon` date.
  - `createModal({title, onClose?}) -> {root, body, footer, open(trigger: HTMLElement): void, close(result?): void, closed: Promise<any>}`:
    - uses `<dialog>` with `showModal`;
    - Tab and Shift+Tab cycle within the dialog;
    - Esc closes with `null`;
    - focus returns to `trigger`.

- [ ] **Step 1: Write failing tests**

```js
test('toggleSwitch reverts and announces on failure, ignores double click', async () => {
  let calls = 0;
  const s = toggleSwitch({label: 'Use in Ask', checked: false, onChange: () => { calls++; return Promise.reject(new Error('Network down')); }});
  s.root.querySelector('[role=switch]').click(); s.root.querySelector('[role=switch]').click(); await settle();
  assert.equal(calls, 1);
  assert.equal(s.root.querySelector('[role=switch]').getAttribute('aria-checked'), 'false');
  assert.match(visibleText(s.root), /Network down/);
});

test('modal traps focus, closes on Escape with null and restores focus', async () => {
  const trigger = button(b.document.body, '+', () => {});
  const m = createModal({title: 'Choose repositories'});
  const a = button(m.body, 'A', () => {}); const z = button(m.footer, 'Z', () => {});
  m.open(trigger); z.focus(); keydown(z, 'Tab');
  assert.equal(b.document.activeElement, a);
  keydown(m.root, 'Escape'); assert.equal(await m.closed, null);
  assert.equal(b.document.activeElement, trigger);
});

test('relativeTime buckets', () => {
  const now = Date.UTC(2026, 10, 15, 12);
  assert.equal(relativeTime(now - 30_000, now), 'now');
  assert.equal(relativeTime(now - 5 * 60_000, now), '5 min ago');
  assert.equal(relativeTime(now - 3 * 3_600_000, now), '3 h ago');
  assert.equal(relativeTime(now - 26 * 3_600_000, now), 'yesterday');
});
```

- [ ] **Step 2: Run** `node --test tests/ui/ui.test.mjs`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `ui.js` and add it to `ASSETS`.
- [ ] **Step 4: Run** `node --test tests/ui/*.test.mjs`. Expected: PASS.
- [ ] **Step 5: Commit** with message `feat(web): add shared UI primitives and focus-trapping modal`.

---

## Phase 2: Ask

### Task 6: Repository source and status mapping

**Files:**
- Create: `repoask/web/repo-source.js`, `tests/ui/repo-source.test.mjs`
- Modify: `repoask/__main__.py` (`ASSETS`)

**Interfaces:**
- Consumes: `GET /api/context/repositories?query=&cursor=&limit=` returns items with `repository_id`, `name`, `status`, `eligible`, `active_snapshot.coverage`, `progress?`. `GET /api/repositories` returns catalog items with `id`, `owner`, `name`, `language`, `pushed_at`, `index_enabled`, `implementation_enabled`, `access_state`.
- Produces:
  - `repoStatus(contextItem, catalogItem?) -> {tone, label}`, using exactly these labels:
    - `"Indexed · keyword only"` (warn) when coverage mode is `lexical_only`;
    - `"Indexed"` (ok);
    - `"Indexing N%"` (info);
    - `"Waiting until HH:MM"` (info), for rate limits;
    - `"Failed"` (danger);
    - `"Not indexed"` (off);
    - `"No access"` (off) when `access_state === "inaccessible"`.
  - `searchRepositories(request, {query = "", cursor = null, limit = 25}) -> Promise<{items: Array<{id, name, owner, language, status: {tone,label}, selectable: boolean}>, nextCursor: string|null}>`.
    - Items are context items enriched from catalog items by `id`. Short `name` is the part after `/`.
    - `selectable` is `eligible && status.label !== "Not indexed" && status.label !== "No access"`.
  - `recentRepositoryIds(): string[]` reads `localStorage["od.recentRepos"]`, max 8, inside try/catch. `rememberRepositories(ids: string[]): void`.

- [ ] **Step 1: Write failing tests** for every status label, for the selectable rule, for paging passthrough (`nextCursor`), and for `localStorage` throwing (no exception, returns `[]`).
- [ ] **Step 2: Run** `node --test tests/ui/repo-source.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run all UI tests.** Expected: PASS.
- [ ] **Step 5: Commit** with message `feat(web): add repository search and plain status labels`.

### Task 7: Repository picker modal

**Files:**
- Create: `repoask/web/picker.js`, `tests/ui/picker.test.mjs`
- Modify: `repoask/__main__.py` (`ASSETS`)

**Interfaces:**
- Consumes: `createModal`, `badge` (Task 5); `searchRepositories`, `recentRepositoryIds` (Task 6).
- Produces: `openRepoPicker({request, selected: string[], trigger: HTMLElement}) -> Promise<Array<{id, name}> | null>`.
  - The search field is focused on open; typing debounces 200 ms, then calls `searchRepositories`.
  - Groups: "Recently used", then "All repositories · N". With a query, results are a single list.
  - Unselectable rows render disabled. A "Not indexed" row has an "Index now" button that calls `POST /api/repositories/<id>/index`.
  - Keyboard: ↑/↓ moves the highlight, Space toggles, Enter confirms.
  - Footer: "N selected", Cancel, and "Add N" (disabled at 0 changes).
  - "Load more" appears when `nextCursor` is set.

- [ ] **Step 1: Write failing tests**

```js
test('picker selects two repos and resolves with them', async () => { /* open, click two rows, click "Add 2" -> [{id:'gh:1',...},{id:'gh:2',...}] */ });
test('picker search hits the server and shows Load more for 300 repos', async () => {
  // responder returns 25 items + next_cursor for query "", then items 26-50 for that cursor
  // assert 25 rows, click "Load more", assert 50 rows, assert request URLs carried cursor
});
test('typing does not issue a request per keystroke', async () => { /* input "r","rc","rcn" quickly -> 1 request after debounce */ });
test('not-indexed repo is disabled with Index now', async () => {});
test('Escape resolves null and focus returns to trigger', async () => {});
```

- [ ] **Step 2: Run** `node --test tests/ui/picker.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.** Debounce with `setTimeout`, so tests use `settle()`. The fake DOM's `setTimeout` is real, so the debounce test awaits 250 ms.
- [ ] **Step 4: Run all UI tests.** Expected: PASS.
- [ ] **Step 5: Commit** with message `feat(web): add searchable repository picker`.

### Task 8: `@` mentions

**Files:**
- Create: `repoask/web/mentions.js`, `tests/ui/mentions.test.mjs`
- Modify: `repoask/__main__.py` (`ASSETS`)

**Interfaces:**
- Consumes: `searchRepositories` (Task 6).
- Produces: `attachMentions(textarea, {request, onPick: (repo: {id, name}) => void}) -> {detach(): void}`.
  - The menu opens when the character before the caret is `@` and is at the start of the text or after whitespace.
  - The query is the text from `@` to the caret, up to 40 characters with no spaces.
  - It shows up to 8 results (debounced 150 ms). ↑/↓ moves the highlight, and Enter or Tab picks; when a pick happens, the `@query` text is removed from the textarea and `onPick` is called.
  - Esc closes the menu and leaves the text as typed.
  - Enter while the menu is open never submits the composer: `preventDefault` plus `stopPropagation`.
  - The menu is a `role=listbox`, and the textarea gets `aria-activedescendant`.

- [ ] **Step 1: Write failing tests**: open on `@rc` and pick with Enter (text becomes empty, `onPick` gets rcnl-app); Esc keeps `"@rc"`; an email `a@b` does not open; Enter while open does not trigger a form submit.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run all UI tests and confirm they pass.**
- [ ] **Step 5: Commit** with message `feat(web): add @ repository mentions`.

### Task 9: Composer

**Files:**
- Create: `repoask/web/composer.js`, `tests/ui/composer.test.mjs`
- Modify: `repoask/__main__.py` (`ASSETS`)

**Interfaces:**
- Consumes: `openRepoPicker` (Task 7), `attachMentions` (Task 8), `el`, `button` (Task 5).
- Produces: `createComposer({request, placeholder, onSend: ({text, repositoryIds}) => Promise<void>, onScopeChange: (ids: string[]) => Promise<void>, onCancel: () => Promise<void>, draftKey: string}) -> {root, setChips(repos: Array<{id, name}>): void, setBusy(busy: boolean): void, focus(): void}`.
  - Enter sends; Shift+Enter adds a new line; an empty text does nothing.
  - While busy, the send button becomes "Cancel" and calls `onCancel`, and the textarea stays editable.
  - Chips render `name ✕`. Clicking ✕, or adding via `+` or `@`, calls `onScopeChange` with the new full ID list.
  - On rejection, the chips revert and the error shows inline.
  - The draft text persists in `sessionStorage[draftKey]` (try/catch), is restored on create, and is cleared after a successful send.
  - Copy: placeholder `"Ask about your code, or describe a change…"`; the `+` button has `aria-label="Add repositories"`.

- [ ] **Step 1: Write failing tests**: Enter vs Shift+Enter; a busy state shows Cancel; ✕ calls `onScopeChange` without that ID; a rejected scope change restores the chip; the draft survives re-creation with the same `draftKey`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run all UI tests and confirm they pass.**
- [ ] **Step 5: Commit** with message `feat(web): add chat composer with repository chips`.

### Task 10: Thread rendering

**Files:**
- Create: `repoask/web/thread.js`, `tests/ui/thread.test.mjs`
- Modify: `repoask/__main__.py` (`ASSETS`)

**Interfaces:**
- Consumes: the conversation payload from `GET /api/conversations/<id>` (`messages[]` with `role`, `state`, `content`, `citations?`; `runs[]`; `plans[]`; `repository_ids`), and routing decisions from `GET /api/route/<id>`.
- Produces: `renderThread(host, view, handlers) -> void`.
  - `view` is `{messages, runs, plans, routing?: {state, candidates[], explanation}, scopeEvents?: Array<{kind: "added"|"removed", name}>, staleScopeSincePlan?: {planId, addedNames: string[]}}`.
  - `handlers` is `{onCitation(citation, trigger), onViewPlan(planId), onStartSession(planId), onRegenerate(planId), onRetry(runId), onPickRoute(repositoryId), onChooseRepos()}`.
  - Rendering:
    - user messages: `.msg-user`;
    - assistant answers: `.msg-assistant`, with citation chips as `button.cite` labelled `file:start–end`;
    - an "ⓘ" detail button shows model, destination, usage and cost;
    - pending: `"Waiting for the model…"` plus elapsed time, never the run ID;
    - failure: an error text plus a Retry button;
    - routing resolved: a muted step `"Looked in <name> because <reason> · change"`;
    - routing `needs_selection`: a card `"Which repository?"` with one button per candidate plus "Choose…";
    - plans: a card with title, `N steps`, `vN`, "View plan" and "Start session". "Start session" is disabled with `title` set to the readiness reason when the plan isn't ready;
    - when `staleScopeSincePlan` is set, the plan card shows `"Made before <names> was added · Regenerate"`.

- [ ] **Step 1: Write failing tests**, one per rendering rule above. Assert the exact copy strings, and that no `answer_` or `conv_` ID appears in `visibleText`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.** Reuse `addInlineCode` and highlighting logic from legacy `app.js` by moving them into `thread.js` and re-importing in `app.js`.
- [ ] **Step 4: Run all UI tests and confirm they pass.**
- [ ] **Step 5: Commit** with message `feat(web): render Ask as a chat thread`.

### Task 11: Ask page composition

**Files:**
- Modify: `repoask/web/ask.js` (rewrite; keep the export `createAskPanel`)
- Create: `repoask/web/plan-panel.js` (the plan view and editor extracted unchanged in behavior from the current `ask.js`, then restyled)
- Migrate: `tests/ui/ask.test.mjs`, `tests/ui/ask-recovery.test.mjs` to the new labels. Keep every behavioral assertion: immutable versions, conflicts, export, recovery, cancel and retry.

**Interfaces:**
- Consumes: `createComposer` (Task 9), `renderThread` (Task 10), `createSidePanel` (Task 4), `rememberRepositories` (Task 6), `shell.setRecent` and `shell.setHeader` (Task 4).
- Produces:
  - `createAskPanel({host, request, panel, shell, onMount}) -> Promise<void>`. The new `panel` and `shell` parameters are passed from `app.js`.
  - `openPlanPanel(panel, {request, planId, versionId?}) -> void`, from `plan-panel.js`.
  - Behavior:
    - `#/ask` with no ID shows `"What are we working on?"` and the composer; no request is made until send.
    - The first send runs `POST /api/conversations {title: first 60 chars trimmed at a word boundary, repository_ids}`, then `location.hash = #/ask/<id>`, then sends the message.
    - With no chips, the send calls `POST /api/route` first and renders the routing outcome. On `needs_selection`, the message isn't sent until the user picks.
    - A scope change calls `PATCH /api/conversations/<id> {repository_ids, expected_revision}`. On 409 it reloads, re-applies the edit once, and on a second 409 shows `"Someone changed this conversation's repositories. Reload to see the latest."`
    - Each scope change appends a scope event to the thread.
    - Pending runs poll `GET /api/conversations/<id>` every 2 s while any run is `queued` or `running`, and stop when the route changes.
    - The Recent list shows `GET /api/conversations` items with title (falling back to `"Untitled · <relativeTime>"`), relative time and repository names.
    - The header shows the title, one pill per repository in scope, and a model pill `"<ask model> · local"` (from `/api/workspace` `providers.profiles.roles.ask`). Clicking the model pill opens a popover with the destination, local-only policy, profile status and the usage note.

- [ ] **Step 1: Write failing tests**

```js
test('first send creates a titled conversation with chosen repos and navigates', async () => {
  // pick rcnl-app via picker, type "What does rcnl-app do and how is it structured?", Enter
  // assert POST /api/conversations body {title:'What does rcnl-app do and how is it structured?', repository_ids:['gh:1444557814']}
  // assert location.hash === '#/ask/conv_new'
});
test('adding a 5th repo mid-conversation PATCHes scope and marks the plan stale', async () => {});
test('scope 409 reapplies once, then shows the conflict message', async () => {
  // responder: first PATCH 409, GET returns revision 3, second PATCH 409 again
  // assert exactly 2 PATCH calls and the conflict copy visible
});
test('unscoped send routes first and waits for a repository choice', async () => {});
test('recent list shows titles, not conversation ids', async () => {});
```

- [ ] **Step 2: Run** `node --test tests/ui/ask*.test.mjs`. Expected: the new tests fail, and the migrated tests fail on old labels until the implementation lands.
- [ ] **Step 3: Implement** `ask.js` and `plan-panel.js`. Pass `panel` and `shell` from `app.js`. Add `plan-panel.js` to `ASSETS`.
- [ ] **Step 4: Run all UI tests and confirm they pass.**
- [ ] **Step 5: Real-browser check** on a scratch data dir: run `.venv/bin/python -m repoask --data-dir <scratch> --port 8897`, then create a conversation, pick a repo, ask, open a citation, and add a repo mid-thread. Record screenshots under `docs/agents/runs/UI-REDESIGN/`.
- [ ] **Step 6: Commit** with message `feat(web): rebuild Ask as a chat with picker, mentions and mid-conversation scope`.

### Task 12: Code viewer in the side panel

**Files:**
- Create: `repoask/web/code-viewer.js`, `tests/ui/code-viewer.test.mjs`
- Modify: `repoask/web/ask.js` (the `onCitation` handler), `repoask/__main__.py` (`ASSETS`)

**Interfaces:**
- Consumes: `GET /api/context/source?repository_id&snapshot_id&path&start_line&end_line&context_lines` returns `{revision, path, first_line, lines[], total_lines}`. Ranges are capped at 500 lines with up to 50 lines of context. Also consumes `createSidePanel` (Task 4).
- Produces: `openSource(panel, citation, {request, githubUrl?}) -> void`.
  - Opens or focuses a tab with ID `repository_id:path` and title the file's basename.
  - The header reads `<owner/name> · <branch> @ <short sha>` plus an "↗ GitHub" link built from the catalog `clone_url` when known.
  - The first load uses `context_lines=50`, and the cited lines get the `.hl` class.
  - "Show earlier" and "Show more" load windows of up to 500 lines, clamped to `1..total_lines`.

- [ ] **Step 1: Write failing tests**:
  - cited lines highlighted;
  - the "Show more" request has `start_line = last + 1` and `end_line = min(total, last + 500)`;
  - a second citation for the same file reuses the tab;
  - Esc closes the panel and focus returns to the citation button.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run all UI tests and confirm they pass.**
- [ ] **Step 5: Commit** with message `feat(web): open citations in a code viewer panel`.

---

## Phase 3: Repositories

### Task 13: Merged repositories page

**Files:**
- Create: `repoask/web/repositories.js`, `tests/ui/repositories.test.mjs`
- Modify: `repoask/web/app.js` (remove the catalog panel code, `renderRepositories`, `loadCatalog` and the filters), `repoask/__main__.py` (`ASSETS`; remove `context.js`)
- Delete: `repoask/web/context.js` and `tests/ui/context.test.mjs`, after moving their behavioral cases into `repositories.test.mjs`: exclusions, purge, reindex, and edits preserved across save.
- Migrate: `tests/ui/catalog.test.mjs` cases into `repositories.test.mjs`, then delete `catalog.test.mjs`.

**Interfaces:**
- Consumes: `searchRepositories`, `repoStatus` (Task 6); `toggleSwitch`, `createModal`, `badge` (Task 5); `createSidePanel` (Task 4); `PATCH /api/repositories/<id>` with `{index_enabled?, implementation_enabled?}`; `PATCH /api/repositories/<id>/context`; `/api/repositories/<id>/exclusions`; `POST /api/repositories/<id>/index`; `POST /api/repositories/<id>/purge`; `POST /api/github/refresh`.
- Produces: `createRepositoriesPage({host, request, panel, shell}) -> {refresh(): Promise<void>}`.
  - Top bar:
    - a search field (debounced 200 ms, server-side);
    - filter chips `All`, `In Ask`, `Can change`, `Problems`, where Problems means Failed, No access or Waiting;
    - "More filters" popover with owner, language, archived and fork, labeled `"Applies to loaded rows"`;
    - `↻ Sync` with `"synced <relativeTime>"`.
  - Table columns: Repository, Status, Use in Ask, Allow changes.
  - Turning on "Allow changes" for a repository the first time opens a confirm modal: `"Allow OpenDevin to push branches and open PRs in <name>? You can turn this off any time."` The repository ID is remembered in `localStorage["od.allowConfirmed"]`.
  - Clicking a row opens a panel tab with:
    - full name, visibility, branch @ SHA;
    - `"N files indexed · M skipped"` with plain reasons: `"generated"` becomes "generated files", `"sensitive"` becomes "files that look like secrets", `"binary_or_sensitive"` becomes "binary or secret-like files";
    - ignored-path chips plus "＋ Add";
    - "Reindex now", "↗ GitHub";
    - a "Danger zone" with "Delete local index…" and a confirm modal.
  - When no embedding role is assigned, a banner reads `"Answers use keyword search only. Turn on smarter search"` and links to `#/settings/models`.

- [ ] **Step 1: Write failing tests**, including:
  - Review Focus 3: a toggle network failure reverts and shows an error; a second click while pending is ignored.
  - "Allow changes" confirm appears only the first time.
  - Problems filter.
  - Detail panel skipped-reason copy.
  - Purge requires the confirm.
  - No 64-character hash appears in `visibleText`.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement, then delete the replaced code and tests.**
- [ ] **Step 4: Run all UI tests and `test_web_assets.py`, and confirm they pass.**
- [ ] **Step 5: Commit** with message `feat(web): merge repository catalog and index state into one list`.

---

## Phase 4: Settings

### Task 14: Settings sections: GitHub, Privacy, System health, Coding agent

**Files:**
- Create: `repoask/web/settings.js`, `tests/ui/settings.test.mjs`
- Modify: `repoask/web/app.js` (remove `renderSettings`, `loadGitHub`, the health cards and the settings parts of `refreshStatus`), `repoask/web/sessions.js` (`createExecutionSettings` mounts into a host element passed in), `repoask/__main__.py` (`ASSETS`)
- Migrate: settings-related cases in `app.test.mjs` and `services.test.mjs`.

**Interfaces:**
- Consumes: `/api/github/connections`, `/api/github/connect`, `/api/github/refresh`, `/api/github/disconnect`, `/api/github/configure`, `/api/github/manifest/start` (Task 3); `/api/provider-profiles` settings (local-only); `/api/health`; `createExecutionSettings` (existing).
- Produces: `createSettingsPage({host, request, shell, sections: {models: (host) => void}}) -> {show(section: "github"|"models"|"agent"|"privacy"|"health"): void}`.
  - The route is `#/settings/<section>`, defaulting to `github`.
  - **GitHub section:**
    - a connection card with account, installations count and `"synced <relativeTime>"`;
    - buttons Sync, "Install on more repositories" (the `begin_connect` link) and Disconnect (confirm modal);
    - when nothing is configured, "Connect GitHub" runs the Manifest flow: `POST /api/github/manifest/start`, then a hidden form `method=post action=<action>?state=<state>` with a hidden `manifest` input, then `submit()`;
    - "Create under an organization" reveals an organization field;
    - the manual form appears under a "Use an existing GitHub App" disclosure;
    - a `?github=<code>` query after the hash maps to a status line: `connected` → "GitHub connected", `manifest_created` → "App created. Now install it on your repositories." with the install button, anything else → "GitHub setup failed: <code in words>. Try again." plus a retry.
  - **Privacy section:** a local-only `toggleSwitch` that saves immediately, with one sentence of explanation plus a "Learn more" `<details>`.
  - **System health section:** the existing health data rendered read-only.
  - **Coding agent section:** `createExecutionSettings` mounted into this section. When the API returns 404, it shows "The coding agent isn't available in this build."

- [ ] **Step 1: Write failing tests**:
  - section routing via hash;
  - the manifest form posts the manifest JSON (the form action includes the state, and the hidden input value parses as JSON with `setup_url`);
  - status-line mapping for each code;
  - the local-only switch saves without a Save button;
  - Coding agent shows the unavailable text on 404.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement and remove the replaced `app.js` code.**
- [ ] **Step 4: Run all UI tests and confirm they pass.**
- [ ] **Step 5: Commit** with message `feat(web): split settings into sections with one-click GitHub setup`.

### Task 15: Models section

**Files:**
- Create: `repoask/web/settings-models.js`, `tests/ui/settings-models.test.mjs`
- Modify: `repoask/web/app.js` (remove `loadProviders` and `renderProviderEditor`), `repoask/__main__.py` (`ASSETS`)

**Interfaces:**
- Consumes:
  - `GET /api/provider-profiles/discover`, `POST /api/provider-profiles/discover/dimensions` (Task 2);
  - `GET/POST/PATCH/DELETE /api/provider-profiles[/<id>]`, `POST /api/provider-profiles/<id>/test`;
  - `GET/PATCH /api/settings/model-roles` (roles `ask`, `planning`, `summary`, `embedding`).
- Produces: `mountModels(host, {request}) -> void`.
  - Provider card: `"Ollama · this computer"` with `"● connected · N models found"` or `"Not running. Start Ollama, then Retry."`, plus Test.
  - Role rows with exact labels:
    - `ask` → "Answering questions";
    - `planning` → "Writing plans";
    - `embedding` → "Smarter code search";
    - `summary` → "Repository summaries".
    Each row has one `<select>` listing existing profiles plus discovered models without a profile (chat models for ask, planning and summary; `embedding: true` models for embedding), plus "Off".
  - Choosing a discovered model:
    1. creates a profile `{name: <model>, adapter: "ollama", base_url, model, capabilities: chat → ["chat","structured_output"], embedding → ["embeddings"], timeout_seconds: 180, context_tokens: <context_length or 8192>, max_output_tokens: 1024, embedding_dimensions: <probe>}`;
    2. assigns the role;
    3. reverts the select on failure.
  - Warning line when the role's model has `gpu === false`: `"<model> runs on the CPU here; long answers can take over a minute."`
  - "＋ Add OpenAI-compatible provider" opens a modal with name, base URL, model and credential, plus an "Advanced" `<details>` for timeout, context, output, prices and source-sharing opt-in.

- [ ] **Step 1: Write failing tests**:
  - discovered `nomic-embed-text` appears only in the Smarter code search select;
  - choosing it POSTs a profile with `embedding_dimensions: 768` and `timeout_seconds: 180`, then PATCHes the role;
  - a failed role save reverts the select;
  - the CPU warning copy;
  - unreachable Ollama copy.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.** Use the exact field names from the existing profile create payload in `app.js` `renderProviderEditor`; read it before deleting.
- [ ] **Step 4: Run all UI tests and confirm they pass.**
- [ ] **Step 5: Commit** with message `feat(web): pick models from discovered Ollama models`.

---

## Phase 5: Setup

### Task 16: First-run checklist

**Files:**
- Create: `repoask/web/setup.js`, `tests/ui/setup.test.mjs`
- Modify: `repoask/web/ask.js` (the empty state shows the checklist when needed), `repoask/__main__.py` (`ASSETS`)

**Interfaces:**
- Consumes: `/api/workspace` (mode, github summary, profiles roles), `searchRepositories` (Task 6), discovery (Task 2), the manifest start used by Settings (Task 14). Expose `startManifest(request, {organization?})` from `settings.js` for reuse.
- Produces: `needsSetup(workspace) -> boolean` and `renderSetup(host, {request, workspace, onDone}) -> void`.
  - `needsSetup` is true when the GitHub status isn't `connected`, OR no repository has `index_enabled`, OR the `ask` role is unassigned.
  - Steps, each with a done state, in this order:
    1. `"Connect GitHub"` → `startManifest`;
    2. `"Choose repositories to search"` → a checklist of catalog repositories, then `"Index N repositories"`, which PATCHes `index_enabled: true` for each, with the hint `"You can keep going while this runs."`;
    3. `"Pick models"` → `"Found Ollama with <chat> and <embedding>. Use them?"`. "Use these" assigns `ask` and `planning` to the first chat model and `embedding` to the first embedding model, using Task 15's create-then-assign helper exported as `useDiscoveredModel(request, role, model)`. "Choose…" goes to `#/settings/models`.
  - Footer link `"Just looking? Try the sample workspace"` is shown only when the server runs in demo mode.

- [ ] **Step 1: Write failing tests**:
  - `needsSetup` truth table;
  - step 2 PATCHes the selected repositories;
  - step 3 "Use these" makes the expected calls;
  - the checklist disappears when all are done.
- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run all UI tests and confirm they pass.**
- [ ] **Step 5: Real-browser check** of the Manifest flow against GitHub with a fresh scratch data dir and a throwaway app name. Record the result, then delete the throwaway GitHub App from GitHub settings yourself; tell the user if you cannot.
- [ ] **Step 6: Commit** with message `feat(web): guide first-run setup in three steps`.

---

## Phase 6: Sessions

### Task 17: Three-pane session page

**Files:**
- Modify: `repoask/web/sessions.js` (layout and copy only; keep request logic, polling, unknown-mutation handling and redaction), `repoask/web/app.js` (rail recent = sessions on `#/sessions*`)
- Migrate: `tests/ui/session.test.mjs` selectors. Keep all 13 behavioral assertions.
- Test: add cases to `tests/ui/session.test.mjs`

**Interfaces:**
- Consumes: `createSidePanel` (Task 4), `createComposer` (Task 9; with chips hidden for sessions, using a new option `chips: false`), `el`, `badge`, `button` (Task 5).
- Produces: `createSessionPanel({host, request, panel, shell, onAvailable, pollMs})`, the same export with the new `panel` and `shell` parameters.
  - Session list in the rail: title, phase badge (running, needs your input, completed · checks failing, PR open, failed, cancelled) and elapsed time.
  - Center thread:
    - first line `"From plan vN · back to conversation"`;
    - event groups collapsed as `"Worked for <duration> · +A −D in N files"`;
    - agent questions as cards, with a button for each offered choice plus "Reply…";
    - the composer has the placeholder `"Guide the agent while it works…"`, and a persistent "Stop" button whenever the phase is active.
  - Panel tabs: `Progress`, `Diff`, `Checks`, `PR`. The PR tab shows `"Publishing isn't available yet"` plus the saved publication policy until F06 exists.
  - Lost connectivity shows `"Reconnecting… Last update <relativeTime>"` with no spinner on the phase badge.
  - When `/api/sessions` returns 404, the page shows only `"Sessions aren't available in this build."` and a link to Ask. No filters are rendered.

- [ ] **Step 1: Write failing tests**:
  - Review Focus 4: a 404 shows only the unavailable copy, with no inputs;
  - Stop is visible in `running` and `waiting_for_user`, and absent when terminal;
  - a question card choice sends a message;
  - the PR tab copy.
- [ ] **Step 2: Run** `node --test tests/ui/session.test.mjs`. Expected: the new tests fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run all UI tests.** Expected: PASS, except the 2 known `session-services.test.mjs` cases that need the session backend.
- [ ] **Step 5: Commit** with message `feat(web): lay out sessions as a three-pane page`.

### Task 18: Cleanup and acceptance

**Files:**
- Modify: `repoask/web/app.js`, `repoask/web/styles.css` (remove dead selectors not used by the legacy demo), `README.md` (GitHub setup section now says "Settings → GitHub → Connect GitHub")
- Create: `docs/agents/runs/UI-REDESIGN/acceptance.md`

- [ ] **Step 1: Remove dead code.** Run `grep -n` for every function removed in Tasks 11–15 and confirm no references remain.
- [ ] **Step 2: Run** `node --test tests/ui/*.test.mjs`, `.venv/bin/python -m unittest discover -s tests -p 'test_web_assets.py'`, and the Python files touched in Tasks 1–3. Expected: PASS (except the 2 known session-backend cases).
- [ ] **Step 3: Real-browser acceptance**, at desktop and 390px width, recorded in `acceptance.md` with screenshots:
  1. First-run checklist.
  2. Ask with picker and `@`, citation panel, adding a 5th repo mid-thread.
  3. Repositories toggles and detail panel.
  4. Settings sections and model dropdowns.
  5. Sessions unavailable state.
  6. Keyboard-only pass through the picker, the `@` menu and the panel.
  7. Legacy demo mode (no `--data-dir`) still answers.
- [ ] **Step 4: Commit** with message `chore(web): remove replaced UI code and record redesign acceptance`.
